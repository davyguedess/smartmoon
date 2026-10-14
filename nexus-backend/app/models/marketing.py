"""
Smart Moon — Marketing Pro Models
Módulo: Brand Kit, Módulos Marketing por empresa, Studio Usage, Meta Campaigns

IMPORTANTE: Não há checkout separado.
Os módulos marketing são ativados/desativados pelo superadmin dentro do plano
IA que a empresa já possui na plataforma.
"""
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, Numeric, Date, Float, Index
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.sql import func
from app.db.session import Base


class BrandKit(Base):
    """Identidade visual e pré-prompt da IA para geração de artes da empresa."""
    __tablename__ = "brand_kits"

    id               = Column(Integer, primary_key=True, index=True)
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                              unique=True, nullable=False)

    # Identidade
    brand_name       = Column(String(200), nullable=False)
    product          = Column(String(500))
    niche            = Column(String(200))
    target_audience  = Column(String(300))   # texto livre descritivo
    target_gender    = Column(String(30), default='todos')  # todos | masculino | feminino
    target_age_min   = Column(Integer, default=18)
    target_age_max   = Column(Integer, default=65)
    city_region      = Column(String(200))

    # Visual
    logo_url         = Column(Text)
    color_primary    = Column(String(7))      # #hex
    color_secondary  = Column(String(7))
    color_accent     = Column(String(7))
    color_background = Column(String(7))
    font_primary     = Column(String(100))
    font_secondary   = Column(String(100))

    # Direção de Arte
    visual_styles    = Column(ARRAY(String), default=list)
    texture_style    = Column(String(100))
    comm_tone        = Column(String(100))
    reference_images = Column(ARRAY(Text), default=list)

    # Pré-prompt gerado pela IA (editável)
    pre_prompt       = Column(Text)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(),
                              onupdate=func.now())

    __table_args__ = (Index("ix_brand_kit_company", "company_id"),)


class CompanyMarketingModules(Base):
    """
    Módulos Marketing Pro habilitados por empresa.
    Gerenciado exclusivamente pelo superadmin — sem checkout separado.
    Os módulos fazem parte do plano IA contratado pela empresa.
    """
    __tablename__ = "company_marketing_modules"

    id                = Column(Integer, primary_key=True, index=True)
    company_id        = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                               unique=True, nullable=False)

    # Flags de módulos
    has_brand_kit     = Column(Boolean, default=False, nullable=False)
    has_studio        = Column(Boolean, default=False, nullable=False)
    has_traffic_pro   = Column(Boolean, default=False, nullable=False)
    has_ig_campaigns  = Column(Boolean, default=False, nullable=False)

    # Limites do Studio
    studio_limit      = Column(Integer, default=50)   # gerações/mês (0 = ilimitado)

    # Meta Ads
    meta_accounts_limit = Column(Integer, default=1)  # contas Meta simultâneas

    # Controle admin
    activated_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes             = Column(Text)

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(),
                               onupdate=func.now())

    __table_args__ = (Index("ix_mkt_modules_company", "company_id"),)


class StudioUsage(Base):
    """Controle mensal de gerações de arte pelo Studio."""
    __tablename__ = "studio_usage"

    id                = Column(Integer, primary_key=True, index=True)
    company_id        = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                               nullable=False)
    month             = Column(String(7), nullable=False)   # "2026-04"
    generations_used  = Column(Integer, default=0)
    generations_limit = Column(Integer, default=50)

    __table_args__ = (
        Index("ix_studio_usage_company_month", "company_id", "month", unique=True),
    )


class MetaCampaign(Base):
    """Campanhas de tráfego pago gerenciadas via Meta Marketing API."""
    __tablename__ = "meta_campaigns"

    id               = Column(Integer, primary_key=True, index=True)
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                              nullable=False)

    # IDs da Meta API
    meta_campaign_id = Column(String(100))
    meta_adset_id    = Column(String(100))
    meta_ad_id       = Column(String(100))
    meta_ad_account  = Column(String(100))

    name             = Column(String(300), nullable=False)
    objective        = Column(String(100))
    status           = Column(String(50), default="draft")

    budget_daily     = Column(Numeric(10, 2))
    start_date       = Column(Date)
    end_date         = Column(Date)

    # Geo-targeting
    location_lat     = Column(Float)
    location_lng     = Column(Float)
    location_radius  = Column(Integer)
    location_name    = Column(String(300))

    target_audience  = Column(JSONB)
    ai_strategy      = Column(JSONB)
    pdf_report_url   = Column(Text)

    approved_at      = Column(DateTime(timezone=True))
    approved_by      = Column(Integer, ForeignKey("users.id"), nullable=True)

    last_metrics     = Column(JSONB)
    last_metrics_at  = Column(DateTime(timezone=True))

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(),
                              onupdate=func.now())

    __table_args__ = (
        Index("ix_meta_campaign_company", "company_id"),
        Index("ix_meta_campaign_status", "status"),
    )


class StudioTemplate(Base):
    """
    Templates de arte do Studio publicados pelos administradores.
    Modelo Canva: admins publicam (grátis ou pagos em créditos),
    usuários usam e editam no Studio editor.
    """
    __tablename__ = "studio_templates"

    id            = Column(Integer, primary_key=True, index=True)

    # Identificação
    name          = Column(String(120), nullable=False)
    description   = Column(String(500))
    category      = Column(String(50), nullable=False, default="Marketing")
    format        = Column(String(20), nullable=False, default="feed")  # feed|story|banner
    tags          = Column(ARRAY(String), default=list)

    # Monetização
    is_premium    = Column(Boolean, default=False, nullable=False)
    price_credits = Column(Integer, default=0)  # 0 = gratuito

    # Assets
    thumbnail_url = Column(Text)   # preview image URL ou base64 pequeno
    konva_json    = Column(JSONB, nullable=False)  # { elements:[], bgColor, format }

    # Ciclo de vida
    status        = Column(String(20), default="draft", nullable=False)  # draft|published
    created_by    = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Analytics
    view_count    = Column(Integer, default=0)
    use_count     = Column(Integer, default=0)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now())

    __table_args__ = (
        Index("ix_studio_tpl_status_cat", "status", "category"),
        Index("ix_studio_tpl_format",     "format"),
        Index("ix_studio_tpl_premium",    "is_premium"),
    )
