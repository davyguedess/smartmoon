"""
NEXUS.IA — Campaign Models
Skill: Instagram Campaign Publisher
6 tabelas para gerenciar campanhas com aprovação em etapas.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


# ─── Status da campanha ────────────────────────────────────────────────────────
CAMPAIGN_STATUSES = (
    "draft_created",
    "gathering_inputs",
    "creative_generation",
    "creative_pending_approval",
    "creative_approved",
    "caption_generation",
    "caption_pending_approval",
    "caption_approved",
    "publish_confirmation_pending",
    "ads_offer_pending",
    "audience_analysis_generation",
    "audience_analysis_pending_approval",
    "ready_to_publish",
    "publishing",
    "published",
    "rejected",
    "needs_revision",
    "canceled",
    "error",
)


class CampaignPost(Base):
    """Campanha principal — representa um post/campanha no Instagram.

    Orienta o fluxo de aprovação em etapas: criativo → legenda → publicação.
    """
    __tablename__ = "campaign_posts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Identificação
    campaign_name = Column(String(300), nullable=False)
    channel = Column(String(50), default="instagram", nullable=False)
    objective = Column(
        SAEnum("branding", "engagement", "lead_generation", "sales",
               name="campaign_objective"),
        default="engagement"
    )
    post_type = Column(
        SAEnum("image", "video", "reel", "carousel", name="campaign_post_type"),
        default="image"
    )
    source_type = Column(
        SAEnum("user_supplied", "ai_generated", "mixed", name="campaign_source_type"),
        default="ai_generated"
    )

    # Status da máquina de estados
    status = Column(
        SAEnum(*CAMPAIGN_STATUSES, name="campaign_status"),
        default="draft_created",
        nullable=False
    )

    # Conteúdo do briefing
    briefing_text = Column(Text, nullable=True)
    target_audience_summary = Column(Text, nullable=True)
    niche = Column(String(200), nullable=True)
    product_or_service = Column(String(300), nullable=True)
    cta_text = Column(String(300), nullable=True)
    notes = Column(Text, nullable=True)

    # Agendamento e publicação
    publish_scheduled_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamentos
    assets = relationship("CampaignAsset", back_populates="campaign", cascade="all, delete-orphan")
    approvals = relationship("CampaignApproval", back_populates="campaign", cascade="all, delete-orphan")
    publish_logs = relationship("CampaignPublishLog", back_populates="campaign", cascade="all, delete-orphan")
    audience_analysis = relationship("CampaignAudienceAnalysis", back_populates="campaign", uselist=False, cascade="all, delete-orphan")
    references = relationship("CampaignReference", back_populates="campaign", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_campaign_company_status", "company_id", "status"),
        Index("ix_campaign_company_agent", "company_id", "agent_id"),
        Index("ix_campaign_integration_status", "integration_id", "status"),
        Index("ix_campaign_company_created", "company_id", "created_at"),
    )


class CampaignAsset(Base):
    """Assets versionados de uma campanha: imagem, vídeo, legenda, hashtags, PDF.

    Cada geração ou upload cria uma nova versão (version_number incremental).
    """
    __tablename__ = "campaign_assets"

    id = Column(Integer, primary_key=True, index=True)
    campaign_post_id = Column(Integer, ForeignKey("campaign_posts.id"), nullable=False)

    asset_type = Column(
        SAEnum("image", "video", "caption", "hashtags", "pdf",
               "analysis", "thumbnail", name="campaign_asset_type"),
        nullable=False
    )
    origin = Column(
        SAEnum("user", "ai", "system", name="campaign_asset_origin"),
        default="ai"
    )
    version_number = Column(Integer, default=1, nullable=False)

    # Conteúdo
    content_text = Column(Text, nullable=True)       # para caption, hashtags, análise
    file_path = Column(String(500), nullable=True)   # para imagem, vídeo, PDF
    mime_type = Column(String(100), nullable=True)
    metadata_json = Column(JSONB, default=dict)      # prompt usado, params, etc.

    # Aprovação
    approval_status = Column(
        SAEnum("pending", "approved", "rejected", name="asset_approval_status"),
        default="pending"
    )
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("CampaignPost", back_populates="assets")

    __table_args__ = (
        Index("ix_campaign_asset_type_version", "campaign_post_id", "asset_type", "version_number"),
        Index("ix_campaign_asset_approval", "campaign_post_id", "approval_status"),
    )


class CampaignApproval(Base):
    """Registro de cada etapa de aprovação da campanha.

    Etapas: creative_approval | caption_approval | publish_confirmation |
            ads_analysis_approval | final_publish_approval
    """
    __tablename__ = "campaign_approvals"

    id = Column(Integer, primary_key=True, index=True)
    campaign_post_id = Column(Integer, ForeignKey("campaign_posts.id"), nullable=False)

    step_name = Column(String(100), nullable=False)
    step_order = Column(Integer, nullable=False, default=0)

    status = Column(
        SAEnum("pending", "approved", "rejected", "skipped",
               name="approval_step_status"),
        default="pending"
    )
    decision_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decision_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaign = relationship("CampaignPost", back_populates="approvals")

    __table_args__ = (
        Index("ix_campaign_approval_post_step", "campaign_post_id", "step_name"),
    )


class CampaignPublishLog(Base):
    """Log de cada tentativa de publicação na Graph API do Instagram."""
    __tablename__ = "campaign_publish_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_post_id = Column(Integer, ForeignKey("campaign_posts.id"), nullable=False)

    provider = Column(String(50), default="meta_instagram", nullable=False)
    container_id = Column(String(255), nullable=True)   # creation_id retornado pela Graph API
    media_id = Column(String(255), nullable=True)       # id final após publish
    publish_status = Column(String(50), nullable=True)  # success | error | pending
    request_payload_json = Column(JSONB, nullable=True)
    response_payload_json = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("CampaignPost", back_populates="publish_logs")


class CampaignAudienceAnalysis(Base):
    """Análise de público-alvo gerada por IA para tráfego pago."""
    __tablename__ = "campaign_audience_analysis"

    id = Column(Integer, primary_key=True, index=True)
    campaign_post_id = Column(Integer, ForeignKey("campaign_posts.id"), unique=True, nullable=False)

    niche_summary = Column(Text, nullable=True)
    audience_profile = Column(Text, nullable=True)
    competitor_examples_json = Column(JSONB, default=list)
    recommended_interests_json = Column(JSONB, default=list)
    recommended_regions_json = Column(JSONB, default=list)
    estimated_budget_range = Column(String(100), nullable=True)
    pdf_asset_id = Column(Integer, ForeignKey("campaign_assets.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("CampaignPost", back_populates="audience_analysis")


class CampaignReference(Base):
    """Benchmarks e referências externas pesquisadas para a campanha."""
    __tablename__ = "campaign_references"

    id = Column(Integer, primary_key=True, index=True)
    campaign_post_id = Column(Integer, ForeignKey("campaign_posts.id"), nullable=False)

    reference_source = Column(
        SAEnum("instagram", "web", "manual", name="reference_source_type"),
        default="web"
    )
    reference_url = Column(String(1000), nullable=True)
    reference_title = Column(String(500), nullable=True)
    reference_summary = Column(Text, nullable=True)
    niche_tag = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("CampaignPost", back_populates="references")

    __table_args__ = (
        Index("ix_campaign_ref_post", "campaign_post_id"),
    )
