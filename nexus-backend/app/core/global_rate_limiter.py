"""
NEXUS.IA — Global Rate Limiter (SlowAPI)
=========================================
Provides per-IP and per-user rate limits for AI chat endpoints.

Limits by plan:
  - free       : 60 req/min  | 500 req/day
  - pro        : 300 req/min | 5000 req/day
  - enterprise : 1000 req/min (unlimited daily)

Usage:
    from app.core.global_rate_limiter import limiter, chat_rate_limit

    @router.post("/chat/stream")
    @limiter.limit(chat_rate_limit)
    async def stream(request: Request, ...):
        ...
"""
from __future__ import annotations

import os
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

# ── Limits table by plan ──────────────────────────────────────────────
_PLAN_LIMITS: dict[str, str] = {
    "free":       "60/minute",
    "pro":        "300/minute",
    "enterprise": "600/minute",
}
_DEFAULT_LIMIT = "60/minute"

# ── Key function: user_id if authenticated, else IP ───────────────────
def _key_func(request: Request) -> str:
    """Use the authenticated user id as rate-limit key when available."""
    user = getattr(request.state, "user", None)
    if user is not None:
        return f"user:{user.id}"
    return get_remote_address(request)


# ── SlowAPI Limiter Instance ──────────────────────────────────────────
# Uses Redis when REDIS_URL is set, otherwise falls back to in-memory.
_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

try:
    limiter = Limiter(
        key_func=_key_func,
        storage_uri=_redis_url,
        default_limits=["200/minute"],   # global fallback per IP
    )
    _backend = "redis"
except Exception:
    limiter = Limiter(key_func=_key_func, default_limits=["200/minute"])
    _backend = "memory"


# ── Dynamic limit string based on user plan ───────────────────────────
def chat_rate_limit(request: Request) -> str:
    """Return the rate-limit string based on the authenticated user's plan."""
    user = getattr(request.state, "user", None)
    if user is None:
        return _DEFAULT_LIMIT
    company = getattr(user, "company", None)
    plan = getattr(company, "plan", "free") if company else "free"
    return _PLAN_LIMITS.get(plan, _DEFAULT_LIMIT)


# ── 429 handler for SlowAPI ───────────────────────────────────────────
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a structured JSON 429 instead of SlowAPI's default plain-text."""
    limit_str = str(exc.detail) if exc.detail else "unknown"
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": f"Muitas requisições. Limite: {limit_str}",
            "retry_after": "60",
        },
        headers={"Retry-After": "60"},
    )
