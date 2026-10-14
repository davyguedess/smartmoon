"""Memory Service — intelligent agent memory management.

Capabilities:
  - Scoped memory retrieval (session_only, user_private, company_shared)
  - Automatic summarization when message count exceeds threshold
  - Fact extraction from conversations
  - Token-aware context window building
  - Memory expiration enforcement

NOTE: LLM calls (_llm_summarize, _llm_extract_facts) now go through AIClient
  — no longer hardcoded to Ollama. Falls back to Ollama if no cloud key available.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, and_
from loguru import logger

from app.models import AgentMemory, AgentProfile


# ── Context Builder ──────────────────────────────────

async def build_context(
    db: AsyncSession,
    company_id: int,
    session_id: str,
    agent_id: Optional[int] = None,
    user_id: Optional[int] = None,
    max_tokens: int = 8000,
) -> List[Dict]:
    """Build conversation context from memory, respecting token limits and scopes.

    Priority order:
      1. Facts (memory_type='fact') — always included first
      2. Summaries (memory_type='summary') — compressed history
      3. Recent messages (memory_type='message') — latest turns
    """
    context = []
    token_budget = max_tokens

    # 2. Semantic Knowledge Search (NEW: Categorical RAG)
    knowledge_category_id = None
    if agent_id:
        result = await db.execute(
            select(AgentProfile).where(AgentProfile.id == agent_id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            knowledge_category_id = profile.knowledge_category_id
            if profile.memory_rules:
                rules = profile.memory_rules

    if knowledge_category_id:
        try:
            # Use last message as query for semantic search
            last_msg = await db.execute(
                select(AgentMemory.content)
                .where(
                    AgentMemory.company_id == company_id,
                    AgentMemory.session_id == session_id,
                    AgentMemory.role == "user"
                )
                .order_by(AgentMemory.created_at.desc())
                .limit(1)
            )
            query_text = last_msg.scalar()
            
            if query_text:
                from app.services.vector_service import get_vector_service
                vector_service = get_vector_service()
                knowledge_hits = await vector_service.search(
                    query_text=query_text,
                    company_id=company_id,
                    category_id=knowledge_category_id,
                    limit=3
                )
                
                for hit in knowledge_hits:
                    content = hit["content"]
                    tokens = _estimate_tokens(content)
                    if token_budget - tokens < 0:
                        break
                    context.append({"role": "system", "content": f"[KNOWLEDGE] {content}"})
                    token_budget -= tokens
        except Exception as e:
            logger.warning(f"⚠️ Semantic search failed: {e}")

    # 3. Load facts (SQL) — the 10 MOST RECENT, then chronological for reading
    facts = await _load_by_type(db, company_id, session_id, "fact", limit=10, newest_first=True)
    facts = list(reversed(facts))
    for f in facts:
        tokens = f.token_count or _estimate_tokens(f.content)
        if token_budget - tokens < 0:
            break
        context.append({"role": "system", "content": f"[FACT] {f.content}"})
        token_budget -= tokens

    # 4. Load summaries — the 3 most recent (newest summary is most relevant)
    summaries = await _load_by_type(db, company_id, session_id, "summary", limit=3, newest_first=True)
    summaries = list(reversed(summaries))
    for s in summaries:
        tokens = s.token_count or _estimate_tokens(s.content)
        if token_budget - tokens < 0:
            break
        context.append({"role": "system", "content": f"[SUMMARY] {s.content}"})
        token_budget -= tokens

    # 5. Fill remaining budget with recent messages
    messages = await _load_by_type(db, company_id, session_id, "message", limit=50)
    message_buffer = []
    for m in reversed(messages):  # newest first
        tokens = m.token_count or _estimate_tokens(m.content)
        if token_budget - tokens < 0:
            break
        message_buffer.insert(0, {"role": m.role, "content": m.content})
        token_budget -= tokens

    context.extend(message_buffer)
    return context


async def _load_by_type(
    db: AsyncSession,
    company_id: int,
    session_id: str,
    memory_type: str,
    limit: int = 50,
    newest_first: bool = False,
) -> list:
    """Load memories of a specific type.

    By default returns the OLDEST `limit` rows (chronological). With
    `newest_first=True` it returns the MOST RECENT `limit` rows — essential
    for facts/summaries, which accumulate over a customer's lifetime and are
    never deleted: an ascending limit would forever surface stale first-visit
    facts and hide the customer's current state.
    """
    order = AgentMemory.created_at.desc() if newest_first else AgentMemory.created_at
    result = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.company_id == company_id,
            AgentMemory.session_id == session_id,
            AgentMemory.memory_type == memory_type,
        )
        .order_by(order)
        .limit(limit)
    )
    return result.scalars().all()


# ── Summarization ────────────────────────────────────

async def maybe_summarize(
    db: AsyncSession,
    company_id: int,
    session_id: str,
    agent_id: Optional[int] = None,
    threshold: int = 20,
):
    """Auto-summarize a session if message count exceeds threshold.

    Creates a summary record and marks old messages as summarized.
    Uses the local Ollama LLM for summarization.
    """
    # Count messages in session
    result = await db.execute(
        select(func.count(AgentMemory.id)).where(
            AgentMemory.company_id == company_id,
            AgentMemory.session_id == session_id,
            AgentMemory.memory_type == "message",
        )
    )
    msg_count = result.scalar() or 0

    if msg_count < threshold:
        return None

    # Load messages to summarize
    messages = await _load_by_type(db, company_id, session_id, "message", limit=threshold)
    if not messages:
        return None

    # Build text for summarization
    conversation_text = "\n".join(
        f"{m.role}: {m.content}" for m in messages
    )

    # Summarize via provider fallback chain (Gemini → Groq → Ollama)
    summary_text = await _llm_summarize(conversation_text, company_id=company_id)
    if not summary_text:
        return None

    # Save summary
    summary = AgentMemory(
        company_id=company_id,
        session_id=session_id,
        agent_id=agent_id,
        role="system",
        content=summary_text,
        memory_type="summary",
        memory_scope="session_only",
        token_count=_estimate_tokens(summary_text),
    )
    db.add(summary)

    # Delete old messages that were summarized (keep last 5)
    keep_ids = [m.id for m in messages[-5:]]
    delete_ids = [m.id for m in messages if m.id not in keep_ids]
    if delete_ids:
        await db.execute(
            delete(AgentMemory).where(AgentMemory.id.in_(delete_ids))
        )

    await db.commit()
    logger.info(f"📝 Session {session_id}: summarized {len(delete_ids)} messages → 1 summary")
    return summary


# ── Fact Extraction ──────────────────────────────────

async def extract_facts(
    db: AsyncSession,
    company_id: int,
    session_id: str,
    message_content: str,
    agent_id: Optional[int] = None,
):
    """Extract key facts from a message using LLM.

    Facts are stored as separate memory records with type='fact'
    and can persist across sessions.
    """
    facts = await _llm_extract_facts(message_content, company_id=company_id)
    if not facts:
        return []

    # ── Dedup: skip facts already stored for this customer/session ──
    # extract_facts runs on every turn; without this, identical facts pile up
    # unbounded and crowd out the (capped) context window on returning clients.
    existing_res = await db.execute(
        select(AgentMemory.content).where(
            AgentMemory.company_id == company_id,
            AgentMemory.session_id == session_id,
            AgentMemory.memory_type == "fact",
        )
    )
    seen = {(c or "").strip().lower() for c in existing_res.scalars().all()}

    # Resolve the agent's knowledge category once (was an N+1 query in the loop)
    category_id = None
    if agent_id:
        profile_res = await db.execute(
            select(AgentProfile.knowledge_category_id).where(AgentProfile.id == agent_id)
        )
        category_id = profile_res.scalar()

    saved = []
    for fact_text in facts:
        key = fact_text.strip().lower()
        if not key or key in seen:
            continue  # duplicate of an existing or already-processed fact
        seen.add(key)

        fact = AgentMemory(
            company_id=company_id,
            session_id=session_id,
            agent_id=agent_id,
            role="system",
            content=fact_text,
            memory_type="fact",
            memory_scope="user_private",  # Facts are user-scoped by default
            token_count=_estimate_tokens(fact_text),
        )
        db.add(fact)
        saved.append(fact_text)

        # ── Vector Storage Integration ──
        try:
            from app.services.vector_service import get_vector_service
            vs = get_vector_service()
            await vs.upsert_text(
                text=fact_text,
                company_id=company_id,
                category_id=category_id,
                metadata={"session_id": session_id, "source": "fact_extraction"}
            )
        except Exception as ve:
            logger.warning(f"⚠️ Failed to store fact in vector DB: {ve}")

    if saved:
        await db.commit()
        logger.info(f"🔍 Extracted {len(saved)} facts from session {session_id}")

    return saved


# ── Expiration / Cleanup ─────────────────────────────

async def cleanup_expired(db: AsyncSession, company_id: int):
    """Delete expired memory records."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(AgentMemory).where(
            AgentMemory.company_id == company_id,
            AgentMemory.expires_at.isnot(None),
            AgentMemory.expires_at < now,
        )
    )
    await db.commit()
    count = result.rowcount or 0
    if count > 0:
        logger.info(f"🧹 Cleaned {count} expired memories for company {company_id}")
    return count


