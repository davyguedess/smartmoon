"""
Z-API Webhook Routes — Receive messages and status updates from Z-API.

Endpoints:
  POST /webhook/zapi/{instance_id}/receive  → Inbound messages + status updates
  POST /webhook/zapi/{instance_id}/status   → Instance connection status changes

Z-API webhook payload format is different from Meta Cloud API:
- Messages come as flat objects with `phone`, `text.message`, `type`, etc.
- Status updates include delivery/read receipts.
- Connection status notifies when instance connects/disconnects.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from loguru import logger
from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models import Integration
from app.models.whatsapp_models import WhatsAppConversation, WhatsAppMessage
from app.services.zapi_client import ZAPIClient

router = APIRouter(tags=["Z-API Webhook"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  WEBHOOK — Receive Messages from Z-API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/webhook/zapi/{instance_id}/receive")
async def zapi_webhook_receive(instance_id: str, request: Request):
    """
    Receive inbound messages from Z-API.

    Z-API sends a POST with format:
    {
        "phone": "5511999998888",
        "instanceId": "xxx",
        "messageId": "xxx",
        "fromMe": false,
        "momment": 1234567890000,
        "type": "ReceivedCallback",
        "text": { "message": "Hello!" },
        "senderName": "John",
        "photo": "https://...",
        "isGroup": false,
        ...
    }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Validate instance
    received_instance_id = body.get("instanceId", instance_id)
    callback_type = body.get("type", "")

    # Skip non-message callbacks (status events handled on /status endpoint)
    if callback_type not in (
        "ReceivedCallback",
        "MessageStatusCallback",
    ):
        logger.debug(f"Z-API callback type={callback_type} ignored for instance={instance_id}")
        return {"status": "ok", "ignored": callback_type}

    if callback_type == "MessageStatusCallback":
        await _process_zapi_status_update(body)
        return {"status": "ok"}

    # It's an inbound message
    if body.get("fromMe", False):
        # Outbound echo — skip
        logger.debug(f"Z-API outbound echo from instance={instance_id}, skipping")
        return {"status": "ok", "skipped": "fromMe"}

    await _process_zapi_inbound_message(received_instance_id, body)
    return {"status": "ok"}


