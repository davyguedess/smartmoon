"""
NEXUS.IA — Open Gateway: Public API Routes (TASK 5.3)

API pública para clientes integrarem pagamentos via API Key.
Base path: /api/v1/gateway/

Endpoints:
    POST   /charges        → Criar cobrança PIX
    GET    /charges/{id}   → Status de cobrança
    DELETE /charges/{id}   → Cancelar cobrança
    GET    /balance        → Consultar saldo
    POST   /payouts        → Solicitar saque (futuro)
    GET    /health         → Status da API

Autenticação: Header X-API-Key
Rate limit: configurável por chave
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.payments.gateway import (
    GatewayApiKey,
    require_gateway_key,
    require_permission,
)
from app.payments.models import PaymentCharge, ChargeStatus, Wallet
from app.payments.services.charge_service import ChargeService
from app.payments.services.ledger_service import LedgerService
from app.payments.schemas import ChargeCreate
from app.payments.services.financial_audit_service import financial_audit


router = APIRouter(
    prefix="/api/v1/gateway",
    tags=["Open Gateway"],
)


# ── Schemas (API pública — diferentes dos internos) ──────────────────────────

class GatewayChargeRequest(BaseModel):
    """Schema de criação de cobrança via API pública."""
    amount:       Decimal = Field(..., ge=Decimal("0.01"), description="Valor em BRL")
    description:  str     = Field(..., min_length=3, max_length=500)
    customer_name:  Optional[str] = Field(None, max_length=200)
    customer_email: Optional[str] = Field(None, max_length=200)
    customer_phone: Optional[str] = Field(None, max_length=20)
    due_date:     Optional[str] = Field(None, description="Data limite YYYY-MM-DD")
    metadata:     Optional[dict] = Field(None, description="Dados extras (até 1KB)")
    idempotency_key: Optional[str] = Field(None, max_length=64)


class GatewayChargeResponse(BaseModel):
    """Resposta padronizada de cobrança."""
    id:                  int
    status:              str
    amount:              str
    description:         str
    pix_qr_code:         Optional[str]
    pix_copy_paste_code: Optional[str]
    payment_link:        Optional[str]
    created_at:          str
    expires_at:          Optional[str] = None

    class Config:
        from_attributes = True


class GatewayBalanceResponse(BaseModel):
    """Resposta de saldo."""
    balance:         str
    total_received:  str
    total_withdrawn: str
    currency:        str = "BRL"


class GatewayErrorResponse(BaseModel):
    """Resposta de erro padronizada."""
    error:   str
    message: str
    details: Optional[dict] = None


# ── Health ───────────────────────────────────────────────────────────────────

@router.get("/health", summary="Status da API")
async def gateway_health():
    """Verifica se a API está online. Não requer autenticação."""
    return {
        "status": "ok",
        "service": "nexus-gateway",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Charges ──────────────────────────────────────────────────────────────────

@router.post(
    "/charges",
    response_model=GatewayChargeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar cobrança PIX",
    responses={
        401: {"model": GatewayErrorResponse},
        403: {"model": GatewayErrorResponse},
        422: {"model": GatewayErrorResponse},
        429: {"model": GatewayErrorResponse},
    }
)
async def create_charge(
    data: GatewayChargeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    api_key: GatewayApiKey = Depends(require_permission("charges.create")),
):
    """
    Cria uma cobrança PIX e retorna o QR Code.

    **Autenticação:** Header `X-API-Key`

    **Exemplo:**
    ```
    curl -X POST https://api.nexus.ia/api/v1/gateway/charges \\
      -H "X-API-Key: nxs_live_xxxx" \\
      -H "Content-Type: application/json" \\
      -d '{"amount": 99.90, "description": "Plano Pro"}'
    ```
    """
    try:
        # Parse due_date
        due_date = None
        if data.due_date:
            from datetime import date
            due_date = date.fromisoformat(data.due_date)

        # Converter para schema interno
        charge_data = ChargeCreate(
            amount       = data.amount,
            description  = data.description,
            client_name  = data.customer_name,
            client_email = data.customer_email,
            client_phone = data.customer_phone,
            due_date     = due_date,
        )

        charge = await ChargeService.create_charge(
            db=db,
            company_id=api_key.company_id,
            data=charge_data,
            creator_email=data.customer_email,
        )

        # Audit
        await financial_audit(
            db=db, company_id=api_key.company_id,
            entity_type="charge", entity_id=charge.id,
            action="created_via_gateway",
            new_values={
                "amount": str(charge.amount),
                "key_prefix": api_key.key_prefix,
                "ip": request.client.host if request.client else "unknown",
            },
        )

        logger.info(
            f"🌐 Gateway charge: R${charge.amount:.2f} | "
            f"company={api_key.company_id} | key={api_key.key_prefix}"
        )

        return GatewayChargeResponse(
            id=charge.id,
            status=charge.status.value if hasattr(charge.status, 'value') else str(charge.status),
            amount=f"{charge.amount:.2f}",
            description=charge.description,
            pix_qr_code=charge.pix_qr_code,
            pix_copy_paste_code=charge.pix_copy_paste_code,
            payment_link=charge.payment_link,
            created_at=charge.created_at.isoformat() if charge.created_at else "",
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": "validation_error", "message": str(e)})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail={"error": "provider_error", "message": str(e)})
    except Exception as e:
        logger.error(f"Gateway create_charge error: {e}")
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": "Erro interno"})


@router.get(
    "/charges/{charge_id}",
    response_model=GatewayChargeResponse,
    summary="Consultar status de cobrança",
)
async def get_charge(
    charge_id: int,
    db: AsyncSession = Depends(get_db),
    api_key: GatewayApiKey = Depends(require_permission("charges.read")),
):
    """Retorna o status atualizado de uma cobrança."""
    result = await db.execute(
        select(PaymentCharge).where(
            PaymentCharge.id == charge_id,
            PaymentCharge.company_id == api_key.company_id,
        )
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Cobrança #{charge_id} não encontrada"}
        )

    return GatewayChargeResponse(
        id=charge.id,
        status=charge.status.value if hasattr(charge.status, 'value') else str(charge.status),
        amount=f"{charge.amount:.2f}",
        description=charge.description,
        pix_qr_code=charge.pix_qr_code,
        pix_copy_paste_code=charge.pix_copy_paste_code,
        payment_link=charge.payment_link,
        created_at=charge.created_at.isoformat() if charge.created_at else "",
    )


@router.delete(
    "/charges/{charge_id}",
    summary="Cancelar cobrança pendente",
)
async def cancel_charge(
    charge_id: int,
    db: AsyncSession = Depends(get_db),
    api_key: GatewayApiKey = Depends(require_permission("charges.create")),
):
    """Cancela uma cobrança PIX pendente."""
    result = await db.execute(
        select(PaymentCharge).where(
            PaymentCharge.id == charge_id,
            PaymentCharge.company_id == api_key.company_id,
        )
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Cobrança #{charge_id} não encontrada"}
        )

    if charge.status != ChargeStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_status", "message": f"Cobrança não pode ser cancelada (status: {charge.status.value})"}
        )

    charge.status = ChargeStatus.CANCELLED
    await db.commit()

    return {"status": "cancelled", "charge_id": charge_id}


# ── Balance ──────────────────────────────────────────────────────────────────

@router.get(
    "/balance",
    response_model=GatewayBalanceResponse,
    summary="Consultar saldo da conta",
)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    api_key: GatewayApiKey = Depends(require_permission("balance.read")),
):
    """Retorna o saldo atual da conta da empresa."""
    result = await db.execute(
        select(Wallet).where(Wallet.company_id == api_key.company_id)
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        return GatewayBalanceResponse(
            balance="0.00",
            total_received="0.00",
            total_withdrawn="0.00",
        )

    return GatewayBalanceResponse(
        balance=f"{wallet.balance:.2f}",
        total_received=f"{wallet.total_received:.2f}",
        total_withdrawn=f"{wallet.total_withdrawn:.2f}",
    )


# ── API Key Management (self-service) ────────────────────────────────────────

@router.get("/keys/info", summary="Informações da API Key atual")
async def key_info(
    api_key: GatewayApiKey = Depends(require_gateway_key),
):
    """Retorna informações da API key usada na request."""
    return {
        "key_prefix":     api_key.key_prefix,
        "label":          api_key.label,
        "environment":    api_key.environment,
        "permissions":    api_key.permissions,
        "rate_limit_rpm": api_key.rate_limit_rpm,
        "created_at":     api_key.created_at.isoformat() if api_key.created_at else None,
        "expires_at":     api_key.expires_at.isoformat() if api_key.expires_at else None,
        "last_used_at":   api_key.last_used_at.isoformat() if api_key.last_used_at else None,
    }
