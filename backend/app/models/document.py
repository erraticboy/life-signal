"""Generated PDF documents and email notification delivery records."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EmailDeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    NOT_CONFIGURED = "not_configured"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ComplaintDocument(Base):
    __tablename__ = "complaint_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pdf_path: Mapped[str] = mapped_column(String(512), nullable=False)
    tracking_url: Mapped[str] = mapped_column(String(512), nullable=False)
    email_delivery_status: Mapped[EmailDeliveryStatus] = mapped_column(
        Enum(
            EmailDeliveryStatus,
            name="email_delivery_status",
            values_callable=lambda obj: [item.value for item in obj],
        ),
        default=EmailDeliveryStatus.PENDING,
        nullable=False,
    )
    email_recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    email_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    complaint = relationship("Complaint", back_populates="documents")

