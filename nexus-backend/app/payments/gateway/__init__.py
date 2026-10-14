"""
NEXUS.IA — Open Gateway: API Key Model & Auth (TASK 5.1 + 5.2)

Modelo SQLAlchemy + middleware de autenticação via X-API-Key header.
Keys são armazenadas como SHA-256 hash (nunca raw no banco).

Fluxo de autenticação:
1. Cliente envia header X-API-Key: nxs_live_xxxxxxxxxxxxxxxxxxxx
2. Middleware faz SHA-256 do valor
3. Busca no banco por key_hash + is_active + not expired
4. Valida IP whitelist e rate limit
5. Injeta company_id no request.state

Usage:
    from app.payments.gateway.auth import require_gateway_key

    @router.post("/charges")
    async def create(request: Request, db=Depends(get_db), api_key=Depends(require_gateway_key)):
        company_id = api_key.company_id
"""
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request, HTTPException, status, Depends
from loguru import logger

from app.db.session import Base, get_db


# ── Model ────────────────────────────────────────────────────────────────────

class GatewayApiKey(Base):
    __tablename__ = "gateway_api_keys"

    id             = Column(Integer, primary_key=True)
    company_id     = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    key_hash       = Column(String(128), unique=True, nullable=False)
    key_prefix     = Column(String(12), nullable=False, index=True)
    label          = Column(String(200), nullable=False, default="Default")
    environment    = Column(String(10), nullable=False, default="live")
    is_active      = Column(Boolean, nullable=False, default=True)
    permissions    = Column(JSON, nullable=False, default=["charges.create", "charges.read", "balance.read"])
    rate_limit_rpm = Column(Integer, nullable=False, default=60)
    last_used_at   = Column(DateTime(timezone=True), nullable=True)
    ip_whitelist   = Column(JSON, default=[])
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    expires_at     = Column(DateTime(timezone=True), nullable=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

def hash_api_key(raw_key: str) -> str:
    """SHA-256 hash da API key. Determinístico — mesma key = mesmo hash."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key(environment: str = "live") -> tuple[str, str, str]:
    """
    Gera nova API key.
    Returns: (raw_key, key_hash, key_prefix)
    """
    import secrets
    random_part = secrets.token_hex(24)  # 48 chars hex
    prefix = f"nxs_{environment[:4]}_"
    raw_key = f"{prefix}{random_part}"
    return raw_key, hash_api_key(raw_key), raw_key[:12]


# ── Rate Limiter (in-memory, por key_prefix) ─────────────────────────────────

_rate_windows: dict[str, list[float]] = {}


def _check_rate_limit(key_prefix: str, max_rpm: int) -> None:
    """Verifica rate limit por API key. Raises 429 se excedido."""
    now = time.time()
    window = 60.0

    if key_prefix not in _rate_windows:
        _rate_windows[key_prefix] = []

    # Prune old entries
    _rate_windows[key_prefix] = [t for t in _rate_windows[key_prefix] if now - t < window]

    if len(_rate_windows[key_prefix]) >= max_rpm:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"Rate limit: {max_rpm} requests/min. Tente novamente em breve.",
                "retry_after_seconds": 60,
            }
        )

    _rate_windows[key_prefix].append(now)


# ── Auth Dependency ──────────────────────────────────────────────────────────

async def require_gateway_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GatewayApiKey:
    """
    FastAPI dependency: valida X-API-Key header.
    Retorna GatewayApiKey se válido, raises 401/403 se não.
    """
    raw_key = request.headers.get("X-API-Key")
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "missing_api_key",
                "message": "Header X-API-Key é obrigatório. "
                           "Gere uma chave em Settings > API Keys.",
            }
        )

    # Hash e busca
    key_h = hash_api_key(raw_key)
    result = await db.execute(
        select(GatewayApiKey).where(
            GatewayApiKey.key_hash == key_h,
            GatewayApiKey.is_active == True,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "invalid_api_key",
                "message": "API Key inválida ou desativada.",
            }
        )

    # Verificar expiração
    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "expired_api_key",
                "message": "API Key expirada. Gere uma nova em Settings > API Keys.",
            }
        )

    # Verificar IP whitelist
    client_ip = request.client.host if request.client else "unknown"
    if api_key.ip_whitelist and len(api_key.ip_whitelist) > 0:
        if client_ip not in api_key.ip_whitelist:
            logger.warning(
                f"🚫 Gateway: IP {client_ip} não está na whitelist da key {api_key.key_prefix}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ip_not_whitelisted",
                    "message": f"IP {client_ip} não autorizado para esta API Key.",
                }
            )

    # Rate limit
    _check_rate_limit(api_key.key_prefix, api_key.rate_limit_rpm)

    # Update last_used_at (fire-and-forget, non-blocking)
    try:
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.flush()
    except Exception:
        pass  # Non-critical

    # Inject company_id in request state
    request.state.gateway_company_id = api_key.company_id
    request.state.gateway_key_prefix = api_key.key_prefix
    request.state.gateway_environment = api_key.environment

    return api_key


def require_permission(permission: str):
    """
    Factory para dependency que verifica permissão específica.
    Usage: Depends(require_permission("charges.create"))
    """
    async def _check(api_key: GatewayApiKey = Depends(require_gateway_key)):
        perms = api_key.permissions or []
        if "*" in perms or permission in perms:
            return api_key
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "insufficient_permissions",
                "message": f"API Key não tem permissão '{permission}'.",
                "required": permission,
                "granted": perms,
            }
        )
    return _check
