"""
NEXUS.IA — MercadoPago Webhook Handler
Processa webhooks de pagamento de forma segura e idempotente.
ÚNICO ponto que pode chamar ChargeService.process_payment_confirmed().
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.payments.models import PaymentCharge, PaymentWebhookEvent
from app.payments.services.charge_service import ChargeService


async def handle_mercadopago_webhook(
    payment_id: str,
    payload:    dict,
    db:         AsyncSession,
) -> dict:
    """
    Processa notificação de pagamento do Mercado Pago.

    Fluxo seguro:
    1. Idempotência: evita processar o mesmo evento duas vezes
    2. Busca cobrança pelo external_payment_id ou external_reference
    3. Verifica status REAL no MP (anti-fraude — não confiar só no webhook)
    4. Se paid → ChargeService.process_payment_confirmed()
    5. Marca evento como processado

    Retorna resumo do processamento.
    """
    event_type = payload.get("type") or payload.get("action", "")

    # ── 1. Verificar idempotência (SELECT FOR UPDATE evita race condition) ─────
    # BUG-02 FIX: sem FOR UPDATE, dois workers Celery podem processar
    # o mesmo webhook simultaneamente (MP dispara duplicatas com <100ms).
    existing_event = await db.execute(
        select(PaymentWebhookEvent)
        .where(
            PaymentWebhookEvent.provider          == "mercadopago",
            PaymentWebhookEvent.provider_event_id == str(payment_id),
        )
        .with_for_update(skip_locked=True)   # worker concorrente pula e descarta
    )
    existing = existing_event.scalar_one_or_none()

    if existing and existing.processed:
        logger.info(f"♻️ Webhook MP duplicado (already processed): payment_id={payment_id}")
        return {"skipped": True, "reason": "duplicate"}

    # Registrar evento (ou reutilizar o existente não processado)
    if not existing:
        webhook_event = PaymentWebhookEvent(
            provider          = "mercadopago",
            provider_event_id = str(payment_id),
            event_type        = event_type,
            raw_payload       = payload,
            processed         = False,
        )
        db.add(webhook_event)
        await db.flush()
    else:
        webhook_event = existing

    # ── 2. Buscar cobrança interna ────────────────────────────────────────────
    # Tenta por external_payment_id (ID do MP)
    charge_result = await db.execute(
        select(PaymentCharge).where(
            PaymentCharge.external_payment_id == str(payment_id)
        )
    )
    charge = charge_result.scalar_one_or_none()

    # Se não encontrou por ID, tenta via external_reference no payload
    if not charge:
        ext_ref = (
            payload.get("data", {}).get("external_reference") or
            payload.get("external_reference")
        )
        if ext_ref:
            ref_result = await db.execute(
                select(PaymentCharge).where(
                    PaymentCharge.external_reference == ext_ref
                )
            )
            charge = ref_result.scalar_one_or_none()

    if not charge:
        logger.warning(
            f"⚠️ Webhook MP: payment_id={payment_id} sem cobrança correspondente"
        )
        # Registrar mas não falhar — pode ser pagamento de outro sistema
        webhook_event.processing_error = "Cobrança não encontrada"
        webhook_event.processed        = True
        webhook_event.processed_at     = datetime.now(timezone.utc)
        await db.commit()
        return {"skipped": True, "reason": "charge_not_found", "payment_id": payment_id}

    webhook_event.charge_id = charge.id

    # ── 3 + 4. Confirmar pagamento e creditar ledger ──────────────────────────
    try:
        updated_charge = await ChargeService.process_payment_confirmed(
            db            = db,
            charge_id     = charge.id,
            mp_payment_id = str(payment_id),
        )

        # ── 4b. Crédito automático de NEXUS tokens (compra de pack IA) ───────
        # Nova lógica: usa token_pack_id / tokens_to_credit da própria charge
        from sqlalchemy import text as _text
        try:
            # Recarregar charge para pegar token_pack_id (pode não estar no objeto ORM)
            ch_row = await db.execute(
                _text("SELECT token_pack_id, tokens_to_credit FROM payment_charges WHERE id=:id"),
                {"id": charge.id}
            )
            ch_data = ch_row.mappings().first()
            token_pack_id    = (ch_data or {}).get("token_pack_id")
            tokens_to_credit = int((ch_data or {}).get("tokens_to_credit") or 0)

            # Fallback legado: metadata_ com chaves antigas
            if not tokens_to_credit:
                ai_meta = charge.metadata_ or {}
                tokens_to_credit = int(ai_meta.get("tokens") or ai_meta.get("tokens_included") or 0)
                token_pack_id = token_pack_id or ai_meta.get("ai_token_pack_id") or ai_meta.get("pack_id")

            if tokens_to_credit > 0:
                # BUG-28 FIX: verificar se esta charge já foi processada antes.
                # Em retries Celery, process_payment_confirmed pode já ter
                # creditado os tokens em execução anterior. Checar via
                # ai_token_transactions para evitar duplo crédito.
                existing_tx = await db.execute(_text("""
                    SELECT id FROM ai_token_transactions
                    WHERE company_id = :cid
                      AND description LIKE :pattern
                    LIMIT 1
                """), {
                    "cid": charge.company_id,
                    "pattern": f"%charge_id={charge.id}%",
                })
                if existing_tx.scalar() is not None:
                    logger.warning(
                        f"⚠️ Tokens já creditados para charge #{charge.id} — retry ignorado"
                    )
                else:
                    # Determinar provider do pack
                    provider = "any"
                    if token_pack_id:
                        pk_row = await db.execute(
                            _text("SELECT provider FROM ai_token_packs WHERE id=:id"),
                            {"id": int(token_pack_id)}
                        )
                        pk = pk_row.scalar()
                        if pk:
                            provider = pk

                    # Upsert no saldo
                    await db.execute(_text("""
                        INSERT INTO ai_token_balances
                            (company_id, provider, balance_tokens, total_purchased, total_used, updated_at)
                        VALUES (:cid, :prov, :tokens, :tokens, 0, NOW())
                        ON CONFLICT (company_id, provider)
                        DO UPDATE SET
                            balance_tokens  = ai_token_balances.balance_tokens + :tokens,
                            total_purchased = ai_token_balances.total_purchased + :tokens,
                            updated_at      = NOW()
                    """), {"cid": charge.company_id, "prov": provider, "tokens": tokens_to_credit})

                    # Registrar transação de crédito
                    await db.execute(_text("""
                        INSERT INTO ai_token_transactions
                            (company_id, provider, tx_type, nexus_tokens_cost, description, created_at)
                        VALUES (:cid, :prov, 'credit', :tokens, :desc, NOW())
                    """), {
                        "cid": charge.company_id,
                        "prov": provider,
                        "tokens": tokens_to_credit,
                        "desc": f"PIX confirmado — pack_id={token_pack_id} | charge_id={charge.id}",
                    })

                    logger.success(
                        f"💎 {tokens_to_credit:,} tokens creditados via PIX aprovado "
                        f"| pack={token_pack_id} | empresa={charge.company_id}"
                    )
        except Exception as _te:
            logger.error(f"❌ Erro ao creditar tokens pós-PIX (charge={charge.id}): {_te}")

        # ── 5b. Activate subscription if this is a registration charge ────
        try:
            ext_ref = charge.external_reference or ""
            if ext_ref.startswith("sub_"):
                # BUG-07 FIX: filtrar pela cobrança específica via external_reference
                # para não ativar TODAS as subscriptions pending da empresa
                await db.execute(_text("""
                    UPDATE subscriptions
                    SET status = 'active', updated_at = NOW()
                    WHERE company_id = :cid
                      AND status = 'pending_payment'
                      AND external_reference = :ext_ref
                """), {"cid": charge.company_id, "ext_ref": ext_ref})

                # BUG-33 FIX: UPDATE transactions precisava de filtro adicional.
                # Sem ele, qualquer transação 'pending' da empresa com external_id=payment_id
                # seria marcada como paga — incluindo transações de outros sistemas.
                # Adicionado filtro por external_reference para restringir ao contexto certo.
                await db.execute(_text("""
                    UPDATE transactions
                    SET status = 'paid', paid_at = NOW()
                    WHERE company_id = :cid
                      AND status = 'pending'
                      AND external_id = :eid
                      AND (
                        external_reference = :ext_ref
                        OR description ILIKE '%subscription%'
                        OR description ILIKE '%plano%'
                      )
                """), {"cid": charge.company_id, "eid": str(payment_id), "ext_ref": ext_ref})

                logger.success(
                    f"🎉 SUBSCRIPTION ATIVADA via PIX: empresa {charge.company_id} | ref={ext_ref}"
                )
        except Exception as _se:
            logger.error(f"❌ Erro ao ativar subscription pós-PIX (charge={charge.id}): {_se}")

        # ── 5. Marcar evento como processado ─────────────────────────────────
        webhook_event.processed    = True
        webhook_event.processed_at = datetime.now(timezone.utc)

        # Atualizar webhook_payload_last na cobrança
        charge.webhook_payload_last = payload

        await db.commit()
        await db.refresh(charge)

        # BUG-41 FIX: notify_charge_created() chamado após commit da confirmação
        try:
            if charge.client_phone or charge.client_email:
                from app.payments.services.notification_service import notify_charge_created
                await notify_charge_created(
                    client_name    = charge.client_name or "Cliente",
                    client_phone   = charge.client_phone,
                    client_email   = charge.client_email,
                    amount         = charge.amount,
                    description    = charge.description,
                    pix_copy_paste = charge.pix_copy_paste_code,
                    due_date       = str(charge.due_date) if charge.due_date else None,
                )
        except Exception as _ne:
            logger.debug(f"notify_charge_created não enviada (não crítico): {_ne}")

        return {
            "processed":  True,
            "charge_id":  charge.id,
            "company_id": charge.company_id,
            "amount":     float(charge.amount),
            "status":     updated_charge.status.value if updated_charge else "unknown",
        }

    except Exception as exc:
        # BUG-13 FIX: Não comitar estado inconsistente após exceção.
        # Fazer rollback e salvar o erro de forma isolada em nova sessão.
        logger.error(f"❌ Erro ao processar webhook MP payment_id={payment_id}: {exc}")
        try:
            await db.rollback()
        except Exception:
            pass

        # Salvar erro em sessão separada e limpa para não perder o rastreio
        try:
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as err_session:
                err_row = await err_session.execute(
                    select(PaymentWebhookEvent).where(
                        PaymentWebhookEvent.provider          == "mercadopago",
                        PaymentWebhookEvent.provider_event_id == str(payment_id),
                    )
                )
                err_event = err_row.scalar_one_or_none()
                if err_event:
                    err_event.processing_error = str(exc)[:500]
                    err_event.processed        = False
                    await err_session.commit()
        except Exception as _inner:
            logger.error(f"Falha ao salvar erro do webhook: {_inner}")
        raise
