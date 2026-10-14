"""
Ollama adapter — local LLM inference via the Ollama API.

Ollama does not return precise token usage data, so we use a char-based
estimate (1 token ≈ 4 chars) which is good enough for quota tracking
of free local models (cost = $0.00 regardless).
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Optional

import httpx
from loguru import logger

from app.core.config import settings
from .base import BaseAIAdapter, AIChunk, AIResponse


class OllamaAdapter(BaseAIAdapter):
    provider_name = "ollama"

    def __init__(self, base_url: Optional[str] = None):
        self._base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")

    def validate_api_key(self) -> bool:
        return True  # Ollama is local — no API key needed

    # ── Streaming ──────────────────────────────────────────

    async def stream(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        **kwargs,
    ) -> AsyncIterator[AIChunk]:
        full_messages = _prepend_system(messages, system_prompt)
        full_text = ""

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/api/chat",
                json={
                    "model": model,
                    "messages": full_messages,
                    "stream": True,
                    "keep_alive": -1,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            full_text += token
                            yield AIChunk(token=token)
                        if chunk.get("done"):
                            break
                    except Exception:
                        pass

        # Estimate tokens from content length (Ollama doesn't return usage)
        prompt_text = " ".join(m.get("content", "") for m in full_messages)
        tokens_in = _estimate_tokens(prompt_text)
        tokens_out = _estimate_tokens(full_text)
        yield AIChunk(token="", tokens_in=tokens_in, tokens_out=tokens_out)

    # ── Non-streaming ──────────────────────────────────────

    async def complete(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        **kwargs,
    ) -> AIResponse:
        full_messages = _prepend_system(messages, system_prompt)

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": model,
                    "messages": full_messages,
                    "stream": False,
                    "keep_alive": -1,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        content = data.get("message", {}).get("content", "")
        prompt_text = " ".join(m.get("content", "") for m in full_messages)

        return AIResponse(
            content=content,
            tokens_in=_estimate_tokens(prompt_text),
            tokens_out=_estimate_tokens(content),
            model=model,
            provider="ollama",
        )

    async def embed(
        self,
        text: str,
        model: Optional[str] = None,
        **kwargs,
    ) -> list[float]:
        """Generate a vector embedding using Ollama's /api/embeddings endpoint."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._base_url}/api/embeddings",
                json={"model": model or settings.OLLAMA_MODEL, "prompt": text},
            )
            resp.raise_for_status()
            data = resp.json()
        return data["embedding"]


# ── Helpers ────────────────────────────────────────────────

def _prepend_system(messages: list[dict], system_prompt: Optional[str]) -> list[dict]:
    if not system_prompt:
        return messages
    return [{"role": "system", "content": system_prompt}, *messages]


def _estimate_tokens(text: str) -> int:
    """Rough estimate: 1 token ≈ 4 chars (works for Portuguese/English)."""
    return max(1, len(text) // 4)
