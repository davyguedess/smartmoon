"""
Health & Observability Dashboard — Sprint 4

Endpoints:
  GET /health          → Quick liveness probe (used by load balancer)
  GET /health/ready    → Full readiness (DB + Redis + Ollama)
  GET /health/metrics  → Internal metrics (costs, quotas, workers)

Used by: Docker healthcheck, Kubernetes readinessProbe, Grafana.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db

router = APIRouter(prefix="/health", tags=["Health"])

_start_time = time.time()


# ── Liveness ────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def liveness():
    """
    Liveness probe — always returns 200 if the process is alive.
    Docker: HEALTHCHECK CMD curl -f http://localhost:8000/health
    """
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - _start_time),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Readiness ───────────────────────────────────────────────────────────

@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe — checks all critical dependencies.
    Returns 200 only when the service is ready to handle traffic.
    """
    checks: dict[str, dict] = {}
    all_ok = True

    # ── Database ──────────────────────────────────────────
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "error", "detail": str(e)}
        all_ok = False

    # ── Redis ─────────────────────────────────────────────
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)}
        all_ok = False  # Redis required for cost tracking

    # ── Ollama ────────────────────────────────────────────
    try:
        import httpx
        from app.core.config import settings
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                checks["ollama"] = {
                    "status": "ok",
                    "models_available": len(models),
                }
            else:
                checks["ollama"] = {"status": "degraded", "http_status": resp.status_code}
    except Exception as e:
        checks["ollama"] = {"status": "degraded", "detail": str(e)}
        # Ollama degraded is OK — cloud AI still works

    # ── Celery workers ────────────────────────────────────
    try:
        from app.workers.celery_app import celery_app
        inspect = celery_app.control.inspect(timeout=2)
        active = inspect.active()
        if active:
            checks["celery"] = {"status": "ok", "workers": len(active)}
        else:
            checks["celery"] = {"status": "degraded", "detail": "No active workers"}
    except Exception as e:
        checks["celery"] = {"status": "degraded", "detail": str(e)}

    status_code = 200 if all_ok else 503
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
        "uptime_seconds": round(time.time() - _start_time),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Cost Metrics ─────────────────────────────────────────────────────────

@router.get("/metrics")
async def metrics(db: AsyncSession = Depends(get_db)):
    """
    Internal cost and usage metrics — for the NEXUS.IA admin dashboard.

    Returns aggregated AI cost, token usage, and quota summary
    for the current billing month across all companies.
    """
    try:
        from sqlalchemy import select, func
        from app.models import UsageLog
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(
                func.count(UsageLog.id).label("companies"),
                func.sum(UsageLog.ai_tokens_used).label("total_tokens"),
                func.sum(UsageLog.ai_cost_usd).label("total_cost_usd"),
                func.sum(UsageLog.executions_count).label("total_executions"),
                func.sum(UsageLog.api_calls).label("total_api_calls"),
            )
            .where(UsageLog.year == now.year, UsageLog.month == now.month)
        )
        row = result.fetchone()

        return {
            "period": {"year": now.year, "month": now.month},
            "aggregate": {
                "companies_active": row.companies or 0,
                "total_ai_tokens": row.total_tokens or 0,
                "total_ai_cost_usd": float(row.total_cost_usd or 0),
                "total_executions": row.total_executions or 0,
                "total_api_calls": row.total_api_calls or 0,
            },
            "uptime_seconds": round(time.time() - _start_time),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Metrics endpoint error: {e}")
        return {"error": str(e), "status": "error"}
