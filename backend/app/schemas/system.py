"""Health and system configuration schemas."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    database_configured: bool
    database_connected: bool
    postgis_enabled: bool
    firebase_configured: bool
    smtp_configured: bool
    database_detail: str


class ConfigStatusResponse(BaseModel):
    app_name: str
    environment: str
    firebase_configured: bool
    dev_auth_enabled: bool
    database_configured: bool
    database_connected: bool
    postgis_enabled: bool
    smtp_configured: bool
    ai_demo_fallback_enabled: bool
    single_admin_mode: bool = False
    missing_requirements: list[str]

