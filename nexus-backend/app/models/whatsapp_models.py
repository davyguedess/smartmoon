"""
WhatsApp Cloud API Models — Conversations, Messages & State.
Mirrors the Telegram model architecture for consistency.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversations"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=False)

    # WhatsApp identifiers
    wa_id = Column(String(50), nullable=False)          # Remote phone number (e.g. "5511999998888")
    phone_number = Column(String(30), nullable=True)    # Formatted: +55 11 99999-8888
    display_name = Column(String(200), nullable=True)   # Profile push name
    profile_pic_url = Column(String(500), nullable=True)

    current_agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    status = Column(String(20), default="open")  # open, active, human_takeover, closed

    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True))

    messages = relationship("WhatsAppMessage", back_populates="conversation", cascade="all, delete-orphan")
    state = relationship("WhatsAppConversationState", back_populates="conversation", uselist=False)

    __table_args__ = (
        Index("ix_wa_conv_company", "company_id", "status"),
        Index("ix_wa_conv_waid", "wa_id", "integration_id", unique=True),
    )


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("whatsapp_conversations.id"), nullable=False)

    direction = Column(String(10), nullable=False)      # inbound, outbound
    sender_type = Column(String(20), default="user")    # user, agent, operator, system
    message_type = Column(String(20), default="text")   # text, image, audio, video, document, location, contacts, interactive, template

    content_text = Column(Text, nullable=True)
    content_json = Column(JSON, nullable=True)          # Raw Meta payload

    # Media
    media_id = Column(String(200), nullable=True)       # Meta media ID
    media_url = Column(String(500), nullable=True)
    media_mime = Column(String(100), nullable=True)

    # WhatsApp message ID (wamid)
    wamid = Column(String(200), nullable=True, unique=True)
    # Delivery status: sent → delivered → read → failed
    delivery_status = Column(String(20), nullable=True)

    # AI telemetry
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    model = Column(String(50), nullable=True)
    provider = Column(String(50), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("WhatsAppConversation", back_populates="messages")

    __table_args__ = (
        Index("ix_wa_msg_conv_created", "conversation_id", "created_at"),
    )


class WhatsAppConversationState(Base):
    """AI-generated conversation state — summary, facts, intent."""
    __tablename__ = "whatsapp_conversation_states"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("whatsapp_conversations.id"), nullable=False, unique=True)

    summary = Column(Text, nullable=True)
    facts_extracted = Column(JSON, nullable=True)
    last_intent = Column(String(100), nullable=True)
    main_topic = Column(String(100), nullable=True)

    memory_snapshot = Column(JSON, nullable=True)

    handoff_required = Column(Boolean, default=False)
    handoff_reason = Column(Text, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    conversation = relationship("WhatsAppConversation", back_populates="state")
