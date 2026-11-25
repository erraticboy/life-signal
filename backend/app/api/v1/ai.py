"""Phase 3 Admin AI Vision, Uncertainty Calibration, and Duplicate Review API endpoints."""

from typing import Optional
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import record_audit_log, require_admin
from app.models.ai_analysis import AIAnalysis
from app.models.complaint import Complaint
from app.models.duplicate import DuplicateGroup, DuplicateReviewStatus
from app.models.user import User
from app.schemas.ai import (
    AIAnalysisResponse,
    AdminAIAnalysisItem,
    AdminAIVerifyRequest,
    AdminAnalyzeResponse,
    AdminBatchAnalyzeResponse,
    CalibrationSummaryResponse,
    DuplicateComplaintPreview,
    DuplicateGroupItem,
    DuplicateReviewRequest,
    DuplicateScanRequest,
    DuplicateScanResponse,
    ReliabilityBinSchema,
)
from app.services.ai_vision.detector import VisionAnalysisOutput, analyze_infrastructure_image
from app.services.duplicates.detector import scan_duplicate_candidates
from app.services.storage import resolve_storage_path
from app.services.uncertainty.ece import compute_calibration_metrics

router = APIRouter(prefix="/admin", tags=["AI & Duplicate Intelligence"])


def _persist_analysis_record(
    db: Session,
    complaint: Complaint,
    output: VisionAnalysisOutput,
) -> AIAnalysis:
    record = AIAnalysis(
        complaint_id=complaint.id,
        predicted_category=output.predicted_category or "Unclassified",
        confidence=output.raw_confidence or 0.0,
        uncertainty_score=output.uncertainty_score or 1.0,
        calibrated_confidence=output.calibrated_confidence,
        requires_human_verification=output.requires_human_verification,
        bounding_boxes=output.bounding_boxes,
        is_demo_mode=output.is_demo_mode,
        model_version=output.model_version,
        processing_time=output.processing_time,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _to_admin_ai_item(analysis: AIAnalysis, complaint: Complaint) -> AdminAIAnalysisItem:
    return AdminAIAnalysisItem(
        id=analysis.id,
        complaint_id=analysis.complaint_id,
        predicted_category=analysis.predicted_category,
        confidence=analysis.confidence,
        uncertainty_score=analysis.uncertainty_score,
        calibrated_confidence=analysis.calibrated_confidence,
        requires_human_verification=analysis.requires_human_verification,
        bounding_boxes=analysis.bounding_boxes,
        is_demo_mode=analysis.is_demo_mode,
        model_version=analysis.model_version,
        processing_time=analysis.processing_time,
        analyzed_at=analysis.analyzed_at,
        complaint_number=complaint.complaint_number,
        complaint_title=complaint.title,
        citizen_category=complaint.category.value,
        has_image=bool(complaint.image_path),
    )


def _to_duplicate_item(group: DuplicateGroup, complaints_by_id: dict[uuid.UUID, Complaint]) -> DuplicateGroupItem:
    c1 = complaints_by_id[group.primary_complaint_id]
    c2 = complaints_by_id[group.related_complaint_id]
    return DuplicateGroupItem(
        id=group.id,
        similarity_score=group.similarity_score,
        image_similarity=group.image_similarity,
        text_similarity=group.text_similarity,
        distance_meters=group.distance_meters,
        time_diff_hours=group.time_diff_hours,
        review_status=group.review_status,
        reviewed_by=group.reviewed_by,
        reviewed_at=group.reviewed_at,
        created_at=group.created_at,
        primary_complaint=DuplicateComplaintPreview(
            id=c1.id,
            complaint_number=c1.complaint_number,
            title=c1.title,
            category=c1.category.value,
            address=c1.address,
            latitude=c1.latitude,
            longitude=c1.longitude,
            status=c1.status.value,
            has_image=bool(c1.image_path),
            created_at=c1.created_at,
        ),
        related_complaint=DuplicateComplaintPreview(
            id=c2.id,
            complaint_number=c2.complaint_number,
            title=c2.title,
            category=c2.category.value,
            address=c2.address,
            latitude=c2.latitude,
            longitude=c2.longitude,
            status=c2.status.value,
            has_image=bool(c2.image_path),
            created_at=c2.created_at,
        ),
    )


@router.get("/ai/analyses", response_model=list[AdminAIAnalysisItem])
def list_ai_analyses(
    needs_verification: Optional[bool] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminAIAnalysisItem]:
    stmt = (
        select(AIAnalysis)
        .options(selectinload(AIAnalysis.complaint))
        .order_by(desc(AIAnalysis.analyzed_at))
        .limit(limit)
    )
    if needs_verification is not None:
        stmt = stmt.where(AIAnalysis.requires_human_verification.is_(needs_verification))

    rows = db.execute(stmt).scalars().all()
    return [_to_admin_ai_item(r, r.complaint) for r in rows if r.complaint is not None]


@router.post("/ai/analyze/{complaint_id}", response_model=AdminAnalyzeResponse)
def analyze_single_complaint(
    complaint_id: uuid.UUID,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminAnalyzeResponse:
    complaint = db.execute(select(Complaint).where(Complaint.id == complaint_id)).scalar_one_or_none()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")
    if not complaint.image_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot run Computer Vision analysis: complaint has no uploaded photograph.",
        )

    disk_path = resolve_storage_path(complaint.image_path)
    if not disk_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint photograph missing on disk.")

    output = analyze_infrastructure_image(disk_path)
    if output.status == "model_unavailable":
        return AdminAnalyzeResponse(status="model_unavailable", detail=output.detail, analysis=None)

    record = _persist_analysis_record(db, complaint, output)
    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.ai_analyzed_complaint",
        resource_type="ai_analysis",
        resource_id=str(record.id),
        details={
            "complaint_number": complaint.complaint_number,
            "predicted_category": record.predicted_category,
            "is_demo_mode": record.is_demo_mode,
        },
        ip_address=client_ip,
    )
    db.commit()

    return AdminAnalyzeResponse(
        status="completed",
        detail=output.detail,
        analysis=AIAnalysisResponse.model_validate(record),
    )


