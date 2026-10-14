"""Resilience utilities — timeout configs + retry with exponential backoff.

Usage in handlers:
    from app.utils.resilience import get_timeout, with_retry

    async with httpx.AsyncClient(timeout=get_timeout("openai")) as client:
        resp = await with_retry(
            lambda: client.post(url, ...),
            provider="openai"
        )
"""
import asyncio
from typing import Callable, Any
from loguru import logger

# ── Timeout per provider (seconds) ──────────────────
TIMEOUTS = {
    "openai": 60,
    "gemini": 60,
    "claude": 90,
    "groq": 30,
    "elevenlabs": 30,
    "whisper": 60,
    "ollama": 120,
    "whatsapp": 20,
    "telegram": 15,
    "mercadopago": 20,
    "default": 30,
}

# ── Retry config ─────────────────────────────────────
MAX_RETRIES = 2
BACKOFF_BASE = 1.0        # 1s → 2s


def get_timeout(provider: str) -> int:
    """Return configured timeout in seconds for a provider."""
    return TIMEOUTS.get(provider, TIMEOUTS["default"])


async def with_retry(
    fn: Callable,
    provider: str = "default",
    max_retries: int = MAX_RETRIES,
) -> Any:
    """Execute an async callable with exponential backoff retry.

    Args:
        fn: async callable (usually a lambda wrapping httpx request)
        provider: provider name for logging
        max_retries: max number of retries (default 2)

    Returns:
        The result of fn()

    Raises:
        The last exception after all retries exhausted
    """
    last_error = None
    for attempt in range(1, max_retries + 2):  # +2 because attempt 1 is the initial try
        try:
            return await fn()
        except Exception as e:
            last_error = e
            if attempt <= max_retries:
                wait = BACKOFF_BASE * (2 ** (attempt - 1))  # 1s, 2s
                logger.warning(
                    f"⚠️ {provider} attempt {attempt} failed: {type(e).__name__}. "
                    f"Retrying in {wait}s..."
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    f"❌ {provider} failed after {max_retries + 1} attempts: {e}"
                )
    raise last_error
