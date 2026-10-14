"""
FeatureService — Per-company feature gates for NEXUS.IA.

Replaces: app/feature_flags.py (3 global hardcoded flags)

Features are controlled by:
  1. Plan tier (free / pro / enterprise)
  2. Redis override — for A/B testing, beta rollout, temporary disables

Usage:
    from app.services.feature_service import feature_service

    if await feature_service.is_enabled("tts", company_id=42):
        audio = await tts_service.synthesize(text)

Redis key schema:
    feature:{company_id}:{feature_name}  →  "1" (enabled) | "0" (disabled)
    TTL: 24h by default
"""
from __future__ import annotations

from typing import Optional

from loguru import logger


# ── Feature definitions per plan (FALLBACK ONLY) ─────────────────────
# These are used ONLY when the DB plan is not found.
# Manage real features via /admin/plans → modules field.

PLAN_FEATURES: dict[str, set[str]] = {
    "free": {
        "ollama_local",
        "basic_flows",
    },
    "starter": {
        "ollama_local",
        "basic_flows",
        "telegram",
        "whatsapp",
        "webhooks",
    },
    "pro": {
        "ollama_local",
        "cloud_ai",
        "basic_flows",
        "webhooks",
        "analytics",
        "audit_log",
        "tts",
        "voice_agents",
        "memory_summary",
        "fact_extraction",
        "telegram",
        "whatsapp",
        "campaigns",
        "google_workspace",
        "bids",
    },
    "enterprise": {
        "*",  # All features unlocked
    },
}

ALL_FEATURES = {
    "ollama_local", "cloud_ai", "basic_flows", "webhooks", "analytics",
    "audit_log", "tts", "voice_agents", "memory_summary", "fact_extraction",
    "telegram", "whatsapp", "campaigns", "sso", "custom_models",
    "experimental_routing", "auto_dream", "cost_dashboard",
    "google_workspace", "bids", "voice_tts",
}


class FeatureService:
    """
    Evaluates feature availability per company.

    Checks (in order):
      1. Enterprise wildcard (*) → all features enabled
      2. Plan-based feature set
      3. Redis override (enables/disables regardless of plan)
    """

    def __init__(self, redis_client=None):
        self._redis = redis_client

    async def is_enabled(
        self,
        feature: str,
        company_id: int,
        plan: Optional[str] = None,
        plan_modules: Optional[list] = None,  # pre-loaded from DB (avoids extra query)
    ) -> bool:
        """
        Check if a feature is available for the given company.

        Priority:
          1. Redis override (per-company, TTL-based)
          2. plan_modules from DB (if provided)
          3. PLAN_FEATURES fallback (hardcoded, for legacy/bootstrap)

        Args:
            feature: Feature slug (e.g. "tts", "cloud_ai")
            company_id: Company ID for per-company Redis overrides
            plan: Optional plan string (used only for fallback)
            plan_modules: DB-loaded list of module slugs (preferred source)
        """
        # 1. Redis override (highest priority — can enable/disable any feature)
        if self._redis:
            try:
                key = f"feature:{company_id}:{feature}"
                override = await self._redis.get(key)
                if override is not None:
                    result = override == "1" or override == b"1"
                    logger.debug(
                        f"🔀 Feature '{feature}' for company {company_id}: "
                        f"Redis override → {'ENABLED' if result else 'DISABLED'}"
                    )
                    return result
            except Exception as e:
                logger.warning(f"Redis feature check failed (falling back to plan): {e}")

        # 2. DB-loaded modules (plan_modules passed from billing_service)
        if plan_modules is not None:
            modules_list = plan_modules if isinstance(plan_modules, (list, set)) else []
            if "*" in modules_list:
                return True  # enterprise wildcard
            return feature in modules_list

        # 3. Fallback to hardcoded PLAN_FEATURES
        plan = plan or "free"
        plan_features = PLAN_FEATURES.get(plan, set())
        if "*" in plan_features:
            return True
        return feature in plan_features

    async def is_enabled_db(
        self,
        feature: str,
        company_id: int,
        db,  # AsyncSession — injected to read from DB
    ) -> bool:
        """
        Full DB-backed check. Use this in route handlers when you have a db session
        and don't want to pre-load plan data separately.
        """
        from app.db.repositories.plan_repository import PlanRepository
        try:
            repo = PlanRepository(db)
            modules = await repo.get_modules_for_company(company_id)
            return await self.is_enabled(feature, company_id, plan_modules=modules)
        except Exception as e:
            logger.warning(f"is_enabled_db failed for {feature}/{company_id}: {e}")
            return False  # fail-safe: deny if DB error

    async def enable(self, feature: str, company_id: int, ttl_seconds: int = 86400) -> None:
        """Enable a feature for a company via Redis override."""
        if not self._redis:
            logger.warning("Redis not available — cannot set feature override")
            return
        key = f"feature:{company_id}:{feature}"
        await self._redis.set(key, "1", ex=ttl_seconds)
        logger.info(f"✅ Feature '{feature}' ENABLED for company {company_id} (TTL={ttl_seconds}s)")

    async def disable(self, feature: str, company_id: int, ttl_seconds: int = 86400) -> None:
        """Disable a feature for a company via Redis override."""
        if not self._redis:
            logger.warning("Redis not available — cannot set feature override")
            return
        key = f"feature:{company_id}:{feature}"
        await self._redis.set(key, "0", ex=ttl_seconds)
        logger.info(f"🚫 Feature '{feature}' DISABLED for company {company_id} (TTL={ttl_seconds}s)")

    async def clear_override(self, feature: str, company_id: int) -> None:
        """Remove Redis override — revert to plan-based access."""
        if not self._redis:
            return
        key = f"feature:{company_id}:{feature}"
        await self._redis.delete(key)

    def plan_features(self, plan: str) -> set[str]:
        """Return the set of features available for a plan."""
        features = PLAN_FEATURES.get(plan, set())
        if "*" in features:
            return ALL_FEATURES
        return features


# ── Singleton ──────────────────────────────────────────────────────────

_instance: Optional[FeatureService] = None


def get_feature_service(redis_client=None) -> FeatureService:
    """Return global FeatureService singleton."""
    global _instance
    if _instance is None:
        _instance = FeatureService(redis_client=redis_client)
    return _instance


# Convenience alias — import this in routes
feature_service = get_feature_service()


# ── Backward-compatibility shim (replaces feature_flags.py) ───────────

def is_enabled(flag: str) -> bool:
    """
    [DEPRECATED] Synchronous compatibility wrapper for old feature_flags.py usage.

    Old: from app.feature_flags import is_enabled; is_enabled("FEATURE_TTS_ENABLED")
    New: await feature_service.is_enabled("tts", company_id=company_id)

    Migration map:
        FEATURE_TTS_ENABLED          → "tts"
        FEATURE_BETA_MEMORY          → "memory_summary"
        FEATURE_EXPERIMENTAL_ROUTING → "experimental_routing"
    """
    _compat_map = {
        "FEATURE_TTS_ENABLED": True,
        "FEATURE_BETA_MEMORY": True,
        "FEATURE_EXPERIMENTAL_ROUTING": False,
    }
    result = _compat_map.get(flag, False)
    logger.warning(
        f"⚠️  is_enabled('{flag}') is deprecated — "
        f"use: await feature_service.is_enabled('<slug>', company_id=id)"
    )
    return result
