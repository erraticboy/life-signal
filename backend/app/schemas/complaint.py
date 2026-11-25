"""Pydantic v2 schemas for Phase 2 complaint registration, documents, and status tracking."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.complaint import ComplaintCategory, ComplaintStatus, PriorityLevel
from app.models.document import EmailDeliveryStatus
from app.schemas.ai import AIAnalysisResponse

CATEGORY_LABELS: dict[ComplaintCategory, str] = {
    ComplaintCategory.POTHOLE: "Road Pothole",
    ComplaintCategory.ROAD_CRACK: "Road Crack",
    ComplaintCategory.GARBAGE: "Garbage Accumulation",
    ComplaintCategory.STREETLIGHT: "Broken Streetlight",
    ComplaintCategory.WATER_LEAKAGE: "Water Leakage",
    ComplaintCategory.PUBLIC_INFRASTRUCTURE: "Damaged Public Infrastructure",
    ComplaintCategory.MANHOLE: "Open or Damaged Manhole",
}


class ComplaintDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    complaint_id: uuid.UUID
    tracking_url: str
    email_delivery_status: EmailDeliveryStatus
    email_recipient: str
    email_error: str | None
    generated_at: datetime
    sent_at: datetime | None


class ComplaintHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    previous_status: ComplaintStatus | None
    new_status: ComplaintStatus
    changed_by: uuid.UUID | None
    notes: str | None
    created_at: datetime


class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    complaint_number: str
    user_id: uuid.UUID
    title: str
    description: str
    category: ComplaintCategory
    has_image: bool
    latitude: float
    longitude: float
    address: str
    contact_email: str
    reported_at: datetime
    status: ComplaintStatus
    priority_score: float | None
    priority_level: PriorityLevel | None
    created_at: datetime
    updated_at: datetime
    document: ComplaintDocumentResponse | None = None


class ComplaintDetailResponse(ComplaintResponse):
    reporter_name: str
    reporter_email: str
    history: list[ComplaintHistoryResponse] = Field(default_factory=list)
    ai_analysis: AIAnalysisResponse | None = None


class AdminComplaintListItem(ComplaintResponse):
    reporter_name: str
    reporter_email: str


class AdminComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    notes: str | None = Field(default=None, max_length=1000)


class ComplaintCreateInput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=4000)
    category: ComplaintCategory
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    address: str = Field(min_length=3, max_length=320)
    contact_email: EmailStr
    reported_at: datetime | None = None

