"""PostGIS spatial helpers and DBSCAN hotspot clustering."""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.cluster import DBSCAN
from sqlalchemy import and_, desc, select, text
from sqlalchemy.orm import Session, selectinload

from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus, PriorityLevel
from app.models.duplicate import DuplicateGroup, DuplicateReviewStatus
from app.services.duplicates.detector import haversine_meters

EARTH_RADIUS_METERS = 6371000.0


@dataclass(frozen=True)
class HotspotCluster:
    cluster_id: int
    centroid_latitude: float
    centroid_longitude: float
    radius_meters: float
    complaint_count: int
    dominant_category: str
    avg_priority_score: float | None
    complaint_numbers: list[str]
    complaint_ids: list[str]


def query_filtered_complaints(
    db: Session,
    *,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    category: ComplaintCategory | None = None,
    status: ComplaintStatus | None = None,
    priority_level: PriorityLevel | None = None,
    location_query: str | None = None,
) -> list[Complaint]:
    """Query complaints with optional temporal, categorical, priority, and location filters."""
    stmt = (
        select(Complaint)
        .options(selectinload(Complaint.user), selectinload(Complaint.ai_analyses))
        .order_by(desc(Complaint.created_at))
    )
    conditions = []
    if start_date is not None:
        conditions.append(Complaint.reported_at >= start_date)
    if end_date is not None:
        conditions.append(Complaint.reported_at <= end_date)
    if category is not None:
        conditions.append(Complaint.category == category)
    if status is not None:
        conditions.append(Complaint.status == status)
    if priority_level is not None:
        conditions.append(Complaint.priority_level == priority_level)
    if location_query and location_query.strip():
        conditions.append(Complaint.address.ilike(f"%{location_query.strip()}%"))

    if conditions:
        stmt = stmt.where(and_(*conditions))
    return list(db.execute(stmt).scalars().all())


def find_nearby_complaints_count(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    radius_meters: float = 150.0,
    exclude_id: Any | None = None,
) -> int:
    """
    Use PostGIS ST_DWithin on Geography(POINT, 4326) when running on PostgreSQL;
    fall back to exact Haversine distance in SQLite unit tests.
    """
    dialect_name = db.bind.dialect.name if db.bind is not None else "postgresql"
    if dialect_name == "postgresql":
        sql = """
            SELECT COUNT(*) FROM complaints
            WHERE geom IS NOT NULL
              AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius)
        """
        params: dict[str, Any] = {"lon": longitude, "lat": latitude, "radius": radius_meters}
        if exclude_id is not None:
            sql += " AND id <> :exclude_id"
            params["exclude_id"] = exclude_id
        return int(db.execute(text(sql), params).scalar_one() or 0)

    all_rows = db.execute(select(Complaint)).scalars().all()
    count = 0
    for row in all_rows:
        if exclude_id is not None and row.id == exclude_id:
            continue
        if haversine_meters(latitude, longitude, row.latitude, row.longitude) <= radius_meters:
            count += 1
    return count


def compute_dbscan_hotspots(
    complaints: list[Complaint],
    *,
    eps_meters: float = 250.0,
    min_samples: int = 2,
) -> tuple[list[HotspotCluster], dict[str, int]]:
    """
    Identify geographic infrastructure hotspots using DBSCAN with exact Haversine
    distance over radians. Returns cluster summaries and complaint_id -> cluster_id mapping.
    """
    if not complaints:
        return [], {}

    coords_deg = np.array([[c.latitude, c.longitude] for c in complaints], dtype=np.float64)
    coords_rad = np.radians(coords_deg)
    eps_rad = max(eps_meters, 10.0) / EARTH_RADIUS_METERS

    labels = DBSCAN(eps=eps_rad, min_samples=max(2, min_samples), metric="haversine", algorithm="ball_tree").fit_predict(
        coords_rad
    )

    cluster_map: dict[str, int] = {}
    grouped: dict[int, list[Complaint]] = {}
    for complaint, label in zip(complaints, labels):
        lbl = int(label)
        cluster_map[str(complaint.id)] = lbl
        if lbl >= 0:
            grouped.setdefault(lbl, []).append(complaint)

    hotspots: list[HotspotCluster] = []
    for cid, members in sorted(grouped.items(), key=lambda kv: len(kv[1]), reverse=True):
        c_lat = float(np.mean([m.latitude for m in members]))
        c_lon = float(np.mean([m.longitude for m in members]))
        max_dist = max(
            [haversine_meters(c_lat, c_lon, m.latitude, m.longitude) for m in members] or [0.0]
        )
        # Ensure visible radius on map even when coordinates nearly overlap
        display_radius = max(round(max_dist + 40.0, 1), 60.0)

        cat_counts = Counter(m.category.value for m in members)
        dominant_cat = cat_counts.most_common(1)[0][0]
        scores = [m.priority_score for m in members if m.priority_score is not None]
        avg_score = round(float(np.mean(scores)), 2) if scores else None

        hotspots.append(
            HotspotCluster(
                cluster_id=cid,
                centroid_latitude=round(c_lat, 6),
                centroid_longitude=round(c_lon, 6),
                radius_meters=display_radius,
                complaint_count=len(members),
                dominant_category=dominant_cat,
                avg_priority_score=avg_score,
                complaint_numbers=[m.complaint_number for m in members],
                complaint_ids=[str(m.id) for m in members],
            )
        )

    return hotspots, cluster_map


def get_duplicate_links_for_map(db: Session) -> list[dict[str, Any]]:
    """Fetch pending/confirmed duplicate pairs for map polyline rendering."""
    groups = (
        db.execute(
            select(DuplicateGroup).where(
                DuplicateGroup.review_status.in_(
                    [DuplicateReviewStatus.PENDING, DuplicateReviewStatus.CONFIRMED_DUPLICATE]
                )
            )
        )
        .scalars()
        .all()
    )
    if not groups:
        return []

    ids = {g.primary_complaint_id for g in groups} | {g.related_complaint_id for g in groups}
    complaints = db.execute(select(Complaint).where(Complaint.id.in_(ids))).scalars().all()
    by_id = {c.id: c for c in complaints}

    links: list[dict[str, Any]] = []
    for g in groups:
        c1 = by_id.get(g.primary_complaint_id)
        c2 = by_id.get(g.related_complaint_id)
        if not c1 or not c2:
            continue
        links.append(
            {
                "group_id": str(g.id),
                "review_status": g.review_status.value,
                "similarity_score": g.similarity_score,
                "from": [c1.latitude, c1.longitude],
                "to": [c2.latitude, c2.longitude],
                "primary_number": c1.complaint_number,
                "related_number": c2.complaint_number,
            }
        )
    return links

