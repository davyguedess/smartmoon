"""
OpenAI adapter — supports GPT-4o, GPT-4o-mini, and any OpenAI-compatible model.

Uses the official `openai` SDK already in requirements.txt.
Token usage is taken from `usage` field in the response.
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Optional

import httpx
from loguru import logger

from app.core.config import settings
from .base import BaseAIAdapter, AIChunk, AIResponse

_BASE_URL = "https://api.openai.com/v1"


class OpenAIAdapter(BaseAIAdapter):
    provider_name = "openai"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.OPENAI_API_KEY

    def validate_api_key(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

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
        tokens_in = tokens_out = 0

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={
                    "model": model,
                    "messages": full_messages,
                    "stream": True,
                    "stream_options": {"include_usage": True},
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
                        # Usage comes on the final chunk when stream_options set
                        if chunk.get("usage"):
                            tokens_in = chunk["usage"].get("prompt_tokens", 0)
                            tokens_out = chunk["usage"].get("completion_tokens", 0)
                        token = chunk["choices"][0]["delta"].get("content", "") if chunk.get("choices") else ""
                        if token:
                            yield AIChunk(token=token)
                    except Exception:
                        pass

        # Final chunk carries usage metadata
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

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE_URL}/chat/completions",
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
            provider="openai",
            finish_reason=data["choices"][0].get("finish_reason", "stop"),
        )

    async def embed(
        self,
        text: str,
        model: Optional[str] = "text-embedding-3-small",
        **kwargs,
    ) -> list[float]:
        """Generate a vector embedding using OpenAI's /embeddings endpoint."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/embeddings",
                headers=self._headers(),
                json={"model": model or "text-embedding-3-small", "input": text},
            )
            resp.raise_for_status()
            data = resp.json()
        return data["data"][0]["embedding"]


# ── Helpers ────────────────────────────────────────────────

def _prepend_system(messages: list[dict], system_prompt: Optional[str]) -> list[dict]:
    if not system_prompt:
        return messages
    return [{"role": "system", "content": system_prompt}, *messages]
