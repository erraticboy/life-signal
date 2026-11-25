"""Pydantic v2 schemas for Phase 4 Geospatial, Hotspots, Prioritization, Maintenance, and Exports."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.complaint import ComplaintCategory, ComplaintStatus, PriorityLevel


class MapComplaintPoint(BaseModel):
    id: uuid.UUID
    complaint_number: str
    title: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority_score: float | None
    priority_level: PriorityLevel | None
    latitude: float
    longitude: float
    address: str
    reported_at: datetime
    cluster_id: int
    ai_predicted_category: str | None = None
    ai_requires_verification: bool | None = None


class HotspotClusterSchema(BaseModel):
    cluster_id: int
    centroid_latitude: float
    centroid_longitude: float
    radius_meters: float
    complaint_count: int
    dominant_category: str
    avg_priority_score: float | None
    complaint_numbers: list[str]
    complaint_ids: list[str]


class MapDuplicateLinkSchema(BaseModel):
    group_id: str
    review_status: str
    similarity_score: float
    from_coords: list[float]
    to_coords: list[float]
    primary_number: str
    related_number: str


class GeospatialMapResponse(BaseModel):
    total_points: int
    hotspot_count: int
    complaints: list[MapComplaintPoint]
    hotspots: list[HotspotClusterSchema]
    duplicate_links: list[MapDuplicateLinkSchema]


class PriorityQueueItem(BaseModel):
    id: uuid.UUID
    complaint_number: str
    title: str
    category: ComplaintCategory
    status: ComplaintStatus
    address: str
    priority_score: float | None
    priority_level: PriorityLevel | None
    priority_explanation: dict[str, Any] | None
    reported_at: datetime


class PriorityOverrideRequest(BaseModel):
    priority_score: float = Field(ge=0.0, le=100.0)
    priority_level: PriorityLevel
    rationale: str = Field(min_length=5, max_length=500)


class PriorityRecomputeResponse(BaseModel):
    updated_count: int
    queue: list[PriorityQueueItem]


class MaintenanceAnalyticsResponse(BaseModel):
    total_complaints: int
    category_distribution: list[dict[str, Any]]
    status_distribution: list[dict[str, Any]]
    priority_distribution: list[dict[str, Any]]
    recurring_locations: list[dict[str, Any]]
    historical_weekly_series: list[dict[str, Any]]
    avg_resolution_hours: float | None
    forecast_available: bool
    forecast_detail: str
    model_name: str | None
    cv_mae: float | None
    cv_rmse: float | None
    forecast_horizon_weeks: list[dict[str, Any]]

