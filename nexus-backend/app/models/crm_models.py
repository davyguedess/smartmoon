"""
SmartMoon CRM Models — WhatsApp CRM & Sales Prospecting.

Provides contact management, operator identification, quick replies,
broadcast campaigns, interaction tracking, and custom tagging.
All models are multi-tenant (company_id scoped).
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    Boolean, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import Numeric

from app.db.session import Base


# ── Contacts ──────────────────────────────────────────────────────────────────

class CRMContact(Base):
    """A WhatsApp contact in the CRM.

    Contacts can be created manually, imported via CSV,
    auto-created from inbound WhatsApp messages, or via API.
    """
    __tablename__ = "crm_contacts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)

    phone = Column(String(30), nullable=False)          # normalized: 5511999998888
    name = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)

    source = Column(String(30), default="manual")       # manual | csv_import | whatsapp_inbound | api
    status = Column(String(20), default="active")       # active | archived | blocked

    tags = Column(JSONB, default=list, server_default="[]")           # ["vip", "lead-quente"]
    custom_fields = Column(JSONB, default=dict, server_default="{}")  # user-defined fields

    notes = Column(Text, nullable=True)
    profile_pic_url = Column(String(500), nullable=True)
    push_name = Column(String(200), nullable=True)      # WhatsApp display name

    last_contact_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    interactions = relationship("CRMInteraction", back_populates="contact", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "phone", name="uq_crm_contact_company_phone"),
        Index("ix_crm_contact_company_status", "company_id", "status"),
        Index("ix_crm_contact_phone", "phone"),
    )


# ── Operators ─────────────────────────────────────────────────────────────────

class CRMOperator(Base):
    """An operator (human agent) who sends messages via the shared WhatsApp.

    When an operator sends a message, the system prefixes their display_name
    so the recipient knows who is speaking:

        *Maria*
        Olá sr Davy, tudo bem?
    """
    __tablename__ = "crm_operators"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    display_name = Column(String(100), nullable=False)  # "Maria"
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Template for operator signature: "{{name}}\n{{message}}"
    signature_template = Column(String(500), default="*{{name}}*\n{{message}}")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    interactions = relationship("CRMInteraction", back_populates="operator")

    __table_args__ = (
        Index("ix_crm_operator_company", "company_id"),
    )


# ── Quick Replies ─────────────────────────────────────────────────────────────

class CRMQuickReply(Base):
    """Pre-saved message templates for fast responses.

    Supports variable interpolation: {{contact_name}}, {{company}}, etc.
    Operators can trigger via shortcut (e.g. /boasvindas).
    """
    __tablename__ = "crm_quick_replies"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(200), nullable=False)         # "Boas-vindas"
    content = Column(Text, nullable=False)              # "Olá {{contact_name}}! ..."
    category = Column(String(50), default="geral")      # vendas | suporte | geral
    shortcut = Column(String(50), nullable=True)        # "/boasvindas"

    use_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_quick_reply_company", "company_id"),
    )


# ── Tags ──────────────────────────────────────────────────────────────────────

class CRMTag(Base):
    """Custom tags for organizing contacts.

    Each company can create their own tag taxonomy with colors.
    Tags are stored as a JSONB array on CRMContact for fast filtering.
    """
    __tablename__ = "crm_tags"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(100), nullable=False)          # "VIP"
    color = Column(String(20), default="#6366f1")       # hex color
    icon = Column(String(10), default="🏷️")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_crm_tag_company_name"),
        Index("ix_crm_tag_company", "company_id"),
    )


# ── Broadcasts ────────────────────────────────────────────────────────────────

class CRMBroadcast(Base):
    """A bulk message campaign targeting filtered contacts.

    Messages are dispatched via the SmartMoon Engine message queue
    with anti-ban delays. Progress is tracked in CRMBroadcastLog.
    """
    __tablename__ = "crm_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(200), nullable=False)          # "Promoção Maio"
    message_template = Column(Text, nullable=False)     # supports {{contact_name}}
    media_url = Column(String(500), nullable=True)      # optional image/document

    # Filter criteria for selecting target contacts
    target_filter = Column(JSONB, default=dict, server_default="{}")  # {"tags": ["lead"], "status": "active"}

    status = Column(String(20), default="draft")        # draft | sending | completed | paused | cancelled
    total_targets = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    delivered_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)

    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    logs = relationship("CRMBroadcastLog", back_populates="broadcast", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_crm_broadcast_company_status", "company_id", "status"),
    )


class CRMBroadcastLog(Base):
    """Per-recipient log entry for a broadcast campaign."""
    __tablename__ = "crm_broadcast_logs"

    id = Column(Integer, primary_key=True, index=True)
    broadcast_id = Column(Integer, ForeignKey("crm_broadcasts.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True)

    phone = Column(String(30), nullable=False)
    status = Column(String(20), default="pending")      # pending | sent | delivered | failed
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    broadcast = relationship("CRMBroadcast", back_populates="logs")

    __table_args__ = (
        Index("ix_crm_broadcast_log_broadcast", "broadcast_id", "status"),
    )


# ── Interactions ──────────────────────────────────────────────────────────────

class CRMInteraction(Base):
    """Tracks every meaningful interaction with a contact.

    Used for metrics, sales funnel, and activity timeline.
    """
    __tablename__ = "crm_interactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id", ondelete="CASCADE"), nullable=False)
    operator_id = Column(Integer, ForeignKey("crm_operators.id", ondelete="SET NULL"), nullable=True)

    interaction_type = Column(String(30), nullable=False)  # message_sent | message_received | sale | appointment | note
    channel = Column(String(20), default="whatsapp")

    value = Column(Numeric(12, 2), nullable=True)       # monetary value (for sales)
    content = Column(Text, nullable=True)                # message text content
    notes = Column(Text, nullable=True)
    custom_label = Column(String(100), nullable=True)    # user-defined label

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contact = relationship("CRMContact", back_populates="interactions")
    operator = relationship("CRMOperator", back_populates="interactions")

    __table_args__ = (
        Index("ix_crm_interaction_company_type", "company_id", "interaction_type", "created_at"),
        Index("ix_crm_interaction_contact", "contact_id", "created_at"),
    )
