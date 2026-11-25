"""Complaint status transition history model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.complaint import ComplaintStatus


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ComplaintHistory(Base):
    __tablename__ = "complaint_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status: Mapped[ComplaintStatus | None] = mapped_column(
        Enum(
            ComplaintStatus,
            name="complaint_status",
            values_callable=lambda obj: [item.value for item in obj],
            create_type=False,
        ),
        nullable=True,
    )
    new_status: Mapped[ComplaintStatus] = mapped_column(
        Enum(
            ComplaintStatus,
            name="complaint_status",
            values_callable=lambda obj: [item.value for item in obj],
            create_type=False,
        ),
        nullable=False,
    )
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

    complaint = relationship("Complaint", back_populates="history")

