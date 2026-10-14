"""
Claude (Anthropic) adapter — supports claude-3-5-sonnet, claude-3-haiku, etc.

Anthropic uses a different streaming event format:
  - content_block_delta events carry the text
  - usage comes in message_start and message_delta events
  - system prompt is a top-level field (not inside messages)
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Optional

import httpx
from loguru import logger

from app.core.config import settings
from .base import BaseAIAdapter, AIChunk, AIResponse

_BASE_URL = "https://api.anthropic.com/v1"
_ANTHROPIC_VERSION = "2023-06-01"


class ClaudeAdapter(BaseAIAdapter):
    provider_name = "claude"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.ANTHROPIC_API_KEY

    def validate_api_key(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict:
        return {
            "x-api-key": self._api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }

    @staticmethod
    def _filter_messages(messages: list[dict]) -> list[dict]:
        """Claude only accepts user/assistant roles in messages."""
        return [m for m in messages if m["role"] in ("user", "assistant")]

    # ── Streaming ──────────────────────────────────────────

    async def stream(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        **kwargs,
    ) -> AsyncIterator[AIChunk]:
        filtered = self._filter_messages(messages)
        tokens_in = tokens_out = 0

        body: dict = {
            "model": model,
            "messages": filtered,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if system_prompt:
            body["system"] = system_prompt

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{_BASE_URL}/messages",
                headers=self._headers(),
                json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    try:
                        event = json.loads(raw)
                        etype = event.get("type", "")

                        # Token extraction
                        if etype == "content_block_delta":
                            token = event.get("delta", {}).get("text", "")
                            if token:
                                yield AIChunk(token=token)

                        # Usage from message_start
                        elif etype == "message_start":
                            usage = event.get("message", {}).get("usage", {})
                            tokens_in = usage.get("input_tokens", 0)

                        # Usage update from message_delta
                        elif etype == "message_delta":
                            usage = event.get("usage", {})
                            tokens_out = usage.get("output_tokens", 0)

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
        filtered = self._filter_messages(messages)
        body: dict = {
            "model": model,
            "messages": filtered,
            "max_tokens": max_tokens,
        }
        if system_prompt:
            body["system"] = system_prompt

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{_BASE_URL}/messages",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["content"][0]["text"]
        usage = data.get("usage", {})
        return AIResponse(
            content=content,
            tokens_in=usage.get("input_tokens", 0),
            tokens_out=usage.get("output_tokens", 0),
            model=model,
            provider="claude",
            finish_reason=data.get("stop_reason", "end_turn"),
        )

    async def embed(self, text: str, model: Optional[str] = None, **kwargs) -> list[float]:
        """Claude does not natively support embeddings. Use OpenAI or Gemini."""
        logger.warning("Claude does not natively support embeddings. Returning empty list.")
        return []
