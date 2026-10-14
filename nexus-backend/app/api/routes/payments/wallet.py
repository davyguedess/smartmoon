"""
NEXUS.IA — Wallet, Extract & Withdrawals API Routes
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models import User
from app.payments.models import Wallet, WalletTransaction, WithdrawalRequest, WithdrawalStatus
from app.payments.schemas import (
    WalletOut, WalletTransactionListOut, WalletTransactionOut,
    WithdrawalCreate, WithdrawalOut, ChargeCreate
)
from app.payments.services.ledger_service import LedgerService, LedgerError
from app.payments.services.withdrawal_service import WithdrawalService
from app.payments.services.charge_service import ChargeService

router = APIRouter(prefix="/payments", tags=["Payments - Wallet"])


# ── Schemas internos ──────────────────────────────────────────────────────────

class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Valor do depósito em BRL")


# ── Saldo ─────────────────────────────────────────────────────────────────────

@router.get("/wallet", response_model=WalletOut)
async def get_wallet(
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Retorna saldo e totais da carteira da empresa."""
    result = await db.execute(
        select(Wallet).where(Wallet.company_id == current_user.company_id)
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = await LedgerService.ensure_wallet(db, current_user.company_id)
        await db.commit()
        await db.refresh(wallet)
    return wallet


# ── Depósito via PIX (checkout transparente) ──────────────────────────────────

@router.post("/wallet/deposit")
async def create_deposit(
    data:         DepositRequest,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Gera cobrança PIX para depósito na carteira da empresa.
    Checkout transparente: retorna QR Code e código copia-e-cola inline.
    O saldo é creditado automaticamente via webhook quando o PIX é pago.
    """
    try:
        # MercadoPago rejeita domínios não-oficiais (ex: .ia) — força email padrão nesses casos
        _VALID_TLDS = {"com", "net", "org", "br", "com.br", "io", "co", "me", "info"}
        _email_raw = current_user.email or ""
        _domain = _email_raw.split("@")[-1].lower() if "@" in _email_raw else ""
        _tld = ".".join(_domain.split(".")[-2:]) if "." in _domain else ""
        payer_email = (
            _email_raw
            if _tld in _VALID_TLDS or _domain.endswith(".com.br")
            else "pagador@smartmoon.com.br"
        )

        charge_data = ChargeCreate(
            amount       = round(data.amount, 2),
            description  = f"Depósito na carteira",
            client_name  = current_user.name or "Depósito próprio",
            client_email = payer_email,
        )
        charge = await ChargeService.create_charge(
            db                 = db,
            company_id         = current_user.company_id,
            data               = charge_data,
            created_by_user_id = current_user.id,
        )
        return {
            "charge_id":          charge.id,
            "amount":             float(charge.amount),
            "status":             charge.status.value if hasattr(charge.status, 'value') else str(charge.status),
            "pix_qr_code":        charge.pix_qr_code,
            "pix_copy_paste_code": charge.pix_copy_paste_code,
            "payment_link":       charge.payment_link,
            "external_reference": charge.external_reference,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"create_deposit error: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao gerar PIX de depósito: {str(e)}")


# ── Extrato (wallet_transactions) ─────────────────────────────────────────────

@router.get("/wallet/transactions", response_model=WalletTransactionListOut)
async def list_transactions(
    type_:   Optional[str] = Query(None, alias="type"),
    page:    int            = Query(1, ge=1),
    limit:   int            = Query(50, ge=1, le=100),
    from_:   Optional[str] = Query(None, alias="from"),
    to_:     Optional[str] = Query(None, alias="to"),
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Extrato completo da carteira."""
    query = (
        select(WalletTransaction)
        .where(WalletTransaction.company_id == current_user.company_id)
        .order_by(WalletTransaction.created_at.desc())
    )
    if type_:
        query = query.where(WalletTransaction.type == type_)
    if from_:
        query = query.where(WalletTransaction.created_at >= from_)
    if to_:
        query = query.where(WalletTransaction.created_at <= to_)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    items = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()

    return WalletTransactionListOut(
        items = [WalletTransactionOut.from_orm(tx) for tx in items],
        total = total,
        page  = page,
        limit = limit,
    )


# ── Saques (cliente) ──────────────────────────────────────────────────────────

@router.post("/wallet/withdrawals", response_model=WithdrawalOut, status_code=201)
async def request_withdrawal(
    data:         WithdrawalCreate,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Solicita saque. Coloca hold no saldo e envia para aprovação do admin."""
    try:
        withdrawal = await WithdrawalService.request_withdrawal(
            db                   = db,
            company_id           = current_user.company_id,
            requested_by_user_id = current_user.id,
            amount               = data.amount,
            pix_key              = data.pix_key,
            pix_key_type         = data.pix_key_type.value,
            bank_name            = data.bank_name,
            notes                = data.notes,
        )
        return WithdrawalOut.from_orm(withdrawal)
    except LedgerError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"request_withdrawal error: {e}")
        raise HTTPException(status_code=500, detail="Erro ao solicitar saque")


@router.get("/wallet/withdrawals", response_model=list[WithdrawalOut])
async def list_withdrawals(
    status:       Optional[str] = Query(None),
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Lista saques da empresa."""
    query = (
        select(WithdrawalRequest)
        .where(WithdrawalRequest.company_id == current_user.company_id)
        .order_by(WithdrawalRequest.created_at.desc())
    )
    if status:
        query = query.where(WithdrawalRequest.status == status)

    results = (await db.execute(query)).scalars().all()
    return [WithdrawalOut.from_orm(w) for w in results]


# ── Admin: Saques e Overview ──────────────────────────────────────────────────

admin_router = APIRouter(prefix="/admin/payments", tags=["Admin - Payments"])


@admin_router.get("/overview")
async def admin_payments_overview(
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Resumo financeiro geral para o painel admin. Usa raw SQL para evitar problemas de enum."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin")
    try:
        ct = (await db.execute(text("""
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE status::text = 'paid'), 0)                                AS total_paid,
                COALESCE(SUM(amount) FILTER (WHERE status::text IN ('pending','sent','waiting_payment')), 0) AS total_pending,
                COALESCE(SUM(amount), 0)                                                                      AS total_charged,
                COUNT(*) FILTER (WHERE status::text = 'paid')                                                AS count_paid,
                COUNT(*) FILTER (WHERE status::text IN ('pending','sent','waiting_payment'))                 AS count_pending
            FROM payment_charges
        """))).fetchone()

        wd_pending = (await db.execute(text(
            "SELECT COUNT(*) FROM withdrawal_requests WHERE status::text = 'pending'"
        ))).scalar() or 0

        wh_unproc = (await db.execute(text(
            "SELECT COUNT(*) FROM payment_webhook_events WHERE processed = false"
        ))).scalar() or 0

        sys_bal = float((await db.execute(text(
            "SELECT COALESCE(SUM(balance), 0) FROM wallets"
        ))).scalar() or 0)

        total_paid    = float(ct[0] or 0)
        total_charged = float(ct[2] or 0)
        return {
            "total_charged":       total_charged,
            "total_paid":          total_paid,
            "total_pending":       float(ct[1] or 0),
            "charges_paid":        ct[3] or 0,
            "charges_pending":     ct[4] or 0,
            "withdrawals_pending": wd_pending,
            "webhooks_unprocessed": wh_unproc,
            "system_balance":      sys_bal,
            "conversion_rate":     round(total_paid / total_charged * 100, 1) if total_charged > 0 else 0,
        }
    except Exception as e:
        logger.error(f"admin_payments_overview error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@admin_router.get("/withdrawals")
async def admin_list_withdrawals(
    status:       Optional[str] = Query("pending"),
    page:         int           = Query(1, ge=1),
    limit:        int           = Query(50, ge=1, le=100),
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Lista saques para aprovação (admin only). Usa raw SQL para evitar problemas de enum."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin")
    try:
        where_clause = "WHERE wr.status::text = :status" if (status and status != "all") else ""
        params = {"status": status, "limit": limit, "offset": (page - 1) * limit}

        rows = (await db.execute(text(f"""
            SELECT wr.id, wr.company_id, wr.amount, wr.status::text, wr.created_at,
                   wr.pix_key, wr.pix_key_type::text, wr.admin_notes, wr.rejection_reason,
                   c.name AS company_name
            FROM withdrawal_requests wr
            JOIN companies c ON c.id = wr.company_id
            {where_clause}
            ORDER BY wr.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)).fetchall()

        count_params = {"status": status} if (status and status != "all") else {}
        total = (await db.execute(text(
            f"SELECT COUNT(*) FROM withdrawal_requests wr {where_clause}"
        ), count_params)).scalar() or 0

        items = [{
            "id": r[0], "company_id": r[1], "amount": float(r[2] or 0),
            "status": r[3], "created_at": r[4].isoformat() if r[4] else None,
            "pix_key": r[5], "pix_key_type": r[6], "admin_notes": r[7],
            "rejection_reason": r[8], "company_name": r[9],
        } for r in rows]

        return {"items": items, "total": total}
    except Exception as e:
        logger.error(f"admin_list_withdrawals error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@admin_router.post("/withdrawals/{withdrawal_id}/approve")
async def admin_approve_withdrawal(
    withdrawal_id: int,
    data:          dict = Body(default={}),  # BUG-39 FIX: Body() evita default mutável compartilhado
    current_user:  User        = Depends(get_current_user),
    db:            AsyncSession = Depends(get_db),
):
    """Admin aprova saque → dispara MP Payout automaticamente."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin")
    try:
        withdrawal = await WithdrawalService.approve_withdrawal(
            db=db, withdrawal_id=withdrawal_id,
            admin_user_id=current_user.id, notes=data.get("notes"),
        )
        return {"ok": True, "status": withdrawal.status, "mp_transfer_id": withdrawal.mp_transfer_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@admin_router.post("/withdrawals/{withdrawal_id}/reject")
async def admin_reject_withdrawal(
    withdrawal_id: int,
    data:          dict,
    current_user:  User        = Depends(get_current_user),
    db:            AsyncSession = Depends(get_db),
):
    """Admin rejeita saque → libera hold do saldo."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin")
    reason = data.get("reason", "")
    if not reason or len(reason) < 5:
        raise HTTPException(status_code=400, detail="Motivo da rejeição é obrigatório (mín. 5 chars)")
    try:
        withdrawal = await WithdrawalService.reject_withdrawal(
            db=db, withdrawal_id=withdrawal_id,
            admin_user_id=current_user.id, reason=reason,
        )
        return {"ok": True, "status": withdrawal.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
