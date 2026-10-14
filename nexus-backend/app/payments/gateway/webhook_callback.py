"""
NEXUS.IA — Gateway Webhook Callback Service (TASK 8.1)

Notifica clientes da Open Gateway API sobre mudanças de status
em cobranças via webhook HTTPS com assinatura HMAC-SHA256.

Fluxo:
1. Status da cobrança muda (pending → paid / expired / cancelled)
2. Sistema busca webhook_url configurado na API key / company
3. Envia POST com payload assinado
4. Registra resultado no audit log

Segurança:
- Payload assinado com HMAC-SHA256 (header X-Webhook-Signature)
- Retry com backoff exponencial (3 tentativas)
- Timeout de 10s por tentativa
- Non-blocking: nunca interrompe a operação principal
"""
import hashlib
import hmac
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
from loguru import logger


# ── Constants ────────────────────────────────────────────────────────────────

MAX_RETRIES = 3
RETRY_DELAYS = [1, 5, 15]  # seconds (backoff exponencial)
TIMEOUT_SECONDS = 10


# ── HMAC Signing ─────────────────────────────────────────────────────────────

def sign_payload(payload: dict, secret: str) -> str:
    """
    Gera assinatura HMAC-SHA256 do payload.
    O cliente valida recalculando: hmac(sha256, body_raw, webhook_secret)
    """
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        secret.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


# ── Webhook Dispatcher ──────────────────────────────────────────────────────

async def dispatch_webhook(
    webhook_url: str,
    webhook_secret: str,
    event_type: str,
    payload: dict,
    company_id: int,
    charge_id: Optional[int] = None,
) -> dict:
    """
    Envia webhook com retry e backoff exponencial.

    Returns dict com resultado:
        {"delivered": True/False, "attempts": N, "status_code": 200, "error": None}
    """
    if not webhook_url:
        return {"delivered": False, "attempts": 0, "error": "no_webhook_url"}

    # Montar payload completo
    full_payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }

    # Assinar
    signature = sign_payload(full_payload, webhook_secret)

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Event": event_type,
        "User-Agent": "SmartMoon-Gateway/1.0",
    }

    result = {"delivered": False, "attempts": 0, "status_code": None, "error": None}

    for attempt in range(MAX_RETRIES):
        result["attempts"] = attempt + 1
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                resp = await client.post(
                    webhook_url,
                    json=full_payload,
                    headers=headers,
                )
                result["status_code"] = resp.status_code

                if 200 <= resp.status_code < 300:
                    result["delivered"] = True
                    logger.info(
                        f"✅ Webhook entregue: {event_type} → {webhook_url} "
                        f"(attempt={attempt+1}, status={resp.status_code})"
                    )
                    return result
                else:
                    logger.warning(
                        f"⚠️ Webhook resposta não-2xx: {resp.status_code} "
                        f"(attempt={attempt+1}/{MAX_RETRIES})"
                    )

        except httpx.TimeoutException:
            result["error"] = f"timeout_attempt_{attempt+1}"
            logger.warning(f"⏱️ Webhook timeout: {webhook_url} (attempt={attempt+1})")
        except httpx.ConnectError as e:
            result["error"] = f"connection_error: {str(e)[:100]}"
            logger.warning(f"🔌 Webhook connection error: {e}")
        except Exception as e:
            result["error"] = f"unexpected: {str(e)[:200]}"
            logger.error(f"❌ Webhook dispatch error: {e}")

        # Retry delay (exceto na última tentativa)
        if attempt < MAX_RETRIES - 1:
            delay = RETRY_DELAYS[attempt] if attempt < len(RETRY_DELAYS) else RETRY_DELAYS[-1]
            await asyncio.sleep(delay)

    logger.error(
        f"❌ Webhook falhou após {MAX_RETRIES} tentativas: "
        f"{event_type} → {webhook_url} | company={company_id}"
    )
    return result


# ── Convenience: Fire-and-Forget ─────────────────────────────────────────────

def fire_webhook(
    webhook_url: str,
    webhook_secret: str,
    event_type: str,
    payload: dict,
    company_id: int,
    charge_id: Optional[int] = None,
) -> None:
    """
    Dispara webhook de forma non-blocking (fire-and-forget).
    Não interrompe a operação principal mesmo se o webhook falhar.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(
                dispatch_webhook(
                    webhook_url=webhook_url,
                    webhook_secret=webhook_secret,
                    event_type=event_type,
                    payload=payload,
                    company_id=company_id,
                    charge_id=charge_id,
                )
            )
        else:
            loop.run_until_complete(
                dispatch_webhook(
                    webhook_url=webhook_url,
                    webhook_secret=webhook_secret,
                    event_type=event_type,
                    payload=payload,
                    company_id=company_id,
                    charge_id=charge_id,
                )
            )
    except Exception as e:
        logger.error(f"❌ fire_webhook failed to schedule: {e}")


# ── Event Helpers ────────────────────────────────────────────────────────────

def build_charge_event(charge, event_type: str = "charge.updated") -> dict:
    """
    Constrói payload de evento de cobrança para webhook.

    event_type: charge.created | charge.paid | charge.expired | charge.cancelled
    """
    return {
        "event": event_type,
        "charge": {
            "id": charge.id,
            "status": charge.status.value if hasattr(charge.status, 'value') else str(charge.status),
            "amount": f"{charge.amount:.2f}" if charge.amount else "0.00",
            "description": charge.description,
            "created_at": charge.created_at.isoformat() if charge.created_at else None,
        },
    }
