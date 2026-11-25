"""Tests for Firebase session provisioning, strict RBAC, and audit logging."""

from __future__ import annotations

from typing import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.firebase import VerifiedFirebaseClaims
from app.models.audit import AuditLog
from app.models.user import User, UserRole


def _citizen_claims(uid: str = "uid-citizen-1", email: str = "citizen@example.com") -> VerifiedFirebaseClaims:
    return VerifiedFirebaseClaims(
        uid=uid,
        email=email,
        email_verified=True,
        name="Aarav Citizen",
        picture="https://example.com/avatar.png",
        sign_in_provider="google.com",
    )


def test_citizen_provisioning_ignores_client_role_escalation(
    isolated_env: None,
    make_client: Callable[[VerifiedFirebaseClaims | None], TestClient],
    db_session: Session,
) -> None:
    client = make_client(_citizen_claims())

    # Attempt to smuggle role="admin" during session sync
    resp = client.post("/api/v1/auth/session", json={"full_name": "Aarav Verma", "role": "admin"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_new_user"] is True
    assert body["user"]["role"] == "citizen"
    assert body["user"]["full_name"] == "Aarav Verma"
    assert body["user"]["email"] == "citizen@example.com"

    # Attempt to escalate role via profile update
    patch_resp = client.patch("/api/v1/auth/me", json={"full_name": "Aarav Updated", "role": "admin"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["role"] == "citizen"
    assert patch_resp.json()["full_name"] == "Aarav Updated"

    # Citizen can access citizen dashboard summary
    dash_resp = client.get("/api/v1/citizen/dashboard")
    assert dash_resp.status_code == 200
    assert dash_resp.json()["total_complaints"] == 0

    # Citizen CANNOT access admin endpoints
    admin_resp = client.get("/api/v1/admin/overview")
    assert admin_resp.status_code == 403

    denied_logs = (
        db_session.execute(select(AuditLog).where(AuditLog.action == "security.admin_access_denied"))
        .scalars()
        .all()
    )
    assert len(denied_logs) == 1


def test_unverified_email_cannot_bootstrap_admin(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    make_client: Callable[[VerifiedFirebaseClaims | None], TestClient],
) -> None:
    monkeypatch.setenv("ADMIN_BOOTSTRAP_EMAILS", "boss@lifesignal.org")
    get_settings.cache_clear()

    unverified_claims = VerifiedFirebaseClaims(
        uid="uid-unverified",
        email="boss@lifesignal.org",
        email_verified=False,
        name="Unverified User",
        picture=None,
        sign_in_provider="password",
    )
    client = make_client(unverified_claims)
    resp = client.post("/api/v1/auth/session")
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "citizen"


def test_verified_admin_bootstrap_and_role_management(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    make_client: Callable[[VerifiedFirebaseClaims | None], TestClient],
    db_session: Session,
) -> None:
    monkeypatch.setenv("ADMIN_BOOTSTRAP_EMAILS", "admin@lifesignal.org")
    get_settings.cache_clear()

    # First provision a citizen
    citizen_client = make_client(_citizen_claims("uid-cit-2", "maya@example.com"))
    cit_resp = citizen_client.post("/api/v1/auth/session")
    assert cit_resp.status_code == 200
    citizen_id = cit_resp.json()["user"]["id"]

    # Now sign in as verified bootstrap admin
    admin_claims = VerifiedFirebaseClaims(
        uid="uid-admin-1",
        email="admin@lifesignal.org",
        email_verified=True,
        name="City Admin",
        picture=None,
        sign_in_provider="google.com",
    )
    admin_client = make_client(admin_claims)
    admin_session = admin_client.post("/api/v1/auth/session")
    assert admin_session.status_code == 200
    assert admin_session.json()["user"]["role"] == "admin"
    admin_id = admin_session.json()["user"]["id"]

    # Sole active admin cannot demote themselves
    self_demote = admin_client.patch(
        f"/api/v1/admin/users/{admin_id}/role",
        json={"role": "citizen"},
    )
    assert self_demote.status_code == 400

    # Admin can promote citizen to admin
    promote_resp = admin_client.patch(
        f"/api/v1/admin/users/{citizen_id}/role",
        json={"role": "admin"},
    )
    assert promote_resp.status_code == 200
    assert promote_resp.json()["role"] == "admin"

    # Overview reflects real user counts
    overview = admin_client.get("/api/v1/admin/overview")
    assert overview.status_code == 200
    assert overview.json()["total_users"] == 2
    assert overview.json()["total_admins"] == 2

    # Inactive user is denied
    promoted_user = db_session.execute(select(User).where(User.email == "maya@example.com")).scalar_one()
    promoted_user.is_active = False
    db_session.commit()

    blocked_client = make_client(_citizen_claims("uid-cit-2", "maya@example.com"))
    blocked_resp = blocked_client.get("/api/v1/auth/me")
    assert blocked_resp.status_code == 403


def test_sole_admin_startup_lock_blocks_other_admins(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    make_client: Callable[[VerifiedFirebaseClaims | None], TestClient],
    db_session: Session,
) -> None:
    monkeypatch.setenv("SOLE_ADMIN_EMAIL", "founder@lifesignal.org")
    get_settings.cache_clear()

    # Non-secret status confirms single-admin policy without exposing email
    public_client = make_client(None)
    cfg = public_client.get("/api/v1/config/status")
    assert cfg.status_code == 200
    assert cfg.json()["single_admin_mode"] is True
    assert "founder@lifesignal.org" not in str(cfg.json())

    # Founder signs in with verified email -> receives admin role automatically
    founder_claims = VerifiedFirebaseClaims(
        uid="uid-founder",
        email="founder@lifesignal.org",
        email_verified=True,
        name="Founder Admin",
        picture=None,
        sign_in_provider="google.com",
    )
    founder_client = make_client(founder_claims)
    founder_resp = founder_client.post("/api/v1/auth/session")
    assert founder_resp.status_code == 200
    assert founder_resp.json()["user"]["role"] == "admin"

    # Seed another user who somehow had role=admin in DB -> downgraded automatically on session sync
    rogue_user = User(
        firebase_uid="uid-rogue",
        full_name="Rogue User",
        email="rogue@example.com",
        email_verified=True,
        role=UserRole.ADMIN,
    )
    db_session.add(rogue_user)
    db_session.commit()

    rogue_client = make_client(_citizen_claims("uid-rogue", "rogue@example.com"))
    rogue_sync = rogue_client.post("/api/v1/auth/session")
    assert rogue_sync.status_code == 200
    assert rogue_sync.json()["user"]["role"] == "citizen"
    assert rogue_client.get("/api/v1/admin/overview").status_code == 403

    # Founder cannot promote rogue user to admin while sole-admin lock is enabled
    founder_client = make_client(founder_claims)
    promote_attempt = founder_client.patch(
        f"/api/v1/admin/users/{rogue_user.id}/role",
        json={"role": "admin"},
    )
    assert promote_attempt.status_code == 400


