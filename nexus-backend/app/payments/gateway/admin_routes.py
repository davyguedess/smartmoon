"""
NEXUS.IA — Open Gateway: Admin Key Management (TASK 5.4)

Rotas para o admin da empresa gerenciar API Keys do Gateway.
Integrado no painel admin existente.

Endpoints:
    GET    /api/payments/gateway/keys       → Listar keys da empresa
    POST   /api/payments/gateway/keys       → Criar nova key
    PATCH  /api/payments/gateway/keys/{id}  → Ativar/desativar key
    DELETE /api/payments/gateway/keys/{id}  → Revogar key
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.payments.gateway import (
    GatewayApiKey,
    generate_api_key,
)


router = APIRouter(
    prefix="/api/payments/gateway/keys",
    tags=["Gateway Key Management"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    label:         str = Field("Default", max_length=200)
    environment:   str = Field("live", pattern="^(live|test)$")
    permissions:   list[str] = Field(default=["charges.create", "charges.read", "balance.read"])
    rate_limit_rpm: int = Field(60, ge=1, le=1000)
    ip_whitelist:  list[str] = Field(default=[])


class KeyResponse(BaseModel):
    id:             int
    key_prefix:     str
    label:          str
    environment:    str
    is_active:      bool
    permissions:    list
    rate_limit_rpm: int
    ip_whitelist:   list
    last_used_at:   Optional[str]
    created_at:     Optional[str]
    expires_at:     Optional[str]


class CreateKeyResponse(KeyResponse):
    raw_key: str  # Mostrado APENAS na criação — nunca mais


class UpdateKeyRequest(BaseModel):
    label:          Optional[str] = None
    is_active:      Optional[bool] = None
    permissions:    Optional[list[str]] = None
    rate_limit_rpm: Optional[int] = None
    ip_whitelist:   Optional[list[str]] = None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[KeyResponse], summary="Listar API Keys")
async def list_keys(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista todas as API keys da empresa do usuário."""
    result = await db.execute(
        select(GatewayApiKey).where(
            GatewayApiKey.company_id == user.company_id,
        ).order_by(GatewayApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        KeyResponse(
            id=k.id,
            key_prefix=k.key_prefix,
            label=k.label,
            environment=k.environment,
            is_active=k.is_active,
            permissions=k.permissions or [],
            rate_limit_rpm=k.rate_limit_rpm,
            ip_whitelist=k.ip_whitelist or [],
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            created_at=k.created_at.isoformat() if k.created_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
        )
        for k in keys
    ]


@router.post("", response_model=CreateKeyResponse, status_code=status.HTTP_201_CREATED, summary="Criar API Key")
async def create_key(
    data: CreateKeyRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Cria uma nova API Key para o Gateway.

    ⚠️ A chave completa (`raw_key`) é retornada **APENAS nesta resposta**.
    Salve-a em local seguro. Não é possível recuperá-la depois.
    """
    raw_key, key_hash, key_prefix = generate_api_key(data.environment)

    new_key = GatewayApiKey(
        company_id=user.company_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        label=data.label,
        environment=data.environment,
        permissions=data.permissions,
        rate_limit_rpm=data.rate_limit_rpm,
        ip_whitelist=data.ip_whitelist,
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    logger.info(
        f"🔑 Gateway key criada: {key_prefix}*** | "
        f"company={user.company_id} | env={data.environment}"
    )

    return CreateKeyResponse(
        id=new_key.id,
        raw_key=raw_key,  # ← ÚNICA vez que é retornada
        key_prefix=key_prefix,
        label=new_key.label,
        environment=new_key.environment,
        is_active=True,
        permissions=new_key.permissions or [],
        rate_limit_rpm=new_key.rate_limit_rpm,
        ip_whitelist=new_key.ip_whitelist or [],
        last_used_at=None,
        created_at=new_key.created_at.isoformat() if new_key.created_at else None,
        expires_at=None,
    )


@router.patch("/{key_id}", response_model=KeyResponse, summary="Atualizar API Key")
async def update_key(
    key_id: int,
    data: UpdateKeyRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Atualiza label, permissões, rate limit ou ativa/desativa."""
    result = await db.execute(
        select(GatewayApiKey).where(
            GatewayApiKey.id == key_id,
            GatewayApiKey.company_id == user.company_id,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API Key não encontrada")

    if data.label is not None:
        key.label = data.label
    if data.is_active is not None:
        key.is_active = data.is_active
    if data.permissions is not None:
        key.permissions = data.permissions
    if data.rate_limit_rpm is not None:
        key.rate_limit_rpm = data.rate_limit_rpm
    if data.ip_whitelist is not None:
        key.ip_whitelist = data.ip_whitelist

    await db.commit()
    await db.refresh(key)

    return KeyResponse(
        id=key.id,
        key_prefix=key.key_prefix,
        label=key.label,
        environment=key.environment,
        is_active=key.is_active,
        permissions=key.permissions or [],
        rate_limit_rpm=key.rate_limit_rpm,
        ip_whitelist=key.ip_whitelist or [],
        last_used_at=key.last_used_at.isoformat() if key.last_used_at else None,
        created_at=key.created_at.isoformat() if key.created_at else None,
        expires_at=key.expires_at.isoformat() if key.expires_at else None,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revogar API Key")
async def revoke_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Revoga (deleta) permanentemente uma API Key."""
    result = await db.execute(
        select(GatewayApiKey).where(
            GatewayApiKey.id == key_id,
            GatewayApiKey.company_id == user.company_id,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API Key não encontrada")

    logger.warning(f"🗑️ Gateway key revogada: {key.key_prefix}*** | company={user.company_id}")
    await db.delete(key)
    await db.commit()
