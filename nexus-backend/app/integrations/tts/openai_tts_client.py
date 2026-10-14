# app/integrations/tts/openai_tts_client.py
"""
OpenAI TTS Client — usado como fallback quando Kokoro/Piper estão offline.
Usa a API OpenAI compatível com o padrão /v1/audio/speech.
Vozes disponíveis: alloy, echo, fable, onyx, nova, shimmer
"""

import httpx
import os
from typing import Optional

# Vozes OpenAI mapeadas para contexto pt-BR
OPENAI_VOICES = [
    "nova",     # Feminino - recomendada para pt-BR
    "alloy",    # Neutro
    "echo",     # Masculino suave
    "fable",    # Britânico/narrativo
    "onyx",     # Masculino profundo
    "shimmer",  # Feminino suave
]

DEFAULT_VOICE = "nova"  # Melhor para português


class OpenAITTSClient:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = "tts-1"  # tts-1 (rápido) ou tts-1-hd (qualidade)

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("sk-"))

    async def synthesize(
        self,
        text: str,
        fmt: str = "mp3",
        voice: Optional[str] = None,
        speed: float = 1.0,
        timeout: int = 30
    ) -> bytes:
        if not self.is_configured():
            raise ValueError("OPENAI_API_KEY não configurada ou inválida")

        # Mapear voice do Kokoro (af_bella, pf_dora...) para OpenAI
        openai_voice = self._map_voice(voice)

        # Normalizar formato: OpenAI aceita mp3, opus, aac, flac, wav, pcm
        openai_fmt = fmt if fmt in ("mp3", "opus", "aac", "flac", "wav", "pcm") else "mp3"

        payload = {
            "model": self.model,
            "input": text,
            "voice": openai_voice,
            "response_format": openai_fmt,
            "speed": max(0.25, min(4.0, speed)),  # OpenAI aceita 0.25-4.0
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/audio/speech",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=timeout,
            )
            response.raise_for_status()
            return response.content

    def _map_voice(self, kokoro_voice: Optional[str]) -> str:
        """Mapeia voice IDs do Kokoro para vozes OpenAI compatíveis."""
        if not kokoro_voice:
            return DEFAULT_VOICE

        v = kokoro_voice.lower()

        # Português / feminino → nova
        if v.startswith("pf_") or "bella" in v or "heart" in v or "dora" in v:
            return "nova"

        # Português / masculino → onyx
        if v.startswith("pm_") or "adam" in v or "michael" in v:
            return "onyx"

        # Inglês feminino → shimmer
        if v.startswith("af_") or v.startswith("bf_"):
            return "shimmer"

        # Inglês masculino → echo
        if v.startswith("am_") or v.startswith("bm_"):
            return "echo"

        # Voz já é uma voz OpenAI válida
        if v in OPENAI_VOICES:
            return v

        return DEFAULT_VOICE

    async def get_voices(self) -> list:
        """Retorna vozes OpenAI disponíveis no formato compatível com Kokoro."""
        if not self.is_configured():
            return []
        return OPENAI_VOICES


# Singleton
openai_tts_client = OpenAITTSClient()
