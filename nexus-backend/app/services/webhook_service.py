"""
Webhook Service — processes incoming webhooks and routes to appropriate handlers.
"""
from loguru import logger
from app.workers.tasks import process_webhook_task


class WebhookService:

    @staticmethod
    async def process_telegram(payload: dict):
        """Handle Telegram update — extract message and trigger any matching flows."""
        message = payload.get("message") or payload.get("edited_message", {})
        text = message.get("text", "") if message else ""
        chat_id = message.get("chat", {}).get("id") if message else None

        logger.info(f"Telegram message from chat {chat_id}: {text[:80]}")

        # TODO: Match against published flows with telegram trigger
        # For now, dispatch to background task
        process_webhook_task.delay("telegram", {"text": text, "chat_id": chat_id, "raw": payload})

    @staticmethod
    async def process_mercadopago_payment(payment_id: str, payload: dict):
        """
        Handle MercadoPago payment confirmation.
        Dispatches to Celery task que processa o ledger de forma assíncrona e
        com retry automático em caso de falha transitória.
        """
        logger.info(f"💳 Despachando pagamento MP para processamento: {payment_id}")
        # Import lazy para evitar circular em startup
        from app.workers.tasks import process_payment_webhook_task
        process_payment_webhook_task.delay("mercadopago", payment_id, payload)

    @staticmethod
    async def process_custom(token: str, payload: dict):
        """Handle custom webhook by token — find and resume matching execution."""
        logger.info(f"Custom webhook token={token}")
        process_webhook_task.delay(f"custom_{token}", payload)
