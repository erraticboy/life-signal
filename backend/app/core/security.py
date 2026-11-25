"""Role-based authorization dependencies, user provisioning, and audit logging."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.firebase import VerifiedFirebaseClaims, verify_firebase_token
from app.models.audit import AuditLog
from app.models.user import User, UserRole


def record_audit_log(
    db: Session,
    *,
    actor_user_id: Any | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Append an immutable audit log entry to the current database session."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry


def sync_user_from_claims(
    db: Session,
    claims: VerifiedFirebaseClaims,
    *,
    requested_full_name: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, bool]:
    """
    Resolve or provision the PostgreSQL user record from verified Firebase token claims.
    Never trusts client-supplied roles; admin bootstrap requires email_verified=True.
    """
    settings = get_settings()
    sole_admin_email = settings.normalized_sole_admin_email
    claim_email = claims.email.lower()
    is_bootstrap_admin = claims.email_verified and (claim_email in settings.admin_bootstrap_set)
    dev_role_override: UserRole | None = None
    if (
        settings.is_dev_auth_active
        and claims.sign_in_provider == "dev-local"
        and claims.dev_role in {"citizen", "admin"}
    ):
        requested_dev_role = UserRole(claims.dev_role)
        if sole_admin_email and requested_dev_role == UserRole.ADMIN and claim_email != sole_admin_email:
            dev_role_override = UserRole.CITIZEN
        else:
            dev_role_override = requested_dev_role

    user = db.execute(select(User).where(User.firebase_uid == claims.uid)).scalar_one_or_none()
    if user is None:
        # Link existing email record ONLY if the incoming Firebase token has a verified email
        existing_by_email = db.execute(select(User).where(User.email == claims.email)).scalar_one_or_none()
        if existing_by_email is not None:
            if not claims.email_verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Please verify your email address before linking to an existing account.",
                )
            existing_by_email.firebase_uid = claims.uid
            user = existing_by_email

    created = False
    if user is None:
        created = True
        fallback_name = claims.email.split("@")[0].replace(".", " ").title()
        resolved_name = (requested_full_name or claims.name or fallback_name).strip()[:160]
        resolved_role = dev_role_override or (UserRole.ADMIN if is_bootstrap_admin else UserRole.CITIZEN)
        user = User(
            firebase_uid=claims.uid,
            full_name=resolved_name,
            email=claims.email,
            email_verified=claims.email_verified,
            profile_image=claims.picture,
            role=resolved_role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        record_audit_log(
            db,
            actor_user_id=user.id,
            action="auth.user_registered",
            resource_type="user",
            resource_id=str(user.id),
            details={
                "role": user.role.value,
                "provider": claims.sign_in_provider,
                "email_verified": claims.email_verified,
            },
            ip_address=ip_address,
        )
    else:
        user.email_verified = claims.email_verified or user.email_verified
        if claims.email_verified and user.email != claims.email:
            user.email = claims.email
        if claims.picture and not user.profile_image:
            user.profile_image = claims.picture
        if claims.name and not user.full_name:
            user.full_name = claims.name[:160]
        if dev_role_override is not None and user.role != dev_role_override:
            user.role = dev_role_override
        elif is_bootstrap_admin and user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN
            record_audit_log(
                db,
                actor_user_id=user.id,
                action="auth.admin_bootstrapped",
                resource_type="user",
                resource_id=str(user.id),
                details={"email": user.email},
                ip_address=ip_address,
            )

    if sole_admin_email and user.role == UserRole.ADMIN and user.email.lower() != sole_admin_email:
        user.role = UserRole.CITIZEN
        record_audit_log(
            db,
            actor_user_id=user.id,
            action="security.sole_admin_role_enforced",
            resource_type="user",
            resource_id=str(user.id),
            details={"email": user.email, "demoted_to": "citizen"},
            ip_address=ip_address,
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact a LIFE SIGNAL administrator.",
        )

    db.commit()
    db.refresh(user)
    return user, created


def get_current_user(
    request: Request,
    claims: VerifiedFirebaseClaims = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate request via Firebase ID token and return active PostgreSQL User."""
    client_ip = request.client.host if request.client else None
    user, _ = sync_user_from_claims(db, claims, ip_address=client_ip)
    return user


def require_citizen(current_user: User = Depends(get_current_user)) -> User:
    """Ensure caller is an active authenticated citizen (or administrator)."""
    if current_user.role not in {UserRole.CITIZEN, UserRole.ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return current_user


def require_admin(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Strictly enforce backend Administrator authorization and log denied attempts."""
    if current_user.role != UserRole.ADMIN:
        client_ip = request.client.host if request.client else None
        record_audit_log(
            db,
            actor_user_id=current_user.id,
            action="security.admin_access_denied",
            resource_type="admin_endpoint",
            resource_id=request.url.path,
            details={"user_role": current_user.role.value},
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required to access this resource.",
        )
    return current_user

