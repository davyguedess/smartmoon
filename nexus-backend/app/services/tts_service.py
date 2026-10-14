# app/services/tts_service.py

"""TTS Service

Orchestrates text‑to‑speech synthesis using the primary provider (Kokoro) and a fallback (Piper).
It handles:
- Selecting the provider based on configuration.
- Invoking the appropriate client.
- Storing the generated audio file.
- Returning metadata about the audio (path, format, provider, duration).
"""

import os
import uuid
import hashlib
from pathlib import Path
from typing import Optional, Dict

from app.core.config import (
    TTS_PRIMARY_PROVIDER,
    TTS_FALLBACK_PROVIDER,
    TTS_STORAGE_MODE,
    TTS_STORAGE_PATH,
    TTS_DEFAULT_FORMAT,
    TTS_TIMEOUT_SECONDS,
)

# TTS Clients
from app.integrations.tts.kokoro_client import KokoroClient
from app.integrations.tts.piper_client import PiperClient
from app.integrations.tts.openai_tts_client import OpenAITTSClient

from app.db.session import AsyncSessionLocal
from app.models.voice import VoiceProfile, VoiceProfileSettings
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

# Simple audit logger placeholder
def audit_log(event: str, details: Dict):
    # In production replace with structured logger
    print(f"[TTS AUDIT] {event}: {details}")


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _store_audio(content: bytes, text_hash: str, fmt: str = TTS_DEFAULT_FORMAT) -> str:
    """Store audio bytes and return the absolute file path."""
    filename = f"{uuid.uuid4()}_{text_hash}.{fmt}"
    storage_dir = Path(TTS_STORAGE_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / filename
    with open(file_path, "wb") as f:
        f.write(content)
    return str(file_path)


class TTSService:
    def __init__(self):
        self.primary_client = KokoroClient() if TTS_PRIMARY_PROVIDER == "kokoro" else PiperClient()
        self.fallback_client = PiperClient() if TTS_FALLBACK_PROVIDER == "piper" else KokoroClient()
        self.openai_client = OpenAITTSClient()  # Always available as second fallback

    async def get_status(self) -> dict:
        """Check which TTS providers are currently available."""
        import httpx
        status = {"kokoro": "offline", "piper": "offline", "openai": "offline", "active": "none"}
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.primary_client.base_url}/v1/audio/voices", timeout=3)
                if r.status_code < 400:
                    status["kokoro"] = "online"
                    status["active"] = "kokoro"
        except Exception:
            pass
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.fallback_client.base_url}/health", timeout=2)
                if r.status_code < 400:
                    status["piper"] = "online"
                    if status["active"] == "none":
                        status["active"] = "piper"
        except Exception:
            pass
        if self.openai_client.is_configured():
            status["openai"] = "configured"
            if status["active"] == "none":
                status["active"] = "openai"
        return status

    async def resolve_voice_profile(self, company_id: int, agent_id: int, channel: Optional[str] = None) -> Optional[int]:
        """Find the linked voice profile for an agent/channel."""
        from app.models.voice import AgentVoiceBinding
        async with AsyncSessionLocal() as db:
            # 1. Try channel-specific binding
            query = select(AgentVoiceBinding.voice_profile_id).where(
                AgentVoiceBinding.company_id == company_id,
                AgentVoiceBinding.agent_id == agent_id
            )
            if channel:
                # Filter by specific channel or "all"
                from sqlalchemy import or_
                query = query.where(or_(AgentVoiceBinding.channel == channel, AgentVoiceBinding.channel == "all"))
            
            query = query.order_by(AgentVoiceBinding.priority.desc())
            result = await db.execute(query)
            v_id = result.scalar_one_or_none()
            
            if v_id:
                return v_id
            
            # 2. Try default for company if no agent binding exists
            result = await db.execute(
                select(VoiceProfile.id).where(
                    VoiceProfile.company_id == company_id,
                    VoiceProfile.is_default == True,
                    VoiceProfile.is_active == True
                )
            )
            return result.scalar_one_or_none()

    async def synthesize(
        self, 
        text: str, 
        fmt: Optional[str] = None, 
        voice: Optional[str] = None, 
        voice_profile_id: Optional[int] = None,
        agent_id: Optional[int] = None,
        company_id: Optional[int] = None,
        channel: Optional[str] = None
    ) -> Dict:
        """Generate audio for *text*.
        Returns a dict with keys: `file_path`, `provider`, `format`, `duration_ms` (optional).
        """
        fmt = fmt or TTS_DEFAULT_FORMAT
        
        # 1. Resolve voice profile if agent/company provided and no explicit ID
        if not voice_profile_id and agent_id and company_id:
            voice_profile_id = await self.resolve_voice_profile(company_id, agent_id, channel)
        
        # Determine voice settings from profile if provided
        voice_id = voice
        settings_override = {}
        
        if voice_profile_id:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(VoiceProfile).where(VoiceProfile.id == voice_profile_id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    voice_id = profile.base_voice_id or profile.slug
                    # Load settings (relationship)
                    from sqlalchemy.orm import selectinload
                    result = await db.execute(
                        select(VoiceProfile)
                        .options(selectinload(VoiceProfile.settings))
                        .where(VoiceProfile.id == voice_profile_id)
                    )
                    profile = result.scalar_one_or_none()
                    
                    if profile and profile.settings:
                        settings_override = {
                            "speed": profile.settings.speed,
                            "stability": profile.settings.stability,
                            "similarity": profile.settings.similarity
                        }
        
        # 2. Text length for quota tracking
        text_length = len(text)
        
        # Default voice if still none
        voice_id = voice_id or "af_bella"
        
        # Include voice and settings in hash
        hash_input = f"{text}|{voice_id}|{settings_override}"
        text_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()
        
        # Check cache
        existing = self._find_existing(text_hash, fmt)
        if existing:
            return {"file_path": existing, "provider": "cache", "format": fmt}

        import time
        start_time = time.perf_counter()

        # 1. Try primary (Kokoro)
        try:
            audio_bytes = await self.primary_client.synthesize(
                text,
                fmt=fmt,
                voice=voice_id,
                speed=settings_override.get("speed", 1.0),
                timeout=TTS_TIMEOUT_SECONDS,
            )
            provider_used = TTS_PRIMARY_PROVIDER
        except Exception as e:
            audit_log("tts_primary_failure", {"error": str(e)})

            # 2. Try Piper fallback
            try:
                audio_bytes = await self.fallback_client.synthesize(
                    text,
                    fmt=fmt,
                    timeout=TTS_TIMEOUT_SECONDS,
                )
                provider_used = TTS_FALLBACK_PROVIDER
            except Exception as e2:
                audit_log("tts_fallback_failure", {"error": str(e2)})

                # 3. Try OpenAI TTS (real audio, not dummy)
                try:
                    # OpenAI TTS works best with mp3; serve as wav-named but mp3 internally
                    openai_fmt = "mp3" if fmt == "wav" else fmt
                    audio_bytes = await self.openai_client.synthesize(
                        text,
                        fmt=openai_fmt,
                        voice=voice_id,
                        speed=settings_override.get("speed", 1.0),
                        timeout=TTS_TIMEOUT_SECONDS,
                    )
                    provider_used = "openai"
                    # Use mp3 extension for actual file if format was wav but we used mp3
                    if fmt == "wav":
                        fmt = "mp3"
                except Exception as e3:
                    audit_log("tts_openai_failure", {"error": str(e3)})
                    # Last resort: silent dummy (at least it won't crash)
                    from io import BytesIO
                    import wave
                    dummy_buffer = BytesIO()
                    with wave.open(dummy_buffer, "wb") as wf:
                        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(22050)
                        wf.writeframes(b"\x00\x00" * 22050)
                    audio_bytes = dummy_buffer.getvalue()
                    provider_used = "dummy"

        end_time = time.perf_counter()
        generation_time_ms = int((end_time - start_time) * 1000)

        file_path = _store_audio(audio_bytes, text_hash, fmt=fmt)

        # 4. Async logging to DB (Real-time monitoring)
        try:
            from app.models.voice import VoiceGeneration
            async with AsyncSessionLocal() as db:
                gen_log = VoiceGeneration(
                    company_id=company_id or 1, # Fallback to default company
                    voice_profile_id=voice_profile_id,
                    agent_id=agent_id,
                    provider=provider_used,
                    source_text_hash=text_hash,
                    text_length=text_length,
                    audio_path=file_path,
                    format=fmt,
                    generation_ms=generation_time_ms,
                    status="success"
                )
                db.add(gen_log)
                await db.commit()
        except Exception as log_err:
            audit_log("voice_gen_log_failure", {"error": str(log_err)})

        return {
            "file_path": file_path, 
            "provider": provider_used, 
            "format": fmt, 
            "voice_id": voice_id,
            "generation_time_ms": generation_time_ms
        }

    def _find_existing(self, text_hash: str, fmt: str) -> Optional[str]:
        storage_dir = Path(TTS_STORAGE_PATH)
        if not storage_dir.exists(): return None
        for p in storage_dir.iterdir():
            if p.is_file() and p.name.endswith(f"_{text_hash}.{fmt}"):
                return str(p)
        return None

    async def get_voices(self) -> list:
        try:
            return await self.primary_client.get_voices()
        except Exception as e:
            audit_log("tts_get_voices_failure", {"error": str(e)})
            return []

# Export singleton
tts_service = TTSService()
