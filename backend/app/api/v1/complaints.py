"""Citizen complaint registration, tracking, protected PDF download, and image endpoints."""

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import get_current_user, record_audit_log, require_citizen
from app.models.ai_analysis import AIAnalysis
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.document import ComplaintDocument
from app.models.user import User, UserRole
from app.schemas.ai import AIAnalysisResponse
from app.schemas.complaint import (
    ComplaintCreateInput,
    ComplaintDetailResponse,
    ComplaintDocumentResponse,
    ComplaintHistoryResponse,
    ComplaintResponse,
)
from app.services.ai_vision.detector import analyze_infrastructure_image
from app.services.complaints import (
    build_tracking_url,
    create_complaint_with_acknowledgment,
    next_complaint_number,
)
from app.services.email.mailer import send_complaint_acknowledgment_email
from app.services.maintenance.prioritizer import compute_explainable_priority
from app.services.pdf.generator import generate_complaint_acknowledgment_pdf
from app.services.storage import resolve_storage_path, validate_and_save_complaint_image

router = APIRouter(prefix="/complaints", tags=["Complaints"])


def _to_complaint_response(complaint: Complaint) -> ComplaintResponse:
    latest_doc = (
        sorted(complaint.documents, key=lambda d: d.generated_at, reverse=True)[0]
        if complaint.documents
        else None
    )
    return ComplaintResponse(
        id=complaint.id,
        complaint_number=complaint.complaint_number,
        user_id=complaint.user_id,
        title=complaint.title,
        description=complaint.description,
        category=complaint.category,
        has_image=bool(complaint.image_path),
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        address=complaint.address,
        contact_email=complaint.contact_email,
        reported_at=complaint.reported_at,
        status=complaint.status,
        priority_score=complaint.priority_score,
        priority_level=complaint.priority_level,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        document=ComplaintDocumentResponse.model_validate(latest_doc) if latest_doc else None,
    )


def _get_authorized_complaint(
    db: Session,
    complaint_id: uuid.UUID,
    current_user: User,
) -> Complaint:
    stmt = (
        select(Complaint)
        .options(
            selectinload(Complaint.user),
            selectinload(Complaint.documents),
            selectinload(Complaint.history),
            selectinload(Complaint.ai_analyses),
        )
        .where(Complaint.id == complaint_id)
    )
    complaint = db.execute(stmt).scalar_one_or_none()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    if complaint.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this complaint or its documents.",
        )
    return complaint


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def register_complaint(
    request: Request,
    title: str = Form(...),
    description: str = Form(...),
    category: ComplaintCategory = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    address: str = Form(...),
    contact_email: str = Form(...),
    reported_at: Optional[datetime] = Form(default=None),
    photo: Optional[UploadFile] = File(default=None),
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db),
) -> ComplaintResponse:
    """Register a new citizen complaint, generate ReportLab PDF receipt, and send SMTP email."""
    try:
        validated = ComplaintCreateInput(
            title=title,
            description=description,
            category=category,
            latitude=latitude,
            longitude=longitude,
            address=address,
            contact_email=contact_email,
            reported_at=reported_at,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    year = (validated.reported_at or datetime.now(timezone.utc)).year
    complaint_number = next_complaint_number(db, year)

    image_path: str | None = None
    if photo is not None and photo.filename:
        image_path = await validate_and_save_complaint_image(photo, complaint_number)

    complaint, document = create_complaint_with_acknowledgment(
        db,
        citizen=current_user,
        data=validated,
        complaint_number=complaint_number,
        image_path=image_path,
    )

    latest_ai_row: AIAnalysis | None = None
    if image_path:
        try:
            vision = analyze_infrastructure_image(resolve_storage_path(image_path))
            if vision.status == "completed":
                latest_ai_row = AIAnalysis(
                    complaint_id=complaint.id,
                    predicted_category=vision.predicted_category or "Unclassified",
                    confidence=vision.raw_confidence or 0.0,
                    uncertainty_score=vision.uncertainty_score or 1.0,
                    calibrated_confidence=vision.calibrated_confidence,
                    requires_human_verification=vision.requires_human_verification,
                    bounding_boxes=vision.bounding_boxes,
                    is_demo_mode=vision.is_demo_mode,
                    model_version=vision.model_version,
                    processing_time=vision.processing_time,
                )
                db.add(latest_ai_row)
        except Exception:
            # Never fail citizen complaint registration if optional AI analysis errors
            pass

    try:
        all_existing = db.execute(select(Complaint)).scalars().all()
        assessment = compute_explainable_priority(
            complaint,
            all_complaints=list(all_existing),
            latest_ai=latest_ai_row,
        )
        complaint.priority_score = assessment.priority_score
        complaint.priority_level = assessment.priority_level
        complaint.priority_explanation = assessment.explanation
    except Exception:
        pass

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=current_user.id,
        action="complaint.created",
        resource_type="complaint",
        resource_id=str(complaint.id),
        details={
            "complaint_number": complaint.complaint_number,
            "category": complaint.category.value,
            "email_status": document.email_delivery_status.value,
        },
        ip_address=client_ip,
    )
    db.commit()

    # Reload with document relationship for clean response
    complaint = _get_authorized_complaint(db, complaint.id, current_user)
    return _to_complaint_response(complaint)


