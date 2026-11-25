"""Multimodal duplicate candidate group model."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Enum, Float, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DuplicateReviewStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED_DUPLICATE = "confirmed_duplicate"
    DISMISSED = "dismissed"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DuplicateGroup(Base):
    __tablename__ = "duplicate_groups"
    __table_args__ = (
        CheckConstraint("primary_complaint_id <> related_complaint_id", name="ck_duplicate_distinct_complaints"),
        UniqueConstraint("primary_complaint_id", "related_complaint_id", name="uq_duplicate_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    primary_complaint_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    related_complaint_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    image_similarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    text_similarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    time_diff_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_status: Mapped[DuplicateReviewStatus] = mapped_column(
        Enum(
            DuplicateReviewStatus,
            name="duplicate_review_status",
            values_callable=lambda obj: [item.value for item in obj],
        ),
        default=DuplicateReviewStatus.PENDING,
        nullable=False,
        index=True,
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)

