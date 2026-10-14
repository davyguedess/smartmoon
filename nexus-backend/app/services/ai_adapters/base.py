"""
Base adapter contract for all AI provider adapters.

Every adapter (OpenAI, Gemini, Claude, Groq, Ollama) must implement:
  - stream()   → AsyncIterator[AIChunk]     (for SSE streaming)
  - complete() → AIResponse                 (for single-shot calls)

"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional


# ── Data contracts ──────────────────────────────────────────

@dataclass
class AIChunk:
    """Single streaming token chunk from any provider."""
    token: str
    # Populated on the LAST chunk (usage data):
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None


@dataclass
class AIResponse:
    """Complete (non-streaming) response from any provider."""
    content: str
    tokens_in: int
    tokens_out: int
    model: str
    provider: str
    finish_reason: str = "stop"


# ── Base Adapter ────────────────────────────────────────────

class BaseAIAdapter(ABC):
    """Abstract base class — all adapters implement this interface."""

    provider_name: str = "unknown"

    @abstractmethod
    async def stream(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        **kwargs,
    ) -> AsyncIterator[AIChunk]:
        """Yield AIChunk objects as tokens arrive from the provider."""
        ...

    @abstractmethod
    async def complete(
        self,
        model: str,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        **kwargs,
    ) -> AIResponse:
        """Return a complete AIResponse (non-streaming)."""
        ...

    @abstractmethod
    async def embed(
        self,
        text: str,
        model: Optional[str] = None,
        **kwargs,
    ) -> list[float]:
        """Generate a vector embedding for the given text."""
        ...

    def validate_api_key(self) -> bool:
        """Return True if this adapter has a usable API key."""
        return True  # Ollama override returns True always; others check key
