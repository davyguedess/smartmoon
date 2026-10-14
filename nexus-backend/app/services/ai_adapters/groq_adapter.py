"""
Groq adapter — OpenAI-compatible API with ultra-fast inference.

Groq is 100% OpenAI-compatible, just a different base URL and API key.
We inherit the OpenAI parsing logic and override only the URL endpoints.
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings
from .openai_adapter import OpenAIAdapter

_GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqAdapter(OpenAIAdapter):
    """Groq is OpenAI-compatible — reuse OpenAI adapter with different URL/key."""

    provider_name = "groq"

    def __init__(self, api_key: Optional[str] = None):
        # Call parent init with Groq key
        super().__init__(api_key=api_key or settings.GROQ_API_KEY)

    def validate_api_key(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    # Override the base URL used in parent methods
    # We monkey-patch the module-level constant at import time
    # instead, override the two request methods directly:

    async def stream(self, model, messages, system_prompt=None, max_tokens=4096, **kwargs):
        """Groq stream — same as OpenAI but via Groq endpoint."""
        import json
        import httpx
        from .base import AIChunk
        from .openai_adapter import _prepend_system

        full_messages = _prepend_system(messages, system_prompt)
        tokens_in = tokens_out = 0

        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"{_GROQ_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={
                    "model": model,
                    "messages": full_messages,
                    "stream": True,
                    "max_tokens": max_tokens,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        if chunk.get("usage"):
                            tokens_in = chunk["usage"].get("prompt_tokens", 0)
                            tokens_out = chunk["usage"].get("completion_tokens", 0)
                        token = chunk["choices"][0]["delta"].get("content", "") if chunk.get("choices") else ""
                        if token:
                            yield AIChunk(token=token)
                    except Exception:
                        pass

        yield AIChunk(token="", tokens_in=tokens_in, tokens_out=tokens_out)

    async def complete(self, model, messages, system_prompt=None, max_tokens=2048, **kwargs):
        """Groq complete — same as OpenAI but via Groq endpoint."""
        import httpx
        from .base import AIResponse
        from .openai_adapter import _prepend_system

        full_messages = _prepend_system(messages, system_prompt)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_GROQ_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={"model": model, "messages": full_messages, "max_tokens": max_tokens},
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return AIResponse(
            content=content,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            model=model,
            provider="groq",
        )

    async def embed(self, text: str, model: Optional[str] = None, **kwargs) -> list[float]:
        """Groq does not natively support embeddings. Use OpenAI or Gemini."""
        from loguru import logger
        logger.warning("Groq does not natively support embeddings. Returning empty list.")
        return []