@router.post("/webhook/zapi/{instance_id}/status")
async def zapi_webhook_status(instance_id: str, request: Request):
    """
    Receive Z-API instance connection status changes.

    Payload: { "connected": true/false, "smartphoneConnected": true/false, ... }
    Z-API sends connected=false when the web session expires but the WhatsApp
    smartphone link is still active — we use smartphoneConnected as truth.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # "smartphoneConnected" = WhatsApp phone is linked (the real signal).
    # "connected" alone can be false just because the web session expired.
    smartphone_ok = body.get("smartphoneConnected", False)
    session_ok = body.get("connected", False)
    connected = smartphone_ok or session_ok

    logger.info(
        f"📡 Z-API instance {instance_id} — "
        f"connected={session_ok} smartphoneConnected={smartphone_ok} → "
        f"marking as {'connected' if connected else 'disconnected'}"
    )

    # Update integration status in DB
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "zapi",
            )
        )
        for intg in result.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("instance_id") == instance_id:
                intg.status = "connected" if connected else "disconnected"
                await db.commit()
                logger.info(f"✅ Z-API integration #{intg.id} status → {intg.status}")
                break

    return {"status": "ok"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Internal processing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def _process_zapi_inbound_message(instance_id: str, body: dict):
    """Parse and persist an inbound Z-API message, then enqueue for processing."""
    phone = body.get("phone", "")
    message_id = body.get("messageId", "")
    sender_name = body.get("senderName", "")
    is_group = body.get("isGroup", False)
    timestamp = body.get("momment", 0)

    # Extract content based on Z-API message structure
    msg_type = "text"
    content_text = ""
    content_json = {}
    media_url = None
    media_mime = None

    # Text message
    if body.get("text"):
        content_text = body["text"].get("message", "")
        msg_type = "text"

    # Image
    elif body.get("image"):
        img = body["image"]
        content_text = img.get("caption", "")
        media_url = img.get("imageUrl") or img.get("url", "")
        media_mime = img.get("mimeType", "image/jpeg")
        content_json = img
        msg_type = "image"

    # Audio
    elif body.get("audio"):
        aud = body["audio"]
        media_url = aud.get("audioUrl") or aud.get("url", "")
        media_mime = aud.get("mimeType", "audio/ogg")
        content_json = aud
        msg_type = "audio"

    # Video
    elif body.get("video"):
        vid = body["video"]
        content_text = vid.get("caption", "")
        media_url = vid.get("videoUrl") or vid.get("url", "")
        media_mime = vid.get("mimeType", "video/mp4")
        content_json = vid
        msg_type = "video"

    # Document
    elif body.get("document"):
        doc = body["document"]
        content_text = doc.get("fileName", "")
        media_url = doc.get("documentUrl") or doc.get("url", "")
        media_mime = doc.get("mimeType", "application/octet-stream")
        content_json = doc
        msg_type = "document"

    # Location
    elif body.get("location"):
        loc = body["location"]
        content_text = f"📍 {loc.get('name', 'Location')}: {loc.get('latitude')}, {loc.get('longitude')}"
        content_json = loc
        msg_type = "location"

    # Contact
    elif body.get("contact"):
        contact = body["contact"]
        content_text = f"👤 {contact.get('displayName', 'Contact')}"
        content_json = contact
        msg_type = "contacts"

    # Sticker
    elif body.get("sticker"):
        sticker = body["sticker"]
        media_url = sticker.get("stickerUrl") or sticker.get("url", "")
        content_json = sticker
        msg_type = "sticker"

    # Reaction
    elif body.get("reaction"):
        reaction = body["reaction"]
        content_text = reaction.get("value", "")
        content_json = reaction
        msg_type = "reaction"

    else:
        # Unknown type — store raw
        content_json = body
        msg_type = body.get("type", "unknown")

    logger.info(f"📥 Z-API inbound from {phone} ({sender_name}): [{msg_type}] {content_text[:80]}")

    async with AsyncSessionLocal() as db:
        # Find integration for this instance_id
        # NOTE: Don't filter by status here — messages can arrive even during
        # a brief disconnect/reconnect cycle. The instance_id match is sufficient.
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "zapi",
            )
        )
        integration = None
        for intg in result.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("instance_id") == instance_id:
                integration = intg
                break

        if not integration:
            logger.warning(f"No Z-API integration found for instance_id={instance_id}")
            return


        # Get or create conversation (same pattern as Meta Cloud API)
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
                display_name=sender_name or None,
                profile_pic_url=body.get("photo"),
                status="active",
                last_message_at=datetime.now(timezone.utc),
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            if conversation.status == "closed":
                conversation.status = "active"
            if sender_name and not conversation.display_name:
                conversation.display_name = sender_name
            if body.get("photo") and not conversation.profile_pic_url:
                conversation.profile_pic_url = body["photo"]

        # Save message
        wa_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="inbound",
            sender_type="user",
            message_type=msg_type,
            content_text=content_text or None,
            content_json=content_json or None,
            media_url=media_url,
            media_mime=media_mime,
            wamid=message_id,
        )
        db.add(wa_msg)
        await db.commit()

        # Mark as read in Z-API
        cfg = integration.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        if message_id:
            try:
                await ZAPIClient.read_message(
                    cfg["instance_id"],
                    cfg["instance_token"],
                    cfg["client_token"],
                    phone,
                    message_id,
                )
            except Exception:
                pass  # Non-critical

        # Enqueue for flow processing (if not in human_takeover)
        if conversation.status != "human_takeover" and content_text:
            try:
                from app.workers.channel_worker import enqueue_channel_message
                await enqueue_channel_message(
                    db, conversation.id, content_text, "whatsapp"
                )
            except Exception as e:
                logger.error(f"Failed to enqueue Z-API message: {e}")


async def _process_zapi_status_update(body: dict):
    """Update message delivery status from Z-API.

    Z-API status callback:
    {
        "messageId": "xxx",
        "status": "DELIVERED" | "READ" | "PLAYED",
        "phone": "5511...",
        ...
    }
    """
    message_id = body.get("messageId", "") or body.get("id", {}).get("id", "")
    new_status = body.get("status", "").lower()

    # Map Z-API statuses → our internal statuses
    status_map = {
        "sent": "sent",
        "delivered": "delivered",
        "read": "read",
        "played": "read",
        "failed": "failed",
        "error": "failed",
        "deleted": "deleted",
    }
    mapped_status = status_map.get(new_status, new_status)

    if not message_id or not mapped_status:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WhatsAppMessage).where(WhatsAppMessage.wamid == message_id)
        )
        msg = result.scalar_one_or_none()
        if msg:
            msg.delivery_status = mapped_status
            await db.commit()
            logger.debug(f"📬 Z-API status update: {message_id} → {mapped_status}")
