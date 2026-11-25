"""Health, readiness, and non-secret setup diagnostics endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database import check_database_health
from app.schemas.system import ConfigStatusResponse, HealthResponse, ReadinessResponse

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def liveness_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
    )


@router.get("/health/ready", response_model=ReadinessResponse)
def readiness_check() -> ReadinessResponse:
    settings = get_settings()
    db_health = check_database_health()
    ready = db_health.connected and db_health.postgis_enabled and settings.is_firebase_configured
    return ReadinessResponse(
        status="ready" if ready else "degraded",
        database_configured=db_health.configured,
        database_connected=db_health.connected,
        postgis_enabled=db_health.postgis_enabled,
        firebase_configured=settings.is_firebase_configured,
        smtp_configured=settings.is_smtp_configured,
        database_detail=db_health.detail,
    )


@router.get("/config/status", response_model=ConfigStatusResponse)
def config_status() -> ConfigStatusResponse:
    """Report configuration readiness without leaking secrets or connection strings."""
    settings = get_settings()
    db_health = check_database_health()

    missing: list[str] = []
    if not settings.is_firebase_configured:
        missing.append(
            "Backend Firebase Admin credentials missing (set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON)."
        )
    if not db_health.configured:
        missing.append("PostgreSQL connection URL missing (set DATABASE_URL in backend/.env).")
    elif not db_health.connected:
        missing.append("PostgreSQL is unreachable (verify server is running and credentials are valid).")
    elif not db_health.postgis_enabled:
        missing.append("PostGIS extension not enabled on database (run CREATE EXTENSION postgis;).")
    if not settings.is_smtp_configured:
        missing.append("SMTP credentials not configured yet (required for Phase 2 confirmation emails).")

    return ConfigStatusResponse(
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        firebase_configured=settings.is_firebase_configured,
        dev_auth_enabled=settings.is_dev_auth_active,
        database_configured=db_health.configured,
        database_connected=db_health.connected,
        postgis_enabled=db_health.postgis_enabled,
        smtp_configured=settings.is_smtp_configured,
        ai_demo_fallback_enabled=settings.ENABLE_AI_DEMO_FALLBACK,
        single_admin_mode=settings.is_single_admin_enforced,
        missing_requirements=missing,
    )

