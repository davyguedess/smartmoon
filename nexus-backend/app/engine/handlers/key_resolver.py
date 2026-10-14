"""
API Key Resolver — used by all AI engine handlers.

Priority:
  1. DB (APIKeyStore table)   — user-configured via /profile → Chaves de API
  2. DB (integrations table)  — for Z-API, Telegram, WhatsApp Business
  3. .env fallback            — ONLY if ALLOW_ENV_PROVIDER_FALLBACK=True (dev only)
  4. None → mock mode

SECURITY: In production, ALLOW_ENV_PROVIDER_FALLBACK must be False.
The .env should only contain infra keys (DB, Redis, Ollama URLs).
"""
from typing import Optional
from loguru import logger
from app.core.config import settings

# Normalize provider name aliases to canonical DB key
_PROVIDER_ALIASES: dict[str, str] = {
    "gpt": "openai",
    "gpt4": "openai",
    "gpt-4o": "openai",
    "whisper": "openai",        # Whisper uses OpenAI key
    "google_gemini": "gemini",
    "google-gemini": "gemini",
    "anthropic": "claude",
    "claude-sonnet": "claude",
    "elevenlabs": "elevenlabs",
    "eleven_labs": "elevenlabs",
    "eleven-labs": "elevenlabs",
    "groq_llm": "groq",
}


def _normalize_provider(provider: str) -> str:
    return _PROVIDER_ALIASES.get(provider.lower(), provider.lower())


async def resolve_api_key(
    provider: str,
    company_id: int,
    db_session,
    env_key: str = "",
) -> Optional[str]:
    """
    Resolves an API key for a provider + company.

    Args:
        provider:    Provider name (e.g. 'openai', 'gemini', 'groq')
        company_id:  The company executing the flow
        db_session:  AsyncSession — injected into context as '_db'
        env_key:     Value from settings (e.g. settings.OPENAI_API_KEY) — fallback only

    Returns:
        Decrypted API key string, or None (mock mode).
    """
    canonical = _normalize_provider(provider)

    # ── 1. Try APIKeyStore (user-configured keys) ──────────────────────────
    if db_session and company_id:
        try:
            from app.api.routes.core.settings import get_api_key_for_provider
            key = await get_api_key_for_provider(canonical, company_id, db_session)
            if key:
                logger.debug(f"🔑 [{canonical}] key resolved from APIKeyStore (company {company_id})")
                return key
        except Exception as e:
            logger.warning(f"Could not read {canonical} key from APIKeyStore: {e}")

    # ── 2. Try PlatformAPIKey (admin-configured platform keys) ─────────────
    if db_session:
        try:
            from sqlalchemy import text as sa_text
            row = await db_session.execute(sa_text(
                "SELECT encrypted_key FROM platform_api_keys "
                "WHERE provider = :p AND is_active = true AND encrypted_key IS NOT NULL"
            ), {"p": canonical})
            result = row.fetchone()
            if result and result.encrypted_key:
                from app.api.routes.core.settings import decrypt_key
                platform_key = decrypt_key(result.encrypted_key)
                if platform_key:
                    logger.debug(f"🔑 [{canonical}] key resolved from PlatformAPIKey (admin global)")
                    return platform_key
        except Exception as e:
            logger.warning(f"Could not read {canonical} key from PlatformAPIKey: {e}")

    # ── 3. .env fallback — dev/internal only ──────────────────────────────
    if env_key:
        if settings.ALLOW_ENV_PROVIDER_FALLBACK:
            logger.debug(f"🔑 [{canonical}] key resolved from .env fallback")
            return env_key
        else:
            logger.warning(
                f"⚠️  [{canonical}] company_id={company_id}: no key configured. "
                f".env fallback BLOCKED (production mode). "
                f"User must configure key via /profile → Chaves de API"
            )

    logger.warning(f"⚠️  [{canonical}] No API key found for company {company_id} — mock mode")
    return None


async def resolve_integration_credentials(
    provider: str,
    company_id: int,
    db_session,
) -> Optional[dict]:
    """
    Resolves integration credentials (Z-API, Telegram, WhatsApp Business)
    from the integrations table (per-company).

    Returns a dict with credentials or None.
    """
    if not db_session or not company_id:
        return None

    try:
        import json
        from sqlalchemy import select
        from app.models import Integration

        result = await db_session.execute(
            select(Integration).where(
                Integration.company_id == company_id,
                Integration.provider == provider,
                Integration.status == "connected",
            ).order_by(Integration.id.desc()).limit(1)
        )
        intg = result.scalars().first()
        if not intg:
            logger.debug(f"  [{provider}] No connected integration for company {company_id}")
            return None

        creds = {}
        if intg.encrypted_credentials:
            try:
                creds = json.loads(intg.encrypted_credentials)
            except Exception:
                creds = {}
        if intg.config_json:
            cfg = intg.config_json if isinstance(intg.config_json, dict) else json.loads(intg.config_json)
            creds.update(cfg)

        logger.debug(f"🔑 [{provider}] integration resolved from DB (company {company_id})")
        return creds if creds else None

    except Exception as e:
        logger.warning(f"Could not read {provider} integration from DB: {e}")
        return None
