"""
WhatsApp Cloud API Routes — Webhook + Multi-Number Management + Conversations.

Endpoints:
  Webhook:
    GET  /webhook/whatsapp/{phone_id}/receive   → Meta challenge verification
    POST /webhook/whatsapp/{phone_id}/receive   → Receive messages + status updates

  Multi-Number Management:
    GET    /whatsapp/numbers                    → List connected numbers
    POST   /whatsapp/numbers                    → Add new number
    PATCH  /whatsapp/numbers/{id}/connect-flow  → Connect flow to number
    DELETE /whatsapp/numbers/{id}               → Remove number

  Conversations:
    GET  /whatsapp/conversations                → List conversations
    GET  /whatsapp/conversations/{id}/messages  → Message history
    POST /whatsapp/conversations/{id}/send      → Send manual message
    POST /whatsapp/conversations/{id}/handoff   → Human takeover
    POST /whatsapp/conversations/{id}/resume    → Resume bot
    GET  /whatsapp/stats                        → Channel metrics
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Query, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select, func, update, text, desc
from typing import Optional

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import AsyncSessionLocal, get_db
from app.models import Integration
from app.models.whatsapp_models import WhatsAppConversation, WhatsAppMessage
from app.services.whatsapp_cloud import WhatsAppCloudClient
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["WhatsApp"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  WEBHOOK — Meta Verification & Message Receiving
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/webhook/whatsapp/{phone_id}/receive")
async def whatsapp_webhook_verify(
    phone_id: str,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification (subscribe)."""
    if hub_mode == "subscribe":
        # Check against global verify token or per-number token
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Integration).where(
                    Integration.provider == "whatsapp_cloud",
                    Integration.status == "connected",
                )
            )
            integrations = result.scalars().all()

            # Check per-number verify_token
            for intg in integrations:
                cfg = intg.config_json or {}
                if isinstance(cfg, str):
                    cfg = json.loads(cfg)
                if cfg.get("phone_number_id") == phone_id:
                    if hub_verify_token == cfg.get("verify_token", settings.WHATSAPP_VERIFY_TOKEN):
                        logger.info(f"✅ WhatsApp webhook verified for phone_id={phone_id}")
                        return int(hub_challenge)

        # Fallback to global verify token
        if hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
            logger.info(f"✅ WhatsApp webhook verified (global token) for phone_id={phone_id}")
            return int(hub_challenge)

        logger.warning(f"❌ WhatsApp webhook verification failed for phone_id={phone_id}")
        raise HTTPException(status_code=403, detail="Verification failed")

    return {"status": "ok"}


@router.post("/webhook/whatsapp/{phone_id}/receive")
async def whatsapp_webhook_receive(phone_id: str, request: Request):
    """Receive messages and status updates from Meta."""
    body = await request.body()

    # Sem app secret não há como provar que veio da Meta: recusa em vez de aceitar tudo
    if not settings.META_WHATSAPP_APP_SECRET:
        logger.error("❌ WhatsApp webhook recusado: META_WHATSAPP_APP_SECRET não configurado")
        raise HTTPException(status_code=403, detail="Webhook não configurado")
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not WhatsAppCloudClient.verify_webhook_signature(
        body, signature, settings.META_WHATSAPP_APP_SECRET
    ):
        logger.warning("❌ WhatsApp webhook signature invalid")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Process each entry
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            display_phone = metadata.get("display_phone_number", "")
            received_phone_id = metadata.get("phone_number_id", phone_id)

            # Process messages
            for msg in value.get("messages", []):
                await _process_inbound_message(received_phone_id, msg, value.get("contacts", []))

            # Process status updates
            for status in value.get("statuses", []):
                await _process_status_update(status)

    return {"status": "ok"}


