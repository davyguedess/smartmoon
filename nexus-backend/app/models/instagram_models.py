"""
Instagram DM Models — Conversations, Messages & State.
Mirrors the WhatsApp model architecture for consistency.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class InstagramConversation(Base):
    __tablename__ = "instagram_conversations"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=False)

    # Instagram identifiers
    ig_user_id = Column(String(100), nullable=False)      # IGSID (Instagram Scoped ID)
    username = Column(String(255), nullable=True)          # @handle
    display_name = Column(String(255), nullable=True)
    profile_pic_url = Column(Text, nullable=True)

    current_agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    status = Column(String(30), default="active")  # active, closed, human_takeover

    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True))

    messages = relationship("InstagramMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_ig_conv_company", "company_id", "status"),
        Index("ix_ig_conv_igid", "ig_user_id", "integration_id", unique=True),
    )


class InstagramMessage(Base):
    __tablename__ = "instagram_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("instagram_conversations.id"), nullable=False)

    direction = Column(String(10), nullable=False)         # inbound, outbound
    sender_type = Column(String(20), default="user")       # user, bot, agent
    message_type = Column(String(30), default="text")      # text, image, video, story_reply, story_mention, share

    content_text = Column(Text, nullable=True)
    content_json = Column(JSON, nullable=True)             # Raw Meta payload

    # Media
    media_url = Column(Text, nullable=True)
    media_mime = Column(String(100), nullable=True)

    # Instagram message ID
    ig_message_id = Column(String(255), nullable=True, unique=True)
    delivery_status = Column(String(30), nullable=True)    # sent, delivered, read

    # AI telemetry
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    model = Column(String(50), nullable=True)
    provider = Column(String(50), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    conversation = relationship("InstagramConversation", back_populates="messages")

    __table_args__ = (
        Index("ix_ig_msg_conv_created", "conversation_id", "created_at"),
    )
