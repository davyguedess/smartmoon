"""
NEXUS.IA — AI Token Service
Gerencia saldo, consumo e compra de NEXUS AI Tokens.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


# ── Custo em NEXUS tokens por 1.000 tokens LLM ─────────────────────────────────
# free = usa key da plataforma sem cobrar (cota mensal do plano)
# >0   = cobra do saldo ai_token_balances da empresa

TOKEN_COST_PER_1K: dict[str, dict] = {
    "ollama":  {"input": 0,   "output": 0},    # grátis (local)
    "gemini_flash": {"input": 0, "output": 0}, # referência ao modelo flash grátis
    "gemini":  {"input": 5,   "output": 10},   # Gemini Pro (via plataforma)
    "groq":    {"input": 2,   "output": 4},    # Groq Llama (mais barato)
    "openai":  {"input": 5,   "output": 10},   # GPT-4o mini base
    "claude":  {"input": 15,  "output": 30},   # Claude Sonnet
}

_FREE_MODELS = {
    "gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash",
    "llama3", "llama3.1", "mistral", "deepseek",  # ollama
}

# Runtime cache for DB costs (refreshed on first miss)
_db_costs_cache: dict[tuple, dict] = {}
_db_costs_loaded = False


def cost_for_call(provider: str, model: str, tokens_in: int, tokens_out: int) -> int:
    """Calcula o custo em NEXUS tokens para uma chamada LLM.
    Tenta usar custos do cache (DB). Fallback para TOKEN_COST_PER_1K."""
    if model in _FREE_MODELS or provider == "ollama":
        return 0

    # Check DB cache first (per-model)
    cache_key = (provider, model)
    if cache_key in _db_costs_cache:
        mc = _db_costs_cache[cache_key]
        if mc.get("is_free"):
            return 0
        cost = (tokens_in / 1000) * mc["input"] + (tokens_out / 1000) * mc["output"]
        return max(0, int(cost))

    # Check DB cache (provider-only, default model)
    provider_key = (provider, "__default__")
    if provider_key in _db_costs_cache:
        mc = _db_costs_cache[provider_key]
        if mc.get("is_free"):
            return 0
        cost = (tokens_in / 1000) * mc["input"] + (tokens_out / 1000) * mc["output"]
        return max(0, int(cost))

    # Fallback to hardcoded
    rates = TOKEN_COST_PER_1K.get(provider, {"input": 10, "output": 20})
    cost = (tokens_in / 1000) * rates["input"] + (tokens_out / 1000) * rates["output"]
    return max(0, int(cost))


async def refresh_model_costs_cache(db: AsyncSession):
    """Load model costs from platform_model_costs table into memory cache."""
    global _db_costs_cache, _db_costs_loaded
    try:
        rows = await db.execute(text(
            "SELECT provider, model, cost_input_per_1k, cost_output_per_1k, is_free, is_default "
            "FROM platform_model_costs"
        ))
        _db_costs_cache = {}
        for r in rows.fetchall():
            key = (r.provider, r.model)
            _db_costs_cache[key] = {
                "input": r.cost_input_per_1k,
                "output": r.cost_output_per_1k,
                "is_free": r.is_free,
            }
            if r.is_default:
                _db_costs_cache[(r.provider, "__default__")] = _db_costs_cache[key]
        _db_costs_loaded = True
        logger.info(f"[TokenService] Refreshed model costs cache: {len(_db_costs_cache)} entries")
    except Exception as e:
        logger.warning(f"[TokenService] Failed to load model costs from DB: {e}")


async def ensure_costs_cache(db: AsyncSession):
    """Ensure costs cache is loaded at least once."""
    global _db_costs_loaded
    if not _db_costs_loaded:
        await refresh_model_costs_cache(db)


# ── Core operations ─────────────────────────────────────────────────────────────

async def get_balance(db: AsyncSession, company_id: int, provider: str = "any") -> int:
    """Retorna o saldo de NEXUS tokens da empresa."""
    try:
        row = await db.execute(
            text("SELECT balance_tokens FROM ai_token_balances WHERE company_id=:cid AND provider=:p"),
            {"cid": company_id, "p": provider}
        )
        val = row.scalar_one_or_none()
        return int(val or 0)
    except Exception:
        return 0


async def get_all_balances(db: AsyncSession, company_id: int) -> dict:
    """Retorna todos os saldos por provider."""
    try:
        rows = await db.execute(
            text("SELECT provider, balance_tokens FROM ai_token_balances WHERE company_id=:cid"),
            {"cid": company_id}
        )
        return {r.provider: int(r.balance_tokens) for r in rows.fetchall()}
    except Exception:
        return {}


async def credit_tokens(
    db: AsyncSession,
    company_id: int,
    amount: int,
    pack_id: Optional[int] = None,
    provider: str = "any",
    description: str = "Pack de tokens creditado",
) -> int:
    """Credita NEXUS tokens na conta da empresa. Retorna novo saldo."""
    try:
        await db.execute(text("""
            INSERT INTO ai_token_balances (company_id, provider, balance_tokens, total_purchased, updated_at)
            VALUES (:cid, :p, :amt, :amt, NOW())
            ON CONFLICT (company_id, provider) DO UPDATE
              SET balance_tokens  = ai_token_balances.balance_tokens + :amt,
                  total_purchased = ai_token_balances.total_purchased + :amt,
                  updated_at      = NOW()
        """), {"cid": company_id, "p": provider, "amt": amount})

        await db.execute(text("""
            INSERT INTO ai_token_transactions
                (company_id, provider, nexus_tokens_cost, tx_type, pack_id, description)
            VALUES (:cid, :p, :amt, 'credit', :pid, :desc)
        """), {"cid": company_id, "p": provider, "amt": amount, "pid": pack_id, "desc": description})

        row = await db.execute(
            text("SELECT balance_tokens FROM ai_token_balances WHERE company_id=:cid AND provider=:p"),
            {"cid": company_id, "p": provider}
        )
        return int(row.scalar_one_or_none() or 0)
    except Exception as e:
        logger.error(f"credit_tokens error: {e}")
        raise


async def debit_tokens(
    db: AsyncSession,
    company_id: int,
    amount: int,
    provider: str,
    model: str = "",
    tokens_in: int = 0,
    tokens_out: int = 0,
    source: str = "chat",
    reference_id: Optional[str] = None,
    user_id: Optional[int] = None,
) -> bool:
    """
    Debita NEXUS tokens do saldo. Tenta 'any' primeiro, depois provider específico.
    Retorna True se ok, False se saldo insuficiente.
    """
    if amount <= 0:
        return True  # custo zero (modelos grátis)

    try:
        # 1. Tenta debitar de 'any' (saldo unificado)
        for p in ["any", provider]:
            row = await db.execute(
                text("SELECT balance_tokens FROM ai_token_balances WHERE company_id=:cid AND provider=:p FOR UPDATE"),
                {"cid": company_id, "p": p}
            )
            bal = row.scalar_one_or_none() or 0
            if bal >= amount:
                await db.execute(text("""
                    UPDATE ai_token_balances
                    SET balance_tokens = balance_tokens - :amt,
                        total_used     = total_used + :amt,
                        updated_at     = NOW()
                    WHERE company_id = :cid AND provider = :p
                """), {"cid": company_id, "amt": amount, "p": p})

                await db.execute(text("""
                    INSERT INTO ai_token_transactions
                        (company_id, user_id, provider, model, tokens_in, tokens_out,
                         nexus_tokens_cost, tx_type, source, reference_id)
                    VALUES (:cid, :uid, :prov, :model, :tin, :tout, :cost, 'usage', :src, :ref)
                """), {
                    "cid": company_id, "uid": user_id, "prov": provider,
                    "model": model, "tin": tokens_in, "tout": tokens_out,
                    "cost": amount, "src": source, "ref": reference_id,
                })
                return True

        return False  # sem saldo em nenhum provider
    except Exception as e:
        logger.error(f"debit_tokens error: {e}")
        return False


async def get_history(
    db: AsyncSession,
    company_id: int,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """Retorna histórico de transações de tokens."""
    offset = (page - 1) * limit
    try:
        rows = await db.execute(text("""
            SELECT id, provider, model, tokens_in, tokens_out,
                   nexus_tokens_cost, tx_type, source, description, created_at
            FROM ai_token_transactions
            WHERE company_id = :cid
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"cid": company_id, "limit": limit, "offset": offset})

        total_row = await db.execute(
            text("SELECT COUNT(*) FROM ai_token_transactions WHERE company_id=:cid"),
            {"cid": company_id}
        )

        tx = []
        for r in rows.mappings().all():
            d = dict(r)
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            tx.append(d)

        return {"transactions": tx, "total": int(total_row.scalar() or 0), "page": page}
    except Exception as e:
        logger.warning(f"get_history error: {e}")
        return {"transactions": [], "total": 0, "page": 1}


async def check_has_tokens_for(
    db: AsyncSession,
    company_id: int,
    provider: str,
    model: str,
    estimated_tokens: int = 2000,
) -> tuple[bool, int]:
    """
    Verifica se a empresa tem saldo para uma chamada estimada.
    Retorna (pode_usar, custo_estimado)
    """
    cost = cost_for_call(provider, model, estimated_tokens, estimated_tokens // 2)
    if cost == 0:
        return True, 0

    bal_any = await get_balance(db, company_id, "any")
    bal_provider = await get_balance(db, company_id, provider)
    total = bal_any + bal_provider
    return total >= cost, cost
