"""Complaint model with PostGIS spatial point storage."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geography
from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ComplaintCategory(str, enum.Enum):
    POTHOLE = "pothole"
    ROAD_CRACK = "road_crack"
    GARBAGE = "garbage_accumulation"
    STREETLIGHT = "broken_streetlight"
    WATER_LEAKAGE = "water_leakage"
    PUBLIC_INFRASTRUCTURE = "damaged_public_infrastructure"
    MANHOLE = "open_or_damaged_manhole"


class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class PriorityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Complaint(Base):
    __tablename__ = "complaints"
    __table_args__ = (
        Index("ix_complaints_status_created", "status", "created_at"),
        Index("ix_complaints_category_created", "category", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[ComplaintCategory] = mapped_column(
        Enum(
            ComplaintCategory,
            name="complaint_category",
            values_callable=lambda obj: [item.value for item in obj],
        ),
        nullable=False,
        index=True,
    )
    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geom: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    address: Mapped[str] = mapped_column(String(320), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(
            ComplaintStatus,
            name="complaint_status",
            values_callable=lambda obj: [item.value for item in obj],
        ),
        default=ComplaintStatus.SUBMITTED,
        nullable=False,
        index=True,
    )
    priority_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    priority_level: Mapped[PriorityLevel | None] = mapped_column(
        Enum(
            PriorityLevel,
            name="priority_level",
            values_callable=lambda obj: [item.value for item in obj],
        ),
        nullable=True,
    )
    priority_explanation: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
    )

    user = relationship("User", back_populates="complaints")
    ai_analyses = relationship("AIAnalysis", back_populates="complaint", cascade="all, delete-orphan")
    documents = relationship("ComplaintDocument", back_populates="complaint", cascade="all, delete-orphan")
    history = relationship("ComplaintHistory", back_populates="complaint", cascade="all, delete-orphan")

