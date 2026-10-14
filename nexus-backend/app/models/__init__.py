"""SQLAlchemy models for NEXUS.IA backend."""
import uuid
from datetime import date
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Date, Text,
    ForeignKey, Enum as SAEnum, BigInteger, Index, Numeric,
    UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
from .campaign import (
    CampaignPost, CampaignAsset, CampaignApproval,
    CampaignPublishLog, CampaignAudienceAnalysis, CampaignReference,
)
from .voice import (
    VoiceProfile, VoiceProfileSettings, VoiceSample, VoiceGeneration,
    AgentVoiceBinding
)
from .telegram_models import (
    TelegramConversation, TelegramMessage, TelegramConversationState,
    TelegramTopic, TelegramFeedback
)
from .whatsapp_models import (
    WhatsAppConversation, WhatsAppMessage, WhatsAppConversationState
)
from .instagram_models import (
    InstagramConversation, InstagramMessage
)
from .crm_models import (
    CRMContact, CRMOperator, CRMQuickReply, CRMTag,
    CRMBroadcast, CRMBroadcastLog, CRMInteraction,
)
from .project import (
    Project, ProjectPhase, ProjectTask, ProjectSubtask,
    ProjectMember, ProjectMeeting, ProjectDecision,
    ProjectComment, ProjectFile, ProjectAlert,
    ProjectDailyReport, ProjectOTPCode, ProjectMemberSession,
)
from .financial_models import FinancialRecord

__all__ = [
    "Company", "User", "Flow", "Execution", "ExecutionStep",
    "Integration", "WebhookEvent", "AuditLog",
    "UserProfile", "APIKeyStore", "AgentMemory", "RefreshToken",
    "AgentProfile", "AgentCustomSkill", "UsageLog",
    "VoiceProfile", "VoiceProfileSettings", "VoiceSample", "VoiceGeneration",
    "AgentVoiceBinding",
    "TelegramConversation", "TelegramMessage", "TelegramConversationState",
    "TelegramTopic", "TelegramFeedback",
    "CampaignPost", "CampaignAsset", "CampaignApproval",
    "CampaignPublishLog", "CampaignAudienceAnalysis", "CampaignReference",
    "WhatsAppConversation", "WhatsAppMessage", "WhatsAppConversationState",
    "PlatformSettings",
    # SaaS core
    "Plan", "SkillInstall", "AgentInstall", "PlatformSkill", "PlatformAgent",
    "UserCredit", "CreditTransaction",
    # Platform API Keys
    "PlatformAPIKey", "PlatformModelCost",
    # Knowledge & RAG
    "KnowledgeCategory",
    # AI Token Store
    "AITokenPack", "AITokenBalance", "AITokenTransaction",
    # CRM WhatsApp
    "CRMContact", "CRMOperator", "CRMQuickReply", "CRMTag",
    "CRMBroadcast", "CRMBroadcastLog", "CRMInteraction",
    # Project Manager
    "Project", "ProjectPhase", "ProjectTask", "ProjectSubtask",
    "ProjectMember", "ProjectMeeting", "ProjectDecision",
    "ProjectComment", "ProjectFile", "ProjectAlert",
    "ProjectDailyReport", "ProjectOTPCode", "ProjectMemberSession",
    # Financial Agent
    "FinancialRecord",
]


from .base import TimestampMixin


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    plan = Column(String(50), default="free")  # free | pro | enterprise
    is_active = Column(Boolean, default=True)

    users = relationship("User", back_populates="company")
    flows = relationship("Flow", back_populates="company")
    integrations = relationship("Integration", back_populates="company")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        SAEnum("owner", "admin", "operator", "analyst", "viewer", name="user_role"),
        default="operator"
    )
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False, nullable=False, server_default="false")
    document = Column(String(18), nullable=True)  # CPF or CNPJ formatted
    document_type = Column(String(4), nullable=True)  # 'cpf' or 'cnpj'
    birth_date = Column(Date, nullable=True)

    company = relationship("Company", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="actor")


