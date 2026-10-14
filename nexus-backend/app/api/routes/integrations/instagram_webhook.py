"""
Instagram DM Webhook — Receive inbound messages and status updates from Meta.

Endpoints:
  GET  /webhook/instagram  → Webhook verification (Meta challenge)
  POST /webhook/instagram  → Receive messages, reactions, reads

Meta sends webhooks for:
  - messages: text, image, video, story_reply, story_mention
  - messaging_postbacks: quick reply taps
  - message_reads: read receipts
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Query
from loguru import logger
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Integration
from app.models.instagram_models import InstagramConversation, InstagramMessage
from app.core.config import settings

router = APIRouter(tags=["Instagram Webhook"])

VERIFY_TOKEN = getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "smartmoon-ig-verify-2026")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Webhook Verification (GET)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/webhook/instagram")
async def instagram_webhook_verify(
    request: Request,
):
    """Meta webhook verification challenge.

    Meta sends:
      GET /webhook/instagram?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=yyy
    We must return hub.challenge if verify_token matches.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("✅ Instagram webhook verified")
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=challenge)

    logger.warning(f"❌ Instagram webhook verification failed: mode={mode}, token={token}")
    raise HTTPException(status_code=403, detail="Verification failed")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Webhook Receiver (POST)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/webhook/instagram")
async def instagram_webhook_receive(request: Request):
    """Receive inbound Instagram messages from Meta.

    Payload format:
    {
      "object": "instagram",
      "entry": [{
        "id": "page_id",
        "time": 1234567890,
        "messaging": [{
          "sender": {"id": "igsid_sender"},
          "recipient": {"id": "ig_user_id"},
          "timestamp": 1234567890000,
          "message": {
            "mid": "m_xxx",
            "text": "Hello!",
            "attachments": [{"type": "image", "payload": {"url": "..."}}]
          }
        }]
      }]
    }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    obj = body.get("object")
    if obj != "instagram":
        logger.debug(f"Instagram webhook: ignoring object={obj}")
        return {"status": "ok"}

    entries = body.get("entry", [])
    for entry in entries:
        page_id = entry.get("id")
        messaging_events = entry.get("messaging", [])

        for event in messaging_events:
            sender_id = event.get("sender", {}).get("id")
            recipient_id = event.get("recipient", {}).get("id")
            timestamp = event.get("timestamp", 0)

            # Message event
            message = event.get("message")
            if message and sender_id:
                await _process_instagram_inbound(
                    page_id=page_id,
                    sender_id=sender_id,
                    recipient_id=recipient_id,
                    message=message,
                    timestamp=timestamp,
                )

            # Read receipt
            read = event.get("read")
            if read:
                await _process_read_receipt(sender_id, read)

            # Postback (quick reply button tap)
            postback = event.get("postback")
            if postback and sender_id:
                await _process_instagram_inbound(
                    page_id=page_id,
                    sender_id=sender_id,
                    recipient_id=recipient_id,
                    message={"mid": f"pb_{timestamp}", "text": postback.get("payload", "")},
                    timestamp=timestamp,
                )

    return {"status": "ok"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Internal processing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def _process_instagram_inbound(
    page_id: str,
    sender_id: str,
    recipient_id: str,
    message: dict,
    timestamp: int,
):
    """Process an inbound Instagram DM. Same pipeline as SmartMoon WhatsApp."""
    mid = message.get("mid", "")
    text = message.get("text", "")
    attachments = message.get("attachments", [])

    # Determine message type
    msg_type = "text"
    media_url = None
    media_mime = None

    if attachments:
        att = attachments[0]
        att_type = att.get("type", "")
        payload = att.get("payload", {})
        media_url = payload.get("url")

        if att_type == "image":
            msg_type = "image"
            media_mime = "image/jpeg"
        elif att_type == "video":
            msg_type = "video"
            media_mime = "video/mp4"
        elif att_type == "audio":
            msg_type = "audio"
            media_mime = "audio/mp4"
        elif att_type == "story_mention":
            msg_type = "story_mention"
        elif att_type == "share":
            msg_type = "share"

    # Check for story reply
    reply_to = message.get("reply_to")
    if reply_to and reply_to.get("story"):
        msg_type = "story_reply"

    logger.info(
        f"📥 Instagram DM from {sender_id}: [{msg_type}] {text[:80]}"
    )

    async with AsyncSessionLocal() as db:
        # Find Instagram integration by page_id or recipient_id (ig_user_id)
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "instagram_dm",
            )
        )
        integration = None
        for intg in result.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("page_id") == page_id or cfg.get("ig_user_id") == recipient_id:
                integration = intg
                break

        if not integration:
            logger.warning(f"No Instagram integration found for page_id={page_id}")
            return

        # Get or create conversation
        conv_result = await db.execute(
            select(InstagramConversation).where(
                InstagramConversation.ig_user_id == sender_id,
                InstagramConversation.integration_id == integration.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()

        if not conversation:
            # Try to get sender profile
            cfg = integration.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)

            conversation = InstagramConversation(
                company_id=integration.company_id,
                integration_id=integration.id,
                ig_user_id=sender_id,
                status="active",
                last_message_at=datetime.now(timezone.utc),
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            if conversation.status == "closed":
                conversation.status = "active"

        # Check for duplicate message
        if mid:
            dup = await db.execute(
                select(InstagramMessage).where(InstagramMessage.ig_message_id == mid)
            )
            if dup.scalar_one_or_none():
                logger.debug(f"Duplicate Instagram message {mid} — skipping")
                return

        # Save message
        ig_msg = InstagramMessage(
            conversation_id=conversation.id,
            direction="inbound",
            sender_type="user",
            message_type=msg_type,
            content_text=text or None,
            content_json=message,
            media_url=media_url,
            media_mime=media_mime,
            ig_message_id=mid,
        )
        db.add(ig_msg)
        await db.commit()

        # Enqueue for flow processing
        if conversation.status != "human_takeover" and text:
            try:
                from app.workers.channel_worker import enqueue_channel_message
                await enqueue_channel_message(
                    db, conversation.id, text, "instagram"
                )
            except Exception as e:
                logger.error(f"Failed to enqueue Instagram message: {e}")


async def _process_read_receipt(sender_id: str, read: dict):
    """Update delivery status for read receipts."""
    watermark = read.get("watermark", 0)
    logger.debug(f"Instagram read receipt from {sender_id} at {watermark}")
    # TODO: Update delivery_status of messages before watermark timestamp
