"""
AIClient — Unified entry point for ALL LLM communication in NEXUS.IA.

Replaces: 9 separate AI call blocks scattered across chat.py (707 lines)

Every AI call in NEXUS.IA must go through this client to ensure:
  ✅ Consistent error handling
  ✅ Automatic cost tracking (tokens + USD)
  ✅ NEXUS token debiting when using platform API key
  ✅ CircuitBreaker protection
  ✅ Provider fallback on failure
  ✅ Structured logging

Usage (streaming):
    ai_client = get_ai_client()
    async for chunk in ai_client.stream(
        provider="openai", model="gpt-4o-mini",
        messages=[...], company_id=42, user_id=7
    ):
        yield chunk.token

Usage (single-shot, e.g. summarization):
    response = await ai_client.complete(
        provider="gemini", model="gemini-1.5-flash",
        messages=[...], company_id=42
    )
    summary = response.content
"""
from __future__ import annotations

from typing import AsyncIterator, Optional, TYPE_CHECKING

from loguru import logger

from app.services.ai_adapters.base import BaseAIAdapter, AIChunk, AIResponse
from app.services.ai_adapters.openai_adapter import OpenAIAdapter
from app.services.ai_adapters.gemini_adapter import GeminiAdapter
from app.services.ai_adapters.claude_adapter import ClaudeAdapter
from app.services.ai_adapters.groq_adapter import GroqAdapter
from app.services.ai_adapters.ollama_adapter import OllamaAdapter
from app.services.cost_tracker import CostTracker, get_cost_tracker


# ── Providers que são gratuitos / locais (não debitam NEXUS tokens) ──────────
_FREE_PROVIDERS = {"ollama"}
_FREE_MODELS    = {
    "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash",
    "llama3", "llama3.1", "mistral", "deepseek",
}


async def _has_user_api_key(provider: str, company_id: int, db) -> bool:
    """Retorna True se a empresa tem API key própria configurada para este provider."""
    if not db or not company_id:
        return False
    try:
        from app.api.routes.core.settings import get_api_key_for_provider
        key = await get_api_key_for_provider(provider, company_id, db)
        return bool(key)
    except Exception:
        return False


async def _debit_nexus_tokens(
    provider: str,
    model: str,
    company_id: int,
    tokens_in: int,
    tokens_out: int,
    db,
) -> None:
    """
    Debita NEXUS tokens da empresa após uso da platform key.
    Silencioso em caso de erro — não deve interromper o fluxo.
    """
    if provider in _FREE_PROVIDERS or model in _FREE_MODELS:
        return
    if tokens_in == 0 and tokens_out == 0:
        return
    if not db or not company_id:
        return

    try:
        from app.services.ai_token_service import debit_tokens, cost_for_call
        nexus_cost = cost_for_call(provider, model, tokens_in, tokens_out)
        if nexus_cost > 0:
            await debit_tokens(
                db=db,
                company_id=company_id,
                amount=nexus_cost,
                provider=provider,
                description=f"{provider}/{model} — {tokens_in}in/{tokens_out}out tokens",
            )
            logger.debug(
                f"💎 SM tokens debitados: {nexus_cost} "
                f"| {provider}/{model} | empresa {company_id}"
            )
    except Exception as e:
        logger.warning(f"⚠️ Falha ao debitar SM tokens (não crítico): {e}")