@router.post("/ai/analyze-pending", response_model=AdminBatchAnalyzeResponse)
def analyze_pending_complaints(
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminBatchAnalyzeResponse:
    complaints = (
        db.execute(
            select(Complaint)
            .options(selectinload(Complaint.ai_analyses))
            .where(Complaint.image_path.is_not(None))
            .order_by(desc(Complaint.created_at))
        )
        .scalars()
        .all()
    )

    pending = [c for c in complaints if len(c.ai_analyses) == 0]
    created_items: list[AdminAIAnalysisItem] = []
    skipped_unavail = 0

    for comp in pending:
        if not comp.image_path:
            continue
        disk_path = resolve_storage_path(comp.image_path)
        if not disk_path.is_file():
            continue
        output = analyze_infrastructure_image(disk_path)
        if output.status == "model_unavailable":
            skipped_unavail += 1
            continue
        rec = _persist_analysis_record(db, comp, output)
        created_items.append(_to_admin_ai_item(rec, comp))

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.ai_batch_analyzed",
        resource_type="ai_analysis",
        details={"processed": len(created_items), "skipped_unavailable": skipped_unavail},
        ip_address=client_ip,
    )
    db.commit()

    return AdminBatchAnalyzeResponse(
        processed_count=len(created_items),
        skipped_model_unavailable=skipped_unavail,
        analyses=created_items,
    )


