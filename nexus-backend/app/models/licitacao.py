"""
Modelos do módulo Radar de Licitações IA
"""
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.session import Base
from app.models.base import TimestampMixin


class ScopeLevel(str, enum.Enum):
    municipal = "municipal"
    state = "state"
    federal = "federal"


class AnalysisLevel(str, enum.Enum):
    preliminar = "preliminar"
    intermediaria = "intermediaria"
    profunda = "profunda"


class Recommendation(str, enum.Enum):
    participar = "participar"
    avaliar_com_cautela = "avaliar_com_cautela"
    descartar = "descartar"


class AdherenceLevel(str, enum.Enum):
    baixa = "Baixa"
    media = "Média"
    alta = "Alta"
    excelente = "Excelente"


class DeliveryChannel(str, enum.Enum):
    dashboard = "dashboard"
    email = "email"
    whatsapp = "whatsapp"
    telegram = "telegram"


class BidActionType(str, enum.Enum):
    saved = "saved"
    discarded = "discarded"
    analyzed = "analyzed"
    assigned = "assigned"
    participate_decision = "participate_decision"


class PublicBid(Base, TimestampMixin):
    """Licitações normalizadas de múltiplas fontes."""
    __tablename__ = "public_bids"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)

    # Rastreabilidade da fonte
    source = Column(String(50), nullable=False)          # pncp, comprasgov, pcp
    external_bid_id = Column(String(200), nullable=False)
    source_url = Column(Text)
    raw_payload_json = Column(JSON)

    # Dados do órgão/localização
    organ_name = Column(String(300))
    municipality = Column(String(150))
    state = Column(String(2))
    scope_level = Column(SAEnum(ScopeLevel))

    # Dados da licitação
    title = Column(String(500))
    object_text = Column(Text)
    modality = Column(String(100))
    estimated_value = Column(Float)
    publication_date = Column(DateTime(timezone=True))
    deadline_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="published")
    has_edital = Column(Boolean, default=False)
    edital_text = Column(Text, nullable=True)  # Texto extraído do PDF do edital

    # Score rápido
    adherence_score = Column(Float)
    adherence_level = Column(SAEnum(AdherenceLevel))

    # Relacionamentos
    analyses = relationship("PublicBidAnalysis", back_populates="bid", cascade="all, delete-orphan")
    topics = relationship("PublicBidTopic", back_populates="bid", cascade="all, delete-orphan")
    actions = relationship("PublicBidAction", back_populates="bid", cascade="all, delete-orphan")


class PublicBidAnalysis(Base, TimestampMixin):
    """Análises IA geradas por agente para uma licitação."""
    __tablename__ = "public_bid_analyses"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    public_bid_id = Column(Integer, ForeignKey("public_bids.id"), nullable=False)
    agent_id = Column(Integer, nullable=True)

    analysis_level = Column(SAEnum(AnalysisLevel), default=AnalysisLevel.preliminar)
    executive_summary = Column(Text)
    adherence_score = Column(Float)
    adherence_level = Column(SAEnum(AdherenceLevel))
    commercial_potential = Column(String(20))   # alto, medio, baixo
    participation_complexity = Column(String(20))
    main_requirements = Column(JSON)  # list of strings
    main_risks = Column(JSON)         # list of strings
    documents_needed = Column(JSON)   # list of strings
    recommendation = Column(SAEnum(Recommendation))
    justification = Column(Text)

    bid = relationship("PublicBid", back_populates="analyses")


class PublicBidTopic(Base, TimestampMixin):
    """Tópicos/assuntos classificados por IA para uma licitação."""
    __tablename__ = "public_bid_topics"

    id = Column(Integer, primary_key=True, index=True)
    public_bid_id = Column(Integer, ForeignKey("public_bids.id"), nullable=False)
    topic_name = Column(String(150), nullable=False)
    topic_category = Column(String(100))
    confidence_score = Column(Float)

    bid = relationship("PublicBid", back_populates="topics")


class PublicBidAlert(Base, TimestampMixin):
    """Alertas configurados pelos usuários para monitoramento automático."""
    __tablename__ = "public_bid_alerts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    niche_id = Column(Integer, ForeignKey("niche_profiles.id"), nullable=True)
    state = Column(String(2))
    municipality = Column(String(150))
    modality = Column(String(100))
    min_value = Column(Float)
    max_value = Column(Float)
    score_min = Column(Float, default=0.0)
    only_with_edital = Column(Boolean, default=False)
    only_city_halls = Column(Boolean, default=False)
    keywords = Column(JSON)  # list of strings
    delivery_channel = Column(SAEnum(DeliveryChannel), default=DeliveryChannel.dashboard)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer)

    niche = relationship("NicheProfile")


class NicheProfile(Base, TimestampMixin):
    """Perfis de nicho personalizados para scoring e filtragem."""
    __tablename__ = "niche_profiles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    positive_keywords_json = Column(JSON, default=list)
    negative_keywords_json = Column(JSON, default=list)
    cnaes_json = Column(JSON, default=list)
    preferred_organs_json = Column(JSON, default=list)
    preferred_regions_json = Column(JSON, default=list)
    ideal_value_min = Column(Float)
    ideal_value_max = Column(Float)


class PublicBidAction(Base, TimestampMixin):
    """Histórico operacional/comercial de ações sobre uma licitação."""
    __tablename__ = "public_bid_actions"

    id = Column(Integer, primary_key=True, index=True)
    public_bid_id = Column(Integer, ForeignKey("public_bids.id"), nullable=False)
    company_id = Column(Integer, nullable=False, index=True)
    action_type = Column(SAEnum(BidActionType), nullable=False)
    note = Column(Text)
    created_by = Column(Integer)

    bid = relationship("PublicBid", back_populates="actions")
