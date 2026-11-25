"""Application settings and non-secret runtime diagnostics."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Typed application settings loaded from environment variables or backend/.env."""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "LIFE SIGNAL"
    APP_ENV: str = "development"
    APP_BASE_URL: str = "http://localhost:5173"
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # PostgreSQL + PostGIS
    DATABASE_URL: str = ""

    # Firebase Admin SDK
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""

    # Bootstrap admin emails (case-insensitive, only honored when email_verified=True)
    ADMIN_BOOTSTRAP_EMAILS: str = ""
    # Optional exclusive single-admin email lock (only this verified email can hold admin privileges)
    SOLE_ADMIN_EMAIL: str = ""

    # Local Development Auth (strictly ignored unless APP_ENV == "development")
    ENABLE_DEV_AUTH: bool = False
    DEV_JWT_SECRET: str = ""

    # Storage & SMTP (Phase 2+)
    STORAGE_ROOT: str = "./storage"
    MAX_UPLOAD_MB: int = 10
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "LIFE SIGNAL"
    SMTP_FROM_EMAIL: str = ""

    # AI / Duplicate settings (Phase 3+)
    YOLO_MODEL_PATH: str = "./weights/infrastructure_yolo.pt"
    ENABLE_AI_DEMO_FALLBACK: bool = False
    AI_UNCERTAINTY_THRESHOLD: float = 0.35
    AI_CONFIDENCE_THRESHOLD: float = 0.65
    AI_TEMPERATURE_SCALE: float = 1.25
    DUPLICATE_WEIGHT_IMAGE: float = 0.35
    DUPLICATE_WEIGHT_TEXT: float = 0.35
    DUPLICATE_WEIGHT_GEO: float = 0.20
    DUPLICATE_WEIGHT_TIME: float = 0.10
    DUPLICATE_THRESHOLD: float = 0.58
    DUPLICATE_MAX_RADIUS_METERS: float = 1000.0

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def normalized_sole_admin_email(self) -> str:
        return self.SOLE_ADMIN_EMAIL.strip().lower()

    @property
    def is_single_admin_enforced(self) -> bool:
        return bool(self.normalized_sole_admin_email)

    @property
    def admin_bootstrap_set(self) -> set[str]:
        if self.normalized_sole_admin_email:
            return {self.normalized_sole_admin_email}
        return {
            email.strip().lower()
            for email in self.ADMIN_BOOTSTRAP_EMAILS.split(",")
            if email.strip()
        }

    @property
    def is_database_configured(self) -> bool:
        return bool(self.DATABASE_URL.strip())

    @property
    def resolved_firebase_service_account_path(self) -> Path | None:
        raw = self.FIREBASE_SERVICE_ACCOUNT_PATH.strip()
        if not raw:
            return None
        path = Path(raw)
        if not path.is_absolute():
            path = (BACKEND_DIR / path).resolve()
        return path

    @property
    def has_firebase_service_account(self) -> bool:
        if self.FIREBASE_SERVICE_ACCOUNT_JSON.strip():
            return True
        sa_path = self.resolved_firebase_service_account_path
        return sa_path is not None and sa_path.is_file()

    @property
    def is_firebase_configured(self) -> bool:
        return self.has_firebase_service_account or bool(self.FIREBASE_PROJECT_ID.strip())

    @property
    def is_dev_auth_active(self) -> bool:
        return self.APP_ENV.strip().lower() == "development" and self.ENABLE_DEV_AUTH

    @property
    def resolved_storage_root(self) -> Path:
        root = Path(self.STORAGE_ROOT.strip() or "./storage")
        if not root.is_absolute():
            root = (BACKEND_DIR / root).resolve()
        return root

    @property
    def resolved_yolo_model_path(self) -> Path:
        model_path = Path(self.YOLO_MODEL_PATH.strip() or "./weights/infrastructure_yolo.pt")
        if not model_path.is_absolute():
            model_path = (BACKEND_DIR / model_path).resolve()
        return model_path

    @property
    def is_smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST.strip() and self.SMTP_USERNAME.strip() and self.SMTP_PASSWORD.strip())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()