class Flow(Base, TimestampMixin):
    __tablename__ = "flows"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(String(20), default="1.0")
    version_int = Column(Integer, default=1)
    status = Column(
        SAEnum("draft", "published", "archived", name="flow_status"),
        default="draft"
    )
    definition_json = Column(JSONB, nullable=False, default=dict)
    # Immutable snapshot created on publish — executions use THIS, not definition_json
    published_snapshot_json = Column(JSONB, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    published_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    company = relationship("Company", back_populates="flows")
    executions = relationship("Execution", back_populates="flow")

    __table_args__ = (
        Index("ix_flows_company_status", "company_id", "status"),
    )


class Execution(Base, TimestampMixin):
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("flows.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    status = Column(
        SAEnum(
            "draft", "queued", "running", "waiting",
            "success", "failed", "canceled",
            name="execution_status"
        ),
        default="queued"
    )
    trigger_type = Column(String(100), nullable=True)
    input_payload = Column(JSONB, default=dict)
    context_json = Column(JSONB, default=dict)
    current_node_id = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    retry_count = Column(Integer, default=0)
    worker_id = Column(String(100), nullable=True)
    triggered_by = Column(String(100), nullable=True)  # user_id or system

    flow = relationship("Flow", back_populates="executions")
    steps = relationship("ExecutionStep", back_populates="execution", order_by="ExecutionStep.id")

    __table_args__ = (
        Index("ix_executions_company_status_created", "company_id", "status", "created_at"),
    )


class ExecutionStep(Base):
    __tablename__ = "execution_steps"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=False)
    node_id = Column(String(100), nullable=False)
    node_type = Column(String(100), nullable=False)
    status = Column(
        SAEnum("running", "success", "failed", "skipped", name="step_status"),
        default="running"
    )
    input_json = Column(JSONB, default=dict)
    output_json = Column(JSONB, default=dict)
    error_json = Column(JSONB, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    execution = relationship("Execution", back_populates="steps")


class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    provider = Column(String(100), nullable=False)  # telegram, mercadopago, meta_ads, etc.
    status = Column(
        SAEnum("pending", "connected", "error", "disconnected", name="integration_status"),
        default="pending"
    )
    encrypted_credentials = Column(Text, nullable=True)
    config_json = Column(JSONB, default=dict)
    # URL do webhook externo — usado pela API pública SmartMoon
    # para entregar mensagens recebidas ao sistema do cliente
    external_webhook_url = Column(String(500), nullable=True)

    company = relationship("Company", back_populates="integrations")


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(100), nullable=False)
    external_event_id = Column(String(255), nullable=True)
    payload_json = Column(JSONB, nullable=False)
    processed = Column(Boolean, default=False)
    signature_valid = Column(Boolean, nullable=True)        # True/False/None if no sig
    error_message = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_webhook_provider_event", "provider", "external_event_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(200), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    metadata_json = Column(JSONB, default=dict)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_company_action", "company_id", "action", "created_at"),
    )


class UserProfile(Base, TimestampMixin):
    """Extended user profile — preferences, avatar, bio."""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)
    bio = Column(Text, nullable=True)
    timezone = Column(String(50), default="America/Sao_Paulo")
    language = Column(String(10), default="pt-BR")
    # JSON blob for UI preferences (theme, sidebar state, etc.)
    preferences_json = Column(JSONB, default=dict)

    user = relationship("User", foreign_keys=[user_id])


class APIKeyStore(Base, TimestampMixin):
    """Encrypted API keys per user per provider.
    Engine handlers check here FIRST, then fall back to .env (if allowed).
    In production: ALLOW_ENV_PROVIDER_FALLBACK=False blocks .env fallback.
    """
    __tablename__ = "api_key_store"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    provider = Column(String(100), nullable=False)   # openai | gemini | claude | groq | elevenlabs
    # Fernet-encrypted key stored as text
    encrypted_key = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    label = Column(String(200), nullable=True)   # user-facing description
    source = Column(String(20), default="tenant")   # tenant | global
    scope = Column(String(50), nullable=True)        # e.g. 'chat', 'flows', 'all'

    user = relationship("User")
    company = relationship("Company")

    __table_args__ = (
        Index("ix_apikeys_user_provider", "user_id", "provider"),
    )


class KnowledgeCategory(Base, TimestampMixin):
    """Knowledge categories for RAG isolation.
    Each company can have multiple categories (e.g. 'Sales', 'Support', 'Technical').
    Documents and memories are tagged with a category_id for strict partitioning.
    """
    __tablename__ = "knowledge_categories"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(10), default="📚")

    company = relationship("Company")

    __table_args__ = (
        Index("ix_knowledge_category_company_slug", "company_id", "slug", unique=True),
    )


