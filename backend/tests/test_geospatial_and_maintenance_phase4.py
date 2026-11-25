"""Tests for Phase 4: DBSCAN hotspots, explainable priority, predictive maintenance, and exports."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.main import create_app
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.user import User
from app.services.geospatial.hotspots import compute_dbscan_hotspots
from app.services.maintenance.forecaster import compute_maintenance_analytics
from app.services.maintenance.prioritizer import compute_explainable_priority


def _seed_user(db: Session, email: str = "cit@example.com") -> User:
    u = User(firebase_uid=f"uid-{email}", full_name="Test Citizen", email=email, email_verified=True)
    db.add(u)
    db.flush()
    return u


def test_dbscan_clusters_nearby_reports_and_excludes_distant_outliers(db_session: Session) -> None:
    u = _seed_user(db_session)
    now = datetime.now(timezone.utc)
    c1 = Complaint(
        complaint_number="LS-2026-000001",
        user_id=u.id,
        title="Pothole 1",
        description="Deep road pothole at north intersection",
        category=ComplaintCategory.POTHOLE,
        latitude=28.61390,
        longitude=77.20900,
        address="Main Highway Gate",
        contact_email=u.email,
        reported_at=now,
    )
    c2 = Complaint(
        complaint_number="LS-2026-000002",
        user_id=u.id,
        title="Pothole 2",
        description="Adjacent pothole 40m away",
        category=ComplaintCategory.POTHOLE,
        latitude=28.61420,
        longitude=77.20920,
        address="Main Highway Gate",
        contact_email=u.email,
        reported_at=now,
    )
    c_far = Complaint(
        complaint_number="LS-2026-000003",
        user_id=u.id,
        title="Distant issue",
        description="Broken streetlight 4km away",
        category=ComplaintCategory.STREETLIGHT,
        latitude=28.65000,
        longitude=77.25000,
        address="North Suburb",
        contact_email=u.email,
        reported_at=now,
    )
    db_session.add_all([c1, c2, c_far])
    db_session.commit()

    hotspots, cluster_map = compute_dbscan_hotspots([c1, c2, c_far], eps_meters=250.0, min_samples=2)
    assert len(hotspots) == 1
    assert hotspots[0].complaint_count == 2
    assert cluster_map[str(c1.id)] == cluster_map[str(c2.id)]
    assert cluster_map[str(c_far.id)] == -1


def test_explainable_priority_ranks_safety_danger_above_frequency(db_session: Session) -> None:
    u1 = _seed_user(db_session, "a@example.com")
    u2 = _seed_user(db_session, "b@example.com")
    now = datetime.now(timezone.utc)

    manhole = Complaint(
        complaint_number="LS-2026-000010",
        user_id=u1.id,
        title="Open manhole outside hospital gate",
        description="Uncovered deep manhole posing immediate fatal danger.",
        category=ComplaintCategory.MANHOLE,
        latitude=28.6100,
        longitude=77.2000,
        address="City Hospital Main Road",
        contact_email=u1.email,
        reported_at=now,
        status=ComplaintStatus.VERIFIED,
    )
    garbage = Complaint(
        complaint_number="LS-2026-000011",
        user_id=u2.id,
        title="Litter pile in alley",
        description="Uncollected garbage bags on residential lane.",
        category=ComplaintCategory.GARBAGE,
        latitude=28.6300,
        longitude=77.2300,
        address="Lane 5",
        contact_email=u2.email,
        reported_at=now,
        status=ComplaintStatus.SUBMITTED,
    )
    db_session.add_all([manhole, garbage])
    db_session.commit()

    p_manhole = compute_explainable_priority(manhole, all_complaints=[manhole, garbage], latest_ai=None)
    p_garbage = compute_explainable_priority(garbage, all_complaints=[manhole, garbage], latest_ai=None)

    assert p_manhole.priority_score > p_garbage.priority_score
    assert len(p_manhole.explanation["factors"]) >= 5


def test_predictive_maintenance_honest_gate_and_forecast_activation(db_session: Session) -> None:
    u = _seed_user(db_session)
    now = datetime.now(timezone.utc)

    # With only 2 complaints -> forecast MUST NOT be fabricated
    for i in range(2):
        db_session.add(
            Complaint(
                complaint_number=f"LS-2026-00010{i}",
                user_id=u.id,
                title=f"Issue {i}",
                description="Road surface damage sample record.",
                category=ComplaintCategory.POTHOLE,
                latitude=28.61 + i * 0.001,
                longitude=77.20,
                address="Sector 1",
                contact_email=u.email,
                reported_at=now - timedelta(weeks=i),
            )
        )
    db_session.commit()

    insufficient = compute_maintenance_analytics(db_session)
    assert insufficient.total_complaints == 2
    assert insufficient.forecast_available is False
    assert insufficient.forecast_horizon_weeks == []

    # Add 12 more historical complaints across 6 distinct weeks -> real ML forecast activates
    for i in range(12):
        db_session.add(
            Complaint(
                complaint_number=f"LS-2026-0002{i:02d}",
                user_id=u.id,
                title=f"Historical issue {i}",
                description="Recurring road damage along ring corridor.",
                category=ComplaintCategory.ROAD_CRACK,
                latitude=28.613 + (i % 3) * 0.0005,
                longitude=77.209,
                address="Ring Road Junction",
                contact_email=u.email,
                reported_at=now - timedelta(weeks=(i % 6) + 1),
            )
        )
    db_session.commit()

    ready = compute_maintenance_analytics(db_session)
    assert ready.total_complaints == 14
    assert ready.forecast_available is True
    assert ready.model_name is not None
    assert len(ready.forecast_horizon_weeks) == 4


def test_admin_geospatial_priority_and_exports_endpoints(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_DEV_AUTH", "true")
    monkeypatch.setenv("DEV_JWT_SECRET", "test-secret-key-for-dev-auth-minimum-32-bytes-long")
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: (yield db_session)
    client = TestClient(app)

    adm = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "City Admin", "email": "admin@city.gov", "role": "admin"},
    )
    token = adm.json()["access_token"]

    # Seed one complaint via API
    c_resp = client.post(
        "/api/v1/complaints",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "title": "Water pipe leak on main junction",
            "description": "Pressurized water leaking across carriageway causing slippery road.",
            "category": "water_leakage",
            "latitude": "28.613900",
            "longitude": "77.209000",
            "address": "Main Junction Road",
            "contact_email": "admin@city.gov",
        },
    )
    assert c_resp.status_code == 201
    cid = c_resp.json()["id"]
    assert c_resp.json()["priority_score"] is not None

    # Map endpoint
    map_resp = client.get("/api/v1/admin/geospatial/map", headers={"Authorization": f"Bearer {token}"})
    assert map_resp.status_code == 200
    assert map_resp.json()["total_points"] == 1

    # Recompute + Override priority
    recomp = client.post("/api/v1/admin/priority/recompute", headers={"Authorization": f"Bearer {token}"})
    assert recomp.status_code == 200

    override = client.patch(
        f"/api/v1/admin/complaints/{cid}/priority",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "priority_score": 92.5,
            "priority_level": "critical",
            "rationale": "Adjacent to hospital emergency entrance.",
        },
    )
    assert override.status_code == 200
    assert override.json()["priority_level"] == "critical"

    # CSV, JSON, and PDF Exports
    csv_resp = client.get("/api/v1/admin/exports/complaints.csv", headers={"Authorization": f"Bearer {token}"})
    assert csv_resp.status_code == 200
    assert "complaint_number" in csv_resp.text

    json_resp = client.get("/api/v1/admin/exports/complaints.json", headers={"Authorization": f"Bearer {token}"})
    assert json_resp.status_code == 200
    assert len(json_resp.json()) == 1

    pdf_resp = client.get("/api/v1/admin/exports/summary.pdf", headers={"Authorization": f"Bearer {token}"})
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")

