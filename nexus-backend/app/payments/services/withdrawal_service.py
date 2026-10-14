"""
NEXUS.IA — Withdrawal Service
Solicitar, aprovar e rejeitar saques com MP Payouts automático.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.payments.models import (
    Wallet, WithdrawalRequest, WithdrawalStatus
)
from app.payments.services.ledger_service import LedgerService, LedgerError
from app.payments.providers.mercadopago_provider import MercadoPagoProvider
from app.payments.services.limits_service import get_company_limits
from app.payments.services.financial_audit_service import financial_audit


async def _get_owner_contact(db: AsyncSession, company_id: int) -> tuple[Optional[str], Optional[str]]:
    """
    Retorna (phone, email) do owner da empresa para notificações.
    """
    try:
        from app.models import User, UserProfile
        from sqlalchemy import and_
        # Buscar owner da empresa
        result = await db.execute(
            select(User).where(
                and_(User.company_id == company_id, User.role == "owner", User.is_active == True)
            ).limit(1)
        )
        owner = result.scalar_one_or_none()
        if not owner:
            return None, None
        # Buscar perfil com phone
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == owner.id).limit(1)
        )
        profile = profile_result.scalar_one_or_none()
        phone = profile.phone if profile else None
        return phone, owner.email
    except Exception as e:
        logger.warning(f"Não foi possível buscar contato do owner (empresa {company_id}): {e}")
        return None, None


class WithdrawalService:

    @staticmethod
    async def request_withdrawal(
        db:                   AsyncSession,
        company_id:           int,
        requested_by_user_id: int,
        amount:               Decimal,
        pix_key:              str,
        pix_key_type:         str,
        bank_name:            Optional[str] = None,
        notes:                Optional[str] = None,
    ) -> WithdrawalRequest:
        """
        Solicita saque.
        1. Valida saldo disponível
        2. Coloca hold no ledger
        3. Cria withdrawal_request (pending)
        4. Admin é notificado
        """
        amount = Decimal(str(amount))

        # BUG-18 FIX: TOCTOU race condition — dois saques simultâneos podem passar
        # na validação com o mesmo saldo sem o lock. O for_update deve ser ANTES
        # da verificação, não apenas dentro do hold().
        wallet_result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()   # Lock antes de verificar saldo
        )
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            raise LedgerError("Carteira não encontrada para esta empresa")

        if wallet.balance < amount:
            raise LedgerError(
                f"Saldo insuficiente: disponível R${wallet.balance:.2f}, "
                f"solicitado R${amount:.2f}"
            )

        # ── TASK 2.2 + 2.3 + 2.5: Validações Anti-Fraude ────────────────────
        limits = await get_company_limits(db, company_id)

        # TASK 2.5a: Limite individual por saque
        if amount > limits.single_withdrawal_limit:
            raise LedgerError(
                f"Valor máximo por saque: R${limits.single_withdrawal_limit:.2f}. "
                f"Solicitado: R${amount:.2f}"
            )

        # TASK 2.2: Limite de saques pendentes simultâneos (anti Denial-of-Wallet)
        pending_count_result = await db.execute(
            select(func.count()).select_from(WithdrawalRequest).where(
                WithdrawalRequest.company_id == company_id,
                WithdrawalRequest.status.in_([
                    WithdrawalStatus.PENDING,
                    WithdrawalStatus.PROCESSING,
                    WithdrawalStatus.UNDER_REVIEW,
                ])
            )
        )
        pending_count = pending_count_result.scalar_one()
        if pending_count >= limits.max_pending_withdrawals:
            raise LedgerError(
                f"Limite de {limits.max_pending_withdrawals} saques pendentes atingido. "
                f"Aguarde a conclusão dos saques anteriores."
            )

        # TASK 2.3: Cooldown por chave PIX (evita drain rápido)
        from datetime import timedelta
        cooldown_cutoff = datetime.now(timezone.utc) - timedelta(hours=limits.pix_key_cooldown_hours)
        recent_same_key = await db.execute(
            select(WithdrawalRequest).where(
                WithdrawalRequest.company_id == company_id,
                WithdrawalRequest.pix_key == pix_key,
                WithdrawalRequest.created_at >= cooldown_cutoff,
                WithdrawalRequest.status.notin_([
                    WithdrawalStatus.REJECTED,
                    WithdrawalStatus.CANCELLED,
                ])
            ).limit(1)
        )
        if recent_same_key.scalar_one_or_none():
            raise LedgerError(
                f"Já existe um saque para esta chave PIX nas últimas "
                f"{limits.pix_key_cooldown_hours}h. Aguarde ou use outra chave."
            )

        # TASK 2.5b: Limite diário total de saques
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        from sqlalchemy import func as sqlfunc
        daily_total_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(WithdrawalRequest.amount), 0)).where(
                WithdrawalRequest.company_id == company_id,
                WithdrawalRequest.created_at >= today_start,
                WithdrawalRequest.status.notin_([
                    WithdrawalStatus.REJECTED,
                    WithdrawalStatus.CANCELLED,
                ])
            )
        )
        daily_total = Decimal(str(daily_total_result.scalar_one()))
        if daily_total + amount > limits.daily_withdrawal_limit:
            remaining = max(Decimal("0"), limits.daily_withdrawal_limit - daily_total)
            raise LedgerError(
                f"Limite diário de saque: R${limits.daily_withdrawal_limit:.2f}. "
                f"Já sacado hoje: R${daily_total:.2f}. "
                f"Disponível: R${remaining:.2f}"
            )

        logger.info(
            f"✅ Anti-fraude OK: empresa={company_id} | "
            f"pendentes={pending_count}/{limits.max_pending_withdrawals} | "
            f"diário=R${daily_total + amount:.2f}/R${limits.daily_withdrawal_limit:.2f}"
        )
        # ── FIM Anti-Fraude ──────────────────────────────────────────────────

        # Idempotency key única para o MP (UUID4 — reutilizado no retry)
        idempotency_key = str(uuid.uuid4())

        # Criar solicitação
        withdrawal = WithdrawalRequest(
            company_id            = company_id,
            wallet_id             = wallet.id,
            requested_by_user_id  = requested_by_user_id,
            amount                = amount,
            status                = WithdrawalStatus.PENDING,
            pix_key               = pix_key,
            pix_key_type          = pix_key_type,
            mp_idempotency_key    = idempotency_key,
            admin_notes           = notes,
        )
        db.add(withdrawal)
        await db.flush()

        # Hold no ledger (bloqueia o valor)
        await LedgerService.hold(
            db            = db,
            company_id    = company_id,
            amount        = amount,
            description   = f"Reserva para saque #{withdrawal.id}",
            withdrawal_id = withdrawal.id,
        )

        await db.commit()
        await db.refresh(withdrawal)

        logger.info(
            f"💸 Saque solicitado: R${amount:.2f} | empresa {company_id} "
            f"| PIX {pix_key_type}:{pix_key[:6]}*** | withdrawal #{withdrawal.id}"
        )

        # TASK 3.4: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="withdrawal", entity_id=withdrawal.id,
            action="requested", performed_by=requested_by_user_id,
            new_values={"amount": str(amount), "pix_key_type": pix_key_type, "status": "pending"},
        )

        # Notificar admin (await direto — asyncio.create_task() é inseguro no Celery)
        try:
            from app.payments.services.notification_service import notify_withdrawal_requested
            from app.core.config import settings as _s
            admin_phone = getattr(_s, "ADMIN_WHATSAPP", None)
            admin_email = getattr(_s, "ADMIN_EMAIL", None)
            await notify_withdrawal_requested(
                admin_phone   = admin_phone,
                admin_email   = admin_email,
                company_id    = company_id,
                amount        = amount,
                pix_key       = pix_key,
                withdrawal_id = withdrawal.id,
            )
        except Exception as _ne:
            logger.debug(f"Notificação admin pulada: {_ne}")

        return withdrawal

    @staticmethod
    async def approve_withdrawal(
        db:                 AsyncSession,
        withdrawal_id:      int,
        admin_user_id:      int,
        notes:              Optional[str] = None,
        manual_transfer_id: Optional[str] = None,
    ) -> WithdrawalRequest:
        """
        Admin aprova saque.
        MODO AUTOMÁTICO: chama MP Payouts API (requer permissão money-transfer no MP).
        MODO MANUAL: manual_transfer_id fornecido → debita ledger + COMPLETED sem MP.
                     Admin já fez o PIX manualmente e registra o ID do comprovante.
        Permite re-aprovar saques com status=FAILED (re-faz o hold).
        """
        # BUG-35 FIX: with_for_update() obrigatório — sem ele dois admins podem aprovar
        # o mesmo saque simultaneamente. Ambos veem status=PENDING, ambos enviam PIX ao MP.
        # O MP deduplicará via X-Idempotency-Key, mas o LedgerService.debit() seria
        # chamado duas vezes, dobrando o total_withdrawn no ledger.
        result = await db.execute(
            select(WithdrawalRequest)
            .where(WithdrawalRequest.id == withdrawal_id)
            .with_for_update()
        )
        withdrawal = result.scalar_one_or_none()
        if not withdrawal:
            raise ValueError(f"Saque #{withdrawal_id} não encontrado")

        if withdrawal.status not in (
            WithdrawalStatus.PENDING,
            WithdrawalStatus.UNDER_REVIEW,
            WithdrawalStatus.FAILED,
        ):
            raise ValueError(
                f"Saque #{withdrawal_id} não pode ser aprovado (status={withdrawal.status})"
            )

        # Se FAILED: precisa re-fazer o hold antes de processar novamente
        if withdrawal.status == WithdrawalStatus.FAILED:
            await LedgerService.hold(
                db            = db,
                company_id    = withdrawal.company_id,
                amount        = withdrawal.amount,
                description   = f"Re-hold para retry saque #{withdrawal.id}",
                withdrawal_id = withdrawal.id,
            )

        # Marca como "processing" imediatamente
        withdrawal.status          = WithdrawalStatus.PROCESSING
        withdrawal.reviewed_at     = datetime.now(timezone.utc)
        withdrawal.reviewed_by_user_id = admin_user_id
        withdrawal.admin_notes     = notes
        await db.flush()

        # ── MODO MANUAL (sem MP Payouts) ──────────────────────────────────────
        if manual_transfer_id:
            logger.info(
                f"📋 Saque #{withdrawal_id} aprovação MANUAL: "
                f"transfer_id={manual_transfer_id}"
            )
            try:
                await LedgerService.debit(
                    db            = db,
                    company_id    = withdrawal.company_id,
                    amount        = withdrawal.amount,
                    description   = f"Saque manual #{withdrawal.id} (PIX pelo admin)",
                    withdrawal_id = withdrawal.id,
                )
                withdrawal.status             = WithdrawalStatus.COMPLETED
                withdrawal.mp_transfer_id     = manual_transfer_id
                withdrawal.mp_transfer_status = "manual"
                withdrawal.processed_at       = datetime.now(timezone.utc)
                withdrawal.admin_notes        = (
                    f"[MANUAL] ID: {manual_transfer_id}"
                    + (f" | {notes}" if notes else "")
                )
                await db.commit()
                await db.refresh(withdrawal)
                logger.success(
                    f"✅ Saque #{withdrawal_id} MANUAL concluído: "
                    f"R${float(withdrawal.amount):.2f} | ID={manual_transfer_id}"
                )
                # Notificar empresa
                try:
                    from app.payments.services.notification_service import notify_withdrawal_approved
                    owner_phone, owner_email = await _get_owner_contact(db, withdrawal.company_id)
                    await notify_withdrawal_approved(
                        owner_phone    = owner_phone,
                        owner_email    = owner_email,
                        amount         = withdrawal.amount,
                        pix_key        = withdrawal.pix_key,
                        withdrawal_id  = withdrawal_id,
                        mp_transfer_id = manual_transfer_id,
                    )
                except Exception as _ne:
                    logger.debug(f"Notificação aprovação manual pulada: {_ne}")
                return withdrawal
            except Exception as e:
                logger.error(f"❌ ERRO na aprovação manual saque #{withdrawal_id}: {e}")
                await LedgerService.release(
                    db            = db,
                    company_id    = withdrawal.company_id,
                    amount        = withdrawal.amount,
                    description   = f"Saque #{withdrawal.id} falhou (manual) — saldo devolvido",
                    withdrawal_id = withdrawal.id,
                )
                withdrawal.status      = WithdrawalStatus.FAILED
                withdrawal.admin_notes = f"ERRO aprovação manual: {str(e)}"
                await db.commit()
                raise RuntimeError(f"Falha na aprovação manual: {e}")

        # ── MODO AUTOMÁTICO (MP Payouts) ──────────────────────────────────────
        try:
            # BUG-16 FIX: passar db= para evitar abrir nova sessão durante
            # transação ativa com status=PROCESSING já no flush()
            provider = await MercadoPagoProvider.get_instance(db=db)
            payout = await provider.send_pix_payout(
                amount          = float(withdrawal.amount),
                pix_key         = withdrawal.pix_key,
                pix_key_type    = withdrawal.pix_key_type.value,
                idempotency_key = withdrawal.mp_idempotency_key,
                description     = f"Saque NEXUS #{withdrawal.id}",
            )

            await LedgerService.debit(
                db            = db,
                company_id    = withdrawal.company_id,
                amount        = withdrawal.amount,
                description   = f"Saque processado #{withdrawal.id}",
                withdrawal_id = withdrawal.id,
            )

            withdrawal.status             = WithdrawalStatus.COMPLETED
            withdrawal.mp_transfer_id     = payout.mp_transfer_id
            withdrawal.mp_transfer_status = payout.status
            withdrawal.processed_at       = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(withdrawal)

            logger.success(
                f"✅ Saque #{withdrawal_id} processado: R${float(withdrawal.amount):.2f} "
                f"→ MP transfer={payout.mp_transfer_id}"
            )

            # TASK 3.4: Audit trail
            await financial_audit(
                db=db, company_id=withdrawal.company_id,
                entity_type="withdrawal", entity_id=withdrawal_id,
                action="approved", performed_by=admin_user_id,
                old_values={"status": "pending"},
                new_values={"status": "completed", "mp_transfer_id": payout.mp_transfer_id},
            )

            try:
                from app.payments.services.notification_service import notify_withdrawal_approved
                owner_phone, owner_email = await _get_owner_contact(db, withdrawal.company_id)
                await notify_withdrawal_approved(
                    owner_phone    = owner_phone,
                    owner_email    = owner_email,
                    amount         = withdrawal.amount,
                    pix_key        = withdrawal.pix_key,
                    withdrawal_id  = withdrawal_id,
                    mp_transfer_id = payout.mp_transfer_id,
                )
            except Exception as _ne:
                logger.debug(f"Notificação aprovação pulada: {_ne}")

            return withdrawal

        except Exception as e:
            logger.error(f"❌ ERRO ao processar saque #{withdrawal_id}: {e}")

            await LedgerService.release(
                db            = db,
                company_id    = withdrawal.company_id,
                amount        = withdrawal.amount,
                description   = f"Saque #{withdrawal.id} falhou — saldo devolvido",
                withdrawal_id = withdrawal.id,
            )

            withdrawal.status        = WithdrawalStatus.FAILED
            withdrawal.admin_notes   = f"ERRO MP Payouts: {str(e)}"
            await db.commit()

            # TASK 3.4: Audit trail
            await financial_audit(
                db=db, company_id=withdrawal.company_id,
                entity_type="withdrawal", entity_id=withdrawal_id,
                action="failed", performed_by=admin_user_id,
                new_values={"status": "failed", "error": str(e)[:200]},
            )

            raise RuntimeError(f"Falha no payout MP: {e}")

    @staticmethod
    async def reject_withdrawal(
        db:            AsyncSession,
        withdrawal_id: int,
        admin_user_id: int,
        reason:        str,
    ) -> WithdrawalRequest:
        """
        Admin rejeita saque → libera hold → notifica empresa.
        """
        # TASK 1.3 FIX: FOR UPDATE previne duplo release de hold (re-applied)
        result = await db.execute(
            select(WithdrawalRequest)
            .where(WithdrawalRequest.id == withdrawal_id)
            .with_for_update()
        )
        withdrawal = result.scalar_one_or_none()
        if not withdrawal:
            raise ValueError(f"Saque #{withdrawal_id} não encontrado")

        if withdrawal.status not in (WithdrawalStatus.PENDING, WithdrawalStatus.UNDER_REVIEW):
            raise ValueError(f"Saque #{withdrawal_id} não pode ser rejeitado (status={withdrawal.status})")

        # Liberar hold — devolve valor ao saldo disponível
        await LedgerService.release(
            db            = db,
            company_id    = withdrawal.company_id,
            amount        = withdrawal.amount,
            description   = f"Saque #{withdrawal.id} rejeitado — saldo liberado",
            withdrawal_id = withdrawal.id,
        )

        withdrawal.status                = WithdrawalStatus.REJECTED
        withdrawal.rejection_reason      = reason
        withdrawal.reviewed_at           = datetime.now(timezone.utc)
        withdrawal.reviewed_by_user_id   = admin_user_id

        await db.commit()
        await db.refresh(withdrawal)

        logger.info(f"🚫 Saque #{withdrawal_id} rejeitado: {reason[:50]}")

        # TASK 3.4: Audit trail
        await financial_audit(
            db=db, company_id=withdrawal.company_id,
            entity_type="withdrawal", entity_id=withdrawal_id,
            action="rejected", performed_by=admin_user_id,
            old_values={"status": "pending"},
            new_values={"status": "rejected", "reason": reason[:200]},
        )

        # Notificar empresa (await direto — asyncio.create_task() é inseguro no Celery)
        try:
            from app.payments.services.notification_service import notify_withdrawal_rejected
            owner_phone, owner_email = await _get_owner_contact(db, withdrawal.company_id)
            await notify_withdrawal_rejected(
                owner_phone   = owner_phone,
                owner_email   = owner_email,
                amount        = withdrawal.amount,
                reason        = reason,
                withdrawal_id = withdrawal_id,
            )
        except Exception as _ne:
            logger.debug(f"Notificação rejeição pulada: {_ne}")

        return withdrawal
