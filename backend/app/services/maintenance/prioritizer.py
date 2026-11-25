"""Explainable maintenance prioritization engine."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_analysis import AIAnalysis
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus, PriorityLevel
from app.services.duplicates.detector import haversine_meters

# Intrinsic safety & structural hazard severity weights (0-42 pts)
CATEGORY_HAZARD_WEIGHTS: dict[ComplaintCategory, float] = {
    ComplaintCategory.MANHOLE: 42.0,
    ComplaintCategory.WATER_LEAKAGE: 32.0,
    ComplaintCategory.STREETLIGHT: 27.0,
    ComplaintCategory.POTHOLE: 25.0,
    ComplaintCategory.PUBLIC_INFRASTRUCTURE: 22.0,
    ComplaintCategory.ROAD_CRACK: 16.0,
    ComplaintCategory.GARBAGE: 14.0,
}

HIGH_IMPORTANCE_KEYWORDS: tuple[str, ...] = (
    "highway",
    "hospital",
    "school",
    "college",
    "university",
    "junction",
    "intersection",
    "bridge",
    "station",
    "metro",
    "main road",
    "bus",
    "market",
)


@dataclass(frozen=True)
class PriorityAssessment:
    priority_score: float
    priority_level: PriorityLevel
    explanation: dict[str, Any]


def classify_priority_level(score: float) -> PriorityLevel:
    if score >= 75.0:
        return PriorityLevel.CRITICAL
    if score >= 55.0:
        return PriorityLevel.HIGH
    if score >= 35.0:
        return PriorityLevel.MEDIUM
    return PriorityLevel.LOW


def compute_explainable_priority(
    complaint: Complaint,
    *,
    all_complaints: list[Complaint],
    latest_ai: AIAnalysis | None,
    road_importance_override: str | None = None,
) -> PriorityAssessment:
    """
    Compute an explainable priority score (0-100) balancing physical danger,
    verification state, road/location importance, bounded independent corroboration,
    historical recurrence, and AI reliability.
    """
    if complaint.status in {ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED}:
        score = 5.0 if complaint.status == ComplaintStatus.RESOLVED else 0.0
        return PriorityAssessment(
            priority_score=score,
            priority_level=PriorityLevel.LOW,
            explanation={
                "summary": f"Complaint is closed ({complaint.status.value}); maintenance priority reduced.",
                "verification_caveat": None,
                "factors": [
                    {
                        "factor": "Workflow Closure",
                        "contribution": score,
                        "max_points": 100.0,
                        "rationale": f"Status is currently {complaint.status.value}.",
                    }
                ],
                "overridden_by_admin": False,
            },
        )

    factors: list[dict[str, Any]] = []

    # 1. Intrinsic hazard severity (0-42)
    hazard_pts = CATEGORY_HAZARD_WEIGHTS.get(complaint.category, 18.0)
    factors.append(
        {
            "factor": "Hazard Severity",
            "contribution": round(hazard_pts, 2),
            "max_points": 42.0,
            "rationale": f"Base public safety risk for '{complaint.category.value.replace('_', ' ')}'.",
        }
    )

    # 2. Verification & workflow state (0-12)
    status_bonus_map = {
        ComplaintStatus.VERIFIED: 12.0,
        ComplaintStatus.IN_PROGRESS: 9.0,
        ComplaintStatus.UNDER_REVIEW: 6.0,
        ComplaintStatus.SUBMITTED: 2.0,
    }
    status_pts = status_bonus_map.get(complaint.status, 2.0)
    factors.append(
        {
            "factor": "Verification Status",
            "contribution": status_pts,
            "max_points": 12.0,
            "rationale": f"Current workflow status is '{complaint.status.value.replace('_', ' ')}'.",
        }
    )

    # 3. Road / Location importance (0-16)
    addr_lower = f"{complaint.address} {complaint.title}".lower()
    matched_keywords = [kw for kw in HIGH_IMPORTANCE_KEYWORDS if kw in addr_lower]
    if road_importance_override == "critical_corridor":
        loc_pts = 16.0
        loc_reason = "Administrator flagged critical arterial/civic corridor."
    elif road_importance_override == "arterial":
        loc_pts = 11.0
        loc_reason = "Administrator flagged arterial connector."
    elif matched_keywords:
        loc_pts = min(16.0, 8.0 + 3.0 * len(matched_keywords))
        loc_reason = f"High-importance corridor keywords detected ({', '.join(matched_keywords[:3])})."
    else:
        loc_pts = 5.0
        loc_reason = "Standard neighborhood/local street corridor."

    factors.append(
        {
            "factor": "Location Importance",
            "contribution": round(loc_pts, 2),
            "max_points": 16.0,
            "rationale": loc_reason,
        }
    )

    # 4. Independent corroboration within 150m (bounded log-scale, 0-12)
    nearby_same_cat = []
    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    for other in all_complaints:
        if other.id == complaint.id or other.status == ComplaintStatus.REJECTED:
            continue
        dist_m = haversine_meters(complaint.latitude, complaint.longitude, other.latitude, other.longitude)
        if dist_m <= 150.0:
            nearby_same_cat.append(other)

    distinct_reporters = len({o.user_id for o in nearby_same_cat if o.user_id != complaint.user_id})
    corroboration_pts = min(12.0, round(4.8 * math.log1p(distinct_reporters), 2))
    factors.append(
        {
            "factor": "Independent Corroboration",
            "contribution": corroboration_pts,
            "max_points": 12.0,
            "rationale": (
                f"{distinct_reporters} distinct additional citizen(s) reported issues within 150m "
                "(log-bounded so frequency never outweighs safety danger)."
            ),
        }
    )

    # 5. Historical recurrence within 150m in last 90 days (0-10)
    recent_recurrence = sum(
        1
        for o in nearby_same_cat
        if (o.reported_at.replace(tzinfo=timezone.utc) if o.reported_at.tzinfo is None else o.reported_at)
        >= ninety_days_ago
    )
    recurrence_pts = min(10.0, round(3.5 * math.log1p(recent_recurrence), 2))
    factors.append(
        {
            "factor": "Historical Recurrence",
            "contribution": recurrence_pts,
            "max_points": 10.0,
            "rationale": f"{recent_recurrence} nearby historical incident(s) recorded within 150m in 90 days.",
        }
    )

    # 6. AI confidence & uncertainty (0-8)
    verification_caveat: str | None = None
    if latest_ai is None:
        ai_pts = 2.0
        ai_reason = "No AI vision record yet; scored primarily from hazard and spatial signals."
    elif latest_ai.is_demo_mode or latest_ai.requires_human_verification:
        cal = latest_ai.calibrated_confidence if latest_ai.calibrated_confidence is not None else latest_ai.confidence
        ai_pts = round(min(4.0, cal * 4.0), 2)
        ai_reason = "AI prediction carries uncertainty or demo flag; capped contribution until verified."
        verification_caveat = "AI analysis requires human verification before automated escalation."
    else:
        cal = latest_ai.calibrated_confidence if latest_ai.calibrated_confidence is not None else latest_ai.confidence
        ai_pts = round(min(8.0, cal * 8.0), 2)
        ai_reason = f"Human-verified AI confidence ({cal * 100:.1f}%) supports severity."

    factors.append(
        {
            "factor": "AI Reliability",
            "contribution": ai_pts,
            "max_points": 8.0,
            "rationale": ai_reason,
        }
    )

    total_score = round(min(100.0, max(0.0, hazard_pts + status_pts + loc_pts + corroboration_pts + recurrence_pts + ai_pts)), 2)
    level = classify_priority_level(total_score)

    return PriorityAssessment(
        priority_score=total_score,
        priority_level=level,
        explanation={
            "summary": f"{level.value.upper()} priority ({total_score}/100) driven primarily by {complaint.category.value.replace('_', ' ')} risk.",
            "verification_caveat": verification_caveat,
            "factors": factors,
            "overridden_by_admin": False,
        },
    )


def recompute_all_priorities(db: Session) -> list[Complaint]:
    """Compute and persist explainable priority scores across all complaints."""
    complaints = db.execute(select(Complaint)).scalars().all()
    if not complaints:
        return []

    analyses = db.execute(select(AIAnalysis)).scalars().all()
    latest_by_complaint: dict[Any, AIAnalysis] = {}
    for a in analyses:
        prev = latest_by_complaint.get(a.complaint_id)
        if prev is None or a.analyzed_at > prev.analyzed_at:
            latest_by_complaint[a.complaint_id] = a

    updated: list[Complaint] = []
    for c in complaints:
        # Preserve explicit administrator manual overrides unless reopened
        if isinstance(c.priority_explanation, dict) and c.priority_explanation.get("overridden_by_admin"):
            continue
        assessment = compute_explainable_priority(
            c,
            all_complaints=complaints,
            latest_ai=latest_by_complaint.get(c.id),
        )
        c.priority_score = assessment.priority_score
        c.priority_level = assessment.priority_level
        c.priority_explanation = assessment.explanation
        updated.append(c)

    db.commit()
    for c in updated:
        db.refresh(c)
    return updated

