"""Firebase authentication session synchronization and user profile endpoints."""

from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dev_auth import issue_dev_token, verify_dev_token
from app.core.firebase import VerifiedFirebaseClaims, get_firebase_app, verify_firebase_token
from app.core.rate_limit import limiter
from app.core.security import get_current_user, record_audit_log, sync_user_from_claims
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthSessionResponse,
    DevLoginRequest,
    DevLoginResponse,
    SessionSyncRequest,
    UserProfileUpdate,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/dev-login", response_model=DevLoginResponse)
@limiter.limit("30/minute")
def dev_login_session(
    request: Request,
    payload: DevLoginRequest,
    db: Session = Depends(get_db),
) -> DevLoginResponse:
    """
    Local development authentication endpoint (strictly disabled outside APP_ENV=development).
    Does NOT simulate Google OAuth; issues a signed HS256 dev JWT and provisions a real PostgreSQL user.
    """
    settings = get_settings()
    if not settings.is_dev_auth_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development authentication is disabled.",
        )

    if (
        settings.normalized_sole_admin_email
        and payload.role == UserRole.ADMIN
        and str(payload.email).strip().lower() != settings.normalized_sole_admin_email
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Single-admin startup policy enabled: only the designated founder account can obtain administrator privileges.",
        )

    token = issue_dev_token(
        email=str(payload.email),
        full_name=payload.full_name,
        role=payload.role.value,
    )
    claims = verify_dev_token(token)
    client_ip = request.client.host if request.client else None
    user, created = sync_user_from_claims(
        db,
        claims,
        requested_full_name=payload.full_name,
        ip_address=client_ip,
    )
    return DevLoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        is_new_user=created,
        sign_in_provider="dev-local",
    )


@router.post("/session", response_model=AuthSessionResponse)
@limiter.limit("30/minute")
def sync_authenticated_session(
    request: Request,
    payload: Optional[SessionSyncRequest] = Body(default=None),
    claims: VerifiedFirebaseClaims = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    """Verify Firebase ID token, provision or load user record, and return RBAC profile."""
    client_ip = request.client.host if request.client else None
    requested_name = payload.full_name if payload else None
    user, created = sync_user_from_claims(
        db,
        claims,
        requested_full_name=requested_name,
        ip_address=client_ip,
    )
    return AuthSessionResponse(
        user=UserResponse.model_validate(user),
        is_new_user=created,
        sign_in_provider=claims.sign_in_provider,
    )


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    request: Request,
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    previous_name = current_user.full_name
    current_user.full_name = payload.full_name.strip()
    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=current_user.id,
        action="profile.updated",
        resource_type="user",
        resource_id=str(current_user.id),
        details={"previous_name": previous_name, "new_name": current_user.full_name},
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/logout")
def logout_session(
    request: Request,
    revoke_all_devices: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | bool]:
    settings = get_settings()
    revoked = False
    if revoke_all_devices and settings.has_firebase_service_account:
        from firebase_admin import auth as firebase_auth

        app = get_firebase_app()
        firebase_auth.revoke_refresh_tokens(current_user.firebase_uid, app=app)
        revoked = True

    client_ip = request.client.host if request.client else None
    record_audit_log(
        db,
        actor_user_id=current_user.id,
        action="auth.logout",
        resource_type="user",
        resource_id=str(current_user.id),
        details={"revoke_all_devices": revoked},
        ip_address=client_ip,
    )
    db.commit()
    return {"status": "logged_out", "revoked_refresh_tokens": revoked}

