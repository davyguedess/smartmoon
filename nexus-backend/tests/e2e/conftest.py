"""
Shared test fixtures for NEXUS.IA test suite.

Uses in-memory SQLite so tests run without a real Postgres instance.
JSONB columns are automatically re-typed to JSON for SQLite compatibility.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import Base
from app.models import Company, User, UsageLog, AgentMemory  # noqa – registers all models


# ── pytest-asyncio global mode ─────────────────────────────
pytestmark = pytest.mark.asyncio


# ── In-memory DB per test session ──────────────────────────

@pytest_asyncio.fixture(scope="session")
async def engine():
    """SQLite in-memory engine with JSONB→JSON remapping."""
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Remap JSONB → JSON for SQLite compatibility
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture()
async def db(engine):
    """Fresh session per test, rolled back after each test."""
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()


# ── Domain entity factories ─────────────────────────────────

@pytest_asyncio.fixture()
async def company(db):
    """A default 'pro' company for tests."""
    c = Company(name="NEXUS Test Co", plan="pro", is_active=True)
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture()
async def user(db, company):
    """A test user belonging to the test company."""
    u = User(
        company_id=company.id,
        name="Test User",
        email="test@nexus.ia",
        password_hash="hashed",
        role="admin",
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture()
async def usage_log(db, company):
    """Current-period UsageLog for the test company."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    ul = UsageLog(
        company_id=company.id,
        year=now.year,
        month=now.month,
        executions_count=0,
        ai_tokens_used=0,
        flows_created=0,
        api_calls=0,
        ai_cost_usd=0,
    )
    db.add(ul)
    await db.flush()
    return ul
