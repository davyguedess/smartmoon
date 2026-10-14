"""
Webhook Delivery — Entrega assíncrona para clientes externos.

Quando uma mensagem chega no WhatsApp do cliente,
processamos internamente (IA, DB) E entregamos no webhook dele.

Usa Celery com retry exponencial — falha no servidor do cliente
não afeta o processamento interno.
"""
import httpx
from loguru import logger
from app.workers.celery_app import celery_app


@celery_app.task(
    name="deliver_external_webhook",
    bind=True,
    max_retries=5,
    soft_time_limit=30,
    time_limit=45,
)
def deliver_external_webhook(self, webhook_url: str, payload: dict):
    """
    Entrega POST no webhook_url do cliente com retry exponencial.
    Tentativas: imediata → 10s → 20s → 40s → 80s → 160s

    O cliente recebe:
    POST {webhook_url}
    Headers: X-SmartMoon-Event: message.received
    Body: {
      "event":    "message.received",
      "instance": "suporte",
      "data": {
        "phone":     "5511999998888",
        "name":      "João Silva",
        "type":      "text",
        "text":      "Olá!",
        "timestamp": 1234567890000
      }
    }
    """
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                webhook_url,
                json=payload,
                headers={
                    "Content-Type":       "application/json",
                    "X-SmartMoon-Event":  payload.get("event", "message"),
                    "X-SmartMoon-Source": "smartmoon-engine",
                },
            )
            # 2xx = sucesso, 4xx = erro do cliente (não retry), 5xx = retry
            if resp.status_code >= 500:
                raise Exception(f"Servidor do cliente retornou {resp.status_code}")

            logger.info(f"✅ Webhook entregue → {webhook_url} [{resp.status_code}]")

    except httpx.TimeoutException:
        countdown = 10 * (2 ** self.request.retries)
        logger.warning(f"⏱ Timeout no webhook {webhook_url} — retry em {countdown}s")
        raise self.retry(exc=Exception("Timeout"), countdown=countdown)

    except Exception as exc:
        countdown = 10 * (2 ** self.request.retries)
        logger.warning(f"🔁 Retry webhook {webhook_url} em {countdown}s: {exc}")
        raise self.retry(exc=exc, countdown=countdown)
