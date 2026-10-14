"""
PlanRepository — Data Access Layer for subscription plans and credits.

Provides the single source of truth for plan data read by billing_service,
feature_service, and store endpoints.
"""
from __future__ import annotations

import json
from typing import Optional, List

from loguru import logger
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UsageLog, Company, Plan


# ── Cached fallback (when DB has no matching plan) ──────────────────────────

_FALLBACK_FREE = {
    "plan": "free",
    "plan_label": "Free",
    "plan_color": "#6b7280",
    "price": 0.0,
    "currency": "BRL",
    "limits": {
        "flows_max": 3,
        "agents_max": 2,
        "skills_max": 3,
        "integrations_max": 2,
        "voice_profiles_max": 0,
        "campaigns_max": 0,
        "executions_per_month": 100,
        "ai_tokens_per_month": 50_000,
        "api_calls_per_month": 500,
        "members_max": 1,
        "credits_per_month": 0,
    },
    "features": ["basic_flows", "ollama_local"],
}


class PlanRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Legacy usage log methods (kept for backward compat) ──────────────────

    async def get_usage_log(self, company_id: int, month_key: str) -> Optional[UsageLog]:
        result = await self.db.execute(
            select(UsageLog).where(
                UsageLog.company_id == company_id,
                UsageLog.month_key == month_key,
            )
        )
        return result.scalar_one_or_none()

    async def list_usage_logs(self, company_id: int, *, limit: int = 12) -> List[UsageLog]:
        result = await self.db.execute(
            select(UsageLog)
            .where(UsageLog.company_id == company_id)
            .order_by(UsageLog.month_key.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create_usage_log(self, company_id: int, month_key: str) -> UsageLog:
        log = UsageLog(company_id=company_id, month_key=month_key)
        self.db.add(log)
        await self.db.flush()
        return log

    async def get_or_create_usage_log(self, company_id: int, month_key: str) -> UsageLog:
        log = await self.get_usage_log(company_id, month_key)
        if not log:
            log = await self.create_usage_log(company_id, month_key)
        return log

    async def total_tokens_this_month(self, month_key: str) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(UsageLog.tokens_used), 0))
            .where(UsageLog.month_key == month_key)
        )
        return result.scalar_one() or 0

    async def total_executions_this_month(self, month_key: str) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(UsageLog.executions_count), 0))
            .where(UsageLog.month_key == month_key)
        )
        return result.scalar_one() or 0

    async def list_companies_by_plan(self, plan: str) -> List[Company]:
        result = await self.db.execute(
            select(Company)
            .where(Company.plan == plan)
            .order_by(Company.created_at.desc())
        )
        return list(result.scalars().all())

    async def count_companies_by_plan(self) -> dict:
        result = await self.db.execute(
            select(Company.plan, func.count(Company.id))
            .group_by(Company.plan)
        )
        return {row[0]: row[1] for row in result.all()}

    # ── Plan lookups (NEW) ───────────────────────────────────────────────────

    async def get_plan_by_name(self, name: str) -> Optional[Plan]:
        """Get plan definition by slug name (e.g. 'free', 'pro')."""
        result = await self.db.execute(
            select(Plan).where(Plan.name == name, Plan.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_plan_by_id(self, plan_id: int) -> Optional[Plan]:
        result = await self.db.execute(select(Plan).where(Plan.id == plan_id))
        return result.scalar_one_or_none()

    async def list_active_plans(self) -> List[Plan]:
        """All active plans ordered by sort_order."""
        result = await self.db.execute(
            select(Plan).where(Plan.is_active == True).order_by(Plan.sort_order, Plan.id)
        )
        return list(result.scalars().all())

    # ── Company plan resolution (NEW) ────────────────────────────────────────

    async def get_company_plan_slug(self, company_id: int) -> str:
        """Return the plan slug for a company. Falls back to 'free'."""
        result = await self.db.execute(
            select(Company.plan).where(Company.id == company_id)
        )
        return result.scalar_one_or_none() or "free"

    async def get_plan_for_company(self, company_id: int) -> dict:
        """
        Return the full plan dict for a company, reading from DB.
        Falls back to _FALLBACK_FREE if plan not found in DB.

        PAYMENT GATE: For paid plans, checks if subscription is active.
        If pending_payment, returns Free-tier modules with payment_pending flag.
        This is the PRIMARY method called by billing_service.
        """
        plan_slug = await self.get_company_plan_slug(company_id)

        # Free plan — no payment check needed
        if plan_slug == "free":
            plan = await self.get_plan_by_name(plan_slug)
            if plan is not None:
                result = plan.to_limits_dict()
                result["payment_pending"] = False
                return result
            fallback = dict(_FALLBACK_FREE)
            fallback["payment_pending"] = False
            return fallback

        # Paid plan — verify active subscription
        has_active = await self._has_active_paid_subscription(company_id)
        plan = await self.get_plan_by_name(plan_slug)

        if not has_active:
            # No paid subscription — return Free-tier modules but keep plan name
            logger.info(
                f"💳 Company {company_id} has plan '{plan_slug}' but no active subscription — "
                f"returning Free modules until payment confirmed"
            )
            free_plan = await self.get_plan_by_name("free")
            result = free_plan.to_limits_dict() if free_plan else dict(_FALLBACK_FREE)
            result["plan"] = plan_slug
            result["plan_label"] = plan.display_name if plan else plan_slug.title()
            result["plan_color"] = plan.color if plan else "#6b7280"
            result["payment_pending"] = True
            return result

        if plan is not None:
            result = plan.to_limits_dict()
            result["payment_pending"] = False
            return result

        # Plan slug not found in DB — use safe fallback
        fallback = dict(_FALLBACK_FREE)
        fallback["plan"] = plan_slug
        fallback["payment_pending"] = False
        return fallback

    async def _has_active_paid_subscription(self, company_id: int) -> bool:
        """Check if company has an active (paid) subscription.
        Returns True if subscription status = 'active' and not expired.
        """
        try:
            result = await self.db.execute(
                text("""
                    SELECT 1 FROM subscriptions
                    WHERE company_id = :cid
                      AND status = 'active'
                      AND (expires_at IS NULL OR expires_at > NOW())
                    LIMIT 1
                """),
                {"cid": company_id}
            )
            return result.fetchone() is not None
        except Exception:
            # If subscriptions table doesn't exist yet, allow access
            return True

    async def get_modules_for_company(self, company_id: int) -> list:
        """Return the list of feature modules for a company's plan."""
        plan_data = await self.get_plan_for_company(company_id)
        features = plan_data.get("features", [])
        if isinstance(features, str):
            try:
                features = json.loads(features)
            except Exception:
                features = []
        return features

    # ── Credit management (NEW) ──────────────────────────────────────────────

    async def get_credit_balance(self, company_id: int) -> int:
        """Return current credit balance for a company (0 if no record)."""
        result = await self.db.execute(
            text("SELECT balance FROM user_credits WHERE company_id = :cid"),
            {"cid": company_id}
        )
        row = result.fetchone()
        return row[0] if row else 0

    async def debit_credits(
        self,
        company_id: int,
        amount: int,
        description: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        performed_by: Optional[int] = None,
    ) -> int:
        """
        Debit credits from a company balance. Returns new balance.
        Raises ValueError if insufficient balance.
        """
        current = await self.get_credit_balance(company_id)
        if current < amount:
            raise ValueError(
                f"Créditos insuficientes: disponível {current}, necessário {amount}"
            )
        new_balance = current - amount

        await self.db.execute(text("""
            INSERT INTO user_credits (company_id, balance, total_earned, total_spent)
            VALUES (:cid, :bal, 0, :spent)
            ON CONFLICT (company_id) DO UPDATE
            SET balance = :bal,
                total_spent = user_credits.total_spent + :spent,
                updated_at = NOW()
        """), {"cid": company_id, "bal": new_balance, "spent": amount})

        await self.db.execute(text("""
            INSERT INTO credit_transactions
              (company_id, amount, balance_after, transaction_type, description,
               reference_id, reference_type, performed_by)
            VALUES
              (:cid, :amt, :bal, 'spend', :desc, :ref_id, :ref_type, :by)
        """), {
            "cid": company_id, "amt": -amount, "bal": new_balance,
            "desc": description, "ref_id": reference_id,
            "ref_type": reference_type, "by": performed_by,
        })
        await self.db.commit()
        return new_balance

    async def grant_credits(
        self,
        company_id: int,
        amount: int,
        description: str,
        transaction_type: str = "grant",
        performed_by: Optional[int] = None,
    ) -> int:
        """Add credits to a company balance. Returns new balance."""
        current = await self.get_credit_balance(company_id)
        new_balance = current + amount

        await self.db.execute(text("""
            INSERT INTO user_credits (company_id, balance, total_earned, total_spent)
            VALUES (:cid, :bal, :earned, 0)
            ON CONFLICT (company_id) DO UPDATE
            SET balance = :bal,
                total_earned = user_credits.total_earned + :earned,
                updated_at = NOW()
        """), {"cid": company_id, "bal": new_balance, "earned": amount})

        await self.db.execute(text("""
            INSERT INTO credit_transactions
              (company_id, amount, balance_after, transaction_type, description, performed_by)
            VALUES
              (:cid, :amt, :bal, :type, :desc, :by)
        """), {
            "cid": company_id, "amt": amount, "bal": new_balance,
            "type": transaction_type, "desc": description, "by": performed_by,
        })
        await self.db.commit()
        return new_balance
