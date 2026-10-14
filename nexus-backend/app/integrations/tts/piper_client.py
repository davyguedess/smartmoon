# app/integrations/tts/piper_client.py

"""Piper TTS client

Wraps the Piper TTS service (local or container). Expected endpoint: POST /synthesize with JSON {"text": "...", "format": "wav"}
Returns raw audio bytes.
"""

import httpx
from typing import Optional
from app.core.config import PIPER_TTS_URL, TTS_TIMEOUT_SECONDS


class PiperClient:
    def __init__(self, base_url: str = PIPER_TTS_URL):
        self.base_url = base_url.rstrip('/')

    async def synthesize(
        self, text: str, fmt: str = "wav", voice: Optional[str] = None, timeout: int = TTS_TIMEOUT_SECONDS
    ) -> bytes:
        payload = {"text": text, "format": fmt, "voice": voice}
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/synthesize", json=payload, timeout=timeout
            )
            response.raise_for_status()
            return response.content

    async def get_voices(self) -> list:
        """Piper voices listing (placeholder)"""
        return []