async def _process_inbound_message(phone_number_id: str, msg: dict, contacts: list):
    """Parse and persist an inbound WhatsApp message, then enqueue for processing."""
    wa_id = msg.get("from", "")
    wamid = msg.get("id", "")
    msg_type = msg.get("type", "text")
    timestamp = msg.get("timestamp", "")

    # Extract contact info
    profile_name = ""
    if contacts:
        profile_name = contacts[0].get("profile", {}).get("name", "")

    # Extract content based on type
    content_text = ""
    content_json = {}
    media_id = None
    media_mime = None

    if msg_type == "text":
        content_text = msg.get("text", {}).get("body", "")
    elif msg_type in ("image", "video", "audio", "document", "sticker"):
        media_data = msg.get(msg_type, {})
        content_text = media_data.get("caption", "")
        media_id = media_data.get("id")
        media_mime = media_data.get("mime_type")
        content_json = media_data
    elif msg_type == "location":
        loc = msg.get("location", {})
        content_text = f"📍 {loc.get('name', 'Location')}: {loc.get('latitude')}, {loc.get('longitude')}"
        content_json = loc
    elif msg_type == "contacts":
        content_json = msg.get("contacts", [])
        content_text = f"👤 {len(content_json)} contact(s) shared"
    elif msg_type == "interactive":
        interactive = msg.get("interactive", {})
        reply = interactive.get("button_reply", {}) or interactive.get("list_reply", {})
        content_text = reply.get("title", "") or reply.get("id", "")
        content_json = interactive
    elif msg_type == "reaction":
        reaction = msg.get("reaction", {})
        content_text = reaction.get("emoji", "")
        content_json = reaction
    else:
        content_json = msg

    logger.info(f"📥 WhatsApp inbound from {wa_id} ({profile_name}): [{msg_type}] {content_text[:80]}")

    async with AsyncSessionLocal() as db:
        # Find integration for this phone_number_id
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "whatsapp_cloud",
                Integration.status == "connected",
            )
        )
        integration = None
        for intg in result.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("phone_number_id") == phone_number_id:
                integration = intg
                break

        if not integration:
            logger.warning(f"No WhatsApp integration found for phone_number_id={phone_number_id}")
            return

        # Get or create conversation
        conv_result = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.wa_id == wa_id,
                WhatsAppConversation.integration_id == integration.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()

        if not conversation:
            conversation = WhatsAppConversation(
                company_id=integration.company_id,
                integration_id=integration.id,
                wa_id=wa_id,
                phone_number=f"+{wa_id}" if wa_id else None,
                display_name=profile_name or None,
                status="active",
                last_message_at=datetime.now(timezone.utc),
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = datetime.now(timezone.utc)
            if conversation.status == "closed":
                conversation.status = "active"
            if profile_name and not conversation.display_name:
                conversation.display_name = profile_name

        # Save message
        wa_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="inbound",
            sender_type="user",
            message_type=msg_type,
            content_text=content_text or None,
            content_json=content_json or None,
            media_id=media_id,
            media_mime=media_mime,
            wamid=wamid,
        )
        db.add(wa_msg)
        await db.commit()

        # Mark as read
        cfg = integration.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        access_token = cfg.get("access_token")
        if access_token and wamid:
            try:
                await WhatsAppCloudClient.mark_as_read(phone_number_id, wamid, access_token)
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
                logger.error(f"Failed to enqueue WhatsApp message: {e}")


