"""Administrator-protected endpoints with strict RBAC and audit logging."""

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import record_audit_log, require_admin
from app.models.audit import AuditLog
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.history import ComplaintHistory
from app.models.user import User, UserRole
from app.schemas.auth import AdminOverviewResponse, AdminRoleUpdateRequest, UserResponse
from app.schemas.complaint import (
    AdminComplaintListItem,
    AdminComplaintStatusUpdate,
    ComplaintDocumentResponse,
    ComplaintResponse,
)
from app.services.email.mailer import send_complaint_status_update_email

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminOverviewResponse:
    total_users = db.execute(select(func.count(User.id))).scalar() or 0
    total_admins = db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN)).scalar() or 0
    total_citizens = db.execute(select(func.count(User.id)).where(User.role == UserRole.CITIZEN)).scalar() or 0
    total_complaints = db.execute(select(func.count(Complaint.id))).scalar() or 0

    recent_logs = db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(10)).scalars().all()
    events = [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in recent_logs
    ]

    return AdminOverviewResponse(
        total_users=int(total_users),
        total_admins=int(total_admins),
        total_citizens=int(total_citizens),
        total_complaints=int(total_complaints),
        recent_audit_events=events,
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    role: Optional[UserRole] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    stmt = select(User).order_by(desc(User.created_at)).offset(offset).limit(limit)
    if role is not None:
        stmt = stmt.where(User.role == role)
    users = db.execute(stmt).scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: uuid.UUID,
    payload: AdminRoleUpdateRequest,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserResponse:
    target = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    settings = get_settings()
    if (
        settings.normalized_sole_admin_email
        and payload.role == UserRole.ADMIN
        and target.email.lower() != settings.normalized_sole_admin_email
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Single-admin startup policy is enabled: other accounts cannot be promoted to administrator.",
        )

    # Guard against removing the last active administrator
    removing_admin_access = (
        target.role == UserRole.ADMIN
        and (payload.role != UserRole.ADMIN or payload.is_active is False)
    )
    if removing_admin_access:
        active_admin_count = (
            db.execute(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN,
                    User.is_active.is_(True),
                )
            ).scalar()
            or 0
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote or deactivate the sole active administrator.",
            )

    prev_role = target.role.value
    prev_active = target.is_active
    target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.user_role_updated",
        resource_type="user",
        resource_id=str(target.id),
        details={
            "target_email": target.email,
            "previous_role": prev_role,
            "new_role": target.role.value,
            "previous_active": prev_active,
            "new_active": target.is_active,
        },
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(target)
    return UserResponse.model_validate(target)


@router.get("/complaints", response_model=list[AdminComplaintListItem])
def list_all_complaints(
    status_filter: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    category: Optional[ComplaintCategory] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminComplaintListItem]:
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.user), selectinload(Complaint.documents))
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
    results: list[AdminComplaintListItem] = []
    for c in complaints:
        latest_doc = (
            sorted(c.documents, key=lambda d: d.generated_at, reverse=True)[0]
            if c.documents
            else None
        )
        results.append(
            AdminComplaintListItem(
                id=c.id,
                complaint_number=c.complaint_number,
                user_id=c.user_id,
                title=c.title,
                description=c.description,
                category=c.category,
                has_image=bool(c.image_path),
                latitude=c.latitude,
                longitude=c.longitude,
                address=c.address,
                contact_email=c.contact_email,
                reported_at=c.reported_at,
                status=c.status,
                priority_score=c.priority_score,
                priority_level=c.priority_level,
                created_at=c.created_at,
                updated_at=c.updated_at,
                document=ComplaintDocumentResponse.model_validate(latest_doc) if latest_doc else None,
                reporter_name=c.user.full_name,
                reporter_email=c.user.email,
            )
        )
    return results


@router.patch("/complaints/{complaint_id}/status", response_model=ComplaintResponse)
def update_complaint_status(
    complaint_id: uuid.UUID,
    payload: AdminComplaintStatusUpdate,
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ComplaintResponse:
    complaint = db.execute(
        select(Complaint)
        .options(selectinload(Complaint.user), selectinload(Complaint.documents))
        .where(Complaint.id == complaint_id)
    ).scalar_one_or_none()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    previous_status = complaint.status
    complaint.status = payload.status

    db.add(
        ComplaintHistory(
            complaint_id=complaint.id,
            previous_status=previous_status,
            new_status=payload.status,
            changed_by=admin_user.id,
            notes=payload.notes.strip() if payload.notes else None,
        )
    )

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=admin_user.id,
        action="admin.complaint_status_updated",
        resource_type="complaint",
        resource_id=str(complaint.id),
        details={
            "complaint_number": complaint.complaint_number,
            "previous_status": previous_status.value,
            "new_status": payload.status.value,
            "notes": payload.notes,
        },
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(complaint)

    # Attempt notification email on status change (never fails the DB update if SMTP is unconfigured)
    send_complaint_status_update_email(
        recipient_email=complaint.user.email,
        citizen_name=complaint.user.full_name,
        complaint_number=complaint.complaint_number,
        new_status=payload.status.value,
        notes=payload.notes,
    )

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

