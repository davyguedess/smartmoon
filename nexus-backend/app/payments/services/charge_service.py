"""
NEXUS.IA — Charge Service
Criação, envio e processamento de cobranças PIX.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.payments.models import (
    PaymentCharge, PaymentClient, Wallet, ChargeStatus
)
from app.payments.schemas import ChargeCreate
from app.payments.providers.mercadopago_provider import MercadoPagoProvider
from app.payments.services.ledger_service import LedgerService
from app.core.config import settings


class ChargeService:

    # ── Criação de cobrança  ──────────────────────────────────────────────────

    @staticmethod
    async def create_charge(
        db:                   AsyncSession,
        company_id:           int,
        data:                 ChargeCreate,
        created_by_user_id:   Optional[int] = None,
        created_by_agent_id:  Optional[int] = None,
        creator_email:        Optional[str] = None,
    ) -> PaymentCharge:
        """
        Cria cobrança PIX via Mercado Pago (conta Smart Moon).
        1. Resolve ou cria client
        2. Gera external_reference único
        3. Chama MercadoPagoProvider.create_pix_charge()
        4. Salva PaymentCharge com QR code e pix copia e cola
        5. Garante que carteira existe (ensure_wallet)
        """
        # 0. Resolver provider ANTES de qualquer operação na sessão DB
        # (evita greenlet_spawn: leitura async não pode ocorrer após flush())
        provider = await MercadoPagoProvider.get_instance(db=db)

        # 1. Resolver cliente
        client_id = data.client_id

        # Helper: aceita email apenas se tiver TLD real (MP rejeita .ia / .local / etc.)
        _FAKE_TLDS = {'.ia', '.local', '.test', '.internal', '.invalid', '.example', '.localhost'}
        def _valid_email(e: Optional[str]) -> Optional[str]:
            if not e or '@' not in e:
                return None
            tld = '.' + e.rsplit('.', 1)[-1].lower()
            return None if tld in _FAKE_TLDS else e

        payer_email = (
            _valid_email(data.client_email)
            or _valid_email(creator_email)
            or f"pagador{company_id}@smartmoon.online"
        )


        if not client_id and data.client_name:
            # Cria cliente inline
            client = PaymentClient(
                company_id = company_id,
                name       = data.client_name,
                email      = data.client_email,
                phone      = data.client_phone,
            )
            db.add(client)
            await db.flush()
            client_id = client.id
            logger.info(f"👤 Cliente criado inline: {data.client_name} (id={client_id})")
        elif client_id:
            result = await db.execute(
                select(PaymentClient).where(
                    PaymentClient.id == client_id,
                    PaymentClient.company_id == company_id,
                )
            )
            client = result.scalar_one_or_none()
            if not client:
                raise ValueError(f"Cliente {client_id} não encontrado")
            payer_email = client.email or payer_email

        # 2. TASK 2.4: Validar limites de valor da cobrança
        from app.payments.services.limits_service import get_company_limits
        limits = await get_company_limits(db, company_id)
        charge_amount = Decimal(str(data.amount))
        if charge_amount < limits.min_charge_amount:
            raise ValueError(
                f"Valor mínimo de cobrança: R${limits.min_charge_amount:.2f}. "
                f"Solicitado: R${charge_amount:.2f}"
            )
        if charge_amount > limits.max_charge_amount:
            raise ValueError(
                f"Valor máximo de cobrança: R${limits.max_charge_amount:.2f}. "
                f"Solicitado: R${charge_amount:.2f}"
            )

        # 3. Referência única
        external_ref = f"nexus_{company_id}_{uuid.uuid4().hex[:12]}"

        # 3. Criar PIX no MP (provider já resolvido no início do método)
        mp_result = await provider.create_pix_charge(
            amount             = float(data.amount),
            description        = data.description,
            external_reference = external_ref,
            payer_email        = payer_email,
            due_date           = data.due_date,
            idempotency_key    = external_ref,  # mesma ref = idempotente
        )

        # 4. Salvar cobrança
        charge = PaymentCharge(
            company_id           = company_id,
            client_id            = client_id,
            created_by_user_id   = created_by_user_id,
            created_by_agent_id  = created_by_agent_id,
            external_provider    = "mercadopago",
            external_payment_id  = mp_result.external_payment_id,
            external_reference   = external_ref,
            amount               = data.amount,
            description          = data.description,
            due_date             = data.due_date,
            status               = ChargeStatus.PENDING,
            pix_qr_code          = mp_result.pix_qr_code,
            pix_copy_paste_code  = mp_result.pix_copy_paste_code,
            payment_link         = mp_result.payment_link,
        )
        db.add(charge)

        # 5. Garantir que carteira existe
        await LedgerService.ensure_wallet(db, company_id)

        await db.commit()
        await db.refresh(charge)
        logger.success(
            f"✅ Cobrança criada: R${data.amount:.2f} | "
            f"ref={external_ref} | MP_ID={mp_result.external_payment_id}"
        )

        # BUG-41 FIX: notify_charge_created() nunca era chamada em create_charge().
        # Cobranças criadas via AgentTools ou backend ficavam sem notificação ao cliente.
        # Chamada pós-commit — erro de notificação NÃO quebra o fluxo principal.
        try:
            if data.client_phone or data.client_email:
                from app.payments.services.notification_service import notify_charge_created
                await notify_charge_created(
                    client_name    = data.client_name or "Cliente",
                    client_phone   = getattr(data, "client_phone", None),
                    client_email   = data.client_email,
                    amount         = data.amount,
                    description    = data.description,
                    pix_copy_paste = charge.pix_copy_paste_code,
                    due_date       = str(data.due_date) if data.due_date else None,
                )
        except Exception as _ne:
            logger.debug(f"notify_charge_created não enviada (não crítico): {_ne}")

        return charge

    # ── Envio ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def send_charge(
        db:         AsyncSession,
        charge_id:  int,
        company_id: int,
        via:        str,            # whatsapp | email | manual
        phone:      Optional[str] = None,
        email:      Optional[str] = None,
        message:    Optional[str] = None,
    ) -> PaymentCharge:
        """
        Envia a cobrança para o cliente pelo canal especificado.
        Atualiza status=sent, sent_via e sent_at.
        """
        result = await db.execute(
            select(PaymentCharge).where(
                PaymentCharge.id         == charge_id,
                PaymentCharge.company_id == company_id,
            )
        )
        charge = result.scalar_one_or_none()
        if not charge:
            raise ValueError(f"Cobrança {charge_id} não encontrada")

        if charge.status == ChargeStatus.PAID:
            raise ValueError("Cobrança já foi paga e não pode ser reenviada")
        if charge.status == ChargeStatus.CANCELLED:
            raise ValueError("Cobrança cancelada não pode ser enviada")

        sent = False

        if via == "whatsapp":
            sent = await ChargeService._send_whatsapp(charge, phone)
        elif via == "email":
            sent = await ChargeService._send_email(charge, email)
        elif via == "manual":
            sent = True  # marcado como enviado manualmente

        if sent:
            charge.status  = ChargeStatus.SENT
            charge.sent_via = via
            charge.sent_at  = datetime.now(timezone.utc)
            await db.commit()
            # BUG-25 FIX: recarregar com joinedload para evitar lazy load
            result2 = await db.execute(
                select(PaymentCharge)
                .options(joinedload(PaymentCharge.client))
                .where(PaymentCharge.id == charge_id)
            )
            charge = result2.scalar_one_or_none() or charge
            logger.info(f"📤 Cobrança {charge_id} enviada via {via}")

        return charge

    @staticmethod
    async def _send_whatsapp(charge: PaymentCharge, phone: Optional[str]) -> bool:
        """Envia cobrança via WhatsApp usando notification_service (Z-API global)."""
        try:
            target_phone = phone or (charge.client.phone if charge.client else None)
            if not target_phone:
                logger.warning(f"Cobrança {charge.id}: telefone não informado para WhatsApp")
                return False

            from app.payments.services.notification_service import notify_charge_created
            client_name  = charge.client.name  if charge.client else "Cliente"
            client_email = charge.client.email if charge.client else None
            due = charge.due_date.strftime("%d/%m/%Y") if charge.due_date else None

            await notify_charge_created(
                client_name     = client_name,
                client_phone    = target_phone,
                client_email    = client_email,
                amount          = charge.amount,
                description     = charge.description,
                pix_copy_paste  = charge.pix_copy_paste_code,
                due_date        = due,
            )
            return True
        except Exception as e:
            logger.error(f"Erro ao enviar WhatsApp cobrança {charge.id}: {e}")
            return False

    @staticmethod
    async def _send_email(charge: PaymentCharge, email: Optional[str]) -> bool:
        """Envia cobrança via email usando notification_service (SMTP)."""
        try:
            target_email = email or (charge.client.email if charge.client else None)
            if not target_email:
                logger.warning(f"Cobrança {charge.id}: email não informado")
                return False

            from app.payments.services.notification_service import notify_charge_created
            client_name  = charge.client.name  if charge.client else "Cliente"
            client_phone = charge.client.phone if charge.client else None
            due = charge.due_date.strftime("%d/%m/%Y") if charge.due_date else None

            await notify_charge_created(
                client_name     = client_name,
                client_phone    = client_phone,
                client_email    = target_email,
                amount          = charge.amount,
                description     = charge.description,
                pix_copy_paste  = charge.pix_copy_paste_code,
                due_date        = due,
            )
            return True
        except Exception as e:
            logger.error(f"Erro ao enviar email cobrança {charge.id}: {e}")
            return False

    @staticmethod
    def _build_whatsapp_message(charge: PaymentCharge) -> str:
        due = charge.due_date.strftime("%d/%m/%Y") if charge.due_date else "Sem vencimento"
        client_name = charge.client.name if charge.client else "Cliente"
        return (
            f"💳 *Cobrança Smart Moon*\n\n"
            f"Olá, {client_name}! Você tem uma cobrança pendente:\n\n"
            f"📋 *{charge.description}*\n"
            f"💰 Valor: *R$ {float(charge.amount):.2f}*\n"
            f"📅 Vencimento: *{due}*\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📋 *PIX Copia e Cola:*\n"
            f"{charge.pix_copy_paste_code}\n\n"
            f"✅ Após o pagamento, você receberá a confirmação automaticamente."
        )

    # ── Cancelamento ──────────────────────────────────────────────────────────

    @staticmethod
    async def cancel_charge(
        db:         AsyncSession,
        charge_id:  int,
        company_id: int,
    ) -> PaymentCharge:
        """Cancela cobrança no MP e atualiza status interno."""
        result = await db.execute(
            select(PaymentCharge).where(
                PaymentCharge.id         == charge_id,
                PaymentCharge.company_id == company_id,
            )
        )
        charge = result.scalar_one_or_none()
        if not charge:
            raise ValueError("Cobrança não encontrada")

        if charge.status == ChargeStatus.PAID:
            raise ValueError("Cobrança paga não pode ser cancelada")

        # BUG-20 FIX: guarda idempotência — evita duplo cancel no MP
        if charge.status == ChargeStatus.CANCELLED:
            logger.info(f"♻️ Cobrança {charge_id} já está cancelada — sem ação")
            return charge

        if charge.external_payment_id:
            # BUG-03 FIX: passar db= para evitar nova conexão dentro de transação ativa
            provider = await MercadoPagoProvider.get_instance(db=db)
            # BUG-22 FIX: verificar retorno — MP pode recusar (PIX pago no último segundo)
            mp_cancelled = await provider.cancel_charge(charge.external_payment_id)
            if not mp_cancelled:
                logger.warning(
                    f"⚠️ MP recusou cancelamento de charge #{charge_id} — verificando status real"
                )
                try:
                    status_result = await provider.get_payment_status(charge.external_payment_id)
                    if status_result.internal_status == "paid":
                        raise ValueError(
                            "Não foi possível cancelar: pagamento já aprovado no MercadoPago"
                        )
                except ValueError:
                    raise
                except Exception:
                    pass  # Falha ao checar status — prosseguir com cancelamento local

        charge.status       = ChargeStatus.CANCELLED
        charge.cancelled_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(charge)
        logger.info(f"❌ Cobrança {charge_id} cancelada")
        return charge

    # ── Confirmação de pagamento (chamada pelo webhook) ───────────────────────

    @staticmethod
    async def process_payment_confirmed(
        db:        AsyncSession,
        charge_id: int,
        mp_payment_id: Optional[str] = None,
    ) -> PaymentCharge:
        """
        Confirma pagamento e credita saldo no ledger.
        SOMENTE o webhook handler deve chamar este método.
        Chamadas duplicadas são seguras (charge.status == paid é ignorado).
        """
        result = await db.execute(
            select(PaymentCharge).where(PaymentCharge.id == charge_id)
        )
        charge = result.scalar_one_or_none()
        if not charge:
            logger.error(f"process_payment_confirmed: charge {charge_id} não encontrada")
            return None

        # Idempotência — já foi processado
        if charge.status == ChargeStatus.PAID:
            logger.info(f"♻️ Cobrança {charge_id} já está paga — ignorando duplicata")
            return charge

        # Verificar status real no MP (anti-fraude: nunca confiar só no webhook)
        if charge.external_payment_id:
            try:
                # BUG-05 FIX: passar db= para evitar nova conexão dentro de transação ativa
                provider = await MercadoPagoProvider.get_instance(db=db)
                status_result = await provider.get_payment_status(charge.external_payment_id)
                if status_result.internal_status != "paid":
                    logger.warning(
                        f"⚠️ Webhook diz pago, mas MP retorna: {status_result.mp_status}. "
                        f"Cobrança {charge_id} não creditada."
                    )
                    return charge
            except Exception as e:
                logger.error(f"Erro ao verificar status no MP: {e} — prosseguindo")

        # Atualiza cobrança
        charge.status  = ChargeStatus.PAID
        charge.paid_at = datetime.now(timezone.utc)
        if mp_payment_id:
            charge.external_payment_id = mp_payment_id

        # Credita ledger (método que realmente movimenta saldo)
        await LedgerService.credit(
            db          = db,
            company_id  = charge.company_id,
            amount      = charge.amount,
            description = f"Pagamento recebido: {charge.description}",
            source      = "pix_payment",
            charge_id   = charge.id,
            reference   = charge.external_payment_id,
        )

        # BUG-01 FIX: NÃO fazer commit aqui.
        # O commit deve ficar EXCLUSIVAMENTE no caller (mercadopago_handler),
        # DEPOIS de atualizar webhook_event.processed = True.
        # Fazer commit aqui + commit no handler = risco de duplo crédito
        # se uma exception ocorrer entre os dois commits.
        await db.flush()   # persiste na transação sem comitar
        await db.refresh(charge)

        logger.success(
            f"🎉 PAGAMENTO CONFIRMADO: R${float(charge.amount):.2f} "
            f"| cobrança {charge_id} | empresa {charge.company_id}"
        )

        # Registrar no log imutável de auditoria financeira
        try:
            from app.payments.services.financial_audit_service import financial_audit
            await financial_audit(
                db=db,
                company_id=charge.company_id,
                entity_type="charge",
                entity_id=charge.id,
                action="credit",
                old_values={"status": "pending"},
                new_values={
                    "status": "paid",
                    "amount": str(charge.amount),
                    "paid_at": charge.paid_at.isoformat() if charge.paid_at else None,
                    "external_payment_id": charge.external_payment_id,
                },
            )
        except Exception as e:
            logger.debug(f"Financial audit log skipped: {e}")

        # Notificar cliente (await direto — asyncio.create_task() é inseguro no Celery)
        # BUG-21 FIX: recarregar cobrança COM joinedload para evitar MissingGreenlet
        # no Celery (lazy load não funciona em contexto async sem greenlet)
        try:
            from app.payments.services.notification_service import notify_charge_paid
            from sqlalchemy.orm import joinedload as _jl
            ch_with_client = await db.execute(
                select(PaymentCharge)
                .options(_jl(PaymentCharge.client))
                .where(PaymentCharge.id == charge.id)
            )
            charge_loaded = ch_with_client.scalar_one_or_none() or charge
            client_phone = charge_loaded.client.phone if charge_loaded.client else None
            client_email = charge_loaded.client.email if charge_loaded.client else None
            client_name  = charge_loaded.client.name  if charge_loaded.client else "Cliente"
            await notify_charge_paid(
                client_name  = client_name,
                client_phone = client_phone,
                client_email = client_email,
                amount       = charge.amount,
                description  = charge.description,
            )
        except Exception as _ne:
            logger.debug(f"Notificação pago pulada: {_ne}")

        # Emitir evento interno para automações do flow engine
        try:
            from app.workers.tasks import emit_payment_event_task
            emit_payment_event_task.delay(
                "payment.confirmed",
                {
                    "charge_id":  charge.id,
                    "company_id": charge.company_id,
                    "amount":     float(charge.amount),
                    "client_id":  charge.client_id,
                }
            )
        except Exception as e:
            logger.warning(f"Evento payment.confirmed não emitido: {e}")

        # Disparar webhook callback para integradores da Open Gateway API
        try:
            from app.payments.gateway.webhook_callback import fire_webhook, build_charge_event
            from app.payments.gateway.models import GatewayAPIKey
            # Buscar API key com webhook_url configurado
            gw_key = await db.execute(
                select(GatewayAPIKey).where(
                    GatewayAPIKey.company_id == charge.company_id,
                    GatewayAPIKey.is_active == True,  # noqa: E712
                    GatewayAPIKey.webhook_url.isnot(None),
                )
            )
            api_key = gw_key.scalar_one_or_none()
            if api_key and api_key.webhook_url:
                event_payload = build_charge_event(charge, "charge.paid")
                fire_webhook(
                    webhook_url=api_key.webhook_url,
                    webhook_secret=api_key.webhook_secret or api_key.key_hash[:32],
                    event_type="charge.paid",
                    payload=event_payload,
                    company_id=charge.company_id,
                    charge_id=charge.id,
                )
        except Exception as e:
            logger.debug(f"Webhook callback not dispatched: {e}")

        return charge
