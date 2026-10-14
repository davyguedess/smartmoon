"""
NEXUS.IA — Ledger Service
Operações imutáveis de saldo por empresa.
TODAS as movimentações financeiras passam por aqui. Nunca UPDATE saldo direto.
"""
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.payments.models import Wallet, WalletTransaction, WalletTxType, DepositRecord
from app.payments.services.financial_audit_service import financial_audit


class LedgerError(Exception):
    pass


class LedgerService:
    """
    Serviço central de ledger imutável.

    Regras:
    - Usa SELECT FOR UPDATE para evitar race conditions.
    - Cada operação registra WalletTransaction com balance_after (snapshot).
    - NUNCA deletar ou modificar WalletTransaction após criação.
    - Somente webhook handler pode chamar credit().
    """

    @staticmethod
    async def ensure_wallet(db: AsyncSession, company_id: int) -> Wallet:
        """Cria carteira para a empresa se não existir (idempotente)."""
        result = await db.execute(
            select(Wallet).where(Wallet.company_id == company_id)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(
                company_id      = company_id,
                balance         = Decimal("0.00"),
                total_received  = Decimal("0.00"),
                total_withdrawn = Decimal("0.00"),
                currency        = "BRL",
            )
            db.add(wallet)
            try:
                await db.flush()
                logger.info(f"💰 Carteira criada para empresa {company_id}")
            except Exception as ie:
                # BUG-31 FIX: dois requests simultâneos ao primeiro acesso podem
                # tentar inserir a mesma carteira (UNIQUE constraint). Capturar
                # IntegrityError e recarregar o registro já existente.
                import sqlalchemy.exc
                if isinstance(ie, sqlalchemy.exc.IntegrityError):
                    await db.rollback()
                    result2 = await db.execute(
                        select(Wallet).where(Wallet.company_id == company_id)
                    )
                    wallet = result2.scalar_one()
                    logger.debug(f"♻️ Carteira já existia (race condition resolvida) empresa {company_id}")
                else:
                    raise
        return wallet

    @staticmethod
    async def get_balance(db: AsyncSession, company_id: int) -> Decimal:
        """Retorna saldo atual da empresa."""
        result = await db.execute(
            select(Wallet).where(Wallet.company_id == company_id)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            return Decimal("0.00")
        return wallet.balance

    @staticmethod
    async def credit(
        db:          AsyncSession,
        company_id:  int,
        amount:      Decimal,
        description: str,
        source:      str          = "pix_payment",
        charge_id:   Optional[int] = None,
        reference:   Optional[str] = None,
        created_by_user_id: Optional[int] = None,
        # BUG-14 FIX: provider não mais hardcoded — permite Stripe/PagSeguro no futuro
        provider:    str          = "mercadopago",
    ) -> WalletTransaction:
        """
        Credita valor na carteira.
        SOMENTE o webhook handler de pagamento deve chamar este método.
        """
        amount = Decimal(str(amount))
        if amount <= 0:
            raise LedgerError(f"Valor de crédito deve ser positivo: {amount}")

        # Lock da carteira ANTES de qualquer verificação de idempotência
        # BUG-27 FIX: check de idempotência DENTRO do lock with_for_update.
        # Com o check fora do lock, dois retries Celery simultâneos podem
        # ambos ver DepositRecord=None antes que qualquer um faça o INSERT.
        # Resultado sem fix: ambos creditam o saldo — duplo crédito.
        result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = await LedgerService.ensure_wallet(db, company_id)

        # Idempotência por charge_id — já dentro do lock, seguro contra race
        if charge_id is not None:
            existing_deposit = await db.execute(
                select(DepositRecord).where(DepositRecord.charge_id == charge_id)
            )
            if existing_deposit.scalar_one_or_none() is not None:
                logger.warning(
                    f"⚠️ CREDIT ignorado — charge_id={charge_id} já foi creditado anteriormente"
                )
                # Retornar a transação existente para não quebrar o caller
                existing_tx = await db.execute(
                    select(WalletTransaction).where(WalletTransaction.charge_id == charge_id)
                )
                tx = existing_tx.scalar_one_or_none()
                if tx:
                    return tx
                # Se não achar tx (edge case), prossegue sem creditar
                return WalletTransaction(
                    company_id = company_id, wallet_id = wallet.id,
                    charge_id  = charge_id,  type      = WalletTxType.CREDIT,
                    amount     = amount,     balance_after = wallet.balance,
                    description = "[DUPLICADO — não creditado]",
                    created_by_system = True,
                )

        new_balance = wallet.balance + amount

        # Atualizar wallet
        wallet.balance        = new_balance
        wallet.total_received = wallet.total_received + amount

        # Registro imutável
        tx = WalletTransaction(
            company_id          = company_id,
            wallet_id           = wallet.id,
            charge_id           = charge_id,
            type                = WalletTxType.CREDIT,
            amount              = amount,
            balance_after       = new_balance,
            description         = description,
            reference           = reference,
            source              = source,
            created_by_system   = created_by_user_id is None,
            created_by_user_id  = created_by_user_id,
        )
        db.add(tx)

        # Registro de depósito
        deposit = DepositRecord(
            company_id          = company_id,
            wallet_id           = wallet.id,
            charge_id           = charge_id,
            amount              = amount,
            source              = source,
            provider            = provider,
            provider_payment_id = reference,
            description         = description,
            created_by          = created_by_user_id,
        )
        db.add(deposit)

        await db.flush()

        # TASK 3.3: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="wallet", entity_id=tx.id,
            action="credit", performed_by=created_by_user_id,
            new_values={"amount": amount, "balance_after": new_balance, "source": source, "charge_id": charge_id},
        )

        logger.success(
            f"💰 CREDIT +R${amount:.2f} → empresa {company_id} "
            f"| saldo: R${new_balance:.2f} | tx_id={tx.id}"
        )
        return tx

    @staticmethod
    async def refund(
        db:          AsyncSession,
        company_id:  int,
        amount:      Decimal,
        description: str,
        charge_id:   Optional[int] = None,
        reference:   Optional[str] = None,
    ) -> WalletTransaction:
        """
        BUG-04 FIX: Debita saldo após reembolso ao pagador.
        Diferente de hold() (saque pendente) — aqui o dinheiro já saiu via MP.
        Registra WalletTransaction com type=REFUND e atualiza total_withdrawn.
        """
        amount = Decimal(str(amount))
        if amount <= 0:
            raise LedgerError(f"Valor de reembolso deve ser positivo: {amount}")

        result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise LedgerError("Carteira não encontrada")

        if wallet.balance < amount:
            raise LedgerError(
                f"Saldo insuficiente para reembolso: R${wallet.balance:.2f} disponível, "
                f"solicitado R${amount:.2f}"
            )

        new_balance = wallet.balance - amount
        wallet.balance         = new_balance
        wallet.total_withdrawn = wallet.total_withdrawn + amount  # conta como saída

        tx = WalletTransaction(
            company_id        = company_id,
            wallet_id         = wallet.id,
            charge_id         = charge_id,
            type              = WalletTxType.REFUND,
            amount            = amount,
            balance_after     = new_balance,
            description       = description,
            reference         = reference,
            source            = "refund",
            created_by_system = True,
        )
        db.add(tx)
        await db.flush()

        # TASK 3.3: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="wallet", entity_id=tx.id,
            action="refund",
            new_values={"amount": amount, "balance_after": new_balance, "charge_id": charge_id},
        )

        logger.info(
            f"🔄 REFUND -R${amount:.2f} empresa {company_id} "
            f"| saldo: R${new_balance:.2f} | tx_id={tx.id}"
        )
        return tx

    @staticmethod
    async def hold(
        db:            AsyncSession,
        company_id:    int,
        amount:        Decimal,
        description:   str,
        withdrawal_id: Optional[int] = None,
    ) -> WalletTransaction:
        """
        Reserva valor para saque pendente.
        Debita do saldo disponível (cliente não pode gastar enquanto hold ativo).
        """
        amount = Decimal(str(amount))
        if amount <= 0:
            raise LedgerError("Valor de hold deve ser positivo")

        result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise LedgerError("Carteira não encontrada")

        if wallet.balance < amount:
            raise LedgerError(
                f"Saldo insuficiente: R${wallet.balance:.2f} disponível, "
                f"solicitado R${amount:.2f}"
            )

        new_balance = wallet.balance - amount
        wallet.balance = new_balance

        tx = WalletTransaction(
            company_id      = company_id,
            wallet_id       = wallet.id,
            withdrawal_id   = withdrawal_id,
            type            = WalletTxType.HOLD,
            amount          = amount,
            balance_after   = new_balance,
            description     = description,
            source          = "withdrawal",
            created_by_system = True,
        )
        db.add(tx)
        await db.flush()

        # TASK 3.3: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="wallet", entity_id=tx.id,
            action="hold",
            new_values={"amount": amount, "balance_after": new_balance, "withdrawal_id": withdrawal_id},
        )

        logger.info(f"🔒 HOLD R${amount:.2f} empresa {company_id} | saldo: R${new_balance:.2f}")
        return tx

    @staticmethod
    async def release(
        db:            AsyncSession,
        company_id:    int,
        amount:        Decimal,
        description:   str,
        withdrawal_id: Optional[int] = None,
    ) -> WalletTransaction:
        """
        Libera valor reservado (saque rejeitado ou cancelado).
        Devolve o valor ao saldo disponível.
        """
        amount = Decimal(str(amount))

        result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise LedgerError("Carteira não encontrada")

        new_balance = wallet.balance + amount
        wallet.balance = new_balance

        tx = WalletTransaction(
            company_id      = company_id,
            wallet_id       = wallet.id,
            withdrawal_id   = withdrawal_id,
            type            = WalletTxType.RELEASE,
            amount          = amount,
            balance_after   = new_balance,
            description     = description,
            source          = "withdrawal_rejected",
            created_by_system = True,
        )
        db.add(tx)
        await db.flush()

        # TASK 3.3: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="wallet", entity_id=tx.id,
            action="release",
            new_values={"amount": amount, "balance_after": new_balance, "withdrawal_id": withdrawal_id},
        )

        logger.info(f"🔓 RELEASE R${amount:.2f} empresa {company_id} | saldo: R${new_balance:.2f}")
        return tx

    @staticmethod
    async def debit(
        db:            AsyncSession,
        company_id:    int,
        amount:        Decimal,
        description:   str,
        withdrawal_id: Optional[int] = None,
    ) -> WalletTransaction:
        """
        Confirma débito final (saque aprovado e transferência enviada).
        wallet.total_withdrawn é incrementado aqui.
        """
        amount = Decimal(str(amount))

        result = await db.execute(
            select(Wallet)
            .where(Wallet.company_id == company_id)
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise LedgerError("Carteira não encontrada")

        # Saldo já foi debitado no hold() — só atualiza total_withdrawn
        wallet.total_withdrawn = wallet.total_withdrawn + amount

        # balance_after = balance atual (já foi deduzido no hold)
        tx = WalletTransaction(
            company_id      = company_id,
            wallet_id       = wallet.id,
            withdrawal_id   = withdrawal_id,
            type            = WalletTxType.DEBIT,
            amount          = amount,
            balance_after   = wallet.balance,  # saldo já estava descontado
            description     = description,
            source          = "withdrawal_completed",
            created_by_system = True,
        )
        db.add(tx)
        await db.flush()

        # TASK 3.3: Audit trail
        await financial_audit(
            db=db, company_id=company_id,
            entity_type="wallet", entity_id=tx.id,
            action="debit",
            new_values={"amount": amount, "balance_after": wallet.balance, "withdrawal_id": withdrawal_id},
        )

        logger.success(
            f"💸 DEBIT R${amount:.2f} empresa {company_id} "
            f"| saldo: R${wallet.balance:.2f} | tx_id={tx.id}"
        )
        return tx
