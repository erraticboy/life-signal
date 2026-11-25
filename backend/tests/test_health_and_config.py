"""Tests for health, readiness, and fail-closed configuration diagnostics."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_returns_ok(isolated_env: None) -> None:
    client = TestClient(create_app())
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    assert root_resp.json()["docs"] == "/docs"

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app_name"] == "LIFE SIGNAL"


def test_config_status_reports_missing_requirements_without_leaking_secrets(isolated_env: None) -> None:
    client = TestClient(create_app())
    response = client.get("/api/v1/config/status")
    assert response.status_code == 200
    data = response.json()
    assert data["firebase_configured"] is False
    assert data["database_configured"] is False
    assert data["database_connected"] is False
    assert len(data["missing_requirements"]) >= 2


def test_auth_session_fails_closed_when_unconfigured(isolated_env: None) -> None:
    client = TestClient(create_app())
    response = client.post("/api/v1/auth/session")
    assert response.status_code == 503
    assert "Firebase" in response.json()["detail"]