@router.get("", response_model=list[ComplaintResponse])
def list_my_complaints(
    status_filter: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    category: Optional[ComplaintCategory] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db),
) -> list[ComplaintResponse]:
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.documents))
        .where(Complaint.user_id == current_user.id)
        .order_by(desc(Complaint.created_at))
        .offset(offset)
        .limit(limit)
    )
    if status_filter is not None:
        stmt = stmt.where(Complaint.status == status_filter)
    if category is not None:
        stmt = stmt.where(Complaint.category == category)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Complaint.complaint_number.ilike(term),
                Complaint.title.ilike(term),
                Complaint.address.ilike(term),
            )
        )

    complaints = db.execute(stmt).scalars().all()
    return [_to_complaint_response(c) for c in complaints]


@router.get("/{complaint_id}", response_model=ComplaintDetailResponse)
def get_complaint_details(
    complaint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ComplaintDetailResponse:
    complaint = _get_authorized_complaint(db, complaint_id, current_user)
    base = _to_complaint_response(complaint)
    sorted_history = sorted(complaint.history, key=lambda h: h.created_at)
    latest_ai = (
        sorted(complaint.ai_analyses, key=lambda a: a.analyzed_at, reverse=True)[0]
        if complaint.ai_analyses
        else None
    )
    return ComplaintDetailResponse(
        **base.model_dump(),
        reporter_name=complaint.user.full_name,
        reporter_email=complaint.user.email,
        history=[ComplaintHistoryResponse.model_validate(h) for h in sorted_history],
        ai_analysis=AIAnalysisResponse.model_validate(latest_ai) if latest_ai else None,
    )


@router.get("/{complaint_id}/pdf")
def download_complaint_pdf(
    complaint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    complaint = _get_authorized_complaint(db, complaint_id, current_user)
    latest_doc = (
        sorted(complaint.documents, key=lambda d: d.generated_at, reverse=True)[0]
        if complaint.documents
        else None
    )

    if latest_doc is None:
        tracking_url = build_tracking_url(complaint.id)
        pdf_rel = generate_complaint_acknowledgment_pdf(
            complaint=complaint,
            citizen=complaint.user,
            tracking_url=tracking_url,
        )
        pdf_path = resolve_storage_path(pdf_rel)
    else:
        pdf_path = resolve_storage_path(latest_doc.pdf_path)
        if not pdf_path.is_file():
            generate_complaint_acknowledgment_pdf(
                complaint=complaint,
                citizen=complaint.user,
                tracking_url=latest_doc.tracking_url,
            )

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"{complaint.complaint_number}-acknowledgment.pdf",
    )


@router.get("/{complaint_id}/image")
def get_complaint_image(
    complaint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    complaint = _get_authorized_complaint(db, complaint_id, current_user)
    if not complaint.image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photograph uploaded for this complaint.")

    disk_path = resolve_storage_path(complaint.image_path)
    if not disk_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint photograph not found on disk.")

    media_type = "image/png" if disk_path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(path=str(disk_path), media_type=media_type)


@router.post("/{complaint_id}/resend-email", response_model=ComplaintDocumentResponse)
def resend_acknowledgment_email(
    complaint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ComplaintDocumentResponse:
    complaint = _get_authorized_complaint(db, complaint_id, current_user)
    latest_doc: ComplaintDocument | None = (
        sorted(complaint.documents, key=lambda d: d.generated_at, reverse=True)[0]
        if complaint.documents
        else None
    )

    tracking_url = build_tracking_url(complaint.id)
    if latest_doc is None:
        pdf_rel = generate_complaint_acknowledgment_pdf(
            complaint=complaint,
            citizen=complaint.user,
            tracking_url=tracking_url,
        )
        latest_doc = ComplaintDocument(
            complaint_id=complaint.id,
            pdf_path=pdf_rel,
            tracking_url=tracking_url,
            email_recipient=complaint.user.email,
        )
        db.add(latest_doc)
    else:
        pdf_path = resolve_storage_path(latest_doc.pdf_path)
        if not pdf_path.is_file():
            generate_complaint_acknowledgment_pdf(
                complaint=complaint,
                citizen=complaint.user,
                tracking_url=latest_doc.tracking_url,
            )

    result = send_complaint_acknowledgment_email(
        recipient_email=complaint.user.email,
        citizen_name=complaint.user.full_name,
        complaint_number=complaint.complaint_number,
        pdf_disk_path=resolve_storage_path(latest_doc.pdf_path),
    )
    latest_doc.email_delivery_status = result.status
    latest_doc.email_error = result.error
    latest_doc.sent_at = result.sent_at
    db.commit()
    db.refresh(latest_doc)
    return ComplaintDocumentResponse.model_validate(latest_doc)
