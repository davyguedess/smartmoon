"""
NEXUS.IA — 2FA Authentication Routes (TASK 7.1)

Endpoints para configurar, ativar, desativar e verificar 2FA.

Routes:
    POST /auth/2fa/setup    → Inicia setup (retorna QR Code + backup codes)
    POST /auth/2fa/verify   → Verifica código e ativa 2FA
    POST /auth/2fa/validate → Valida código para operação crítica (ex: saque)
    POST /auth/2fa/disable  → Desativa 2FA (requer código válido)
    GET  /auth/2fa/status   → Verifica se 2FA está ativo
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.totp_service import (
    setup_2fa,
    verify_totp_code,
    verify_backup_code,
    hash_backup_code,
    TOTP_AVAILABLE,
)
from app.models import User
from app.core.security_events import log_security_event, extract_request_info


router = APIRouter(prefix="/auth/2fa", tags=["2FA Authentication"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class Setup2FAResponse(BaseModel):
    qr_code: str           # base64 PNG
    otpauth_uri: str       # para apps que preferem URI
    backup_codes: list[str]  # 8 códigos — MOSTRAR UMA VEZ

class Verify2FARequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)

class Validate2FARequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)
    operation: str = Field("withdrawal", description="Tipo de operação sendo protegida")

class Disable2FARequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status", summary="Status do 2FA")
async def twofa_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna se 2FA está ativo para o usuário."""
    result = await db.execute(select(User).where(User.id == user.id))
    u = result.scalar_one_or_none()
    return {
        "enabled": bool(u and getattr(u, 'totp_enabled', False)),
        "available": TOTP_AVAILABLE,
        "verified_at": getattr(u, 'totp_verified_at', None),
    }


# ── Setup ────────────────────────────────────────────────────────────────────

@router.post("/setup", response_model=Setup2FAResponse, summary="Configurar 2FA")
async def twofa_setup(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Gera QR Code e backup codes para ativar 2FA.

    ⚠️ Os backup codes são exibidos APENAS nesta resposta.
    O usuário deve salvá-los em local seguro.
    """
    if not TOTP_AVAILABLE:
        raise HTTPException(status_code=503, detail="2FA não disponível no servidor")

    result = await db.execute(select(User).where(User.id == user.id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if getattr(u, 'totp_enabled', False):
        raise HTTPException(status_code=400, detail="2FA já está ativo. Desative antes de reconfigurar.")

    # Gerar setup
    data = setup_2fa(u.email)

    # Salvar secret e backup hashes (2FA ainda NÃO está ativo até verify)
    await db.execute(
        update(User).where(User.id == user.id).values(
            totp_secret=data["secret"],
            totp_backup_codes=data["backup_hashes"],
            totp_enabled=False,  # Ativo só após verify
        )
    )
    await db.commit()

    logger.info(f"🔐 2FA setup iniciado: user={user.id} email={u.email}")

    return Setup2FAResponse(
        qr_code=data["qr_code"],
        otpauth_uri=data["otpauth_uri"],
        backup_codes=data["backup_codes"],
    )


# ── Verify (ativa 2FA) ──────────────────────────────────────────────────────

@router.post("/verify", summary="Verificar e ativar 2FA")
async def twofa_verify(
    data: Verify2FARequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Verifica o código TOTP do app e ATIVA 2FA na conta.
    Este endpoint é chamado após escanear o QR Code.
    """
    result = await db.execute(select(User).where(User.id == user.id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    secret = getattr(u, 'totp_secret', None)
    if not secret:
        raise HTTPException(status_code=400, detail="Execute /auth/2fa/setup primeiro")

    if getattr(u, 'totp_enabled', False):
        raise HTTPException(status_code=400, detail="2FA já está ativo")

    # Verificar código
    if not verify_totp_code(secret, data.code):
        raise HTTPException(status_code=401, detail="Código inválido. Tente novamente.")

    # Ativar 2FA
    now = datetime.now(timezone.utc)
    await db.execute(
        update(User).where(User.id == user.id).values(
            totp_enabled=True,
            totp_verified_at=now,
        )
    )
    await db.commit()

    logger.info(f"✅ 2FA ativado: user={user.id}")
    req_info = extract_request_info(request)
    await log_security_event(db, "2fa_setup", user_id=user.id, ip_address=req_info["ip_address"], user_agent=req_info["user_agent"])

    return {"status": "enabled", "message": "2FA ativado com sucesso!", "verified_at": now.isoformat()}


# ── Validate (para operações críticas) ───────────────────────────────────────

@router.post("/validate", summary="Validar código para operação crítica")
async def twofa_validate(
    data: Validate2FARequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Valida código 2FA para autorizar operação crítica (ex: saque, alteração de senha).
    Aceita código TOTP ou backup code.
    """
    result = await db.execute(select(User).where(User.id == user.id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if not getattr(u, 'totp_enabled', False):
        # Se 2FA não está ativo, permite a operação
        return {"valid": True, "method": "no_2fa", "operation": data.operation}

    secret = getattr(u, 'totp_secret', None)
    if not secret:
        raise HTTPException(status_code=500, detail="2FA ativo mas sem secret")

    # Tentar código TOTP
    if verify_totp_code(secret, data.code):
        logger.info(f"✅ 2FA validado (TOTP): user={user.id} op={data.operation}")
        return {"valid": True, "method": "totp", "operation": data.operation}

    # Tentar backup code
    backup_hashes = getattr(u, 'totp_backup_codes', []) or []
    is_valid, remaining = verify_backup_code(data.code, backup_hashes)
    if is_valid:
        # Remover backup code usado
        await db.execute(
            update(User).where(User.id == user.id).values(
                totp_backup_codes=remaining,
            )
        )
        await db.commit()
        logger.warning(
            f"⚠️ 2FA validado (backup code): user={user.id} | "
            f"restantes={len(remaining)}/{len(backup_hashes)}"
        )
        return {
            "valid": True,
            "method": "backup_code",
            "operation": data.operation,
            "remaining_backup_codes": len(remaining),
        }

    raise HTTPException(status_code=401, detail="Código 2FA inválido")


# ── Disable ──────────────────────────────────────────────────────────────────

@router.post("/disable", summary="Desativar 2FA")
async def twofa_disable(
    data: Disable2FARequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Desativa 2FA na conta. Requer código válido para confirmar identidade."""
    result = await db.execute(select(User).where(User.id == user.id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if not getattr(u, 'totp_enabled', False):
        raise HTTPException(status_code=400, detail="2FA já está desativado")

    secret = getattr(u, 'totp_secret', None)
    if not secret:
        raise HTTPException(status_code=500, detail="Inconsistência: 2FA ativo sem secret")

    # Verificar código antes de desativar
    valid = verify_totp_code(secret, data.code)
    if not valid:
        # Tentar backup code
        backup_hashes = getattr(u, 'totp_backup_codes', []) or []
        valid, _ = verify_backup_code(data.code, backup_hashes)

    if not valid:
        raise HTTPException(status_code=401, detail="Código inválido. 2FA não foi desativado.")

    await db.execute(
        update(User).where(User.id == user.id).values(
            totp_enabled=False,
            totp_secret=None,
            totp_backup_codes=[],
            totp_verified_at=None,
        )
    )
    await db.commit()

    logger.warning(f"🔓 2FA desativado: user={user.id}")
    req_info = extract_request_info(request)
    await log_security_event(db, "2fa_disabled", user_id=user.id, ip_address=req_info["ip_address"], user_agent=req_info["user_agent"])

    return {"status": "disabled", "message": "2FA desativado com sucesso."}
