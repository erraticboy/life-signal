"""Firebase Admin SDK initialization and ID token verification."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

if TYPE_CHECKING:
    import firebase_admin
    from firebase_admin import credentials

_bearer_scheme = HTTPBearer(auto_error=False)
_firebase_app: Any | None = None


@dataclass(frozen=True)
class VerifiedFirebaseClaims:
    """Verified identity attributes extracted from a Firebase ID token."""

    uid: str
    email: str
    email_verified: bool
    name: str | None
    picture: str | None
    sign_in_provider: str | None
    dev_role: str | None = None


def reset_firebase_app() -> None:
    """Reset cached Firebase app state (used in tests)."""
    global _firebase_app
    if _firebase_app is not None:
        import firebase_admin

        try:
            firebase_admin.delete_app(_firebase_app)
        except ValueError:
            pass
    _firebase_app = None


def _build_firebase_credentials() -> credentials.Base:
    from firebase_admin import credentials

    settings = get_settings()

    if settings.FIREBASE_SERVICE_ACCOUNT_JSON.strip():
        try:
            payload = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
        except json.JSONDecodeError as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc
        return credentials.Certificate(payload)

    sa_path = settings.resolved_firebase_service_account_path
    if sa_path is not None and sa_path.is_file():
        return credentials.Certificate(str(sa_path))

    raise RuntimeError(
        "Firebase Admin SDK credentials are missing. Provide FIREBASE_SERVICE_ACCOUNT_PATH "
        "or FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env."
    )


def get_firebase_app() -> firebase_admin.App:
    """Initialize and return the singleton Firebase Admin app."""
    global _firebase_app
    import firebase_admin

    if _firebase_app is not None:
        return _firebase_app

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    settings = get_settings()
    cred = _build_firebase_credentials()
    options: dict[str, Any] = {}
    if settings.FIREBASE_PROJECT_ID.strip():
        options["projectId"] = settings.FIREBASE_PROJECT_ID.strip()

    _firebase_app = firebase_admin.initialize_app(cred, options or None)
    return _firebase_app


def verify_firebase_token(
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> VerifiedFirebaseClaims:
    """Verify Firebase Bearer ID token (or signed dev JWT when explicitly enabled in development)."""
    settings = get_settings()
    if not settings.is_firebase_configured and not settings.is_dev_auth_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Firebase authentication is not configured on the backend. "
                "Follow docs/FIREBASE_SETUP.md to provide service account credentials."
            ),
        )

    if bearer is None or bearer.scheme.lower() != "bearer" or not bearer.credentials.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if settings.is_dev_auth_active:
        import jwt as pyjwt

        try:
            header = pyjwt.get_unverified_header(bearer.credentials)
        except pyjwt.PyJWTError:
            header = {}
        if header.get("alg") == "HS256":
            from app.core.dev_auth import verify_dev_token

            return verify_dev_token(bearer.credentials)

    if not settings.is_firebase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Firebase authentication is not configured on the backend. "
                "Follow docs/FIREBASE_SETUP.md to provide FIREBASE_PROJECT_ID or service account credentials."
            ),
        )

    if settings.has_firebase_service_account:
        from firebase_admin import auth as firebase_auth

        try:
            app = get_firebase_app()
            decoded: dict[str, Any] = firebase_auth.verify_id_token(
                bearer.credentials,
                app=app,
                check_revoked=True,
            )
        except firebase_auth.RevokedIdTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been revoked. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except firebase_auth.ExpiredIdTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please refresh your session.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except firebase_auth.InvalidIdTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Firebase authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except firebase_auth.CertificateFetchError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to fetch Firebase verification certificates.",
            ) from exc
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
    else:
        # Verify signature, issuer, audience, and expiry against Google's official Firebase public certificates
        from google.auth.exceptions import GoogleAuthError
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        try:
            decoded = google_id_token.verify_firebase_token(
                bearer.credentials,
                google_requests.Request(),
                audience=settings.FIREBASE_PROJECT_ID.strip(),
            )
        except GoogleAuthError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired Firebase authentication token ({exc}).",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to verify Firebase token with Google certificates ({type(exc).__name__}).",
            ) from exc

    uid = str(decoded.get("uid") or decoded.get("user_id") or decoded.get("sub") or "").strip()
    email = str(decoded.get("email") or "").strip().lower()
    if not uid or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated Firebase account must include a valid UID and email address.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_meta = decoded.get("firebase") if isinstance(decoded.get("firebase"), dict) else {}
    provider = firebase_meta.get("sign_in_provider") if isinstance(firebase_meta, dict) else None

    return VerifiedFirebaseClaims(
        uid=uid,
        email=email,
        email_verified=bool(decoded.get("email_verified", False)),
        name=(str(decoded["name"]).strip() if decoded.get("name") else None),
        picture=(str(decoded["picture"]).strip() if decoded.get("picture") else None),
        sign_in_provider=(str(provider) if provider else None),
    )

