"""Pytest fixtures for LIFE SIGNAL backend Phase 1 tests."""

from __future__ import annotations

import os
from collections.abc import Generator
from typing import Callable

import geoalchemy2.admin.dialects.sqlite as geo_sqlite
import pytest
from fastapi.testclient import TestClient
from geoalchemy2 import Geography
from sqlalchemy import create_engine, event
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.database import Base, get_db
from app.core.firebase import VerifiedFirebaseClaims, verify_firebase_token
from app.main import create_app


@compiles(Geography, "sqlite")
def _compile_geography_sqlite(_type, _compiler, **_kwargs) -> str:
    """Allow ORM schema creation in isolated unit tests when PostgreSQL is unavailable."""
    return "TEXT"


def _noop_geo_hook(*_args, **_kwargs) -> None:
    return None


geo_sqlite.before_create = _noop_geo_hook
geo_sqlite.after_create = _noop_geo_hook
geo_sqlite.before_drop = _noop_geo_hook
geo_sqlite.after_drop = _noop_geo_hook


@pytest.fixture()
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure settings start clean without reading external developer secrets."""
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "")
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    monkeypatch.setenv("ADMIN_BOOTSTRAP_EMAILS", "")
    monkeypatch.setenv("SOLE_ADMIN_EMAIL", "")
    monkeypatch.setenv("ENABLE_DEV_AUTH", "false")
    monkeypatch.setenv("DEV_JWT_SECRET", "")
    monkeypatch.setenv("SMTP_USERNAME", "")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Create an isolated test session (PostgreSQL if TEST_DATABASE_URL set, else SQLite memory)."""
    test_db_url = os.getenv("TEST_DATABASE_URL", "").strip()
    if test_db_url:
        engine = create_engine(test_db_url, pool_pre_ping=True)
    else:
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def _register_sqlite_geo_stubs(dbapi_connection, _connection_record) -> None:
            dbapi_connection.create_function("ST_GeogFromText", 1, lambda val: val)
            dbapi_connection.create_function("ST_AsBinary", 1, lambda val: val)
            dbapi_connection.create_function("AsBinary", 1, lambda val: val)
            dbapi_connection.create_function("ST_AsEWKB", 1, lambda val: val)

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def make_client(
    db_session: Session,
) -> Generator[Callable[[VerifiedFirebaseClaims | None], TestClient], None, None]:
    """Factory creating a FastAPI TestClient with controlled Firebase claims and isolated DB."""
    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    def _build(claims: VerifiedFirebaseClaims | None) -> TestClient:
        if claims is not None:
            app.dependency_overrides[verify_firebase_token] = lambda: claims
        else:
            app.dependency_overrides.pop(verify_firebase_token, None)
        return TestClient(app)

    yield _build
    app.dependency_overrides.clear()

