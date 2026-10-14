# app/integrations/tts/kokoro_client.py

"""Kokoro TTS client

Provides a simple wrapper around the Kokoro‑FastAPI TTS service.
Expected endpoint: POST /v1/audio/speech with JSON payload {"input": "...", "voice": "...", "speed": 1.0, "response_format": "wav"}
Returns raw audio bytes.
"""

import httpx
from app.core.config import KOKORO_TTS_URL, TTS_TIMEOUT_SECONDS

class KokoroClient:
    def __init__(self, base_url: str = KOKORO_TTS_URL):
        self.base_url = base_url.rstrip('/')

    async def synthesize(self, text: str, fmt: str = "wav", voice: str = "af_heart", speed: float = 1.0, timeout: int = TTS_TIMEOUT_SECONDS) -> bytes:
        # OpenAI-compatible payload
        payload = {
            "model": "kokoro",
            "input": text,
            "voice": voice,
            "response_format": fmt,
            "speed": speed
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{self.base_url}/v1/audio/speech", json=payload, timeout=timeout)
            response.raise_for_status()
            return response.content

    async def get_voices(self) -> list:
        """List all available voices from the Kokoro service."""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/v1/audio/voices", timeout=5)
            response.raise_for_status()
            return response.json()