# ── LLM helpers (via AIClient) ──────────────────────────
# Uses AIClient so any provider can handle summarization/fact extraction.
# Tries free cloud providers first (Gemini → Groq) and falls back to local
# Ollama. Antes estava fixo em "ollama" — em produção (sem Ollama) a memória
# de longo prazo falhava em silêncio.

def _memory_provider_chain() -> List[tuple]:
    """Ordered (provider, model) attempts for memory LLM calls.

    Prefers free/configured cloud models, then local Ollama as last resort.
    """
    from app.core.config import settings

    chain: List[tuple] = []
    if getattr(settings, "GEMINI_API_KEY", ""):
        chain.append(("gemini", "gemini-2.0-flash"))
    if getattr(settings, "GROQ_API_KEY", ""):
        chain.append(("groq", getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")))
    if getattr(settings, "OLLAMA_MODEL", ""):
        chain.append(("ollama", settings.OLLAMA_MODEL))
    return chain


async def _memory_llm(prompt: str, company_id: int, max_tokens: int) -> Optional[str]:
    """Run a memory-governance prompt through the provider fallback chain."""
    from app.services.ai_client import get_ai_client

    ai_client = get_ai_client()
    for provider, model in _memory_provider_chain():
        try:
            response = await ai_client.complete(
                provider=provider,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                company_id=company_id,
                max_tokens=max_tokens,
            )
            text = (response.content or "").strip()
            if text:
                return text
        except Exception as e:
            logger.warning(f"Memory LLM via {provider} failed: {e} — trying next")
            continue
    return None


async def _llm_summarize(text: str, company_id: int = 0) -> Optional[str]:
    """Summarize conversation text using AIClient (provider-agnostic)."""
    prompt = (
        "Resuma a seguinte conversa de forma concisa, mantendo os pontos principais, "
        "decisões tomadas e informações importantes. Responda APENAS com o resumo:\n\n"
        + text[:4000]
    )
    return await _memory_llm(prompt, company_id, max_tokens=512)


async def _llm_extract_facts(text: str, company_id: int = 0) -> List[str]:
    """Extract key facts from text using AIClient (provider-agnostic)."""
    prompt = (
        "Extraia fatos concretos e verificáveis desta mensagem. "
        "Retorne cada fato em uma linha separada. Se não houver fatos, retorne vazio.\n"
        "Exemplos: \"Nome do cliente: João\", \"Valor: R$1500\", \"Prazo: 30 dias\"\n\n"
        f"Mensagem: {text[:2000]}"
    )
    raw = await _memory_llm(prompt, company_id, max_tokens=256)
    if not raw:
        return []
    facts = [line.strip() for line in raw.split("\n") if line.strip() and len(line.strip()) > 5]
    return facts[:10]


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ≈ 4 chars for Portuguese."""
    return max(1, len(text) // 4)
