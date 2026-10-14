"""
Tests for memory_service — uses in-memory SQLite via aiosqlite.

Ollama calls are mocked so tests run without an LLM running.
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

# Use the app Base so all models are registered
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import Base
from app.models import AgentMemory  # noqa — register all models
from app.services import memory_service


# ── pytest-asyncio config ──────────────────────────────
# Tell pytest-asyncio to run all async tests automatically
pytestmark = pytest.mark.asyncio


# ── Test DB setup ─────────────────────────────────────

@pytest_asyncio.fixture(scope="session")
async def engine():
    """In-memory SQLite engine with JSONB mapped to JSON for compatibility."""
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        # SQLite doesn't know JSONB — map it to JSON at the engine level
        json_deserializer=lambda x: x,
    )
    # Override JSONB → JSON globally before creating tables
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
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()


# ── Fixtures ──────────────────────────────────────────

COMPANY_ID = 1
SESSION_ID = "test-session-001"


async def _add_messages(db, n: int, session_id: str = SESSION_ID):
    """Helper: add n user+assistant message pairs to memory."""
    for i in range(n):
        db.add(AgentMemory(
            company_id=COMPANY_ID,
            session_id=session_id,
            role="user",
            content=f"user message {i}",
            memory_type="message",
            memory_scope="session_only",
        ))
        db.add(AgentMemory(
            company_id=COMPANY_ID,
            session_id=session_id,
            role="assistant",
            content=f"assistant reply {i}",
            memory_type="message",
            memory_scope="session_only",
        ))
    await db.commit()


# ── Tests: build_context ──────────────────────────────

@pytest.mark.asyncio
async def test_build_context_empty(db):
    context = await memory_service.build_context(db, COMPANY_ID, "empty-session")
    assert context == []


@pytest.mark.asyncio
async def test_build_context_includes_messages(db):
    sid = "ctx-messages"
    await _add_messages(db, 3, sid)
    context = await memory_service.build_context(db, COMPANY_ID, sid, max_tokens=99999)
    # Should have 6 messages (3 user + 3 assistant) in context
    assert len(context) == 6
    assert any(m["role"] == "user" for m in context)
    assert any(m["role"] == "assistant" for m in context)


@pytest.mark.asyncio
async def test_build_context_respects_token_limit(db):
    sid = "ctx-token-limit"
    # Add messages with known large content
    for _ in range(10):
        db.add(AgentMemory(
            company_id=COMPANY_ID,
            session_id=sid,
            role="user",
            content="x" * 400,   # ~100 tokens each
            memory_type="message",
            memory_scope="session_only",
            token_count=100,
        ))
    await db.commit()
    context = await memory_service.build_context(db, COMPANY_ID, sid, max_tokens=250)
    total_tokens = sum(memory_service._estimate_tokens(m["content"]) for m in context)
    assert total_tokens <= 250


@pytest.mark.asyncio
async def test_build_context_facts_come_first(db):
    sid = "ctx-facts-first"
    db.add(AgentMemory(
        company_id=COMPANY_ID, session_id=sid, role="system",
        content="fact: client name is João", memory_type="fact", memory_scope="user_private",
    ))
    db.add(AgentMemory(
        company_id=COMPANY_ID, session_id=sid, role="user",
        content="regular message", memory_type="message", memory_scope="session_only",
    ))
    await db.commit()
    context = await memory_service.build_context(db, COMPANY_ID, sid, max_tokens=9999)
    # Fact (system role with [FACT] prefix) should appear before regular message
    fact_idx = next(i for i, m in enumerate(context) if "[FACT]" in m["content"])
    msg_idx = next(i for i, m in enumerate(context) if m["role"] == "user")
    assert fact_idx < msg_idx


# ── Tests: maybe_summarize ────────────────────────────

@pytest.mark.asyncio
async def test_maybe_summarize_below_threshold(db):
    sid = "summarize-below"
    await _add_messages(db, 5, sid)   # 10 messages total, threshold is 20
    result = await memory_service.maybe_summarize(db, COMPANY_ID, sid, threshold=20)
    assert result is None  # Should NOT summarize


@pytest.mark.asyncio
async def test_maybe_summarize_above_threshold_ollama_unavailable(db):
    """When Ollama is down, summarize returns None gracefully (no crash)."""
    sid = "summarize-nogollama"
    await _add_messages(db, 12, sid)  # 24 messages > threshold 20

    with patch.object(memory_service, "_llm_summarize", new=AsyncMock(return_value=None)):
        result = await memory_service.maybe_summarize(db, COMPANY_ID, sid, threshold=20)
    assert result is None  # Graceful: no summary created but no exception either


@pytest.mark.asyncio
async def test_maybe_summarize_creates_summary(db):
    """When Ollama is available and threshold exceeded, summary is created and old messages deleted."""
    sid = "summarize-creates"
    await _add_messages(db, 12, sid)

    with patch.object(memory_service, "_llm_summarize", new=AsyncMock(return_value="Resumo da conversa")):
        result = await memory_service.maybe_summarize(db, COMPANY_ID, sid, threshold=20)

    assert result is not None
    assert result.memory_type == "summary"
    assert "Resumo" in result.content


# ── Tests: extract_facts ─────────────────────────────

@pytest.mark.asyncio
async def test_extract_facts_ollama_unavailable(db):
    """Should return empty list when Ollama is down."""
    with patch.object(memory_service, "_llm_extract_facts", new=AsyncMock(return_value=[])):
        facts = await memory_service.extract_facts(
            db, COMPANY_ID, "fact-session", "Cliente João quer pagar R$1500"
        )
    assert facts == []


@pytest.mark.asyncio
async def test_extract_facts_saves_to_db(db):
    """Facts returned by LLM should be persisted in AgentMemory."""
    sid = "fact-save"
    extracted = ["Cliente: João Silva", "Valor: R$1500"]
    with patch.object(memory_service, "_llm_extract_facts", new=AsyncMock(return_value=extracted)):
        saved = await memory_service.extract_facts(db, COMPANY_ID, sid, "some message")
    assert len(saved) == 2
    assert "Cliente: João Silva" in saved


# ── Tests: cleanup_expired ───────────────────────────

@pytest.mark.asyncio
async def test_cleanup_expired_removes_old_records(db):
    sid = "cleanup-test"
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    future = datetime.now(timezone.utc) + timedelta(days=30)

    db.add(AgentMemory(
        company_id=COMPANY_ID, session_id=sid, role="user",
        content="expired msg", memory_type="message", expires_at=past,
    ))
    db.add(AgentMemory(
        company_id=COMPANY_ID, session_id=sid, role="assistant",
        content="valid msg", memory_type="message", expires_at=future,
    ))
    await db.commit()

    count = await memory_service.cleanup_expired(db, COMPANY_ID)
    assert count >= 1  # At least the past record removed


@pytest.mark.asyncio
async def test_cleanup_expired_keeps_non_expiring(db):
    sid = "cleanup-keep"
    db.add(AgentMemory(
        company_id=COMPANY_ID, session_id=sid, role="user",
        content="no expiry", memory_type="message", expires_at=None,
    ))
    await db.commit()
    count = await memory_service.cleanup_expired(db, COMPANY_ID)
    # Records with expires_at=None should NOT be deleted
    assert count == 0


# ── Tests: _estimate_tokens ──────────────────────────

def test_estimate_tokens_minimum():
    assert memory_service._estimate_tokens("") == 1


def test_estimate_tokens_typical():
    text = "a" * 400
    assert memory_service._estimate_tokens(text) == 100
