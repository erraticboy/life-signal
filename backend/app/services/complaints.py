"""Domain service for registering complaints, PostGIS points, PDF generation, and SMTP dispatch."""

from __future__ import annotations

from datetime import datetime, timezone

from geoalchemy2 import WKTElement
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.complaint import Complaint, ComplaintStatus
from app.models.document import ComplaintDocument
from app.models.history import ComplaintHistory
from app.models.user import User
from app.schemas.complaint import ComplaintCreateInput
from app.services.email.mailer import send_complaint_acknowledgment_email
from app.services.pdf.generator import generate_complaint_acknowledgment_pdf
from app.services.storage import resolve_storage_path


def next_complaint_number(db: Session, year: int) -> str:
    """Generate a unique sequential reference number (e.g. LS-2026-000001)."""
    dialect_name = db.bind.dialect.name if db.bind is not None else "postgresql"
    if dialect_name == "postgresql":
        seq_val = int(db.execute(text("SELECT nextval('complaint_number_seq')")).scalar_one())
    else:
        existing_count = int(db.execute(select(func.count(Complaint.id))).scalar_one() or 0)
        seq_val = existing_count + 1
    return f"LS-{year}-{seq_val:06d}"


def build_tracking_url(complaint_id: object) -> str:
    base_url = get_settings().APP_BASE_URL.rstrip("/")
    return f"{base_url}/citizen/complaints/{complaint_id}"


def create_complaint_with_acknowledgment(
    db: Session,
    *,
    citizen: User,
    data: ComplaintCreateInput,
    complaint_number: str,
    image_path: str | None,
) -> tuple[Complaint, ComplaintDocument]:
    """
    Persist Complaint + PostGIS point + History, generate ReportLab PDF,
    attempt real SMTP email to authenticated user's verified email, and retain records even if SMTP fails.
    """
    reported_at = data.reported_at or datetime.now(timezone.utc)
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)

    dialect_name = db.bind.dialect.name if db.bind is not None else "postgresql"
    geom_value: object | None = None
    if dialect_name == "postgresql":
        geom_value = WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326)
    else:
        geom_value = f"POINT({data.longitude} {data.latitude})"

    complaint = Complaint(
        complaint_number=complaint_number,
        user_id=citizen.id,
        title=data.title.strip(),
        description=data.description.strip(),
        category=data.category,
        image_path=image_path,
        latitude=data.latitude,
        longitude=data.longitude,
        geom=geom_value,
        address=data.address.strip(),
        contact_email=str(data.contact_email).strip().lower(),
        reported_at=reported_at,
        status=ComplaintStatus.SUBMITTED,
    )
    db.add(complaint)
    db.flush()

    history_entry = ComplaintHistory(
        complaint_id=complaint.id,
        previous_status=None,
        new_status=ComplaintStatus.SUBMITTED,
        changed_by=citizen.id,
        notes="Complaint registered by citizen.",
    )
    db.add(history_entry)

    tracking_url = build_tracking_url(complaint.id)
    pdf_rel_path = generate_complaint_acknowledgment_pdf(
        complaint=complaint,
        citizen=citizen,
        tracking_url=tracking_url,
    )

    # Always deliver official PDF acknowledgment to the authenticated user's registered email
    recipient_email = citizen.email
    email_result = send_complaint_acknowledgment_email(
        recipient_email=recipient_email,
        citizen_name=citizen.full_name,
        complaint_number=complaint.complaint_number,
        pdf_disk_path=resolve_storage_path(pdf_rel_path),
    )

    document = ComplaintDocument(
        complaint_id=complaint.id,
        pdf_path=pdf_rel_path,
        tracking_url=tracking_url,
        email_delivery_status=email_result.status,
        email_recipient=recipient_email,
        email_error=email_result.error,
        sent_at=email_result.sent_at,
    )
    db.add(document)
    db.commit()
    db.refresh(complaint)
    db.refresh(document)
    return complaint, document

