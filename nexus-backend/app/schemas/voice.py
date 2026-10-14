"""
Voice Schemas — Request/Response Pydantic models para módulo de voz.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ── VoiceProfile ──────────────────────────────────────────────────────────────

class VoiceProfileCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    provider: str = "elevenlabs"           # elevenlabs | openai | gtts | edge_tts
    provider_voice_id: Optional[str] = None
    language: str = "pt-BR"
    description: Optional[str] = None
    is_cloned: bool = False


class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = None
    provider_voice_id: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class VoiceProfileResponse(BaseModel):
    id: int
    company_id: int
    name: str
    provider: str
    provider_voice_id: Optional[str]
    language: str
    description: Optional[str]
    is_cloned: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VoiceProfileList(BaseModel):
    voices: List[VoiceProfileResponse]
    total: int


# ── TTS Request / Response ────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_profile_id: Optional[int] = None
    provider: Optional[str] = None          # override profile provider
    provider_voice_id: Optional[str] = None # override profile voice
    language: str = "pt-BR"
    output_format: str = "mp3"              # mp3 | wav | ogg
    speed: float = Field(1.0, ge=0.5, le=2.0)


class TTSResponse(BaseModel):
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    duration_seconds: Optional[float] = None
    provider: str
    voice_id: Optional[str] = None
    characters_used: int


# ── VoiceSample ──────────────────────────────────────────────────────────────

class VoiceSampleResponse(BaseModel):
    id: int
    voice_profile_id: int
    filename: str
    duration_seconds: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# ── VoiceGeneration Log ───────────────────────────────────────────────────────

class VoiceGenerationResponse(BaseModel):
    id: int
    voice_profile_id: Optional[int]
    provider: str
    characters_used: int
    duration_seconds: Optional[float]
    cost_usd: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True
