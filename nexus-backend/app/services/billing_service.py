"""NEXUS.IA — Billing & Quota Service

Responsible for:
  - Defining PLAN_LIMITS fallback (for tests/bootstrap only)
  - Retrieving current plan data FROM THE DATABASE (via PlanRepository)
  - Retrieving current period usage
  - Incrementing usage counters atomically (upsert)
  - Checking if a company is within quota limits

IMPORTANT: As of this version, plan limits are read from the `plans` table
in the database (managed via /admin/plans). The PLAN_LIMITS dict below is used
ONLY as an in-memory fallback when the DB plan is not found.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Union

from sqlalchemy import select, func, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Company, Execution, Flow, UsageLog

# ── Legacy fallback (used only if DB plan not found) ──────────────────────────
# Do NOT add new plans here — create them in the admin panel instead.

PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Free",
        "color": "#6b7280",
        "executions_per_month": 100,
        "ai_tokens_per_month": 50_000,
        "flows_max": 3,
        "agents_max": 2,
        "skills_max": 3,
        "integrations_max": 2,
        "voice_profiles_max": 0,
        "campaigns_max": 0,
        "api_calls_per_month": 500,
        "members_max": 1,
        "credits_per_month": 0,
        "features": ["ollama_local", "basic_flows"],
    },
    "starter": {
        "label": "Starter",
        "color": "#10b981",
        "executions_per_month": 1_000,
        "ai_tokens_per_month": 500_000,
        "flows_max": 10,
        "agents_max": 5,
        "skills_max": 10,
        "integrations_max": 5,
        "voice_profiles_max": 1,
        "campaigns_max": 2,
        "api_calls_per_month": 5_000,
        "members_max": 3,
        "credits_per_month": 200,
        "features": ["ollama_local", "basic_flows", "telegram", "whatsapp", "webhooks"],
    },
    "pro": {
        "label": "Pro",
        "color": "#7c55eb",
        "executions_per_month": 5_000,
        "ai_tokens_per_month": 2_000_000,
        "flows_max": 50,
        "agents_max": 20,
        "skills_max": 50,
        "integrations_max": 20,
        "voice_profiles_max": 5,
        "campaigns_max": 10,
        "api_calls_per_month": 50_000,
        "members_max": 10,
        "credits_per_month": 1_000,
        "features": [
            "ollama_local", "cloud_ai", "webhooks", "analytics",
            "audit_log", "telegram", "whatsapp", "voice_tts",
            "campaigns", "google_workspace",
        ],
    },
    "enterprise": {
        "label": "Enterprise",
        "color": "#06b6d4",
        "executions_per_month": -1,
        "ai_tokens_per_month": -1,
        "flows_max": -1,
        "agents_max": -1,
        "skills_max": -1,
        "integrations_max": -1,
        "voice_profiles_max": -1,
        "campaigns_max": -1,
        "api_calls_per_month": -1,
        "members_max": -1,
        "credits_per_month": 5_000,
        "features": ["*"],  # wildcard — all features
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_period() -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    return now.year, now.month


def _pct(used: Union[int, float], limit: int) -> float:
    """Return usage percentage. -1 limit = unlimited → always 0%."""
    if limit == -1 or limit == 0:
        return 0.0
    return round(min((used / limit) * 100, 100), 1)


def _fallback_limits(plan_key: str) -> dict:
    """Return hardcoded fallback limits for a plan key."""
    return PLAN_LIMITS.get(plan_key, PLAN_LIMITS["free"])


# ── Core service functions ────────────────────────────────────────────────────

async def get_company_plan(company_id: int, db: AsyncSession) -> dict:
    """
    Return plan info for a company — reads from DB via PlanRepository.

    Returns a dict with shape:
      { plan, plan_label, plan_color, price, currency, limits{...}, features[...] }
    """
    from app.db.repositories.plan_repository import PlanRepository
    repo = PlanRepository(db)

    try:
        plan_data = await repo.get_plan_for_company(company_id)
        # Normalize shape for backward compat with existing callers
        limits = plan_data.get("limits", {})
        return {
            "plan": plan_data["plan"],
            "plan_label": plan_data.get("plan_label", plan_data["plan"].title()),
            "plan_color": plan_data.get("plan_color", "#6b7280"),
            # Flatten limits into top level (legacy compat)
            "executions_per_month": limits.get("executions_per_month", 100),
            "ai_tokens_per_month": limits.get("ai_tokens_per_month", 50_000),
            "flows_max": limits.get("flows_max", 3),
            "agents_max": limits.get("agents_max", 2),
            "skills_max": limits.get("skills_max", 3),
            "integrations_max": limits.get("integrations_max", 2),
            "voice_profiles_max": limits.get("voice_profiles_max", 0),
            "campaigns_max": limits.get("campaigns_max", 0),
            "api_calls_per_month": limits.get("api_calls_per_month", 500),
            "members_max": limits.get("members_max", 1),
            "credits_per_month": limits.get("credits_per_month", 0),
            "features": plan_data.get("features", []),
            # Nested version for new callers
            "limits": limits,
        }
    except Exception:
        # Absolute fallback — never crash billing
        result = await db.execute(select(Company.plan).where(Company.id == company_id))
        plan_key = result.scalar_one_or_none() or "free"
        lim = _fallback_limits(plan_key)
        return {"plan": plan_key, **lim, "limits": lim}


async def get_or_create_usage(company_id: int, db: AsyncSession) -> "UsageLog":
    """Get (or create) the UsageLog row for the current billing period."""
    year, month = _current_period()

    result = await db.execute(
        select(UsageLog).where(
            UsageLog.company_id == company_id,
            UsageLog.year == year,
            UsageLog.month == month,
        )
    )
    usage = result.scalar_one_or_none()

    if not usage:
        usage = UsageLog(
            company_id=company_id, year=year, month=month,
            executions_count=0, ai_tokens_used=0,
            flows_created=0, api_calls=0,
        )
        db.add(usage)
        await db.flush()

    return usage


async def get_quota_status(company_id: int, db: AsyncSession) -> dict:
    """Return full quota status for a company (usage + limits + percentages)."""
    year, month = _current_period()

    # Get plan from DB
    plan_info = await get_company_plan(company_id, db)
    plan_key = plan_info["plan"]

    limits = plan_info.get("limits") or {
        "flows_max": plan_info.get("flows_max", 3),
        "agents_max": plan_info.get("agents_max", 2),
        "skills_max": plan_info.get("skills_max", 3),
        "integrations_max": plan_info.get("integrations_max", 2),
        "voice_profiles_max": plan_info.get("voice_profiles_max", 0),
        "campaigns_max": plan_info.get("campaigns_max", 0),
        "executions_per_month": plan_info.get("executions_per_month", 100),
        "ai_tokens_per_month": plan_info.get("ai_tokens_per_month", 50_000),
        "api_calls_per_month": plan_info.get("api_calls_per_month", 500),
        "members_max": plan_info.get("members_max", 1),
        "credits_per_month": plan_info.get("credits_per_month", 0),
    }

    # Get or create current period row
    usage = await get_or_create_usage(company_id, db)
    live_executions = usage.executions_count or 0

    try:
        flow_count_result = await db.execute(
            select(func.count()).select_from(Flow).where(
                Flow.company_id == company_id,
                Flow.status != "archived",
            )
        )
        live_flows = flow_count_result.scalar() or 0
    except Exception:
        live_flows = 0

    # Count active agents
    try:
        from app.models import AgentProfile
        agent_result = await db.execute(
            select(func.count()).select_from(AgentProfile).where(
                AgentProfile.company_id == company_id
            )
        )
        live_agents = agent_result.scalar() or 0
    except Exception:
        live_agents = 0

    # Get credit balance
    from app.db.repositories.plan_repository import PlanRepository
    credits_balance = 0
    try:
        repo = PlanRepository(db)
        credits_balance = await repo.get_credit_balance(company_id)
    except Exception:
        pass

    exec_limit = limits.get("executions_per_month", 100)
    token_limit = limits.get("ai_tokens_per_month", 50_000)
    flow_limit = limits.get("flows_max", 3)
    api_limit = limits.get("api_calls_per_month", 500)
    agent_limit = limits.get("agents_max", 2)

    return {
        "plan": plan_key,
        "plan_label": plan_info.get("plan_label", plan_key.title()),
        "plan_color": plan_info.get("plan_color", "#6b7280"),
        "period": {"year": year, "month": month},
        "limits": {
            "executions_per_month": exec_limit,
            "ai_tokens_per_month": token_limit,
            "flows_max": flow_limit,
            "agents_max": agent_limit,
            "skills_max": limits.get("skills_max", 3),
            "integrations_max": limits.get("integrations_max", 2),
            "voice_profiles_max": limits.get("voice_profiles_max", 0),
            "campaigns_max": limits.get("campaigns_max", 0),
            "api_calls_per_month": api_limit,
            "members_max": limits.get("members_max", 1),
            "credits_per_month": limits.get("credits_per_month", 0),
        },
        "usage": {
            "executions": live_executions,
            "ai_tokens": usage.ai_tokens_used,
            "flows": live_flows,
            "agents": live_agents,
            "api_calls": usage.api_calls,
        },
        "percentages": {
            "executions": _pct(live_executions, exec_limit),
            "ai_tokens": _pct(usage.ai_tokens_used or 0, token_limit),
            "flows": _pct(live_flows, flow_limit),
            "agents": _pct(live_agents, agent_limit),
            "api_calls": _pct(usage.api_calls or 0, api_limit),
        },
        "features": plan_info.get("features", []),
        "credits": {
            "balance": credits_balance,
            "monthly_grant": limits.get("credits_per_month", 0),
        },
        "over_quota": {
            "executions": exec_limit != -1 and live_executions >= exec_limit,
            "flows": flow_limit != -1 and live_flows >= flow_limit,
            "agents": agent_limit != -1 and live_agents >= agent_limit,
            "ai_tokens": token_limit != -1 and (usage.ai_tokens_used or 0) >= token_limit,
        },
        "payment_pending": plan_info.get("payment_pending", False),
    }


async def _upsert_field(company_id: int, db: AsyncSession, **increments) -> None:
    """DB-agnostic atomic increment for UsageLog fields.
    BUG-10 FIX: usa incremento atômico no SQL (col + :val) em vez de
    ler em Python e somar — elimina race condition entre workers paralelos.
    """
    year, month = _current_period()
    # Garantir que a linha existe
    await get_or_create_usage(company_id, db)

    # Montar SET com incrementos atômicos diretamente no SQL
    set_clauses = ", ".join([f"{field} = COALESCE({field}, 0) + :{field}" for field in increments])
    params = {"company_id": company_id, "year": year, "month": month, **increments}

    await db.execute(
        text(
            f"UPDATE usage_logs SET {set_clauses} "
            f"WHERE company_id = :company_id AND year = :year AND month = :month"
        ),
        params,
    )
    await db.commit()


async def increment_executions(company_id: int, db: AsyncSession, amount: int = 1) -> None:
    await _upsert_field(company_id, db, executions_count=amount)


async def increment_tokens(company_id: int, db: AsyncSession, tokens: int) -> None:
    await _upsert_field(company_id, db, ai_tokens_used=tokens)


async def increment_api_call(company_id: int, db: AsyncSession, amount: int = 1) -> None:
    await _upsert_field(company_id, db, api_calls=amount)


async def increment_cost(company_id: int, db: AsyncSession, cost_usd: float) -> None:
    if cost_usd <= 0:
        return
    await _upsert_field(company_id, db, ai_cost_usd=cost_usd)


async def check_can_execute(company_id: int, db: AsyncSession) -> tuple[bool, str]:
    quota = await get_quota_status(company_id, db)
    if quota["over_quota"]["executions"]:
        plan = quota["plan_label"]
        limit = quota["limits"]["executions_per_month"]
        return False, f"Limite de {limit} execuções/mês atingido no plano {plan}. Faça upgrade."
    return True, ""


async def check_can_create_flow(company_id: int, db: AsyncSession) -> tuple[bool, str]:
    quota = await get_quota_status(company_id, db)
    if quota["over_quota"]["flows"]:
        plan = quota["plan_label"]
        limit = quota["limits"]["flows_max"]
        return False, f"Limite de {limit} fluxos ativos atingido no plano {plan}. Faça upgrade."
    return True, ""


async def check_can_create_agent(company_id: int, db: AsyncSession) -> tuple[bool, str]:
    quota = await get_quota_status(company_id, db)
    if quota["over_quota"]["agents"]:
        plan = quota["plan_label"]
        limit = quota["limits"]["agents_max"]
        return False, f"Limite de {limit} agentes atingido no plano {plan}. Faça upgrade."
    return True, ""
