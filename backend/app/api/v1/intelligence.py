"""Phase 4 Admin Geospatial Map, DBSCAN Hotspots, Prioritization, Predictive Maintenance & Exports."""

import csv
from datetime import datetime
from io import BytesIO, StringIO
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import record_audit_log, require_admin
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus, PriorityLevel
from app.models.user import User
from app.schemas.intelligence import (
    GeospatialMapResponse,
    HotspotClusterSchema,
    MaintenanceAnalyticsResponse,
    MapComplaintPoint,
    MapDuplicateLinkSchema,
    PriorityOverrideRequest,
    PriorityQueueItem,
    PriorityRecomputeResponse,
)
from app.services.geospatial.hotspots import (
    compute_dbscan_hotspots,
    get_duplicate_links_for_map,
    query_filtered_complaints,
)
from app.services.maintenance.forecaster import compute_maintenance_analytics
from app.services.maintenance.prioritizer import recompute_all_priorities

router = APIRouter(prefix="/admin", tags=["Geospatial, Priority & Predictive Maintenance"])


@router.get("/geospatial/map", response_model=GeospatialMapResponse)
def get_geospatial_map_data(
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    category: Optional[ComplaintCategory] = Query(default=None),
    status_filter: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    priority_level: Optional[PriorityLevel] = Query(default=None),
    location_query: Optional[str] = Query(default=None, max_length=120),
    eps_meters: float = Query(default=250.0, ge=25.0, le=5000.0),
    min_samples: int = Query(default=2, ge=2, le=20),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GeospatialMapResponse:
    complaints = query_filtered_complaints(
        db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        status=status_filter,
        priority_level=priority_level,
        location_query=location_query,
    )
    hotspots, cluster_map = compute_dbscan_hotspots(
        complaints,
        eps_meters=eps_meters,
        min_samples=min_samples,
    )
    dup_links = get_duplicate_links_for_map(db)

    points: list[MapComplaintPoint] = []
    for c in complaints:
        latest_ai = (
            sorted(c.ai_analyses, key=lambda a: a.analyzed_at, reverse=True)[0]
            if c.ai_analyses
            else None
        )
        points.append(
            MapComplaintPoint(
                id=c.id,
                complaint_number=c.complaint_number,
                title=c.title,
                category=c.category,
                status=c.status,
                priority_score=c.priority_score,
                priority_level=c.priority_level,
                latitude=c.latitude,
                longitude=c.longitude,
                address=c.address,
                reported_at=c.reported_at,
                cluster_id=cluster_map.get(str(c.id), -1),
                ai_predicted_category=latest_ai.predicted_category if latest_ai else None,
                ai_requires_verification=latest_ai.requires_human_verification if latest_ai else None,
            )
        )

    return GeospatialMapResponse(
        total_points=len(points),
        hotspot_count=len(hotspots),
        complaints=points,
        hotspots=[
            HotspotClusterSchema(
                cluster_id=h.cluster_id,
                centroid_latitude=h.centroid_latitude,
                centroid_longitude=h.centroid_longitude,
                radius_meters=h.radius_meters,
                complaint_count=h.complaint_count,
                dominant_category=h.dominant_category,
                avg_priority_score=h.avg_priority_score,
                complaint_numbers=h.complaint_numbers,
                complaint_ids=h.complaint_ids,
            )
            for h in hotspots
        ],
        duplicate_links=[
            MapDuplicateLinkSchema(
                group_id=lnk["group_id"],
                review_status=lnk["review_status"],
                similarity_score=lnk["similarity_score"],
                from_coords=lnk["from"],
                to_coords=lnk["to"],
                primary_number=lnk["primary_number"],
                related_number=lnk["related_number"],
            )
            for lnk in dup_links
        ],
    )


@router.get("/priority/queue", response_model=list[PriorityQueueItem])
def get_priority_queue(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[PriorityQueueItem]:
    rows = (
        db.execute(
            select(Complaint).order_by(
                desc(Complaint.priority_score).nulls_last(),
                desc(Complaint.reported_at),
            )
        )
        .scalars()
        .all()
    )
    return [
        PriorityQueueItem(
            id=c.id,
            complaint_number=c.complaint_number,
            title=c.title,
            category=c.category,
            status=c.status,
            address=c.address,
            priority_score=c.priority_score,
            priority_level=c.priority_level,
            priority_explanation=c.priority_explanation,
            reported_at=c.reported_at,
        )
        for c in rows
    ]


@router.post("/priority/recompute", response_model=PriorityRecomputeResponse)
def trigger_priority_recompute(
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PriorityRecomputeResponse:
    updated = recompute_all_priorities(db)
    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.priority_recomputed",
        resource_type="complaint",
        details={"updated_count": len(updated)},
        ip_address=client_ip,
    )
    db.commit()

    queue = get_priority_queue(_admin=admin_user, db=db)
    return PriorityRecomputeResponse(updated_count=len(updated), queue=queue)


@router.patch("/complaints/{complaint_id}/priority", response_model=PriorityQueueItem)
def override_complaint_priority(
    complaint_id: uuid.UUID,
    payload: PriorityOverrideRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PriorityQueueItem:
    complaint = db.execute(select(Complaint).where(Complaint.id == complaint_id)).scalar_one_or_none()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    prev_score = complaint.priority_score
    complaint.priority_score = round(payload.priority_score, 2)
    complaint.priority_level = payload.priority_level
    complaint.priority_explanation = {
        "summary": f"Administrator set priority to {payload.priority_level.value.upper()} ({complaint.priority_score}/100).",
        "verification_caveat": None,
        "factors": [
            {
                "factor": "Administrator Review Override",
                "contribution": complaint.priority_score,
                "max_points": 100.0,
                "rationale": payload.rationale.strip(),
            }
        ],
        "overridden_by_admin": True,
    }

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.priority_overridden",
        resource_type="complaint",
        resource_id=str(complaint.id),
        details={
            "complaint_number": complaint.complaint_number,
            "previous_score": prev_score,
            "new_score": complaint.priority_score,
            "new_level": complaint.priority_level.value,
            "rationale": payload.rationale,
        },
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(complaint)
    return PriorityQueueItem(
        id=complaint.id,
        complaint_number=complaint.complaint_number,
        title=complaint.title,
        category=complaint.category,
        status=complaint.status,
        address=complaint.address,
        priority_score=complaint.priority_score,
        priority_level=complaint.priority_level,
        priority_explanation=complaint.priority_explanation,
        reported_at=complaint.reported_at,
    )


@router.get("/maintenance/analytics", response_model=MaintenanceAnalyticsResponse)
def get_maintenance_analytics(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MaintenanceAnalyticsResponse:
    res = compute_maintenance_analytics(db)
    return MaintenanceAnalyticsResponse(
        total_complaints=res.total_complaints,
        category_distribution=res.category_distribution,
        status_distribution=res.status_distribution,
        priority_distribution=res.priority_distribution,
        recurring_locations=res.recurring_locations,
        historical_weekly_series=res.historical_weekly_series,
        avg_resolution_hours=res.avg_resolution_hours,
        forecast_available=res.forecast_available,
        forecast_detail=res.forecast_detail,
        model_name=res.model_name,
        cv_mae=res.cv_mae,
        cv_rmse=res.cv_rmse,
        forecast_horizon_weeks=res.forecast_horizon_weeks,
    )


@router.get("/exports/complaints.csv")
def export_complaints_csv(
    request: Request,
    status_filter: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    category: Optional[ComplaintCategory] = Query(default=None),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    rows = query_filtered_complaints(db, category=category, status=status_filter)

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "complaint_number",
            "title",
            "category",
            "status",
            "priority_level",
            "priority_score",
            "latitude",
            "longitude",
            "address",
            "reporter_name",
            "reporter_email",
            "reported_at",
        ]
    )
    for c in rows:
        writer.writerow(
            [
                c.complaint_number,
                c.title,
                c.category.value,
                c.status.value,
                c.priority_level.value if c.priority_level else "",
                c.priority_score if c.priority_score is not None else "",
                c.latitude,
                c.longitude,
                c.address,
                c.user.full_name if c.user else "",
                c.user.email if c.user else "",
                c.reported_at.isoformat(),
            ]
        )

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.export_csv",
        resource_type="complaint",
        details={"row_count": len(rows)},
        ip_address=client_ip,
    )
    db.commit()

    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="life-signal-complaints.csv"'},
    )


@router.get("/exports/complaints.json")
def export_complaints_json(
    request: Request,
    status_filter: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    category: Optional[ComplaintCategory] = Query(default=None),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = query_filtered_complaints(db, category=category, status=status_filter)
    payload = [
        {
            "complaint_number": c.complaint_number,
            "title": c.title,
            "description": c.description,
            "category": c.category.value,
            "status": c.status.value,
            "priority_level": c.priority_level.value if c.priority_level else None,
            "priority_score": c.priority_score,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "address": c.address,
            "reporter_email": c.user.email if c.user else None,
            "reported_at": c.reported_at.isoformat(),
        }
        for c in rows
    ]

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.export_json",
        resource_type="complaint",
        details={"row_count": len(payload)},
        ip_address=client_ip,
    )
    db.commit()
    return payload


@router.get("/exports/summary.pdf")
def export_executive_summary_pdf(
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    analytics = compute_maintenance_analytics(db)
    complaints = query_filtered_complaints(db)[:30]

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("<b>LIFE SIGNAL — Municipal Infrastructure Intelligence Report</b>", styles["Title"]),
        Spacer(1, 4 * mm),
        Paragraph(
            f"Total Recorded Complaints: <b>{analytics.total_complaints}</b> | "
            f"Forecast Status: {'Active (' + (analytics.model_name or '') + ')' if analytics.forecast_available else 'Pending Sufficient History'}",
            styles["Normal"],
        ),
        Spacer(1, 5 * mm),
        Paragraph("<b>Recent Complaint Records (Top 30)</b>", styles["Heading3"]),
    ]

    table_data = [["Ref ID", "Category", "Status", "Priority", "Location"]]
    for c in complaints:
        table_data.append(
            [
                c.complaint_number,
                c.category.value.replace("_", " "),
                c.status.value.replace("_", " "),
                f"{c.priority_level.value if c.priority_level else 'unscored'} ({c.priority_score or '-'})",
                c.address[:40],
            ]
        )
    tbl = Table(table_data, colWidths=[30 * mm, 38 * mm, 26 * mm, 30 * mm, 52 * mm])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1220")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    story.append(tbl)
    doc.build(story)

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.export_summary_pdf",
        resource_type="complaint",
        details={"included_rows": len(complaints)},
        ip_address=client_ip,
    )
    db.commit()

    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="life-signal-executive-report.pdf"'},
    )

