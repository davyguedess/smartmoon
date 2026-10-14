"""
NEXUS.IA — Analytics & Observability (Sprint 5)

Provides per-tenant analytics for:
  - Flow execution stats (success/fail/avg_duration)
  - Agent usage metrics
  - Audit event counts
  - System health + service dependency checks
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, text
from loguru import logger

from app.models import (
    Flow, Execution, AgentMemory, AuditLog,
    AgentProfile, WebhookEvent,
)


async def flow_analytics(
    db: AsyncSession,
    company_id: int,
    days: int = 30,
) -> dict:
    """Per-flow execution stats for the company."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            Execution.flow_id,
            Flow.name.label("flow_name"),
            func.count(Execution.id).label("total"),
            func.count(case((Execution.status == "completed", 1))).label("success"),
            func.count(case((Execution.status == "failed", 1))).label("failed"),
            func.count(case((Execution.status == "running", 1))).label("running"),
        )
        .join(Flow, Execution.flow_id == Flow.id)
        .where(
            Execution.company_id == company_id,
            Execution.created_at >= since,
        )
        .group_by(Execution.flow_id, Flow.name)
        .order_by(func.count(Execution.id).desc())
        .limit(20)
    )
    rows = result.all()
    return [
        {
            "flow_id": r.flow_id,
            "flow_name": r.flow_name,
            "total": r.total,
            "success": r.success,
            "failed": r.failed,
            "running": r.running,
            "success_rate": round(r.success / r.total * 100, 1) if r.total > 0 else 0,
        }
        for r in rows
    ]


async def agent_analytics(
    db: AsyncSession,
    company_id: int,
    days: int = 30,
) -> dict:
    """Per-agent usage statistics."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            AgentMemory.agent_id,
            func.count(AgentMemory.id).label("message_count"),
            func.count(func.distinct(AgentMemory.session_id)).label("session_count"),
            func.sum(AgentMemory.token_count).label("total_tokens"),
        )
        .where(
            AgentMemory.company_id == company_id,
            AgentMemory.created_at >= since,
            AgentMemory.memory_type == "message",
        )
        .group_by(AgentMemory.agent_id)
        .order_by(func.count(AgentMemory.id).desc())
    )
    rows = result.all()
    return [
        {
            "agent_id": r.agent_id,
            "message_count": r.message_count,
            "session_count": r.session_count,
            "total_tokens": r.total_tokens or 0,
        }
        for r in rows
    ]


async def audit_summary(
    db: AsyncSession,
    company_id: int,
    days: int = 7,
) -> dict:
    """Audit event summary — grouped by action."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            AuditLog.action,
            func.count(AuditLog.id).label("count"),
        )
        .where(
            AuditLog.company_id == company_id,
            AuditLog.created_at >= since,
        )
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(30)
    )
    rows = result.all()
    return [{"action": r.action, "count": r.count} for r in rows]


async def webhook_analytics(
    db: AsyncSession,
    company_id: int,
    days: int = 30,
) -> dict:
    """Webhook event stats."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            WebhookEvent.provider,
            func.count(WebhookEvent.id).label("total"),
            func.count(case((WebhookEvent.status == "processed", 1))).label("processed"),
            func.count(case((WebhookEvent.status == "failed", 1))).label("failed"),
        )
        .where(
            WebhookEvent.company_id == company_id,
            WebhookEvent.received_at >= since,
        )
        .group_by(WebhookEvent.provider)
        .order_by(func.count(WebhookEvent.id).desc())
    )
    rows = result.all()
    return [
        {
            "provider": r.provider, "total": r.total,
            "processed": r.processed, "failed": r.failed,
        }
        for r in rows
    ]


async def dashboard_summary(
    db: AsyncSession,
    company_id: int,
    days: int = 30,
) -> dict:
    """Complete dashboard summary for a tenant."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Counts
    flows_count = await db.scalar(
        select(func.count(Flow.id)).where(Flow.company_id == company_id)
    )
    executions_count = await db.scalar(
        select(func.count(Execution.id)).where(
            Execution.company_id == company_id,
            Execution.created_at >= since,
        )
    )
    success_count = await db.scalar(
        select(func.count(Execution.id)).where(
            Execution.company_id == company_id,
            Execution.status == "completed",
            Execution.created_at >= since,
        )
    )
    agents_count = await db.scalar(
        select(func.count(AgentProfile.id)).where(
            AgentProfile.company_id == company_id,
            AgentProfile.is_active == True,
        )
    )
    memory_tokens = await db.scalar(
        select(func.sum(AgentMemory.token_count)).where(
            AgentMemory.company_id == company_id,
            AgentMemory.created_at >= since,
        )
    )

    return {
        "period_days": days,
        "flows": flows_count or 0,
        "executions": executions_count or 0,
        "success_rate": round((success_count or 0) / max(executions_count or 1, 1) * 100, 1),
        "active_agents": agents_count or 0,
        "tokens_consumed": memory_tokens or 0,
    }
