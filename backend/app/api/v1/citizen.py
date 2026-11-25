"""Citizen-protected endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_citizen
from app.models.complaint import Complaint, ComplaintStatus
from app.models.document import ComplaintDocument
from app.models.user import User
from app.schemas.auth import CitizenDashboardSummary, UserResponse

router = APIRouter(prefix="/citizen", tags=["Citizen"])


@router.get("/dashboard", response_model=CitizenDashboardSummary)
def get_citizen_dashboard_summary(
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db),
) -> CitizenDashboardSummary:
    total_complaints = (
        db.execute(select(func.count(Complaint.id)).where(Complaint.user_id == current_user.id)).scalar()
        or 0
    )
    resolved_complaints = (
        db.execute(
            select(func.count(Complaint.id)).where(
                Complaint.user_id == current_user.id,
                Complaint.status == ComplaintStatus.RESOLVED,
            )
        ).scalar()
        or 0
    )
    open_complaints = (
        db.execute(
            select(func.count(Complaint.id)).where(
                Complaint.user_id == current_user.id,
                Complaint.status.notin_([ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED]),
            )
        ).scalar()
        or 0
    )
    documents_generated = (
        db.execute(
            select(func.count(ComplaintDocument.id))
            .join(Complaint, Complaint.id == ComplaintDocument.complaint_id)
            .where(Complaint.user_id == current_user.id)
        ).scalar()
        or 0
    )

    return CitizenDashboardSummary(
        user=UserResponse.model_validate(current_user),
        total_complaints=int(total_complaints),
        open_complaints=int(open_complaints),
        resolved_complaints=int(resolved_complaints),
        documents_generated=int(documents_generated),
        phase_notice="Phase 2 active: register complaints with GPS & photo uploads, download official ReportLab PDFs, and receive SMTP email receipts.",
    )

