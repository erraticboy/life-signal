"""Pydantic v2 schemas for Phase 3 AI Vision, Uncertainty Calibration, and Duplicate Detection."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.duplicate import DuplicateReviewStatus


class AIAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    complaint_id: uuid.UUID
    predicted_category: str
    confidence: float
    uncertainty_score: float
    calibrated_confidence: float | None
    requires_human_verification: bool
    bounding_boxes: list[dict[str, Any]] | None
    is_demo_mode: bool
    model_version: str
    processing_time: float
    analyzed_at: datetime


class AdminAIAnalysisItem(AIAnalysisResponse):
    complaint_number: str
    complaint_title: str
    citizen_category: str
    has_image: bool


class AdminAnalyzeResponse(BaseModel):
    status: str
    detail: str
    analysis: AIAnalysisResponse | None = None


class AdminBatchAnalyzeResponse(BaseModel):
    processed_count: int
    skipped_model_unavailable: int
    analyses: list[AdminAIAnalysisItem]


class AdminAIVerifyRequest(BaseModel):
    verified_category: str = Field(min_length=2, max_length=100)
    notes: str | None = Field(default=None, max_length=500)


class ReliabilityBinSchema(BaseModel):
    bin_index: int
    bin_lower: float
    bin_upper: float
    count: int
    avg_confidence: float
    accuracy: float
    gap: float


class CalibrationSummaryResponse(BaseModel):
    available: bool
    detail: str
    ece: float | None = None
    mce: float | None = None
    brier_score: float | None = None
    sample_count: int = 0
    bins: list[ReliabilityBinSchema] = Field(default_factory=list)


class DuplicateComplaintPreview(BaseModel):
    id: uuid.UUID
    complaint_number: str
    title: str
    category: str
    address: str
    latitude: float
    longitude: float
    status: str
    has_image: bool
    created_at: datetime


class DuplicateGroupItem(BaseModel):
    id: uuid.UUID
    similarity_score: float
    image_similarity: float | None
    text_similarity: float | None
    distance_meters: float | None
    time_diff_hours: float | None
    review_status: DuplicateReviewStatus
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    primary_complaint: DuplicateComplaintPreview
    related_complaint: DuplicateComplaintPreview


class DuplicateScanRequest(BaseModel):
    threshold: float | None = Field(default=None, ge=0.1, le=0.99)


class DuplicateScanResponse(BaseModel):
    candidates_found: int
    text_backend: str
    image_backend: str
    groups: list[DuplicateGroupItem]


class DuplicateReviewRequest(BaseModel):
    review_status: DuplicateReviewStatus

