"""Development-only signed HS256 JWT authentication for local testing without Firebase.

Strictly disabled unless APP_ENV == 'development' and ENABLE_DEV_AUTH is True.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.firebase import VerifiedFirebaseClaims

DEV_TOKEN_ISSUER = "life-signal-dev-auth"
_FALLBACK_DEV_SECRET = "life-signal-local-dev-only-secret-do-not-use-in-prod"


def _get_dev_signing_secret() -> str:
    settings = get_settings()
    return settings.DEV_JWT_SECRET.strip() or _FALLBACK_DEV_SECRET


def issue_dev_token(*, email: str, full_name: str, role: str) -> str:
    """Issue an HS256 token strictly in local development mode."""
    settings = get_settings()
    if not settings.is_dev_auth_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development login is disabled outside APP_ENV=development.",
        )

    cleaned_email = email.strip().lower()
    uid_digest = hashlib.sha256(cleaned_email.encode("utf-8")).hexdigest()[:20]
    now = datetime.now(timezone.utc)
    payload = {
        "iss": DEV_TOKEN_ISSUER,
        "sub": f"dev-{uid_digest}",
        "email": cleaned_email,
        "name": full_name.strip(),
        "dev_role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=12)).timestamp()),
    }
    return jwt.encode(payload, _get_dev_signing_secret(), algorithm="HS256")


def verify_dev_token(token: str) -> VerifiedFirebaseClaims:
    """Verify a local development HS256 JWT token."""
    settings = get_settings()
    if not settings.is_dev_auth_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development authentication tokens are rejected in this environment.",
        )

    try:
        decoded = jwt.decode(
            token,
            _get_dev_signing_secret(),
            algorithms=["HS256"],
            issuer=DEV_TOKEN_ISSUER,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Development session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid development authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = str(decoded.get("sub") or "").strip()
    email = str(decoded.get("email") or "").strip().lower()
    if not uid or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed development token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return VerifiedFirebaseClaims(
        uid=uid,
        email=email,
        email_verified=True,
        name=(str(decoded["name"]).strip() if decoded.get("name") else None),
        picture=None,
        sign_in_provider="dev-local",
        dev_role=(str(decoded["dev_role"]) if decoded.get("dev_role") in {"citizen", "admin"} else None),
    )

