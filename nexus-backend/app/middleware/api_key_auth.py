"""
API Key Auth Middleware — SmartMoon Public API

Valida Bearer token, aplica rate limiting via Redis,
injeta company_id e api_key no request.state.
"""
import hashlib
import secrets
import time
from datetime import datetime, timezone
from typing import Tuple

from fastapi import HTTPException, Request
from loguru import logger
from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models.api_key import ApiKey, ApiUsageLog


# ── Auth ─────────────────────────────────────────────────────

async def verify_api_key(request: Request) -> ApiKey:
    """
    Dependency para FastAPI: valida API Key do header.

    Uso nas rotas:
        @router.get("/endpoint")
        async def my_route(api_key=Depends(verify_api_key)):
            company_id = api_key.company_id

    Header esperado:
        Authorization: Bearer sm_xxxxxxxxxxxxxxxx
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer sm_"):
        raise HTTPException(
            status_code=401,
            detail="API Key obrigatória. Header: Authorization: Bearer sm_<chave>",
        )

    raw_key  = auth[len("Bearer "):]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ApiKey).where(
                ApiKey.key_hash == key_hash,
                ApiKey.is_active == True,
            )
        )
        api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=401, detail="API Key inválida ou revogada")

    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="API Key expirada")

    # Rate limiting
    await _apply_rate_limit(api_key)

    # Atualiza last_used_at (non-blocking, best effort)
    _update_last_used(api_key.id)

    request.state.api_key    = api_key
    request.state.company_id = api_key.company_id
    return api_key


async def _apply_rate_limit(api_key: ApiKey) -> None:
    """Conta requests por minuto via Redis. Lança 429 se exceder."""
    try:
        from app.core.config import settings
        import redis.asyncio as aioredis

        r = aioredis.from_url(getattr(settings, "REDIS_URL", "redis://localhost:6379/0"))
        minute_bucket = int(time.time() // 60)
        redis_key = f"rate:apikey:{api_key.key_prefix}:{minute_bucket}"

        count = await r.incr(redis_key)
        if count == 1:
            await r.expire(redis_key, 120)  # TTL 2 min

        await r.aclose()

        if count > api_key.rate_limit_rpm:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit excedido: {api_key.rate_limit_rpm} req/min. Aguarde o próximo minuto.",
                headers={"Retry-After": "60"},
            )
    except HTTPException:
        raise
    except Exception as e:
        # Redis indisponível — não bloqueia a requisição (best effort)
        logger.warning(f"Rate limit check failed (Redis?): {e}")


def _update_last_used(api_key_id: int) -> None:
    """Atualiza last_used_at de forma não bloqueante (fire and forget)."""
    import asyncio

    async def _update():
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(ApiKey)
                    .where(ApiKey.id == api_key_id)
                    .values(last_used_at=datetime.now(timezone.utc))
                )
                await db.commit()
        except Exception:
            pass

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_update())
    except RuntimeError:
        pass  # sem event loop ativo — ignora silenciosamente


# ── Log de uso ────────────────────────────────────────────────

async def log_api_usage(
    api_key: ApiKey,
    endpoint: str,
    method: str = "POST",
    instance_id: str = None,
    status_code: int = 200,
    msgs_sent: int = 0,
) -> None:
    """Registra uso da API para auditoria e billing futuro (best effort)."""
    try:
        async with AsyncSessionLocal() as db:
            db.add(ApiUsageLog(
                api_key_id  = api_key.id,
                company_id  = api_key.company_id,
                endpoint    = endpoint,
                method      = method,
                instance_id = instance_id,
                status_code = status_code,
                msgs_sent   = msgs_sent,
            ))
            await db.commit()
    except Exception as e:
        logger.warning(f"Failed to log API usage: {e}")


# ── Geração de chaves ─────────────────────────────────────────

def generate_api_key() -> Tuple[str, str, str]:
    """
    Gera uma nova API Key.
    Retorna: (raw_key, key_prefix, key_hash)

    raw_key   → exibido UMA ÚNICA VEZ ao usuário
    key_prefix → guardado no banco para exibição (ex: "sm_abc123")
    key_hash  → SHA-256 guardado no banco para validação
    """
    token   = secrets.token_urlsafe(32)
    raw_key = f"sm_{token}"
    key_prefix = raw_key[:12]  # "sm_" + 9 chars
    key_hash   = hashlib.sha256(raw_key.encode()).hexdigest()
    return raw_key, key_prefix, key_hash