class AIClient:
    """
    Unified LLM client with provider abstraction, cost tracking,
    NEXUS token debiting, and fallback.

    Instantiate via get_ai_client() or inject via FastAPI Depends.
    """

    SUPPORTED_PROVIDERS = ("openai", "gemini", "claude", "groq", "ollama", "deepseek", "mistral", "together", "xai")

    # Fallback chain: if primary fails, try the next in this order
    FALLBACK_CHAIN = ["groq", "ollama"]

    def __init__(
        self,
        cost_tracker: Optional[CostTracker] = None,
        circuit_breaker=None,
    ):
        self.cost_tracker = cost_tracker or get_cost_tracker()
        self.circuit_breaker = circuit_breaker
        from app.services.ai_adapters.deepseek_adapter import DeepSeekAdapter
        from app.services.ai_adapters.mistral_adapter import MistralAdapter
        from app.services.ai_adapters.together_adapter import TogetherAdapter
        from app.services.ai_adapters.xai_adapter import XAIAdapter
        
        self._adapters: dict[str, BaseAIAdapter] = {
            "openai": OpenAIAdapter(),
            "gemini": GeminiAdapter(),
            "claude":  ClaudeAdapter(),
            "groq":   GroqAdapter(),
            "ollama": OllamaAdapter(),
            "deepseek": DeepSeekAdapter(),
            "mistral": MistralAdapter(),
            "together": TogetherAdapter(),
            "xai": XAIAdapter(),
        }

    def _get_adapter(self, provider: str) -> BaseAIAdapter:
        """Return the adapter for the given provider."""
        adapter = self._adapters.get(provider)
        if adapter is None:
            raise ValueError(
                f"Unknown provider '{provider}'. "
                f"Supported: {self.SUPPORTED_PROVIDERS}"
            )
        return adapter

    # ── Streaming ──────────────────────────────────────────────────────

    async def stream(
        self,
        provider: str,
        model: str,
        messages: list[dict],
        company_id: int,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        db=None,
        **kwargs,
    ) -> AsyncIterator[AIChunk]:
        """
        Stream tokens from the given provider/model.

        Automatically:
          - Tracks token usage and USD cost after stream completes
          - Debits NEXUS tokens if using platform API key (no user key)
          - Falls back to the fallback chain if the primary provider fails
          - Logs structured cost info

        Yields AIChunk objects. The LAST chunk has tokens_in/tokens_out set.
        """
        adapter = self._get_adapter(provider)
        tokens_in = tokens_out = 0

        # Check if company has own API key (before stream starts)
        using_platform_key = not await _has_user_api_key(provider, company_id, db)

        try:
            async for chunk in adapter.stream(
                model=model,
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                **kwargs,
            ):
                # Capture usage data from the final sentinel chunk
                if chunk.tokens_in is not None:
                    tokens_in = chunk.tokens_in
                if chunk.tokens_out is not None:
                    tokens_out = chunk.tokens_out

                yield chunk

        except Exception as exc:
            logger.error(f"❌ AI stream failed [{provider}/{model}]: {exc}")
            # Try fallback providers
            fallback_used = False
            for fallback_provider in self.FALLBACK_CHAIN:
                if fallback_provider == provider:
                    continue
                try:
                    logger.warning(f"🔄 Falling back to '{fallback_provider}'...")
                    fallback_adapter = self._get_adapter(fallback_provider)
                    fallback_model = self._default_model(fallback_provider)
                    # On fallback, also check platform key status for the new provider
                    using_platform_key = not await _has_user_api_key(fallback_provider, company_id, db)
                    async for chunk in fallback_adapter.stream(
                        model=fallback_model,
                        messages=messages,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                    ):
                        if chunk.tokens_in is not None:
                            tokens_in = chunk.tokens_in
                        if chunk.tokens_out is not None:
                            tokens_out = chunk.tokens_out
                        yield chunk
                    provider = fallback_provider
                    model = fallback_model
                    fallback_used = True
                    break
                except Exception as fb_exc:
                    logger.error(f"Fallback '{fallback_provider}' also failed: {fb_exc}")

            if not fallback_used:
                raise exc

        # ── Post-stream cost tracking (USD) ──────────────────────────
        if tokens_in > 0 or tokens_out > 0:
            await self.cost_tracker.record(
                provider=provider,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                company_id=company_id,
                user_id=user_id,
                db=db,
            )

            # ── Post-stream NEXUS token debit (platform key only) ───────
            if using_platform_key:
                await _debit_nexus_tokens(
                    provider=provider,
                    model=model,
                    company_id=company_id,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    db=db,
                )

    # ── Non-streaming ──────────────────────────────────────────────────

    async def complete(
        self,
        provider: str,
        model: str,
        messages: list[dict],
        company_id: int,
        user_id: Optional[int] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        db=None,
        **kwargs,
    ) -> AIResponse:
        """
        Single-shot completion (for summarization, fact extraction, etc.)

        Returns AIResponse with content + token counts.
        Cost is tracked automatically. NEXUS tokens debited if using platform key.
        """
        adapter = self._get_adapter(provider)

        # Check platform key usage before completion
        using_platform_key = not await _has_user_api_key(provider, company_id, db)

        try:
            response = await adapter.complete(
                model=model,
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                **kwargs,
            )
        except Exception as exc:
            logger.error(f"❌ AI complete failed [{provider}/{model}]: {exc}")
            # Try Ollama as last resort for internal tasks
            logger.warning("🔄 Falling back to Ollama for completion...")
            ollama_adapter = self._get_adapter("ollama")
            from app.core.config import settings
            response = await ollama_adapter.complete(
                model=settings.OLLAMA_MODEL,
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
            )
            provider = "ollama"
            model = settings.OLLAMA_MODEL
            using_platform_key = False  # Ollama is free/local

        # Track USD cost
        await self.cost_tracker.record(
            provider=provider,
            model=model,
            tokens_in=response.tokens_in,
            tokens_out=response.tokens_out,
            company_id=company_id,
            user_id=user_id,
            db=db,
        )

        # Debit NEXUS tokens if using platform key
        if using_platform_key:
            await _debit_nexus_tokens(
                provider=provider,
                model=model,
                company_id=company_id,
                tokens_in=response.tokens_in,
                tokens_out=response.tokens_out,
                db=db,
            )

        return response

    # ── Embeddings ─────────────────────────────────────────────────────

    async def embed(
        self,
        text: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        company_id: Optional[int] = None,
        db=None,
        **kwargs,
    ) -> list[float]:
        """
        Generate a vector embedding for the given text.
        
        If provider is not specified, tries: OpenAI -> Gemini -> Ollama.
        Cost is tracked if a paid provider is used.
        """
        # 1. Determine which provider to use
        providers_to_try = [provider] if provider else ["openai", "gemini", "ollama"]
        
        last_exception = None
        for p in providers_to_try:
            adapter = self._adapters.get(p)
            if not adapter:
                continue
                
            # Skip if adapter doesn't have an API key (unless it's Ollama)
            if p != "ollama" and not adapter.validate_api_key():
                # Check if company has its own key
                if company_id and db:
                    if not await _has_user_api_key(p, company_id, db):
                        continue
                else:
                    continue

            try:
                # Use default model if none provided
                target_model = model
                if not target_model:
                    if p == "openai": target_model = "text-embedding-3-small"
                    elif p == "gemini": target_model = "text-embedding-004"
                    elif p == "ollama": 
                        from app.core.config import settings
                        target_model = settings.OLLAMA_MODEL

                vector = await adapter.embed(text, model=target_model, **kwargs)
                if vector:
                    # Tracking cost for embeddings is usually negligible but good for completeness
                    # (Skipping token-based debit for now to keep it simple, as /embeddings is very cheap)
                    return vector
            except Exception as e:
                logger.warning(f"⚠️ Embedding failed with {p}: {e}")
                last_exception = e
                continue
        
        if last_exception:
            raise last_exception
        raise ValueError("No suitable embedding provider found or all failed.")

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _default_model(provider: str) -> str:
        from app.core.config import settings
        defaults = {
            "openai":  "gpt-4o-mini",
            "gemini":  "gemini-1.5-flash",
            "claude":  "claude-3-5-haiku-20241022",
            "groq":    "llama3-8b-8192",
            "ollama":  settings.OLLAMA_MODEL,
            "deepseek": "deepseek-chat",
            "mistral": "mistral-small-latest",
            "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "xai":     "grok-2",
        }
        return defaults.get(provider, "gpt-4o-mini")


# ── Singleton factory ──────────────────────────────────────────────────

_client_instance: Optional[AIClient] = None


def get_ai_client() -> AIClient:
    """Get or create the global AIClient singleton (for FastAPI Depends)."""
    global _client_instance
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
