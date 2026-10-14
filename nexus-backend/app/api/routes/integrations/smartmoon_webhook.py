"""
SmartMoon Engine Webhook Routes — Receive messages and status updates
from the SmartMoon WhatsApp Engine (Node.js microservice).

Endpoints:
  POST /webhook/smartmoon/{instance_id}/receive  → Inbound messages
  POST /webhook/smartmoon/{instance_id}/status   → Connection status changes

These endpoints are called by the SmartMoon Engine internally via Docker network.
They are NOT public — protected by X-API-Key header validation.

The payload format is normalized by the engine to match our internal schema,
so we can reuse 100% of the existing channel_worker pipeline.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db.session import AsyncSessionLocal
from app.models import Integration
from app.models.whatsapp_models import WhatsAppConversation, WhatsAppMessage
from app.core.config import settings

router = APIRouter(tags=["SmartMoon Webhook"])


def _validate_api_key(request: Request) -> bool:
    """Validate internal API key from SmartMoon Engine."""
    expected = getattr(settings, "SMARTMOON_ENGINE_KEY", "smartmoon-dev-key")
    received = request.headers.get("X-API-Key", "")
    return received == expected


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  WEBHOOK — Receive Messages from SmartMoon Engine
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/webhook/smartmoon/{instance_id}/receive")
async def smartmoon_webhook_receive(instance_id: str, request: Request):
    """
    Receive inbound messages from SmartMoon Engine.

    Engine payload format:
    {
        "event": "messages.upsert",
        "instance": "instance-abc",
        "data": {
            "phone": "5511999998888",
            "messageId": "xxx",
            "pushName": "John",
            "isGroup": false,
            "type": "text",
            "text": "Hello!",
            "mediaPath": "/data/media/instance-abc/xxx.jpg",  // file path, NOT base64
            "mediaMime": "image/jpeg",
            "contentJson": {},
            "timestamp": 1234567890000
        }
    }
    """
    if not _validate_api_key(request):
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = body.get("event", "")
    data = body.get("data", {})

    if event != "messages.upsert":
        logger.debug(f"SmartMoon event={event} ignored for instance={instance_id}")
        return {"status": "ok", "ignored": event}

    phone = data.get("phone", "")
    if not phone:
        return {"status": "ok", "skipped": "no phone"}

    await _process_smartmoon_inbound(instance_id, data)
    return {"status": "ok"}


@router.post("/webhook/smartmoon/{instance_id}/status")
async def smartmoon_webhook_status(instance_id: str, request: Request):
    """
    Receive connection status changes from SmartMoon Engine.

    Payload:
    {
        "event": "connection.update",
        "instance": "instance-abc",
        "data": {
            "status": "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT",
            "phoneNumber": "5511999998888",
            "pushName": "John",
            "timestamp": 1234567890000
        }
    }

    This is the critical event that keeps the Python DB in sync with
    the actual WhatsApp connection state — solving the "phantom connected"
    problem where the panel shows connected but the instance is dead.
    """
    if not _validate_api_key(request):
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    data = body.get("data", {})
    status = data.get("status", "").upper()
    phone_number = data.get("phoneNumber", "")
    push_name = data.get("pushName", "")

    # Map engine status → our DB status
    status_map = {
        "CONNECTED": "connected",
        "DISCONNECTED": "disconnected",
        "LOGGED_OUT": "disconnected",
        "ERROR": "disconnected",
        "QR_READY": "pending",
        "INITIALIZING": "pending",
        "CONNECTING": "pending",
    }
    db_status = status_map.get(status, "disconnected")

    logger.info(
        f"📡 SmartMoon instance {instance_id} → {status} "
        f"(phone={phone_number}, name={push_name})"
    )

    # Update integration status in DB
    # NOTE: We scan all companies since the webhook doesn't carry company_id.
    # This is safe because instance_id is unique globally (users choose it).
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "smartmoon",
            )
        )
        for intg in result.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("instance_id") == instance_id:
                intg.status = db_status
                # Update phone/name if newly connected
                if db_status == "connected" and phone_number:
                    cfg["display_phone"] = phone_number
                    cfg["push_name"] = push_name
                    intg.config_json = cfg
                    # flag_modified required for SQLAlchemy to detect JSONB mutation
                    flag_modified(intg, "config_json")
                await db.commit()
                logger.info(f"✅ SmartMoon integration #{intg.id} status → {db_status}")
                break

    return {"status": "ok"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Internal processing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def _process_smartmoon_inbound(instance_id: str, data: dict):
    """Parse SmartMoon Engine payload and persist as WhatsAppMessage.

    Uses the exact same pattern as Z-API webhook processing:
    1. Find integration by instance_id
    2. Get or create conversation
    3. Save message
    4. Enqueue for flow processing
    """
    phone = data.get("phone", "")
    message_id = data.get("messageId", "")
    push_name = data.get("pushName", "")
    is_group = data.get("isGroup", False)
    msg_type = data.get("type", "text")
    content_text = data.get("text", "")
    media_path = data.get("mediaPath")  # File path on shared volume
    media_mime = data.get("mediaMime")
    content_json = data.get("contentJson", {})
    timestamp = data.get("timestamp", 0)

    logger.info(
        f"📥 SmartMoon inbound from {phone} ({push_name}): "
        f"[{msg_type}] {content_text[:80]}"
    )

    async with AsyncSessionLocal() as db:
        # FIX: busca direta via índice — evita full scan em todas as integrações
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import JSONB
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "smartmoon",
                Integration.config_json["instance_id"].astext == instance_id,
                Integration.status == "connected",
            ).order_by(Integration.id.desc())
        )
        integration = result.scalars().first()  # safe against duplicates

        if not integration:
            logger.warning(
                f"No SmartMoon integration found for instance_id={instance_id}"
            )
            return

        # Get or create conversation (same pattern as Z-API)
        conv_result = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.wa_id == phone,
                WhatsAppConversation.integration_id == integration.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()

        if not conversation:
            conversation = WhatsAppConversation(
                company_id=integration.company_id,
                integration_id=integration.id,
                wa_id=phone,
                phone_number=f"+{phone}" if phone else None,
                display_name=push_name or None,
                status="active",
                last_message_at=datetime.now(timezone.utc),
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            if conversation.status == "closed":
                conversation.status = "active"
            if push_name and not conversation.display_name:
                conversation.display_name = push_name

        # Save message
        # NOTE: media_url stores the FILE PATH (not a URL) when from SmartMoon.
        # The Python backend reads the file directly from the shared volume.
        wa_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="inbound",
            sender_type="user",
            message_type=msg_type,
            content_text=content_text or None,
            content_json=content_json or None,
            media_url=media_path,  # Shared volume path
            media_mime=media_mime,
            wamid=message_id,
        )
        db.add(wa_msg)

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        #  CRM Bridge — Auto-create contact + record interaction
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try:
            from app.models.crm_models import CRMContact, CRMInteraction

            # Normalize phone for CRM lookup
            crm_phone = phone.lstrip("+")

            # Get or create CRM contact
            crm_result = await db.execute(
                select(CRMContact).where(
                    CRMContact.company_id == integration.company_id,
                    CRMContact.phone == crm_phone,
                )
            )
            crm_contact = crm_result.scalar_one_or_none()

            if not crm_contact:
                crm_contact = CRMContact(
                    company_id=integration.company_id,
                    phone=crm_phone,
                    name=push_name or f"WhatsApp {crm_phone[-4:]}",
                    push_name=push_name,
                    source="whatsapp_inbound",
                    status="active",
                    tags=[],
                    last_contact_at=datetime.now(timezone.utc),
                )
                db.add(crm_contact)
                await db.flush()
                logger.info(f"📇 CRM auto-created contact: {push_name} ({crm_phone})")
            else:
                crm_contact.last_contact_at = datetime.now(timezone.utc)
                if push_name and not crm_contact.push_name:
                    crm_contact.push_name = push_name
                if push_name and (not crm_contact.name or crm_contact.name.startswith("WhatsApp ")):
                    crm_contact.name = push_name

            # Record inbound interaction
            db.add(CRMInteraction(
                company_id=integration.company_id,
                contact_id=crm_contact.id,
                interaction_type="message_received",
                channel="whatsapp",
                content=content_text[:2000] if content_text else f"[{msg_type}]",
            ))
        except Exception as crm_err:
            logger.warning(f"CRM bridge error (non-blocking): {crm_err}")

        await db.commit()

        # Enqueue for flow/agent processing (if not in human_takeover)
        # Text, audio and image messages are processed (image → OCR/análise no worker)
        if conversation.status != "human_takeover" and (
            content_text or msg_type in ("audio", "image")
        ):
            try:
                from app.workers.channel_worker import enqueue_channel_message
                await enqueue_channel_message(
                    db, conversation.id, content_text or "", "whatsapp",
                    group_id=(phone + "@g.us") if is_group else None,
                    integration_id=integration.id,
                    media_path=media_path if msg_type in ("audio", "image") else None,
                    msg_type=msg_type,
                )
            except Exception as e:
                logger.error(f"Failed to enqueue SmartMoon message: {e}")

        # Fanout: entrega ao webhook externo do cliente (se configurado)
        external_url = getattr(integration, "external_webhook_url", None)
        if external_url:
            try:
                from app.services.webhook_delivery import deliver_external_webhook
                # Remove namespace company_id do instance_id para o cliente
                display_name = instance_id.split("-", 1)[-1] if "-" in instance_id else instance_id
                external_payload = {
                    "event":    "message.received",
                    "instance": display_name,
                    "data": {
                        "phone":     phone,
                        "name":      push_name,
                        "type":      msg_type,
                        "text":      content_text,
                        "timestamp": timestamp,
                    },
                }
                # Enfileira — NÃO bloqueia o processamento interno
                deliver_external_webhook.delay(external_url, external_payload)
                logger.debug(f"Fanout enqueued → {external_url}")
            except Exception as e:
                logger.warning(f"Failed to enqueue external webhook: {e}")
