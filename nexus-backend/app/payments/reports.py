"""
NEXUS.IA — Financial Reports Endpoints (TASK 8.3)

Endpoints para relatórios financeiros e métricas de dashboard.
Dados agregados: volume, receita, charges por status, top clientes, etc.

Base path: /api/payments/reports/
Auth: JWT (admin/owner)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.payments.models import PaymentCharge, ChargeStatus, Wallet


router = APIRouter(
    prefix="/api/payments/reports",
    tags=["Financial Reports"],
)


# ── Dashboard Summary ────────────────────────────────────────────────────────

@router.get("/summary", summary="Resumo financeiro geral")
async def financial_summary(
    days: int = Query(30, ge=1, le=365, description="Período em dias"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Retorna resumo financeiro do período:
    - Total recebido
    - Total de cobranças por status
    - Ticket médio
    - Volume por dia
    """
    company_id = user.company_id
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Agregações de cobrança
    result = await db.execute(
        select(
            func.count(PaymentCharge.id).label("total_charges"),
            func.sum(
                case(
                    (PaymentCharge.status == ChargeStatus.PAID, PaymentCharge.amount),
                    else_=0,
                )
            ).label("total_received"),
            func.sum(
                case(
                    (PaymentCharge.status == ChargeStatus.PENDING, PaymentCharge.amount),
                    else_=0,
                )
            ).label("total_pending"),
            func.avg(
                case(
                    (PaymentCharge.status == ChargeStatus.PAID, PaymentCharge.amount),
                    else_=None,
                )
            ).label("avg_ticket"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.PAID, 1),
                    else_=None,
                )
            ).label("paid_count"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.PENDING, 1),
                    else_=None,
                )
            ).label("pending_count"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.EXPIRED, 1),
                    else_=None,
                )
            ).label("expired_count"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.CANCELLED, 1),
                    else_=None,
                )
            ).label("cancelled_count"),
        ).where(
            and_(
                PaymentCharge.company_id == company_id,
                PaymentCharge.created_at >= start_date,
            )
        )
    )
    row = result.one()

    # Saldo da carteira
    wallet_result = await db.execute(
        select(Wallet).where(Wallet.company_id == company_id)
    )
    wallet = wallet_result.scalar_one_or_none()

    return {
        "period_days": days,
        "total_charges": row.total_charges or 0,
        "total_received": f"{(row.total_received or 0):.2f}",
        "total_pending": f"{(row.total_pending or 0):.2f}",
        "avg_ticket": f"{(row.avg_ticket or 0):.2f}",
        "status_breakdown": {
            "paid": row.paid_count or 0,
            "pending": row.pending_count or 0,
            "expired": row.expired_count or 0,
            "cancelled": row.cancelled_count or 0,
        },
        "wallet": {
            "balance": f"{wallet.balance:.2f}" if wallet else "0.00",
            "total_received": f"{wallet.total_received:.2f}" if wallet else "0.00",
            "total_withdrawn": f"{wallet.total_withdrawn:.2f}" if wallet else "0.00",
        },
    }


# ── Daily Volume ─────────────────────────────────────────────────────────────

@router.get("/daily-volume", summary="Volume diário de cobranças")
async def daily_volume(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna volume de cobranças agregado por dia (para gráficos)."""
    company_id = user.company_id
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(PaymentCharge.created_at).label("date"),
            func.count(PaymentCharge.id).label("count"),
            func.sum(PaymentCharge.amount).label("total"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.PAID, 1),
                    else_=None,
                )
            ).label("paid"),
        ).where(
            and_(
                PaymentCharge.company_id == company_id,
                PaymentCharge.created_at >= start_date,
            )
        ).group_by(func.date(PaymentCharge.created_at))
        .order_by(func.date(PaymentCharge.created_at))
    )

    data = []
    for row in result:
        data.append({
            "date": str(row.date),
            "total_charges": row.count,
            "total_amount": f"{(row.total or 0):.2f}",
            "paid_count": row.paid,
        })

    return {"period_days": days, "data": data}


# ── Conversion Rate ──────────────────────────────────────────────────────────

@router.get("/conversion", summary="Taxa de conversão")
async def conversion_rate(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Taxa de conversão: cobranças pagas / total de cobranças."""
    company_id = user.company_id
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.count(PaymentCharge.id).label("total"),
            func.count(
                case(
                    (PaymentCharge.status == ChargeStatus.PAID, 1),
                    else_=None,
                )
            ).label("paid"),
        ).where(
            and_(
                PaymentCharge.company_id == company_id,
                PaymentCharge.created_at >= start_date,
            )
        )
    )
    row = result.one()
    total = row.total or 0
    paid = row.paid or 0
    rate = (paid / total * 100) if total > 0 else 0

    return {
        "period_days": days,
        "total_charges": total,
        "paid_charges": paid,
        "conversion_rate": f"{rate:.1f}%",
    }
