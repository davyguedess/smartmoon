"""
Gemini adapter — supports gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash, etc.

Gemini uses a custom message format:
  - roles are "user" / "model" (not "assistant")
  - content is wrapped in parts: [{text: "..."}]
  - system prompt goes in system_instruction
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Optional

import httpx
from loguru import logger

from app.core.config import settings
from .base import BaseAIAdapter, AIChunk, AIResponse

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiAdapter(BaseAIAdapter):
    provider_name = "gemini"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.GEMINI_API_KEY

    def validate_api_key(self) -> bool:
        return bool(self._api_key)

    # ── Message conversion ─────────────────────────────────

    @staticmethod
    def _to_gemini_messages(messages: list[dict]) -> list[dict]:
        """Convert OpenAI-style messages to Gemini format."""
        result = []
        for m in messages:
            role = m["role"]
            if role == "system":
                continue  # system goes in system_instruction
            gemini_role = "model" if role == "assistant" else "user"
            result.append({"role": gemini_role, "parts": [{"text": m["content"]}]})
        return result

    def _build_body(
        self, model: str, messages: list[dict],
        system_prompt: Optional[str], max_tokens: int
    ) -> tuple[str, dict]:
        url_model = model
        contents = self._to_gemini_messages(messages)
        body: dict = {
            "contents": contents,
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        if system_prompt:
            body["system_instruction"] = {"parts": [{"text": system_prompt}]}
        return url_model, body

    # ── Streaming ──────────────────────────────────────────

    async def stream(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        **kwargs,
    ) -> AsyncIterator[AIChunk]:
        url_model, body = self._build_body(model, messages, system_prompt, max_tokens)
        tokens_in = tokens_out = 0

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{_BASE_URL}/{url_model}:streamGenerateContent",
                params={"key": self._api_key, "alt": "sse"},
                json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if not raw:
                        continue
                    try:
                        chunk = json.loads(raw)
                        # Extract token
                        candidates = chunk.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            token = parts[0].get("text", "") if parts else ""
                            if token:
                                yield AIChunk(token=token)
                        # Usage metadata (may come on last chunk)
                        usage = chunk.get("usageMetadata", {})
                        if usage:
                            tokens_in = usage.get("promptTokenCount", 0)
                            tokens_out = usage.get("candidatesTokenCount", 0)
                    except Exception:
                        pass

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
        url_model, body = self._build_body(model, messages, system_prompt, max_tokens)

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE_URL}/{url_model}:generateContent",
                params={"key": self._api_key},
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["candidates"][0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {})
        return AIResponse(
            content=content,
            tokens_in=usage.get("promptTokenCount", 0),
            tokens_out=usage.get("candidatesTokenCount", 0),
            model=model,
            provider="gemini",
        )

    async def embed(
        self,
        text: str,
        model: Optional[str] = "text-embedding-004",
        **kwargs,
    ) -> list[float]:
        """Generate a vector embedding using Gemini's :embedContent endpoint."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/{model or 'text-embedding-004'}:embedContent",
                params={"key": self._api_key},
                json={"content": {"parts": [{"text": text}]}},
            )
            resp.raise_for_status()
            data = resp.json()
        return data["embedding"]["values"]
