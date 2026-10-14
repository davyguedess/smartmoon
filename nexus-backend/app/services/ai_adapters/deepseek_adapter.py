"""
DeepSeek adapter — OpenAI-compatible API.

Free tier + ultra-low cost paid.
Models: deepseek-chat (general), deepseek-reasoner (R1 reasoning)
API: https://api.deepseek.com/v1  (OpenAI-compatible)
"""
from __future__ import annotations
from typing import Optional
import json, httpx

from app.core.config import settings
from .base import AIChunk, AIResponse, BaseAIAdapter

_BASE_URL = "https://api.deepseek.com/v1"

def _prepend_system(messages: list[dict], system_prompt: Optional[str]) -> list[dict]:
    if not system_prompt:
        return messages
    return [{"role": "system", "content": system_prompt}] + [
        m for m in messages if m.get("role") != "system"
    ]


class DeepSeekAdapter(BaseAIAdapter):
    """DeepSeek — OpenAI-compatible, ultra-cheap, great reasoning."""

    provider_name = "deepseek"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.DEEPSEEK_API_KEY

    def validate_api_key(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def stream(self, model: str, messages: list[dict],
                     system_prompt: Optional[str] = None,
                     max_tokens: int = 4096, **kwargs):
        full_messages = _prepend_system(messages, system_prompt)
        tokens_in = tokens_out = 0

        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST", f"{_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={"model": model, "messages": full_messages,
                      "stream": True, "max_tokens": max_tokens},
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
                        token = (chunk["choices"][0]["delta"].get("content", "")
                                 if chunk.get("choices") else "")
                        if token:
                            yield AIChunk(token=token)
                    except Exception:
                        pass

        yield AIChunk(token="", tokens_in=tokens_in, tokens_out=tokens_out)

    async def complete(self, model: str, messages: list[dict],
                       system_prompt: Optional[str] = None,
                       max_tokens: int = 2048, **kwargs) -> AIResponse:
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
            model=model, provider="deepseek",
        )

    async def embed(self, text: str, model: Optional[str] = None, **kwargs) -> list[float]:
        """DeepSeek does not provide an official embedding endpoint yet. 
        Returns an empty list to satisfy the interface or can be routed to OpenAI.
        """
        # For now, return empty to avoid crash
        return []
