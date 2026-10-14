import os
import hashlib
import httpx
import asyncio
from typing import Optional, Dict, Any
from loguru import logger
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.voice import VoiceProfile, VoiceGeneration

class VoiceService:
    """Service for handling AI voice generation (TTS)."""

    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db
        self.base_url = settings.KOKORO_TTS_URL
        self.storage_path = settings.TTS_STORAGE_PATH
        self.timeout = settings.TTS_TIMEOUT_SECONDS
        
        # Ensure storage directory exists
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path, exist_ok=True)

    async def generate_voice(
        self, 
        text: str, 
        company_id: int,
        voice_profile_id: Optional[int] = None,
        voice_name: str = "af_sky", # Default Kokoro voice
        speed: float = 1.0,
        lang: str = "pt-br"
    ) -> Dict[str, Any]:
        """
        Generates audio from text using Kokoro TTS.
        Checks for cache before generating.
        """
        # 1. Create a hash of the text + voice + speed for caching
        content_hash = hashlib.sha256(f"{text}|{voice_name}|{speed}|{lang}".encode()).hexdigest()
        filename = f"{content_hash}.{settings.TTS_DEFAULT_FORMAT}"
        relative_path = os.path.join(str(company_id), filename)
        absolute_path = os.path.join(self.storage_path, relative_path)

        # Ensure company subdirectory exists
        os.makedirs(os.path.dirname(absolute_path), exist_ok=True)

        # 2. Check if file already exists (Cache)
        if os.path.exists(absolute_path):
            logger.info(f"🔊 Voice cache hit: {filename}")
            return {
                "status": "success",
                "audio_path": relative_path,
                "cached": True,
                "filename": filename
            }

        # 3. Call Kokoro TTS API
        start_time = datetime.now()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "model": "kokoro",
                    "input": text,
                    "voice": voice_name,
                    "speed": speed,
                    "response_format": settings.TTS_DEFAULT_FORMAT,
                }
                
                logger.info(f"🎙️ Generating voice for company {company_id}: {text[:50]}...")
                response = await client.post(f"{self.base_url}/v1/audio/speech", json=payload)
                
                if response.status_code != 200:
                    logger.error(f"❌ Kokoro TTS error: {response.status_code} - {response.text[:200]}")
                    return {"status": "error", "message": "Failed to generate audio from provider"}

                # Save the audio file
                with open(absolute_path, "wb") as f:
                    f.write(response.content)

            generation_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.info(f"✅ Voice generated in {generation_ms}ms: {filename}")

            # 4. Log generation in DB if session available (skip for global/platform audio)
            if self.db and company_id > 0:
                try:
                    log = VoiceGeneration(
                        company_id=company_id,
                        voice_profile_id=voice_profile_id,
                        provider="kokoro",
                        source_text_hash=content_hash,
                        text_length=len(text),
                        audio_path=relative_path,
                        format=settings.TTS_DEFAULT_FORMAT,
                        generation_ms=generation_ms,
                        status="success"
                    )
                    self.db.add(log)
                    await self.db.commit()
                except Exception as db_err:
                    logger.warning(f"Voice log DB error (non-fatal): {db_err}")
                    await self.db.rollback()

            return {
                "status": "success",
                "audio_path": relative_path,
                "cached": False,
                "generation_ms": generation_ms,
                "filename": filename
            }

        except Exception as e:
            logger.error(f"❌ Voice generation failed: {str(e)}")
            return {"status": "error", "message": str(e)}

    async def get_available_voices(self) -> list:
        """Fetch available voices from Kokoro."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/v1/voices")
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception:
            return ["af_sky", "af_bella", "af_sarah", "am_adam", "am_michael"] # Fallback list
