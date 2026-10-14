"""
CostTracker — real-time AI cost tracking per company.

Records cost to:
  1. Redis (real-time counter, 90-day TTL) — for instant dashboard queries
  2. DB UsageLog.ai_cost_usd — for billing and monthly reports

Inspired by Claude Code's CostTracker pattern.

Price table (per 1M tokens, USD, April 2026):
  https://openai.com/pricing
  https://ai.google.dev/pricing
  https://www.anthropic.com/pricing
  https://console.groq.com/docs/openai
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from loguru import logger


# ── Price table ────────────────────────────────────────────
# (input_per_1M_usd, output_per_1M_usd)
PRICE_TABLE: dict[str, tuple[float, float]] = {
    # OpenAI
    "gpt-4o":                    (2.50,   10.00),
    "gpt-4o-mini":               (0.15,    0.60),
    "gpt-4-turbo":               (10.00,  30.00),
    "gpt-3.5-turbo":             (0.50,   1.50),
    # Google Gemini
    "gemini-1.5-pro":            (1.25,    5.00),
    "gemini-1.5-flash":          (0.075,   0.30),
    "gemini-2.0-flash":          (0.10,    0.40),
    "gemini-2.0-flash-lite":     (0.075,   0.30),
    # Anthropic Claude
    "claude-3-5-sonnet-20241022": (3.00,  15.00),
    "claude-3-5-haiku-20241022":  (0.80,   4.00),
    "claude-3-opus-20240229":     (15.00,  75.00),
    # Groq (Llama models via Groq)
    "llama3-70b-8192":           (0.59,    0.79),
    "llama3-8b-8192":            (0.05,    0.08),
    "mixtral-8x7b-32768":        (0.24,    0.24),
    # Ollama — always free (local)
    "ollama":                    (0.00,    0.00),
}


def calculate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    """Calculate USD cost for a given model and token counts."""
    # Try exact match first, then prefix match for Ollama
    prices = PRICE_TABLE.get(model)
    if prices is None:
        # Fallback: check if any key is a prefix
        for key, val in PRICE_TABLE.items():
            if model.startswith(key):
                prices = val
                break
    if prices is None:
        logger.warning(f"⚠️ No price found for model '{model}' — cost recorded as $0.00")
        return 0.0

    input_price, output_price = prices
    cost = (tokens_in * input_price + tokens_out * output_price) / 1_000_000
    return round(cost, 6)


class CostTracker:
    """
    Records AI cost after each LLM call.

    Usage:
        tracker = CostTracker(redis_client, db_session)
        await tracker.record(
            provider="openai", model="gpt-4o",
            tokens_in=500, tokens_out=200,
            company_id=42
        )
    """

    def __init__(self, redis_client=None):
        self._redis = redis_client

    async def record(
        self,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        company_id: int,
        db=None,
        user_id: Optional[int] = None,
    ) -> float:
        """
        Record cost for a completed AI call.
        Returns the USD cost recorded.
        """
        cost = calculate_cost(model, tokens_in, tokens_out)
        total_tokens = tokens_in + tokens_out
        now = datetime.now(timezone.utc)
        period_key = f"{now.year}-{now.month:02d}"

        logger.info(
            f"💰 AI Cost | {provider}/{model} | "
            f"in={tokens_in} out={tokens_out} | "
            f"cost=${cost:.6f} | company={company_id}"
        )

        # 1. Redis real-time counter
        if self._redis:
            try:
                redis_key = f"ai_cost:{company_id}:{period_key}"
                await self._redis.incrbyfloat(redis_key, cost)
                await self._redis.expire(redis_key, 90 * 86400)  # 90 days TTL

                token_key = f"ai_tokens:{company_id}:{period_key}"
                await self._redis.incrby(token_key, total_tokens)
                await self._redis.expire(token_key, 90 * 86400)
            except Exception as e:
                logger.warning(f"Redis cost tracking failed (non-blocking): {e}")

        # 2. DB persistence
        if db and total_tokens > 0:
            try:
                from app.services import billing_service
                await billing_service.increment_tokens(company_id, db, total_tokens)
                await billing_service.increment_cost(company_id, db, cost)
            except Exception as e:
                logger.warning(f"DB cost tracking failed (non-blocking): {e}")

        return cost

    async def get_month_cost(self, company_id: int) -> float:
        """Get current month's total cost from Redis (fast path)."""
        if not self._redis:
            return 0.0
        now = datetime.now(timezone.utc)
        key = f"ai_cost:{company_id}:{now.year}-{now.month:02d}"
        try:
            val = await self._redis.get(key)
            return float(val) if val else 0.0
        except Exception:
            return 0.0


# ── Singleton factory ──────────────────────────────────────

_tracker_instance: Optional[CostTracker] = None


def get_cost_tracker(redis_client=None) -> CostTracker:
    """Get or create the global CostTracker singleton."""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = CostTracker(redis_client=redis_client)
    return _tracker_instance
