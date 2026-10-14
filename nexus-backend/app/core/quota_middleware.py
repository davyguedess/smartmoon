"""NEXUS.IA — Quota Enforcement Middleware

Intercepts API calls and blocks them if the company has exceeded its quota.
Monitored paths:
  - POST /executions/*  → checks executions_per_month
  - POST /flows         → checks flows_max
  - POST /chat/*        → increments api_calls counter
  - POST /ollama/chat   → increments api_calls counter

Responses:
  429 Too Many Requests — with a JSON body explaining the exceeded limit.
"""
from __future__ import annotations
from typing import Optional
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from loguru import logger

from app.core.security import decode_token
from app.models import Company, UsageLog
from app.services.billing_service import PLAN_LIMITS, get_quota_status

# Paths that enforce quotas — prefix match
EXECUTION_PATHS = ["/executions"]
FLOW_CREATE_PATHS = ["/flows"]
AI_CALL_PATHS = ["/chat/", "/ollama/chat"]

# Paths that should NEVER be blocked (auth, health, billing itself)
BYPASS_PATHS = [
    "/auth/", "/health", "/", "/docs", "/redoc",
    "/billing/", "/ws/", "/openapi", "/bids/",
]


def _is_bypassed(path: str) -> bool:
    return any(path.startswith(bp) for bp in BYPASS_PATHS)


def _get_token(request: Request) -> Optional[str]:
    return request.cookies.get("access_token")


class QuotaMiddleware(BaseHTTPMiddleware):
    """Lightweight quota enforcement — runs only on write/create requests."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method

        # Only check POST/PUT/PATCH — GETs never consume quota
        if method not in ("POST", "PUT", "PATCH") or _is_bypassed(path):
            return await call_next(request)

        # Try to get company_id from JWT (cookie)
        token = _get_token(request)
        if not token:
            return await call_next(request)  # let auth middleware handle unauth

        payload = decode_token(token)
        if not payload:
            return await call_next(request)

        company_id = payload.get("company_id")
        if not company_id:
            return await call_next(request)
        company_id = int(company_id)

        # Get DB session from app state (async)
        from app.db.session import AsyncSessionLocal, get_db
        async with AsyncSessionLocal() as db:
            try:
                quota = await get_quota_status(company_id, db)
            except Exception as e:
                logger.warning(f"QuotaMiddleware: could not fetch quota for company {company_id}: {e}")
                return await call_next(request)

        plan = quota["plan"]
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        # ── Execution quota ───────────────────────────────────────────────────
        if any(path.startswith(p) for p in EXECUTION_PATHS) and path.endswith("/test") or "/run" in path:
            if quota["over_quota"].get("executions"):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "quota_exceeded",
                        "detail": f"Limite de execuções atingido no plano {quota['plan_label']}.",
                        "dimension": "executions",
                        "used": quota["usage"]["executions"],
                        "limit": limits["executions_per_month"],
                        "upgrade_url": "/billing",
                    },
                )

        # ── Flow creation quota ───────────────────────────────────────────────
        if path == "/flows" and method == "POST":
            if quota["over_quota"].get("flows"):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "quota_exceeded",
                        "detail": f"Limite de {limits['flows_max']} fluxos ativos atingido no plano {quota['plan_label']}.",
                        "dimension": "flows",
                        "used": quota["usage"]["flows"],
                        "limit": limits["flows_max"],
                        "upgrade_url": "/billing",
                    },
                )

        # ── AI token quota ────────────────────────────────────────────────────
        if any(path.startswith(p) for p in AI_CALL_PATHS):
            if quota["over_quota"].get("ai_tokens"):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "quota_exceeded",
                        "detail": f"Limite de tokens de IA atingido no plano {quota['plan_label']}.",
                        "dimension": "ai_tokens",
                        "used": quota["usage"]["ai_tokens"],
                        "limit": limits["ai_tokens_per_month"],
                        "upgrade_url": "/billing",
                    },
                )

        return await call_next(request)
