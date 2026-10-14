"""
API Pública — Gerenciamento de API Keys

Endpoints para criar, listar e revogar API Keys.
Requer autenticação JWT normal (usuário do painel NEXUS).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.middleware.api_key_auth import generate_api_key
from app.models.api_key import ApiKey, ApiUsageLog

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


# ── Schemas ──────────────────────────────────────────────────

class CreateApiKeyRequest(BaseModel):
    name:           str
    rate_limit_rpm: Optional[int] = 60
    expires_at:     Optional[datetime] = None


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/", summary="Criar API Key")
async def create_api_key(
    body: CreateApiKeyRequest,
    db:   AsyncSession = Depends(get_db),
    user  = Depends(get_current_user),
):
    """
    Cria uma nova API Key para sua empresa.

    ⚠️ A chave completa é exibida APENAS nesta resposta.
    Guarde-a com segurança — não é possível recuperá-la depois.
    """
    raw_key, key_prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        company_id     = user.company_id,
        name           = body.name,
        key_prefix     = key_prefix,
        key_hash       = key_hash,
        rate_limit_rpm = body.rate_limit_rpm or 60,
        expires_at     = body.expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return {
        "id":          api_key.id,
        "name":        api_key.name,
        "key":         raw_key,        # ← exibida apenas 1 vez!
        "key_prefix":  key_prefix,
        "rate_limit":  api_key.rate_limit_rpm,
        "created_at":  api_key.created_at.isoformat(),
        "warning":     "Guarde esta chave agora — ela não será exibida novamente.",
    }


@router.get("/", summary="Listar API Keys")
async def list_api_keys(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(get_current_user),
):
    """Lista todas as API Keys da sua empresa (sem exibir a chave real)."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.company_id == user.company_id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        {
            "id":           k.id,
            "name":         k.name,
            "key_prefix":   k.key_prefix,
            "is_active":    k.is_active,
            "rate_limit":   k.rate_limit_rpm,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "expires_at":   k.expires_at.isoformat() if k.expires_at else None,
            "created_at":   k.created_at.isoformat(),
        }
        for k in keys
    ]


@router.delete("/{key_id}", summary="Revogar API Key")
async def revoke_api_key(
    key_id: int,
    db:     AsyncSession = Depends(get_db),
    user    = Depends(get_current_user),
):
    """Revoga uma API Key. Requisições com ela falharão imediatamente."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.company_id == user.company_id,
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")

    api_key.is_active = False
    await db.commit()
    return {"message": f"API Key '{api_key.name}' revogada com sucesso"}


@router.get("/{key_id}/usage", summary="Uso da API Key")
async def get_api_key_usage(
    key_id: int,
    db:     AsyncSession = Depends(get_db),
    user    = Depends(get_current_user),
):
    """Retorna estatísticas de uso de uma API Key."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.company_id == user.company_id,
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")

    logs_result = await db.execute(
        select(ApiUsageLog)
        .where(ApiUsageLog.api_key_id == key_id)
        .order_by(ApiUsageLog.created_at.desc())
        .limit(100)
    )
    logs = logs_result.scalars().all()

    total_msgs = sum(l.msgs_sent for l in logs)
    total_reqs = len(logs)

    return {
        "key_prefix":   api_key.key_prefix,
        "name":         api_key.name,
        "total_requests": total_reqs,
        "total_msgs_sent": total_msgs,
        "recent_logs": [
            {
                "endpoint":    l.endpoint,
                "status_code": l.status_code,
                "msgs_sent":   l.msgs_sent,
                "instance_id": l.instance_id,
                "created_at":  l.created_at.isoformat(),
            }
            for l in logs[:20]
        ],
    }
