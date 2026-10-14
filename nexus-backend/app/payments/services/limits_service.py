"""
NEXUS.IA — Company Payment Limits Service (TASK 2.7)

Fornece limites de segurança financeira por empresa com fallback para defaults.
Usado por WithdrawalService e ChargeService para validar operações.

Usage:
    from app.payments.services.limits_service import get_company_limits

    limits = await get_company_limits(db, company_id)
    if pending_count >= limits.max_pending_withdrawals:
        raise LedgerError("Limite de saques pendentes atingido")
"""
from decimal import Decimal
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger


@dataclass
class PaymentLimits:
    """Limites de segurança — valores imutáveis por request."""
    max_pending_withdrawals: int = 3
    daily_withdrawal_limit: Decimal = Decimal("50000.00")
    single_withdrawal_limit: Decimal = Decimal("10000.00")
    min_charge_amount: Decimal = Decimal("1.00")
    max_charge_amount: Decimal = Decimal("100000.00")
    pix_key_cooldown_hours: int = 24
    require_2fa_above: Decimal = Decimal("500.00")


# Singleton default — zero allocation para empresas sem config custom
_DEFAULT_LIMITS = PaymentLimits()


async def get_company_limits(db: AsyncSession, company_id: int) -> PaymentLimits:
    """
    Retorna limites da empresa. Se não tem registro custom, retorna defaults.
    Non-blocking: em caso de erro no DB, retorna defaults (fail-safe).
    """
    try:
        from app.payments.models import CompanyPaymentLimits

        result = await db.execute(
            select(CompanyPaymentLimits).where(
                CompanyPaymentLimits.company_id == company_id
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return _DEFAULT_LIMITS

        return PaymentLimits(
            max_pending_withdrawals=row.max_pending_withdrawals,
            daily_withdrawal_limit=row.daily_withdrawal_limit,
            single_withdrawal_limit=row.single_withdrawal_limit,
            min_charge_amount=row.min_charge_amount,
            max_charge_amount=row.max_charge_amount,
            pix_key_cooldown_hours=row.pix_key_cooldown_hours,
            require_2fa_above=row.require_2fa_above,
        )
    except Exception as e:
        logger.warning(f"⚠️ get_company_limits falhou (usando defaults): {e}")
        return _DEFAULT_LIMITS
