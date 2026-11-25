"""SQLAlchemy database engine, session management, and PostGIS readiness checks."""

from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine | None:
    """Lazily construct and cache the SQLAlchemy engine when DATABASE_URL is configured."""
    global _engine, _SessionLocal
    settings = get_settings()
    if not settings.is_database_configured:
        return None
    if _engine is None:
        _engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def reset_database_engine() -> None:
    """Dispose cached engine (used by tests or settings reloads)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None


def get_session_factory() -> sessionmaker[Session] | None:
    """Return configured sessionmaker or None if database URL is missing."""
    get_engine()
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency providing a transactional DB session or failing closed with 503."""
    factory = get_session_factory()
    if factory is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "PostgreSQL database is not configured. Set DATABASE_URL in backend/.env "
                "and apply migrations with 'alembic upgrade head'."
            ),
        )
    db = factory()
    try:
        yield db
    finally:
        db.close()


@dataclass(frozen=True)
class DatabaseHealth:
    configured: bool
    connected: bool
    postgis_enabled: bool
    detail: str


def check_database_health() -> DatabaseHealth:
    """Verify PostgreSQL connectivity and PostGIS extension availability without exposing secrets."""
    settings = get_settings()
    if not settings.is_database_configured:
        return DatabaseHealth(
            configured=False,
            connected=False,
            postgis_enabled=False,
            detail="DATABASE_URL is not configured in backend/.env.",
        )

    engine = get_engine()
    if engine is None:
        return DatabaseHealth(
            configured=False,
            connected=False,
            postgis_enabled=False,
            detail="Database engine could not be initialized.",
        )

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            postgis_row = conn.execute(
                text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')")
            ).scalar()
            postgis_enabled = bool(postgis_row)
            detail = (
                "PostgreSQL and PostGIS are connected."
                if postgis_enabled
                else "PostgreSQL connected, but PostGIS extension is not enabled yet (run CREATE EXTENSION postgis;)."
            )
            return DatabaseHealth(
                configured=True,
                connected=True,
                postgis_enabled=postgis_enabled,
                detail=detail,
            )
    except Exception as exc:
        return DatabaseHealth(
            configured=True,
            connected=False,
            postgis_enabled=False,
            detail=f"Database connection failed ({type(exc).__name__}). Verify PostgreSQL is running and DATABASE_URL is valid.",
        )

