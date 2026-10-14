from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class TelegramConversation(Base):
    __tablename__ = "telegram_conversations"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=False)
    
    external_chat_id = Column(String(100), nullable=False) # ID real do Telegram
    external_user_id = Column(String(100), nullable=True) # ID do usuário
    username = Column(String(100), nullable=True)
    display_name = Column(String(200), nullable=True)
    
    current_agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    status = Column(String(20), default="open") # open, idle, closed, handoff
    
    metadata_json = Column(JSON, nullable=True) # Dados extras
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True))

    # Relationships
    messages = relationship("TelegramMessage", back_populates="conversation")
    topics = relationship("TelegramTopic", back_populates="conversation")
    state = relationship("TelegramConversationState", back_populates="conversation", uselist=False)

class TelegramMessage(Base):
    __tablename__ = "telegram_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("telegram_conversations.id"), nullable=False)
    
    direction = Column(String(10), nullable=False) # inbound, outbound
    sender_type = Column(String(20)) # user, agent, operator, system
    message_type = Column(String(20), default="text") # text, audio, image, etc
    
    content_text = Column(Text, nullable=True)
    content_json = Column(JSON, nullable=True) # Payload bruto se necessário
    
    # Telemetria de IA
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    model = Column(String(50), nullable=True)
    provider = Column(String(50), nullable=True)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    
    external_message_id = Column(String(100), nullable=True) # ID no Telegram
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("TelegramConversation", back_populates="messages")

class TelegramConversationState(Base):
    __tablename__ = "telegram_conversation_states"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("telegram_conversations.id"), nullable=False, unique=True)
    
    summary = Column(Text, nullable=True)
    facts_extracted = Column(JSON, nullable=True) # Lista de fatos
    last_intent = Column(String(100), nullable=True)
    main_topic = Column(String(100), nullable=True)
    
    memory_snapshot = Column(JSON, nullable=True) # Estado da memória no momento
    
    handoff_required = Column(Boolean, default=False)
    handoff_reason = Column(Text, nullable=True)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    conversation = relationship("TelegramConversation", back_populates="state")

class TelegramTopic(Base):
    __tablename__ = "telegram_topics"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("telegram_conversations.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    confidence = Column(Float, default=1.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("TelegramConversation", back_populates="topics")

class TelegramFeedback(Base):
    __tablename__ = "telegram_feedbacks"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("telegram_conversations.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("telegram_messages.id"), nullable=True)
    
    feedback_type = Column(String(20)) # good, bad, corrected
    note = Column(Text, nullable=True)
    corrected_content = Column(Text, nullable=True)
    
    created_by = Column(Integer, nullable=True) # ID do operador se houver
    created_at = Column(DateTime(timezone=True), server_default=func.now())