class AgentMemory(Base):
    """Conversation memory for agents.
    Each message in every session is stored here so agents
    accumulate context over time. Supports per-agent isolation.
    """
    __tablename__ = "agent_memory"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("knowledge_categories.id"), nullable=True)
    session_id = Column(String(100), nullable=False, index=True)
    role = Column(
        SAEnum("system", "user", "assistant", name="memory_role"),
        nullable=False
    )
    content = Column(Text, nullable=False)
    model = Column(String(100), nullable=True)
    provider = Column(String(50), nullable=True)
    token_count = Column(Integer, nullable=True)
    flow_id = Column(Integer, ForeignKey("flows.id"), nullable=True)
    # Memory governance (Sprint 4 full)
    memory_scope = Column(String(30), default="session_only")   # agent_private|user_private|company_shared|session_only
    memory_type = Column(String(30), default="message")         # message|summary|fact|tool_state|knowledge_ref
    is_sensitive = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")

    __table_args__ = (
        Index("ix_memory_company_session", "company_id", "session_id", "created_at"),
    )


class RefreshToken(Base):
    """Revocable refresh tokens — raw token NEVER persisted.

    Rotation policy: each /auth/refresh call:
      1. validates the incoming token hash in this table
      2. marks it revoked=True IMMEDIATELY
      3. creates a new row with a fresh token
    On /auth/logout: marks ALL tokens for that user revoked=True.
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    # SHA-256 hex digest of the raw refresh token — never store the raw value
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    # Metadata for audit / session management
    device_info = Column(String(500), nullable=True)   # user-agent
    ip_address = Column(String(45), nullable=True)     # IPv4 or IPv6
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")

    __table_args__ = (
        Index("ix_refresh_user_revoked", "user_id", "revoked", "expires_at"),
    )


class AgentProfile(Base):
    """Agent profiles — configurable AI agents with memory governance rules.

    Each agent has its own system prompt, model, memory retention policy,
    and summarization config. Agents are scoped per-company (multi-tenant).
    sales_config stores structured sales agent configuration (identity, products,
    team, behavior rules, FAQs, business info, niche & Instagram intelligence).
    """
    __tablename__ = "agent_profiles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)          # unique identifier for code
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    model = Column(String(100), default="llama3.2")
    provider = Column(String(50), default="ollama")     # ollama|openai|gemini|groq
    temperature = Column(String(10), default="0.7")
    is_active = Column(Boolean, default=True)
    agent_type = Column(String(30), default="general")  # general|sales|support|custom
    knowledge_category_id = Column(Integer, ForeignKey("knowledge_categories.id"), nullable=True)

    # Memory governance rules (JSONB)
    memory_rules = Column(JSONB, default=lambda: {
        "retention_days": 90,
        "max_tokens_per_session": 8000,
        "auto_summarize_after": 20,     # Summarize after N messages
        "fact_extraction_enabled": True,
        "allowed_scopes": ["session_only", "user_private", "company_shared"],
    })

    # Sales agent structured config (JSONB)
    sales_config = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_agent_profile_company", "company_id", "slug", unique=True),
    )


class UsageLog(Base):
    """Monthly usage tracking per company — powers the billing/quota system.

    One row per (company_id, year, month). Counters are incremented atomically.
    Reset at the start of each billing cycle (month boundary).
    """
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)    # 1-12

    # Metered dimensions
    executions_count = Column(Integer, default=0, nullable=False)
    ai_tokens_used = Column(BigInteger, default=0, nullable=False)
    flows_created = Column(Integer, default=0, nullable=False)
    api_calls = Column(BigInteger, default=0, nullable=False)
    # Real USD cost — populated by CostTracker after every AI call
    from sqlalchemy import Numeric as _Numeric
    ai_cost_usd = Column(_Numeric(12, 6), default=0, nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_usage_company_period", "company_id", "year", "month", unique=True),
    )


class AgentCustomSkill(Base):
    """Custom skills created by each company — extends the built-in skill catalog.

    Each skill has a prompt_patch that is applied to the agent's system_prompt
    when the skill is active. Skills are scoped per-company.
    """
    __tablename__ = "agent_custom_skills"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)      # unique per company
    icon = Column(String(10), default="🔧")         # emoji
    category = Column(String(50), default="Custom")
    description = Column(Text, nullable=True)
    prompt_patch = Column(Text, nullable=True)      # appended to system_prompt when active
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_custom_skill_company_slug", "company_id", "slug", unique=True),
    )


class PlatformSettings(Base):
    """Key-value configuration table for platform-wide settings (SMTP, terms, etc.)."""
    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── SaaS Core Models ──────────────────────────────────────────────────────────

from sqlalchemy import Numeric as _Numeric  # noqa: E402


class Plan(Base, TimestampMixin):
    """SaaS subscription plans — created and managed by superadmin.

    This is the single source of truth for plan limits and features.
    billing_service.py reads from here instead of hardcoded PLAN_LIMITS.
    """
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)       # slug: "free", "pro"
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(_Numeric(12, 2), default=0, nullable=False)
    currency = Column(String(3), default="BRL")
    billing_cycle = Column(String(20), default="monthly")         # monthly | yearly | once
    duration_days = Column(Integer, default=30)

    # ── Resource limits (-1 = unlimited) ──
    max_flows = Column(Integer, default=3)
    max_agents = Column(Integer, default=2)
    max_skills = Column(Integer, default=3)
    max_integrations = Column(Integer, default=2)
    max_voice_profiles = Column(Integer, default=0)
    max_campaigns = Column(Integer, default=0)
    credits_per_month = Column(Integer, default=0)                # monthly credit grant

    # ── Feature gates ──
    # JSON array of feature slugs e.g. ["basic_flows", "telegram", "cloud_ai"]
    # Use ["*"] for enterprise wildcard (all features)
    modules = Column(JSONB, default=list, nullable=False, server_default="[]")
    free_skills = Column(JSONB, default=list, nullable=False, server_default="[]")  # skill slugs included

    # ── Display ──
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False)                  # highlight on pricing page
    sort_order = Column(Integer, default=0)
    color = Column(String(20), default="#6366f1")

    __table_args__ = (
        Index("ix_plans_name_active", "name", "is_active"),
    )

    def to_limits_dict(self) -> dict:
        """Convert to the format expected by billing_service."""
        import json
        modules_val = self.modules
        if isinstance(modules_val, str):
            try:
                modules_val = json.loads(modules_val)
            except Exception:
                modules_val = []
        return {
            "plan": self.name,
            "plan_label": self.display_name,
            "plan_color": self.color,
            "price": float(self.price),
            "currency": self.currency,
            "limits": {
                "flows_max": self.max_flows,
                "agents_max": self.max_agents,
                "skills_max": self.max_skills,
                "integrations_max": self.max_integrations,
                "voice_profiles_max": self.max_voice_profiles,
                "campaigns_max": self.max_campaigns,
                "executions_per_month": -1,   # kept for compat — use UsageLog
                "ai_tokens_per_month": -1,
                "api_calls_per_month": -1,
                "members_max": -1,
                "credits_per_month": self.credits_per_month,
            },
            "features": modules_val,
        }


class PlatformSkill(Base, TimestampMixin):
    """Skills available in the Smart Moon marketplace.

    Created by superadmin. Users install them via /store/skills.
    """
    __tablename__ = "platform_skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    long_description = Column(Text, nullable=True)
    icon = Column(String(10), default="🔧")
    category = Column(String(100), default="Geral")
    price_credits = Column(Integer, default=0)                   # 0 = free
    prompt_patch = Column(Text, nullable=True)                   # injected into system prompt
    is_active = Column(Boolean, default=True)
    is_exclusive = Column(Boolean, default=False)                # exclusive to specific companies
    exclusive_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    allowed_plans = Column(JSONB, default=list, server_default="[]")  # ["pro","enterprise"]
    tags = Column(JSONB, default=list, server_default="[]")
    install_count = Column(Integer, default=0)                   # cached counter
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        Index("ix_platform_skills_slug", "slug", unique=True),
    )


class PlatformAgent(Base, TimestampMixin):
    """Agent templates available in the Smart Moon marketplace.

    Created by superadmin. Companies install them via /store/agents.
    """
    __tablename__ = "platform_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    long_description = Column(Text, nullable=True)
    icon = Column(String(10), default="🤖")
    category = Column(String(100), default="Geral")              # sales|support|analytical|creative
    agent_type = Column(String(50), default="general")
    system_prompt = Column(Text, nullable=True)
    model = Column(String(100), default="gpt-4o-mini")
    provider = Column(String(50), default="openai")
    temperature = Column(String(10), default="0.7")
    price_credits = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_exclusive = Column(Boolean, default=False)
    exclusive_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    allowed_plans = Column(JSONB, default=list, server_default="[]")  # ["pro","enterprise"]
    tags = Column(JSONB, default=list, server_default="[]")
    install_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        Index("ix_platform_agents_slug", "slug", unique=True),
    )


class SkillInstall(Base):
    """Tracks which companies have installed which platform skills."""
    __tablename__ = "skill_installs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("platform_skills.id"), nullable=False)
    installed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    credits_spent = Column(Integer, default=0)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_skill_installs_company_skill", "company_id", "skill_id", unique=True),
    )


class AgentInstall(Base):
    """Tracks which companies have installed which platform agents."""
    __tablename__ = "agent_installs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("platform_agents.id"), nullable=False)
    installed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    credits_spent = Column(Integer, default=0)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    # Copy of agent config at install time — so edits to template don't break existing installs
    config_snapshot = Column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_agent_installs_company_agent", "company_id", "agent_id", unique=True),
    )


class UserCredit(Base, TimestampMixin):
    """Current credit balance per company."""
    __tablename__ = "user_credits"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False)
    balance = Column(Integer, default=0, nullable=False)
    total_earned = Column(Integer, default=0, nullable=False)
    total_spent = Column(Integer, default=0, nullable=False)

    company = relationship("Company")

    __table_args__ = (
        Index("ix_user_credits_company", "company_id", unique=True),
    )


class CreditTransaction(Base):
    """Immutable ledger of all credit movements."""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)      # positive=earn, negative=spend
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(
        SAEnum("grant", "purchase", "spend", "refund", "bonus", "expiry", name="credit_tx_type"),
        nullable=False
    )
    description = Column(String(500), nullable=True)
    reference_id = Column(String(100), nullable=True)    # e.g. skill_install_id
    reference_type = Column(String(50), nullable=True)   # "skill_install"|"agent_install"|"plan_renewal"
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # null = system
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_credit_tx_company_created", "company_id", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════════
# Platform API Keys — Chaves globais da plataforma
# ═══════════════════════════════════════════════════════════════════

class PlatformAPIKey(Base):
    """Global platform API keys managed by superadmin."""
    __tablename__ = "platform_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), nullable=False, default="")
    category = Column(String(100), nullable=False, default="ai")
    encrypted_key = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    default_model = Column(String(100), nullable=True)
    base_url = Column(String(500), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    test_status = Column(String(20), nullable=False, default="unknown")
    test_error = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    config_json = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    model_costs = relationship("PlatformModelCost", back_populates="platform_key", cascade="all, delete-orphan")


class PlatformModelCost(Base):
    """Per-model cost configuration in NEXUS tokens."""
    __tablename__ = "platform_model_costs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(100), ForeignKey("platform_api_keys.provider", ondelete="CASCADE"), nullable=False)
    model = Column(String(200), nullable=False)
    cost_input_per_1k = Column(Integer, nullable=False, default=5)
    cost_output_per_1k = Column(Integer, nullable=False, default=10)
    is_free = Column(Boolean, nullable=False, default=False)
    is_default = Column(Boolean, nullable=False, default=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    platform_key = relationship("PlatformAPIKey", back_populates="model_costs")

    __table_args__ = (
        Index("ix_platform_model_costs_provider", "provider"),
    )

# ── AI Token Store ─────────────────────────────────────────────────────────────

class AITokenPack(Base, TimestampMixin):
    """Catalog of AI token packs for purchase."""
    __tablename__ = "ai_token_packs"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    badge_text = Column(String)
    provider = Column(String, nullable=False, default="any")
    tokens_included = Column(BigInteger, nullable=False, default=100000)
    price_brl = Column(Numeric(10, 2), nullable=False, default=0)
    price_credits = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    is_highlighted = Column(Boolean, nullable=False, default=False)
    tier = Column(String, nullable=False, default="free")
    sort_order = Column(Integer, nullable=False, default=0)
    renews_monthly = Column(Boolean, nullable=False, default=True)
    color = Column(String, default="#a78bfa")
    icon = Column(String, default="zap")


class AITokenBalance(Base, TimestampMixin):
    """Company token balance per provider."""
    __tablename__ = "ai_token_balances"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String, nullable=False, default="any")
    balance_tokens = Column(BigInteger, nullable=False, default=0)
    total_purchased = Column(BigInteger, nullable=False, default=0)
    total_used = Column(BigInteger, nullable=False, default=0)
    reset_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("company_id", "provider"),
    )


class AITokenTransaction(Base):
    """Ledger of token consumption and credits."""
    __tablename__ = "ai_token_transactions"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String, nullable=False)
    model = Column(String)
    tokens_in = Column(BigInteger, nullable=False, default=0)
    tokens_out = Column(BigInteger, nullable=False, default=0)
    nexus_tokens_cost = Column(BigInteger, nullable=False, default=0)
    tx_type = Column(String, nullable=False, default="usage")
    source = Column(String)
    reference_id = Column(String)
    pack_id = Column(Integer, ForeignKey("ai_token_packs.id"))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
