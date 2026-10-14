"""Webhook signature validation — Protocol 4.

Validates HMAC-SHA256 signatures for incoming webhooks from external providers.
Prevents replay attacks (timestamp check), enforces idempotency (event ID check).

Usage:
    from app.utils.webhook_security import validate_webhook

    @router.post("/webhooks/{provider}")
    async def receive(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
        await validate_webhook(provider, request, db)
        ...
"""
import hashlib
import hmac
import time
from typing import Optional
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from app.core.config import settings
from app.models import WebhookEvent


# ── Provider-specific signature config ──────────────
def _get_secret(provider: str) -> Optional[str]:
    """Return the webhook secret for a provider from .env config."""
    secrets = {
        "telegram": settings.TELEGRAM_WEBHOOK_SECRET,
        "mercadopago": settings.MERCADOPAGO_WEBHOOK_SECRET,
        "whatsapp": settings.WHATSAPP_API_KEY,  # Evolution API uses apikey as HMAC
        "meta": settings.META_APP_SECRET,
    }
    return secrets.get(provider) or None


def _compute_hmac(secret: str, body: bytes) -> str:
    """Compute HMAC-SHA256 hex digest."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _extract_signature(provider: str, headers: dict) -> Optional[str]:
    """Extract the signature from provider-specific headers."""
    header_map = {
        "telegram": "X-Telegram-Bot-Api-Secret-Token",
        "mercadopago": "X-Signature",
        "whatsapp": "X-Hub-Signature-256",
        "meta": "X-Hub-Signature-256",
    }
    header_name = header_map.get(provider, "X-Signature")
    sig = headers.get(header_name.lower()) or headers.get(header_name)
    # Some providers prefix with "sha256="
    if sig and sig.startswith("sha256="):
        sig = sig[7:]
    return sig


def _extract_timestamp(provider: str, headers: dict) -> Optional[int]:
    """Extract request timestamp for anti-replay check."""
    ts_header = headers.get("x-request-timestamp") or headers.get("x-timestamp")
    if ts_header:
        try:
            return int(ts_header)
        except (ValueError, TypeError):
            return None
    return None


def _extract_event_id(provider: str, body: dict) -> Optional[str]:
    """Extract unique event ID for idempotency."""
    if provider == "telegram":
        return str(body.get("update_id", ""))
    if provider == "mercadopago":
        return body.get("id") or body.get("data", {}).get("id")
    if provider in ("whatsapp", "meta"):
        entries = body.get("entry", [{}])
        if entries:
            return entries[0].get("id")
    return body.get("event_id") or body.get("id")


# ── Anti-replay window (5 minutes) ─────────────────
MAX_TIMESTAMP_AGE = 300  # seconds


async def validate_webhook(
    provider: str,
    request: Request,
    db: AsyncSession,
) -> dict:
    """Validate incoming webhook: signature + anti-replay + idempotency.

    Returns the parsed body on success.
    Raises HTTPException on any validation failure.
    """
    body_bytes = await request.body()
    try:
        body = await request.json()
    except Exception:
        body = {}

    headers = dict(request.headers)

    # 1. Signature validation (if secret is configured)
    secret = _get_secret(provider)
    if secret:
        signature = _extract_signature(provider, headers)
        if not signature:
            logger.warning(f"🔴 Webhook {provider}: missing signature header")
            raise HTTPException(status_code=401, detail="Missing webhook signature")

        # Telegram uses simple token comparison, not HMAC
        if provider == "telegram":
            if signature != secret:
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        else:
            expected = _compute_hmac(secret, body_bytes)
            if not hmac.compare_digest(expected, signature):
                logger.warning(f"🔴 Webhook {provider}: signature mismatch")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning(f"⚠️ Webhook {provider}: no secret configured — skipping signature validation")

    # 2. Anti-replay (skip if no timestamp header)
    ts = _extract_timestamp(provider, headers)
    if ts:
        age = abs(int(time.time()) - ts)
        if age > MAX_TIMESTAMP_AGE:
            logger.warning(f"🔴 Webhook {provider}: timestamp too old ({age}s)")
            raise HTTPException(status_code=400, detail="Webhook timestamp expired (replay attack?)")

    # 3. Idempotency — check if we already processed this event
    event_id = _extract_event_id(provider, body)
    if event_id:
        existing = await db.execute(
            select(WebhookEvent).where(
                WebhookEvent.provider == provider,
                WebhookEvent.external_event_id == str(event_id),
            )
        )
        if existing.scalar_one_or_none():
            logger.info(f"♻️ Webhook {provider}: duplicate event {event_id} — skipping")
            raise HTTPException(status_code=200, detail="Duplicate event — already processed")

    logger.info(f"✅ Webhook {provider} validated (event_id={event_id})")
    return body
