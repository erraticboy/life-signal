"""Tests for Phase 3: Uncertainty calibration, Vision AI honest mode, and Multimodal Duplicate Detection."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.main import create_app
from app.models.complaint import Complaint
from app.services.ai_vision.detector import analyze_infrastructure_image
from app.services.uncertainty.ece import compute_calibration_metrics
from app.services.uncertainty.mc_dropout import (
    assess_prediction_uncertainty,
    compute_mc_uncertainty_from_samples,
)
from app.services.uncertainty.temperature_scaling import apply_temperature_scaling, fit_temperature


def _make_road_png_bytes() -> bytes:
    buf = BytesIO()
    img = Image.new("RGB", (240, 180), color=(110, 112, 118))
    # Draw dark high-contrast region simulating road defect
    for x in range(70, 160):
        for y in range(55, 125):
            img.putpixel((x, y), (25, 25, 28))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_ece_and_temperature_scaling_calibration() -> None:
    rng = np.random.default_rng(7)
    labels = rng.integers(0, 4, size=300)
    logits = rng.normal(0.0, 1.0, size=(300, 4))
    logits[np.arange(300), labels] += 1.6
    logits *= 3.0  # Make predictions severely overconfident

    raw_probs = apply_temperature_scaling(logits, temperature=1.0)
    raw_report = compute_calibration_metrics(np.max(raw_probs, axis=1), np.argmax(raw_probs, axis=1) == labels)

    opt_temp = fit_temperature(logits[:150], labels[:150])
    assert opt_temp > 1.2

    cal_probs = apply_temperature_scaling(logits[150:], temperature=opt_temp)
    cal_report = compute_calibration_metrics(
        np.max(cal_probs, axis=1), np.argmax(cal_probs, axis=1) == labels[150:]
    )
    assert cal_report.ece < raw_report.ece


def test_mc_dropout_uncertainty_flags_human_verification(isolated_env: None) -> None:
    ambiguous_samples = np.array(
        [
            [0.48, 0.42, 0.05, 0.03, 0.02],
            [0.30, 0.56, 0.08, 0.04, 0.02],
            [0.42, 0.45, 0.06, 0.04, 0.03],
        ]
    )
    mc = compute_mc_uncertainty_from_samples(ambiguous_samples)
    assert mc["epistemic_uncertainty"] > 0.0
    assert mc["uncertainty_score"] > 0.35

    est = assess_prediction_uncertainty(
        raw_confidence=mc["raw_confidence"],
        prob_samples=ambiguous_samples,
        is_demo_mode=False,
    )
    assert est.requires_human_verification is True
    assert est.calibrated_confidence != est.raw_confidence

    # Overconfident p > 0.5 is tempered downward by T > 1.0
    overconfident_est = assess_prediction_uncertainty(raw_confidence=0.88, is_demo_mode=False)
    assert overconfident_est.calibrated_confidence < overconfident_est.raw_confidence


def test_vision_detector_honest_model_unavailable_vs_demo_mode(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    img_path = tmp_path / "pothole.png"
    img_path.write_bytes(_make_road_png_bytes())

    # 1. With ENABLE_AI_DEMO_FALLBACK=false and no YOLO weights -> must NOT invent predictions
    monkeypatch.setenv("YOLO_MODEL_PATH", str(tmp_path / "missing_yolo.pt"))
    monkeypatch.setenv("ENABLE_AI_DEMO_FALLBACK", "false")
    get_settings.cache_clear()

    unavailable = analyze_infrastructure_image(img_path)
    assert unavailable.status == "model_unavailable"
    assert unavailable.predicted_category is None
    assert unavailable.requires_human_verification is True

    # 2. With ENABLE_AI_DEMO_FALLBACK=true -> clearly labeled demo fallback + mandatory human verification
    monkeypatch.setenv("ENABLE_AI_DEMO_FALLBACK", "true")
    get_settings.cache_clear()

    demo_res = analyze_infrastructure_image(img_path)
    assert demo_res.status == "completed"
    assert demo_res.is_demo_mode is True
    assert demo_res.requires_human_verification is True
    assert "opencv-demo" in demo_res.model_version
    assert demo_res.predicted_category is not None


def test_multimodal_duplicate_scan_and_admin_review_preserves_complaints(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_DEV_AUTH", "true")
    monkeypatch.setenv("DEV_JWT_SECRET", "test-secret-key-for-dev-auth-minimum-32-bytes-long")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path))
    monkeypatch.setenv("ENABLE_AI_DEMO_FALLBACK", "true")
    monkeypatch.setenv("DUPLICATE_THRESHOLD", "0.55")
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: (yield db_session)
    client = TestClient(app)

    cit = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "Reporter One", "email": "rep1@example.com", "role": "citizen"},
    )
    cit_token = cit.json()["access_token"]

    png_bytes = _make_road_png_bytes()
    r1 = client.post(
        "/api/v1/complaints",
        headers={"Authorization": f"Bearer {cit_token}"},
        data={
            "title": "Deep pothole near main college gate",
            "description": "Large pothole blocking lane outside main college gate entrance.",
            "category": "pothole",
            "latitude": "28.613900",
            "longitude": "77.209000",
            "address": "Main College Gate",
            "contact_email": "rep1@example.com",
        },
        files={"photo": ("p1.png", png_bytes, "image/png")},
    )
    assert r1.status_code == 201
    c1_id = r1.json()["id"]

    # Second closely located & similarly described complaint
    r2 = client.post(
        "/api/v1/complaints",
        headers={"Authorization": f"Bearer {cit_token}"},
        data={
            "title": "Large pothole at main college entrance gate",
            "description": "Deep road pothole blocking traffic near main college gate.",
            "category": "pothole",
            "latitude": "28.613940",
            "longitude": "77.209030",
            "address": "College Gate Main Road",
            "contact_email": "rep1@example.com",
        },
        files={"photo": ("p2.png", png_bytes, "image/png")},
    )
    assert r2.status_code == 201

    # Citizen detail view exposes demo AI analysis clearly marked for human verification
    detail = client.get(f"/api/v1/complaints/{c1_id}", headers={"Authorization": f"Bearer {cit_token}"}).json()
    assert detail["ai_analysis"] is not None
    assert detail["ai_analysis"]["is_demo_mode"] is True
    assert detail["ai_analysis"]["requires_human_verification"] is True

    # Admin runs duplicate scan & reviews candidate without deleting either complaint
    adm = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "City Admin", "email": "adm@example.com", "role": "admin"},
    )
    adm_token = adm.json()["access_token"]

    scan = client.post(
        "/api/v1/admin/duplicates/scan",
        headers={"Authorization": f"Bearer {adm_token}"},
    )
    assert scan.status_code == 200
    scan_data = scan.json()
    assert scan_data["candidates_found"] >= 1
    group_id = scan_data["groups"][0]["id"]
    assert scan_data["groups"][0]["distance_meters"] < 25.0

    confirm = client.patch(
        f"/api/v1/admin/duplicates/{group_id}",
        headers={"Authorization": f"Bearer {adm_token}"},
        json={"review_status": "confirmed_duplicate"},
    )
    assert confirm.status_code == 200
    assert confirm.json()["review_status"] == "confirmed_duplicate"

    # Both complaints remain intact in database
    total_complaints = len(db_session.execute(select(Complaint)).scalars().all())
    assert total_complaints == 2

    # Admin verifies AI analysis prediction
    analysis_id = detail["ai_analysis"]["id"]
    verify = client.patch(
        f"/api/v1/admin/ai/analyses/{analysis_id}/verify",
        headers={"Authorization": f"Bearer {adm_token}"},
        json={"verified_category": "Pothole"},
    )
    assert verify.status_code == 200
    assert verify.json()["requires_human_verification"] is False

