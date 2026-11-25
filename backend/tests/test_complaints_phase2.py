"""Tests for Phase 2: dev-mode auth boundary, complaint registration, ReportLab PDF, SMTP status, and RBAC."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.main import create_app
from app.models.document import EmailDeliveryStatus
from app.services.email.mailer import EmailDispatchResult


def _make_png_bytes() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (120, 90), color=(37, 99, 235)).save(buf, format="PNG")
    return buf.getvalue()


def _dev_client(db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_DEV_AUTH", "true")
    monkeypatch.setenv("DEV_JWT_SECRET", "test-secret-key-for-dev-auth-minimum-32-bytes-long")
    monkeypatch.setenv("STORAGE_ROOT", str(tmp_path))
    monkeypatch.setenv("SMTP_USERNAME", "")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: (yield db_session)
    return TestClient(app)


def test_dev_login_blocked_in_production(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ENABLE_DEV_AUTH", "true")
    get_settings.cache_clear()

    app = create_app()
    app.dependency_overrides[get_db] = lambda: (yield db_session)
    client = TestClient(app)

    resp = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "Prod Attacker", "email": "attacker@example.com", "role": "admin"},
    )
    assert resp.status_code == 403


def test_complaint_registration_pdf_ownership_and_email_resilience(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
    tmp_path: Path,
) -> None:
    client = _dev_client(db_session, tmp_path, monkeypatch)

    # 1. Sign in Citizen A and Citizen B via dev-login
    cit_a = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "Citizen A", "email": "cit_a@example.com", "role": "citizen"},
    )
    assert cit_a.status_code == 200
    token_a = cit_a.json()["access_token"]

    cit_b = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "Citizen B", "email": "cit_b@example.com", "role": "citizen"},
    )
    token_b = cit_b.json()["access_token"]

    # 2. Reject invalid (non-image) file payload
    bad_upload = client.post(
        "/api/v1/complaints",
        headers={"Authorization": f"Bearer {token_a}"},
        data={
            "title": "Deep pothole near gate",
            "description": "Severe pothole causing vehicles to swerve dangerously.",
            "category": "pothole",
            "latitude": "28.6139",
            "longitude": "77.2090",
            "address": "Main College Road",
            "contact_email": "cit_a@example.com",
        },
        files={"photo": ("fake.jpg", b"not-an-image", "image/jpeg")},
    )
    assert bad_upload.status_code == 400

    # 3. Valid complaint registration with genuine PNG -> PDF generated, email NOT_CONFIGURED cleanly
    create_resp = client.post(
        "/api/v1/complaints",
        headers={"Authorization": f"Bearer {token_a}"},
        data={
            "title": "Deep pothole near campus gate",
            "description": "Large pothole across northbound lane filling with rainwater.",
            "category": "pothole",
            "latitude": "28.613939",
            "longitude": "77.209021",
            "address": "College Main Entrance, Sector 4",
            "contact_email": "cit_a@example.com",
        },
        files={"photo": ("pothole.png", _make_png_bytes(), "image/png")},
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    complaint_id = created["id"]
    assert created["complaint_number"].startswith("LS-")
    assert created["has_image"] is True
    assert created["document"]["email_delivery_status"] == "not_configured"

    # 4. Citizen A can download genuine PDF receipt (%PDF-) and image
    pdf_resp = client.get(
        f"/api/v1/complaints/{complaint_id}/pdf",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"].startswith("application/pdf")
    assert pdf_resp.content.startswith(b"%PDF-")

    img_resp = client.get(
        f"/api/v1/complaints/{complaint_id}/image",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert img_resp.status_code == 200
    assert img_resp.headers["content-type"] == "image/png"

    # 5. Citizen B CANNOT access Citizen A's complaint, PDF, or image
    assert (
        client.get(
            f"/api/v1/complaints/{complaint_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/complaints/{complaint_id}/pdf",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/complaints/{complaint_id}/image",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )

    # 6. Mock real SMTP attachment delivery on resend -> status transitions to SENT
    monkeypatch.setattr(
        "app.api.v1.complaints.send_complaint_acknowledgment_email",
        lambda **_kwargs: EmailDispatchResult(
            status=EmailDeliveryStatus.SENT,
            error=None,
            sent_at=None,
        ),
    )
    resend_resp = client.post(
        f"/api/v1/complaints/{complaint_id}/resend-email",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resend_resp.status_code == 200
    assert resend_resp.json()["email_delivery_status"] == "sent"

    # 7. Admin can view all complaints and update status with history
    adm = client.post(
        "/api/v1/auth/dev-login",
        json={"full_name": "Municipal Admin", "email": "admin@city.gov", "role": "admin"},
    )
    admin_token = adm.json()["access_token"]

    all_resp = client.get(
        "/api/v1/admin/complaints",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 1

    upd_resp = client.patch(
        f"/api/v1/admin/complaints/{complaint_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "verified", "notes": "Field crew inspection scheduled."},
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["status"] == "verified"

    detail_resp = client.get(
        f"/api/v1/complaints/{complaint_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert detail_resp.status_code == 200
    assert len(detail_resp.json()["history"]) == 2


def test_smtp_mailer_strips_gmail_app_password_spaces_and_uses_ssl_on_465(
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from email.mime.multipart import MIMEMultipart
    from app.services.email.mailer import _send_mime_message

    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USE_TLS", "true")
    monkeypatch.setenv("SMTP_USERNAME", " sender@gmail.com ")
    monkeypatch.setenv("SMTP_PASSWORD", "abcd efgh ijkl mnop")
    get_settings.cache_clear()

    captured: dict[str, object] = {}

    class DummySMTPSSL:
        def __init__(self, host: str, port: int, timeout: int = 20) -> None:
            captured["ssl_host"] = host
            captured["ssl_port"] = port

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def login(self, user: str, password: str) -> None:
            captured["user"] = user
            captured["password"] = password

        def send_message(self, msg: MIMEMultipart) -> None:
            captured["to"] = msg["To"]

    monkeypatch.setattr("smtplib.SMTP_SSL", DummySMTPSSL)
    msg = MIMEMultipart()
    res = _send_mime_message(msg, "citizen@example.com")
    assert res.status == EmailDeliveryStatus.SENT
    assert captured["ssl_host"] == "smtp.gmail.com"
    assert captured["ssl_port"] == 465
    assert captured["user"] == "sender@gmail.com"
    assert captured["password"] == "abcdefghijklmnop"

