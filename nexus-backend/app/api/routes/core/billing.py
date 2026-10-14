"""NEXUS.IA — Billing & Quota API Routes

GET  /billing/plan    — Current plan info + features
GET  /billing/quota   — Full quota status: usage, limits, percentages
POST /billing/upgrade — Request upgrade (opens contact/link for now)

All endpoints require authentication.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.services.billing_service import (
    get_company_plan, get_quota_status, PLAN_LIMITS
)

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/plan")
async def billing_plan(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current plan info for the authenticated user's company."""
    plan = await get_company_plan(user.company_id, db)
    return plan


@router.get("/quota")
async def billing_quota(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return full quota status with usage, limits and percentages."""
    quota = await get_quota_status(user.company_id, db)
    return quota


@router.get("/plans")
async def list_plans():
    """Return all available plans for comparison (public or auth'd)."""
    return {
        plan_key: {
            "key": plan_key,
            **plan_data,
        }
        for plan_key, plan_data in PLAN_LIMITS.items()
    }
