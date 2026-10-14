from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import enum

class ChannelEnum(str, enum.Enum):
    whatsapp = "whatsapp"
    telegram = "telegram"
    other = "other"

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    channel = Column(Enum(ChannelEnum), nullable=False)
    external_id = Column(String, nullable=False, unique=True, index=True)  # ID from WhatsApp/Telegram
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")

    @classmethod
    async def get_or_create(cls, db, external_id: str, channel: str, tenant_id: int = 1):
        result = await db.execute(
            cls.__table__.select().where(cls.external_id == external_id)
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv
        conv = cls(
            tenant_id=tenant_id,
            channel=ChannelEnum(channel),
            external_id=external_id,
        )
        db.add(conv)
        await db.flush()
        return conv

class DirectionEnum(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"

class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    direction = Column(Enum(DirectionEnum), nullable=False)
    payload = Column(Text, nullable=False)  # raw text or JSON payload
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")

    @classmethod
    async def create(cls, db, conversation_id: int, direction: str, payload: str):
        msg = cls(
            conversation_id=conversation_id,
            direction=DirectionEnum(direction),
            payload=payload,
        )
        db.add(msg)
        await db.flush()
        return msg
