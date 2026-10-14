"""Webhook routes — Protocol 4: HMAC validation, anti-replay, idempotency."""
from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from app.core.config import settings
from app.db.session import get_db
from app.utils.webhook_security import validate_webhook
from app.models import WebhookEvent

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/telegram")
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive updates from Telegram Bot API (webhook mode)."""
    payload = await validate_webhook("telegram", request, db)

    # Record event for idempotency
    event_id = str(payload.get("update_id", ""))
    db.add(WebhookEvent(
        provider="telegram",
        external_event_id=event_id,
        payload_json=payload,
        processed=False,
    ))
    await db.commit()

    logger.info(f"📥 Telegram webhook: {event_id}")

    from app.services.webhook_service import WebhookService
    await WebhookService.process_telegram(payload)
    return {"ok": True}


@router.post("/mercadopago")
async def mercadopago_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe notificações de pagamento do Mercado Pago.

    SEGURANÇA (TASK 1.1 — 26/04/2026):
    - validate_webhook() valida HMAC-SHA256 via MERCADOPAGO_WEBHOOK_SECRET
    - Anti-replay: rejeita timestamps > 5 min
    - Se MERCADOPAGO_WEBHOOK_SECRET não está configurado, loga warning
      mas ainda aceita (graceful degradation durante migração)

    ARQUITETURA DE IDEMPOTÊNCIA:
    - NÃO registra em WebhookEvent (tabela genérica) para pagamentos.
    - A idempotência é responsabilidade exclusiva do mercadopago_handler
      via PaymentWebhookEvent (tabela específica do módulo de pagamentos).
    - Isso evita duplo ponto de controle que gerava inconsistências silenciosas.
    """
    payload = await validate_webhook("mercadopago", request, db)

    topic       = payload.get("type") or payload.get("topic", "")
    resource_id = payload.get("data", {}).get("id") or payload.get("resource", "")

    logger.info(f"💳 MercadoPago webhook — topic: {topic} | id: {resource_id}")

    if topic in ("payment", "merchant_order"):
        from app.services.webhook_service import WebhookService
        await WebhookService.process_mercadopago_payment(resource_id, payload)

    # Resposta imediata (< 22s) conforme requisito MP para evitar retry automático
    return {"status": "received"}


@router.post("/meta")
async def meta_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive Meta (Facebook/Instagram) events."""
    payload = await validate_webhook("meta", request, db)

    entries = payload.get("entry", [{}])
    event_id = entries[0].get("id", "") if entries else ""
    db.add(WebhookEvent(
        provider="meta",
        external_event_id=str(event_id),
        payload_json=payload,
        processed=False,
    ))
    await db.commit()

    logger.info(f"📢 Meta webhook: event {event_id}")
    return {"status": "received"}


@router.get("/meta")
async def meta_webhook_verify(
    hub_mode: str = None,
    hub_challenge: str = None,
    hub_verify_token: str = None,
):
    """Meta webhook verification challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_APP_SECRET:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verificação Meta falhou")


@router.post("/custom/{token}")
async def custom_webhook(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generic webhook endpoint for any external event."""
    payload = await request.json()

    db.add(WebhookEvent(
        provider=f"custom_{token}",
        external_event_id=token,
        payload_json=payload,
        processed=False,
    ))
    await db.commit()

    logger.info(f"🔗 Custom webhook [{token}]")

    from app.services.webhook_service import WebhookService
    await WebhookService.process_custom(token, payload)
    return {"status": "received"}
