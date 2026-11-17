"""Initial schema for users, refresh tokens, PIPA consents, diary records, and collected cards.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-17 00:00:00+00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

JSON_VARIANT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("login_id", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("nickname", sa.String(length=64), nullable=False),
        sa.Column("is_adult_14_plus", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_login_id", "users", ["login_id"], unique=True)

    op.create_table(
        "consent_policies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("items", sa.Text(), nullable=False),
        sa.Column("retention_period", sa.String(length=255), nullable=False),
        sa.Column("refusal_notice", sa.Text(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", "version", name="uq_consent_policy_code_version"),
    )
    op.create_index("ix_consent_policies_code", "consent_policies", ["code"], unique=False)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)

    op.create_table(
        "user_consents",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("policy_code", sa.String(length=64), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False),
        sa.Column("agreed", sa.Boolean(), nullable=False),
        sa.Column("agreed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "policy_code", "policy_version", name="uq_user_consent_policy"),
    )
    op.create_index("ix_user_consents_user_id", "user_consents", ["user_id"], unique=False)

    op.create_table(
        "user_consent_logs",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("user_ref_hash", sa.String(length=64), nullable=False),
        sa.Column("policy_code", sa.String(length=64), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("client_meta_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_consent_logs_user_id", "user_consent_logs", ["user_id"], unique=False)
    op.create_index("ix_user_consent_logs_user_ref_hash", "user_consent_logs", ["user_ref_hash"], unique=False)

    op.create_table(
        "diary_records",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("client_record_id", sa.String(length=128), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False),
        sa.Column("analysis_status", sa.String(length=16), nullable=False),
        sa.Column("model_version", sa.String(length=128), nullable=True),
        sa.Column("taxonomy_version", sa.String(length=64), nullable=True),
        sa.Column("probabilities", JSON_VARIANT, nullable=True),
        sa.Column("dominant_emotion", sa.String(length=16), nullable=True),
        sa.Column("dominant_ratio", sa.Float(), nullable=True),
        sa.Column("ties", JSON_VARIANT, nullable=True),
        sa.Column("card_stage", sa.Integer(), nullable=True),
        sa.Column("card_key", sa.String(length=32), nullable=True),
        sa.Column("card_policy_version", sa.String(length=64), nullable=True),
        sa.Column("truncated", sa.Boolean(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "client_record_id", name="uq_diary_user_client_record_id"),
    )
    op.create_index("ix_diary_records_user_id", "diary_records", ["user_id"], unique=False)
    op.create_index("ix_diary_records_user_date", "diary_records", ["user_id", "record_date"], unique=False)
    op.create_index("ix_diary_records_user_card_key", "diary_records", ["user_id", "card_key"], unique=False)

    op.create_table(
        "collected_cards",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("card_key", sa.String(length=32), nullable=False),
        sa.Column("emotion_id", sa.String(length=16), nullable=False),
        sa.Column("card_stage", sa.Integer(), nullable=False),
        sa.Column("first_record_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("last_record_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("collect_count", sa.Integer(), nullable=False),
        sa.Column("first_collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["first_record_id"], ["diary_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["last_record_id"], ["diary_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "card_key", name="uq_collected_card_user_key"),
    )
    op.create_index("ix_collected_cards_user_id", "collected_cards", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_collected_cards_user_id", table_name="collected_cards")
    op.drop_table("collected_cards")
    op.drop_index("ix_diary_records_user_card_key", table_name="diary_records")
    op.drop_index("ix_diary_records_user_date", table_name="diary_records")
    op.drop_index("ix_diary_records_user_id", table_name="diary_records")
    op.drop_table("diary_records")
    op.drop_index("ix_user_consent_logs_user_ref_hash", table_name="user_consent_logs")
    op.drop_index("ix_user_consent_logs_user_id", table_name="user_consent_logs")
    op.drop_table("user_consent_logs")
    op.drop_index("ix_user_consents_user_id", table_name="user_consents")
    op.drop_table("user_consents")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_consent_policies_code", table_name="consent_policies")
    op.drop_table("consent_policies")
    op.drop_index("ix_users_login_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
