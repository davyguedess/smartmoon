"""Initial schema — NEXUS.IA (all 12 tables + agent_id FK to agent_profiles).

Revision ID: 0001_initial_schema
Revises: —
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── companies ──────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("plan", sa.String(50), server_default="free"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── users ──────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum(
            "owner", "admin", "operator", "analyst", "viewer",
            name="user_role",
        ), server_default="operator"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── user_profiles ──────────────────────────────────────
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("phone", sa.String(30)),
        sa.Column("bio", sa.Text()),
        sa.Column("timezone", sa.String(50), server_default="America/Sao_Paulo"),
        sa.Column("language", sa.String(10), server_default="pt-BR"),
        sa.Column("preferences_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── refresh_tokens ─────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("device_info", sa.String(500)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_refresh_user_revoked", "refresh_tokens", ["user_id", "revoked", "expires_at"])

    # ── api_key_store ──────────────────────────────────────
    op.create_table(
        "api_key_store",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("label", sa.String(200)),
        sa.Column("source", sa.String(20), server_default="tenant"),
        sa.Column("scope", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_apikeys_user_provider", "api_key_store", ["user_id", "provider"])

    # ── flows ──────────────────────────────────────────────
    op.create_table(
        "flows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("version", sa.String(20), server_default="1.0"),
        sa.Column("version_int", sa.Integer(), server_default="1"),
        sa.Column("status", sa.Enum("draft", "published", "archived", name="flow_status"), server_default="draft"),
        sa.Column("definition_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("published_snapshot_json", postgresql.JSONB()),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("published_by", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_flows_company_status", "flows", ["company_id", "status"])

    # ── executions ─────────────────────────────────────────
    op.create_table(
        "executions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("flow_id", sa.Integer(), sa.ForeignKey("flows.id"), nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("status", sa.Enum(
            "draft", "queued", "running", "waiting", "success", "failed", "canceled",
            name="execution_status",
        ), server_default="queued"),
        sa.Column("trigger_type", sa.String(100)),
        sa.Column("input_payload", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("context_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("current_node_id", sa.String(100)),
        sa.Column("error_message", sa.Text()),
        sa.Column("queued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("worker_id", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_executions_company_status_created", "executions", ["company_id", "status", "created_at"])

    # ── execution_steps ────────────────────────────────────
    op.create_table(
        "execution_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("execution_id", sa.Integer(), sa.ForeignKey("executions.id"), nullable=False),
        sa.Column("node_id", sa.String(100), nullable=False),
        sa.Column("node_type", sa.String(100), nullable=False),
        sa.Column("status", sa.Enum("running", "success", "failed", "skipped", name="step_status"), server_default="running"),
        sa.Column("input_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("output_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("error_json", postgresql.JSONB()),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("duration_ms", sa.Integer()),
    )

    # ── integrations ───────────────────────────────────────
    op.create_table(
        "integrations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("status", sa.Enum("pending", "connected", "error", "disconnected", name="integration_status"), server_default="pending"),
        sa.Column("encrypted_credentials", sa.Text()),
        sa.Column("config_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── webhook_events ─────────────────────────────────────
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("external_event_id", sa.String(255)),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False),
        sa.Column("processed", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("signature_valid", sa.Boolean()),
        sa.Column("error_message", sa.Text()),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("execution_id", sa.Integer(), sa.ForeignKey("executions.id")),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_webhook_provider_event", "webhook_events", ["provider", "external_event_id"])

    # ── audit_logs ─────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id")),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("resource_type", sa.String(100)),
        sa.Column("resource_id", sa.String(100)),
        sa.Column("metadata_json", postgresql.JSONB(), server_default=sa.text("'{}'")),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_company_action", "audit_logs", ["company_id", "action", "created_at"])

    # ── agent_profiles ─────────────────────────────────────
    # Must come BEFORE agent_memory (FK dependency)
    op.create_table(
        "agent_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("system_prompt", sa.Text()),
        sa.Column("model", sa.String(100), server_default="llama3.2"),
        sa.Column("provider", sa.String(50), server_default="ollama"),
        sa.Column("temperature", sa.String(10), server_default="0.7"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("memory_rules", postgresql.JSONB(), server_default=sa.text(
            "'{\"retention_days\": 90, \"max_tokens_per_session\": 8000, "
            "\"auto_summarize_after\": 20, \"fact_extraction_enabled\": true, "
            "\"allowed_scopes\": [\"session_only\", \"user_private\", \"company_shared\"]}'"
        )),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_agent_profile_company", "agent_profiles", ["company_id", "slug"], unique=True)

    # ── agent_memory ───────────────────────────────────────
    op.create_table(
        "agent_memory",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id")),
        # FK to agent_profiles — properly enforced at DB level
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agent_profiles.id")),
        sa.Column("session_id", sa.String(100), nullable=False),
        sa.Column("role", sa.Enum("system", "user", "assistant", name="memory_role"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model", sa.String(100)),
        sa.Column("provider", sa.String(50)),
        sa.Column("token_count", sa.Integer()),
        sa.Column("flow_id", sa.Integer(), sa.ForeignKey("flows.id")),
        sa.Column("memory_scope", sa.String(30), server_default="session_only"),
        sa.Column("memory_type", sa.String(30), server_default="message"),
        sa.Column("is_sensitive", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_memory_company_session", "agent_memory", ["company_id", "session_id", "created_at"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("agent_memory")
    op.drop_table("agent_profiles")
    op.drop_table("audit_logs")
    op.drop_table("webhook_events")
    op.drop_table("integrations")
    op.drop_table("execution_steps")
    op.drop_table("executions")
    op.drop_table("flows")
    op.drop_table("api_key_store")
    op.drop_table("refresh_tokens")
    op.drop_table("user_profiles")
    op.drop_table("users")
    op.drop_table("companies")

    # Drop custom enums
    for enum in ["user_role", "flow_status", "execution_status", "step_status",
                 "integration_status", "memory_role"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