async def _process_status_update(status: dict):
    """Update message delivery status (sent → delivered → read → failed)."""
    wamid = status.get("id", "")
    new_status = status.get("status", "")  # sent, delivered, read, failed
    errors = status.get("errors", [])

    if not wamid or not new_status:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WhatsAppMessage).where(WhatsAppMessage.wamid == wamid)
        )
        msg = result.scalar_one_or_none()
        if msg:
            msg.delivery_status = new_status
            if errors:
                msg.error_message = json.dumps(errors[:3])
            await db.commit()
            logger.debug(f"📬 WA status update: {wamid} → {new_status}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MULTI-NUMBER MANAGEMENT (mirrors Telegram multi-bot)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AddNumberRequest(BaseModel):
    access_token: str
    phone_number_id: str
    label: Optional[str] = None
    waba_id: Optional[str] = None


@router.get("/whatsapp/numbers")
async def list_whatsapp_numbers(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all connected WhatsApp numbers — scoped to current company."""
    result = await db.execute(
        select(Integration).where(
            Integration.provider == "whatsapp_cloud",
            Integration.company_id == user.company_id,
        ).order_by(Integration.id.desc())
    )
    integrations = result.scalars().all()

    numbers = []
    for intg in integrations:
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        numbers.append({
            "id": intg.id,
            "label": cfg.get("label", "WhatsApp"),
            "phone_number_id": cfg.get("phone_number_id", ""),
            "display_phone": cfg.get("display_phone", ""),
            "waba_id": cfg.get("waba_id", ""),
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "status": intg.status,
            "webhook_url": f"/webhook/whatsapp/{cfg.get('phone_number_id', '')}/receive",
            "created_at": str(intg.created_at) if intg.created_at else None,
        })

    return numbers


@router.post("/whatsapp/numbers")
async def add_whatsapp_number(
    req: AddNumberRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Register a new WhatsApp Cloud API number."""
    # Validate the token by fetching business profile
    profile = await WhatsAppCloudClient.get_business_profile(
        req.phone_number_id, req.access_token
    )

    verify_token = f"nexus_{req.phone_number_id[:8]}"
    display_phone = profile.get("display_phone_number", "")

    # Check for existing within same company
    existing = await db.execute(
        select(Integration).where(
            Integration.provider == "whatsapp_cloud",
            Integration.company_id == user.company_id,
        )
    )
    for intg in existing.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        if cfg.get("phone_number_id") == req.phone_number_id:
            raise HTTPException(status_code=409, detail=f"Phone number ID {req.phone_number_id} already registered")

    integration = Integration(
        company_id=user.company_id,
        provider="whatsapp_cloud",
        status="connected",
        config_json={
            "label": req.label or "WhatsApp Bot",
            "phone_number_id": req.phone_number_id,
            "display_phone": display_phone,
            "waba_id": req.waba_id or "",
            "access_token": req.access_token,
            "verify_token": verify_token,
            "flow_id": None,
            "flow_name": None,
        },
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)

    webhook_url = f"/webhook/whatsapp/{req.phone_number_id}/receive"
    return {
        "id": integration.id,
        "message": "✅ WhatsApp number registered",
        "phone_number_id": req.phone_number_id,
        "display_phone": display_phone,
        "verify_token": verify_token,
        "webhook_url": webhook_url,
        "note": f"Configure this webhook URL in Meta App Dashboard: https://YOUR_DOMAIN{webhook_url}",
    }


async def _get_company_conversation(db, conv_id: int, company_id: int) -> WhatsAppConversation:
    result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conv_id,
            WhatsAppConversation.company_id == company_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/whatsapp/numbers/{integration_id}/connect-flow")
async def connect_whatsapp_flow(integration_id: int, flow_id: int = None, user=Depends(get_current_user)):
    """Connect or disconnect a flow from a WhatsApp number."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Integration).where(
                Integration.id == integration_id,
                Integration.provider == "whatsapp_cloud",
                Integration.company_id == user._token_company_id,
            )
        )
        intg = result.scalar_one_or_none()
        if not intg:
            raise HTTPException(status_code=404, detail="WhatsApp number not found")

        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        flow_name = None
        if flow_id:
            from app.models import Flow
            flow_result = await db.execute(select(Flow).where(Flow.id == flow_id, Flow.company_id == user._token_company_id))
            flow = flow_result.scalar_one_or_none()
            if not flow:
                raise HTTPException(status_code=404, detail=f"Flow #{flow_id} not found")
            flow_name = flow.name

        cfg["flow_id"] = flow_id
        cfg["flow_name"] = flow_name
        intg.config_json = cfg

        # Force SQLAlchemy to detect JSONB change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(intg, "config_json")

        await db.commit()

    return {
        "message": f"✅ Flow {'connected: ' + flow_name if flow_id else 'disconnected'}",
        "flow_id": flow_id,
        "flow_name": flow_name,
    }


@router.delete("/whatsapp/numbers/{integration_id}")
async def remove_whatsapp_number(integration_id: int, user=Depends(get_current_user)):
    """Remove a WhatsApp number integration."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Integration).where(
                Integration.id == integration_id,
                Integration.provider == "whatsapp_cloud",
                Integration.company_id == user._token_company_id,
            )
        )
        intg = result.scalar_one_or_none()
        if not intg:
            raise HTTPException(status_code=404, detail="Not found")

        await db.delete(intg)
        await db.commit()

    return {"message": "✅ WhatsApp number removed"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONVERSATIONS (admin view)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/whatsapp/conversations")
async def list_whatsapp_conversations(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List WhatsApp conversations with last message preview — scoped to current company."""
    query = select(WhatsAppConversation).where(
        WhatsAppConversation.company_id == user.company_id
    ).order_by(desc(WhatsAppConversation.last_message_at))
    if status:
        query = query.where(WhatsAppConversation.status == status)
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    conversations = result.scalars().all()

    return [
        {
            "id": c.id,
            "wa_id": c.wa_id,
            "phone_number": c.phone_number,
            "display_name": c.display_name,
            "status": c.status,
            "last_message_at": str(c.last_message_at) if c.last_message_at else None,
            "created_at": str(c.created_at) if c.created_at else None,
        }
        for c in conversations
    ]


@router.get("/whatsapp/conversations/{conv_id}/messages")
async def get_whatsapp_messages(conv_id: int, limit: int = 50, offset: int = 0, user=Depends(get_current_user)):
    """Get message history for a conversation."""
    async with AsyncSessionLocal() as db:
        await _get_company_conversation(db, conv_id, user._token_company_id)
        result = await db.execute(
            select(WhatsAppMessage)
            .where(WhatsAppMessage.conversation_id == conv_id)
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(limit).offset(offset)
        )
        messages = result.scalars().all()

    return [
        {
            "id": m.id,
            "direction": m.direction,
            "sender_type": m.sender_type,
            "message_type": m.message_type,
            "content_text": m.content_text,
            "media_id": m.media_id,
            "media_mime": m.media_mime,
            "wamid": m.wamid,
            "delivery_status": m.delivery_status,
            "created_at": str(m.created_at) if m.created_at else None,
        }
        for m in messages
    ]


class ManualSendRequest(BaseModel):
    text: str


@router.post("/whatsapp/conversations/{conv_id}/send")
async def send_manual_message(conv_id: int, req: ManualSendRequest, user=Depends(get_current_user)):
    """Send a manual message to a conversation (operator mode)."""
    async with AsyncSessionLocal() as db:
        conv = await _get_company_conversation(db, conv_id, user._token_company_id)

        # Get integration credentials
        intg_result = await db.execute(
            select(Integration).where(Integration.id == conv.integration_id)
        )
        intg = intg_result.scalar_one_or_none()
        if not intg:
            raise HTTPException(status_code=500, detail="Integration not found")

        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        phone_number_id = cfg.get("phone_number_id")
        access_token = cfg.get("access_token")

        if not phone_number_id or not access_token:
            raise HTTPException(status_code=500, detail="Missing API credentials")

        # Send via Cloud API
        result = await WhatsAppCloudClient.send_text(
            phone_number_id, conv.wa_id, req.text, access_token
        )

        wamid = None
        messages = result.get("messages", [])
        if messages:
            wamid = messages[0].get("id")

        # Save outbound message
        msg = WhatsAppMessage(
            conversation_id=conv.id,
            direction="outbound",
            sender_type="operator",
            message_type="text",
            content_text=req.text,
            wamid=wamid,
            delivery_status="sent",
        )
        db.add(msg)
        await db.commit()

    return {"sent": True, "wamid": wamid}


@router.post("/whatsapp/conversations/{conv_id}/handoff")
async def handoff_conversation(conv_id: int, user=Depends(get_current_user)):
    """Switch conversation to human operator mode (bot stops responding)."""
    async with AsyncSessionLocal() as db:
        await _get_company_conversation(db, conv_id, user._token_company_id)
        await db.execute(
            update(WhatsAppConversation)
            .where(WhatsAppConversation.id == conv_id)
            .values(status="human_takeover")
        )
        await db.commit()
    return {"message": "Conversation handed off to human operator"}


@router.post("/whatsapp/conversations/{conv_id}/resume")
async def resume_conversation(conv_id: int, user=Depends(get_current_user)):
    """Resume bot processing for this conversation."""
    async with AsyncSessionLocal() as db:
        await _get_company_conversation(db, conv_id, user._token_company_id)
        await db.execute(
            update(WhatsAppConversation)
            .where(WhatsAppConversation.id == conv_id)
            .values(status="active")
        )
        await db.commit()
    return {"message": "Bot resumed for this conversation"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STATS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/whatsapp/stats")
async def whatsapp_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Basic WhatsApp channel metrics — scoped to current company."""
    company_id = user.company_id
    convs = await db.execute(
        select(func.count(WhatsAppConversation.id)).where(
            WhatsAppConversation.company_id == company_id
        )
    )
    total_conversations = convs.scalar() or 0

    active = await db.execute(
        select(func.count(WhatsAppConversation.id)).where(
            WhatsAppConversation.company_id == company_id,
            WhatsAppConversation.status.in_(["open", "active"]),
        )
    )
    active_conversations = active.scalar() or 0

    msgs = await db.execute(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.conversation_id.in_(
                select(WhatsAppConversation.id).where(
                    WhatsAppConversation.company_id == company_id
                )
            )
        )
    )
    total_messages = msgs.scalar() or 0

    inbound = await db.execute(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.direction == "inbound",
            WhatsAppMessage.conversation_id.in_(
                select(WhatsAppConversation.id).where(
                    WhatsAppConversation.company_id == company_id
                )
            ),
        )
    )
    inbound_messages = inbound.scalar() or 0

    return {
        "total_conversations": total_conversations,
        "active_conversations": active_conversations,
        "total_messages": total_messages,
        "inbound_messages": inbound_messages,
        "outbound_messages": total_messages - inbound_messages,
    }