@router.patch("/ai/analyses/{analysis_id}/verify", response_model=AdminAIAnalysisItem)
def verify_ai_prediction(
    analysis_id: uuid.UUID,
    payload: AdminAIVerifyRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminAIAnalysisItem:
    analysis = db.execute(
        select(AIAnalysis)
        .options(selectinload(AIAnalysis.complaint))
        .where(AIAnalysis.id == analysis_id)
    ).scalar_one_or_none()
    if analysis is None or analysis.complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI analysis record not found.")

    previous_pred = analysis.predicted_category
    analysis.predicted_category = payload.verified_category.strip()
    analysis.requires_human_verification = False

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.ai_prediction_verified",
        resource_type="ai_analysis",
        resource_id=str(analysis.id),
        details={
            "complaint_number": analysis.complaint.complaint_number,
            "previous_prediction": previous_pred,
            "verified_category": analysis.predicted_category,
            "notes": payload.notes,
        },
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(analysis)
    return _to_admin_ai_item(analysis, analysis.complaint)


@router.get("/ai/calibration-summary", response_model=CalibrationSummaryResponse)
def get_calibration_summary(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CalibrationSummaryResponse:
    """
    Compute real Expected Calibration Error (ECE) over verified human-reviewed AI predictions.
    """
    verified_rows = (
        db.execute(
            select(AIAnalysis)
            .options(selectinload(AIAnalysis.complaint))
            .where(AIAnalysis.requires_human_verification.is_(False))
        )
        .scalars()
        .all()
    )
    eligible = [r for r in verified_rows if r.complaint is not None]
    if len(eligible) < 3:
        return CalibrationSummaryResponse(
            available=False,
            sample_count=len(eligible),
            detail=(
                "At least 3 human-verified AI predictions are required to compute empirical Expected Calibration Error (ECE). "
                "Verify predictions on this page or run ml_research/evaluate_uncertainty.py for offline validation benchmarks."
            ),
        )

    confidences: list[float] = []
    correct_flags: list[int] = []
    for row in eligible:
        conf = float(row.calibrated_confidence if row.calibrated_confidence is not None else row.confidence)
        pred_norm = row.predicted_category.strip().lower().replace("_", " ")
        actual_norm = row.complaint.category.value.strip().lower().replace("_", " ")
        # Match road damage categories consistently
        is_match = int(
            pred_norm == actual_norm
            or ("crack" in pred_norm and "crack" in actual_norm)
            or ("pothole" in pred_norm and "pothole" in actual_norm)
        )
        confidences.append(conf)
        correct_flags.append(is_match)

    report = compute_calibration_metrics(confidences, correct_flags, n_bins=10)
    return CalibrationSummaryResponse(
        available=True,
        detail="Empirical Expected Calibration Error computed over human-verified predictions.",
        ece=report.ece,
        mce=report.mce,
        brier_score=report.brier_score,
        sample_count=report.sample_count,
        bins=[
            ReliabilityBinSchema(
                bin_index=b.bin_index,
                bin_lower=b.bin_lower,
                bin_upper=b.bin_upper,
                count=b.count,
                avg_confidence=b.avg_confidence,
                accuracy=b.accuracy,
                gap=b.gap,
            )
            for b in report.bins
        ],
    )


@router.get("/duplicates", response_model=list[DuplicateGroupItem])
def list_duplicate_groups(
    review_status: Optional[DuplicateReviewStatus] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[DuplicateGroupItem]:
    stmt = select(DuplicateGroup).order_by(desc(DuplicateGroup.similarity_score)).limit(limit)
    if review_status is not None:
        stmt = stmt.where(DuplicateGroup.review_status == review_status)
    groups = db.execute(stmt).scalars().all()
    if not groups:
        return []

    ids = {g.primary_complaint_id for g in groups} | {g.related_complaint_id for g in groups}
    complaints = db.execute(select(Complaint).where(Complaint.id.in_(ids))).scalars().all()
    by_id = {c.id: c for c in complaints}
    return [
        _to_duplicate_item(g, by_id)
        for g in groups
        if g.primary_complaint_id in by_id and g.related_complaint_id in by_id
    ]


@router.post("/duplicates/scan", response_model=DuplicateScanResponse)
def run_duplicate_scan(
    request: Request,
    payload: Optional[DuplicateScanRequest] = Body(default=None),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DuplicateScanResponse:
    threshold = payload.threshold if payload else None
    groups, backends = scan_duplicate_candidates(db, threshold=threshold)

    ids = {g.primary_complaint_id for g in groups} | {g.related_complaint_id for g in groups}
    complaints = (
        db.execute(select(Complaint).where(Complaint.id.in_(ids))).scalars().all() if ids else []
    )
    by_id = {c.id: c for c in complaints}

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.duplicate_scan_completed",
        resource_type="duplicate_group",
        details={"candidates_found": len(groups), **backends},
        ip_address=client_ip,
    )
    db.commit()

    return DuplicateScanResponse(
        candidates_found=len(groups),
        text_backend=backends["text_backend"],
        image_backend=backends["image_backend"],
        groups=[
            _to_duplicate_item(g, by_id)
            for g in groups
            if g.primary_complaint_id in by_id and g.related_complaint_id in by_id
        ],
    )


@router.patch("/duplicates/{group_id}", response_model=DuplicateGroupItem)
def review_duplicate_group(
    group_id: uuid.UUID,
    payload: DuplicateReviewRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DuplicateGroupItem:
    from datetime import datetime, timezone

    group = db.execute(select(DuplicateGroup).where(DuplicateGroup.id == group_id)).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Duplicate group not found.")

    previous = group.review_status
    group.review_status = payload.review_status
    group.reviewed_by = admin_user.id
    group.reviewed_at = datetime.now(timezone.utc)

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.duplicate_reviewed",
        resource_type="duplicate_group",
        resource_id=str(group.id),
        details={"previous_status": previous.value, "new_status": payload.review_status.value},
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(group)

    complaints = (
        db.execute(
            select(Complaint).where(
                Complaint.id.in_([group.primary_complaint_id, group.related_complaint_id])
            )
        )
        .scalars()
        .all()
    )
    by_id = {c.id: c for c in complaints}
    return _to_duplicate_item(group, by_id)

