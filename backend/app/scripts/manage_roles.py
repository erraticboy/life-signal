"""Server-side CLI for promoting or demoting verified user roles."""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_session_factory
from app.core.security import record_audit_log
from app.models.user import User, UserRole


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Manage LIFE SIGNAL user roles safely from the server.")
    parser.add_argument("--email", required=True, help="Registered user email address")
    parser.add_argument("--role", required=True, choices=["citizen", "admin"], help="Target role")
    args = parser.parse_args(argv)

    factory = get_session_factory()
    if factory is None:
        print("Error: DATABASE_URL is not configured in backend/.env.", file=sys.stderr)
        return 1

    target_email = args.email.strip().lower()
    target_role = UserRole(args.role)

    sole_admin = get_settings().normalized_sole_admin_email
    if sole_admin and target_role == UserRole.ADMIN and target_email != sole_admin:
        print(
            f"Error: Single-admin policy restricts admin privileges exclusively to '{sole_admin}'.",
            file=sys.stderr,
        )
        return 1

    with factory() as db:
        user = db.execute(select(User).where(User.email == target_email)).scalar_one_or_none()
        if user is None:
            print(f"Error: No user found with email '{target_email}'. User must sign in once first.", file=sys.stderr)
            return 1

        previous_role = user.role.value
        user.role = target_role
        record_audit_log(
            db,
            actor_user_id=None,
            action="cli.user_role_updated",
            resource_type="user",
            resource_id=str(user.id),
            details={"email": target_email, "previous_role": previous_role, "new_role": target_role.value},
        )
        db.commit()
        print(f"Updated {target_email}: {previous_role} -> {target_role.value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

