"""Initial LIFE SIGNAL relational + PostGIS schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-25 00:00:00
"""
from __future__ import annotations

from alembic import op
import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START 1")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("firebase_uid", sa.String(length=128), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("profile_image", sa.String(length=1024), nullable=True),
        sa.Column("role", sa.Enum("citizen", "admin", name="user_role"), nullable=False, server_default="citizen"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("firebase_uid"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "complaints",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_number", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "pothole",
                "road_crack",
                "garbage_accumulation",
                "broken_streetlight",
                "water_leakage",
                "damaged_public_infrastructure",
                "open_or_damaged_manhole",
                name="complaint_category",
            ),
            nullable=False,
        ),
        sa.Column("image_path", sa.String(length=512), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("address", sa.String(length=320), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "status",
            sa.Enum(
                "submitted",
                "under_review",
                "verified",
                "in_progress",
                "resolved",
                "rejected",
                name="complaint_status",
            ),
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("priority_score", sa.Float(), nullable=True),
        sa.Column(
            "priority_level",
            sa.Enum("low", "medium", "high", "critical", name="priority_level"),
            nullable=True,
        ),
        sa.Column("priority_explanation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("complaint_number"),
    )
    op.create_index("ix_complaints_complaint_number", "complaints", ["complaint_number"])
    op.create_index("ix_complaints_user_id", "complaints", ["user_id"])
    op.create_index("ix_complaints_category", "complaints", ["category"])
    op.create_index("ix_complaints_status", "complaints", ["status"])
    op.create_index("ix_complaints_priority_score", "complaints", ["priority_score"])
    op.create_index("ix_complaints_status_created", "complaints", ["status", "created_at"])
    op.create_index("ix_complaints_category_created", "complaints", ["category", "created_at"])
    op.execute("CREATE INDEX IF NOT EXISTS ix_complaints_geom ON complaints USING GIST (geom)")

    op.create_table(
        "ai_analysis",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), nullable=False),
        sa.Column("predicted_category", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("uncertainty_score", sa.Float(), nullable=False),
        sa.Column("calibrated_confidence", sa.Float(), nullable=True),
        sa.Column("requires_human_verification", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("bounding_boxes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_demo_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("processing_time", sa.Float(), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_analysis_complaint_id", "ai_analysis", ["complaint_id"])

    op.create_table(
        "duplicate_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("primary_complaint_id", sa.Uuid(), nullable=False),
        sa.Column("related_complaint_id", sa.Uuid(), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=False),
        sa.Column("image_similarity", sa.Float(), nullable=True),
        sa.Column("text_similarity", sa.Float(), nullable=True),
        sa.Column("distance_meters", sa.Float(), nullable=True),
        sa.Column("time_diff_hours", sa.Float(), nullable=True),
        sa.Column(
            "review_status",
            sa.Enum("pending", "confirmed_duplicate", "dismissed", name="duplicate_review_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("primary_complaint_id <> related_complaint_id", name="ck_duplicate_distinct_complaints"),
        sa.ForeignKeyConstraint(["primary_complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["related_complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("primary_complaint_id", "related_complaint_id", name="uq_duplicate_pair"),
    )
    op.create_index("ix_duplicate_groups_primary_complaint_id", "duplicate_groups", ["primary_complaint_id"])
    op.create_index("ix_duplicate_groups_related_complaint_id", "duplicate_groups", ["related_complaint_id"])
    op.create_index("ix_duplicate_groups_similarity_score", "duplicate_groups", ["similarity_score"])
    op.create_index("ix_duplicate_groups_review_status", "duplicate_groups", ["review_status"])

    op.create_table(
        "complaint_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), nullable=False),
        sa.Column("pdf_path", sa.String(length=512), nullable=False),
        sa.Column("tracking_url", sa.String(length=512), nullable=False),
        sa.Column(
            "email_delivery_status",
            sa.Enum("pending", "sent", "failed", "not_configured", name="email_delivery_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("email_recipient", sa.String(length=255), nullable=False),
        sa.Column("email_error", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_complaint_documents_complaint_id", "complaint_documents", ["complaint_id"])

    op.create_table(
        "complaint_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), nullable=False),
        sa.Column(
            "previous_status",
            postgresql.ENUM(
                "submitted",
                "under_review",
                "verified",
                "in_progress",
                "resolved",
                "rejected",
                name="complaint_status",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "new_status",
            postgresql.ENUM(
                "submitted",
                "under_review",
                "verified",
                "in_progress",
                "resolved",
                "rejected",
                name="complaint_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("changed_by", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_complaint_history_complaint_id", "complaint_history", ["complaint_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("complaint_history")
    op.drop_table("complaint_documents")
    op.drop_table("duplicate_groups")
    op.drop_table("ai_analysis")
    op.drop_table("complaints")
    op.drop_table("users")
    op.execute("DROP SEQUENCE IF EXISTS complaint_number_seq")
    for enum_name in (
        "email_delivery_status",
        "duplicate_review_status",
        "priority_level",
        "complaint_status",
        "complaint_category",
        "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

