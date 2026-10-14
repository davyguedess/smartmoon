"""
Tests for billing_service — quota checks, token increment, cost tracking.

All DB operations use the in-memory SQLite fixture from conftest.py.
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from decimal import Decimal

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import billing_service
from app.models import UsageLog

pytestmark = pytest.mark.asyncio


# ── get_company_plan ────────────────────────────────────────

async def test_get_company_plan_returns_pro(db, company):
    plan = await billing_service.get_company_plan(company.id, db)
    assert plan["plan"] == "pro"
    assert plan["ai_tokens_per_month"] == 2_000_000


async def test_get_company_plan_defaults_free_for_unknown(db, company):
    plan = await billing_service.get_company_plan(99999, db)
    assert plan["plan"] == "free"


# ── get_or_create_usage ─────────────────────────────────────

async def test_get_or_create_usage_creates_new(db, company):
    usage = await billing_service.get_or_create_usage(company.id, db)
    assert usage.company_id == company.id
    assert usage.executions_count == 0
    assert usage.ai_tokens_used == 0


async def test_get_or_create_usage_returns_existing(db, company, usage_log):
    usage = await billing_service.get_or_create_usage(company.id, db)
    assert usage.id == usage_log.id  # Same row returned


# ── increment_tokens ────────────────────────────────────────

async def test_increment_tokens(db, company):
    await billing_service.increment_tokens(company.id, db, 5000)
    usage = await billing_service.get_or_create_usage(company.id, db)
    assert usage.ai_tokens_used >= 5000


async def test_increment_tokens_accumulates(db, company):
    await billing_service.increment_tokens(company.id, db, 1000)
    await billing_service.increment_tokens(company.id, db, 2000)
    usage = await billing_service.get_or_create_usage(company.id, db)
    assert usage.ai_tokens_used >= 3000


# ── increment_executions ────────────────────────────────────

async def test_increment_executions(db, company):
    await billing_service.increment_executions(company.id, db, 1)
    usage = await billing_service.get_or_create_usage(company.id, db)
    assert usage.executions_count >= 1


# ── check_can_execute ───────────────────────────────────────

async def test_check_can_execute_allowed_for_pro(db, company):
    allowed, reason = await billing_service.check_can_execute(company.id, db)
    assert allowed is True
    assert reason == ""


async def test_check_can_execute_blocked_at_limit(db, company):
    """Simulate a free company that has hit the 100 execution limit."""
    from app.models import Company
    from sqlalchemy import select, update
    # Temporarily downgrade to free
    await db.execute(
        update(Company).where(Company.id == company.id).values(plan="free")
    )
    await db.commit()

    # Manually set executions to the limit
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    now = datetime.now(timezone.utc)
    from sqlalchemy import text
    await db.execute(
        text("""
            INSERT INTO usage_logs (company_id, year, month, executions_count, ai_tokens_used, flows_created, api_calls, ai_cost_usd)
            VALUES (:cid, :yr, :mo, 100, 0, 0, 0, 0)
            ON CONFLICT (company_id, year, month) DO UPDATE SET executions_count = 100
        """),
        {"cid": company.id, "yr": now.year, "mo": now.month}
    )
    await db.commit()

    allowed, reason = await billing_service.check_can_execute(company.id, db)
    assert allowed is False
    assert "Limite" in reason

    # Restore to pro
    await db.execute(
        update(Company).where(Company.id == company.id).values(plan="pro")
    )
    await db.commit()


# ── get_quota_status ────────────────────────────────────────

async def test_get_quota_status_structure(db, company):
    status = await billing_service.get_quota_status(company.id, db)
    assert "plan" in status
    assert "usage" in status
    assert "limits" in status
    assert "percentages" in status
    assert "over_quota" in status
    assert "features" in status


async def test_get_quota_status_percentages_are_valid(db, company):
    status = await billing_service.get_quota_status(company.id, db)
    for key, pct in status["percentages"].items():
        assert 0.0 <= pct <= 100.0, f"Percentage {key}={pct} out of range"
