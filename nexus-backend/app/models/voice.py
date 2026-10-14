from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
from .base import TimestampMixin
import enum

class VoiceTypeEnum(str, enum.Enum):
    native = "native"
    cloned = "cloned"
    custom = "custom"

class VoiceProfile(Base, TimestampMixin):
    __tablename__ = "voice_profiles"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False) # kokoro, xtts, openvoice, piper
    voice_type = Column(SAEnum(VoiceTypeEnum), default=VoiceTypeEnum.native)
    language_code = Column(String(10), default="pt-BR")
    base_voice_id = Column(String(100), nullable=True) # Original ID from provider
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    settings = relationship("VoiceProfileSettings", back_populates="voice_profile", uselist=False, cascade="all, delete-orphan")
    samples = relationship("VoiceSample", back_populates="voice_profile", cascade="all, delete-orphan")

class VoiceProfileSettings(Base):
    __tablename__ = "voice_profile_settings"
    id = Column(Integer, primary_key=True, index=True)
    voice_profile_id = Column(Integer, ForeignKey("voice_profiles.id"), unique=True, nullable=False)
    speed = Column(Float, default=1.0)
    pitch = Column(Float, default=1.0)
    style = Column(String(100), nullable=True)
    stability = Column(Float, default=0.5)
    similarity = Column(Float, default=0.5)
    temperature = Column(Float, default=0.7)
    volume_gain = Column(Float, default=0.0)
    audio_format = Column(String(10), default="wav")
    sample_rate = Column(Integer, default=22050)
    fallback_provider = Column(String(50), nullable=True)
    send_text_also = Column(Boolean, default=True)
    audio_max_chars = Column(Integer, default=500)

    voice_profile = relationship("VoiceProfile", back_populates="settings")

class VoiceSample(Base):
    __tablename__ = "voice_samples"
    id = Column(Integer, primary_key=True, index=True)
    voice_profile_id = Column(Integer, ForeignKey("voice_profiles.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    duration_seconds = Column(Float, nullable=True)
    language_detected = Column(String(10), nullable=True)
    quality_score = Column(Float, nullable=True)
    status = Column(String(20), default="ready") # uploading, validating, ready, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    voice_profile = relationship("VoiceProfile", back_populates="samples")

class VoiceGeneration(Base):
    __tablename__ = "voice_generations"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    voice_profile_id = Column(Integer, ForeignKey("voice_profiles.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    conversation_id = Column(String(100), nullable=True)
    provider = Column(String(50), nullable=False)
    source_text_hash = Column(String(64), nullable=True)
    text_length = Column(Integer, nullable=True)
    audio_path = Column(String(500), nullable=True)
    format = Column(String(10), nullable=True)
    status = Column(String(20), default="success")
    error_message = Column(Text, nullable=True)
    generation_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AgentVoiceBinding(Base):
    __tablename__ = "agent_voice_bindings"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=False)
    integration_id = Column(Integer, ForeignKey("integrations.id"), nullable=True)
    voice_profile_id = Column(Integer, ForeignKey("voice_profiles.id"), nullable=False)
    channel = Column(String(50), nullable=True) # whatsapp, telegram, all
    priority = Column(Integer, default=1)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
