"""
QuotaMiddleware — Intercepts AI calls and enforces plan quotas at the middleware layer.

This is the last line of defense before a request reaches the AI:
  - Checks ai_tokens quota for the current billing period
  - Increments api_calls counter on every /chat/ request
  - Returns 429 with upgrade hint if quota is exceeded

Designed to work alongside the explicit check_can_execute() in chat.py:
  - chat.py: checks execution quota before the stream starts
  - QuotaMiddleware: checks token quota + counts api_calls

Usage (add to main.py):
    from app.middleware.quota import QuotaMiddleware
    app.add_middleware(QuotaMiddleware)
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from loguru import logger


PROTECTED_PREFIXES = ("/chat/", "/flows/execute", "/agent/run")


class QuotaMiddleware(BaseHTTPMiddleware):
    """
    HTTP middleware that enforces token quotas and counts API calls.

    Runs for: /chat/, /flows/execute, /agent/run
    Skips: auth routes, health checks, static files
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip non-AI routes
        if not any(path.startswith(p) for p in PROTECTED_PREFIXES):
            return await call_next(request)

        # Skip health and auth
        if path in ("/health", "/auth/login", "/auth/refresh"):
            return await call_next(request)

        # Require authenticated user state (injected by auth middleware upstream)
        user = getattr(request.state, "user", None)
        if user is None:
            return await call_next(request)  # Auth middleware will handle 401

        company_id = getattr(user, "company_id", None)
        if not company_id:
            return await call_next(request)

        # ── Token quota check ──────────────────────────────
        try:
            from app.db.session import AsyncSessionLocal
            from app.services.billing_service import get_quota_status

            async with AsyncSessionLocal() as db:
                quota = await get_quota_status(company_id, db)

            if quota["over_quota"].get("ai_tokens"):
                plan = quota["plan_label"]
                limit = quota["limits"]["ai_tokens_per_month"]
                logger.warning(
                    f"🚫 Token quota exceeded: company={company_id} plan={plan} "
                    f"used={quota['usage']['ai_tokens']:,} limit={limit:,}"
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "quota_exceeded",
                        "detail": (
                            f"Limite de {limit:,} tokens/mês atingido no plano {plan}. "
                            "Faça upgrade para continuar."
                        ),
                        "plan": quota["plan"],
                        "upgrade_url": "/settings/billing",
                    },
                )
        except Exception as e:
            logger.warning(f"QuotaMiddleware quota check failed (non-blocking): {e}")

        # ── Process request ────────────────────────────────
        response = await call_next(request)

        # ── Increment API call counter (fire-and-forget) ──
        try:
            from app.db.session import AsyncSessionLocal
            from app.services.billing_service import increment_api_call
            import asyncio

            async def _increment():
                async with AsyncSessionLocal() as db:
                    await increment_api_call(company_id, db)

            asyncio.create_task(_increment())
        except Exception as e:
            logger.debug(f"Failed to increment api_call counter: {e}")

        return response
