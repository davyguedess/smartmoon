"""
NEXUS.IA — /analytics routes (Sprint 5)
Per-tenant analytics dashboard: flows, agents, webhooks, audit events.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def dashboard(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Top-level dashboard summary for the tenant."""
    return await analytics_service.dashboard_summary(db, user.company_id, days)


@router.get("/flows")
async def flow_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Per-flow execution stats (success/fail/running + success rate)."""
    return await analytics_service.flow_analytics(db, user.company_id, days)


@router.get("/agents")
async def agent_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Per-agent usage metrics (messages, sessions, tokens)."""
    return await analytics_service.agent_analytics(db, user.company_id, days)


@router.get("/audit")
async def audit_stats(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Audit event summary grouped by action type."""
    return await analytics_service.audit_summary(db, user.company_id, days)


@router.get("/webhooks")
async def webhook_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Webhook processing stats per provider."""
    return await analytics_service.webhook_analytics(db, user.company_id, days)
