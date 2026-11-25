"""Authentication, profile, and admin user management schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class SessionSyncRequest(BaseModel):
    """Optional display name passed during initial email/password registration."""

    full_name: str | None = Field(default=None, min_length=2, max_length=160)


class DevLoginRequest(BaseModel):
    """Local development sign-in payload (only accepted when APP_ENV=development & ENABLE_DEV_AUTH=true)."""

    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    role: UserRole = UserRole.CITIZEN


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    full_name: str
    email: str
    email_verified: bool
    profile_image: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AuthSessionResponse(BaseModel):
    user: UserResponse
    is_new_user: bool
    sign_in_provider: str | None = None


class DevLoginResponse(AuthSessionResponse):
    access_token: str
    token_type: str = "bearer"


class UserProfileUpdate(BaseModel):
    """Editable citizen/admin profile fields; role cannot be edited by self."""

    full_name: str = Field(min_length=2, max_length=160)


class AdminRoleUpdateRequest(BaseModel):
    role: UserRole
    is_active: bool | None = None


class CitizenDashboardSummary(BaseModel):
    user: UserResponse
    total_complaints: int
    open_complaints: int
    resolved_complaints: int
    documents_generated: int
    phase_notice: str


class AdminOverviewResponse(BaseModel):
    total_users: int
    total_admins: int
    total_citizens: int
    total_complaints: int
    recent_audit_events: list[dict]

