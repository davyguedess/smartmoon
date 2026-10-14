from fastapi import APIRouter, Request, HTTPException, status, Depends
from typing import List, Optional, Dict, Any, Union
from loguru import logger
from app.core.dependencies import get_db, get_current_user
from app.core.config import settings
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import TelegramConversation, TelegramMessage, Integration
from app.workers.channel_worker import enqueue_channel_message
from app.services.telegram_intelligence import process_conversation_intelligence

router = APIRouter(tags=["Telegram"])


def _verify_telegram_secret(request: Request) -> None:
    # Telegram envia o secret_token passado no setWebhook neste header
    if not settings.TELEGRAM_WEBHOOK_SECRET:
        logger.error("❌ Telegram webhook recusado: TELEGRAM_WEBHOOK_SECRET não configurado")
        raise HTTPException(status_code=403, detail="Webhook não configurado")
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")


async def _get_company_conversation(db: AsyncSession, conversation_id: int, company_id: int) -> TelegramConversation:
    result = await db.execute(
        select(TelegramConversation).where(
            TelegramConversation.id == conversation_id,
            TelegramConversation.company_id == company_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def _process_telegram_update(payload: dict, db: AsyncSession, bot_id_filter: Optional[str] = None):
    """Core logic: parse Telegram update, store message, enqueue flow."""
    import httpx as _httpx
    import json as _json

    if "message" not in payload:
        return {"status": "ignored"}

    msg = payload["message"]
    chat = msg.get("chat", {})
    user = msg.get("from", {})

    chat_id = str(chat.get("id", ""))
    user_id = str(user.get("id", ""))
    username = user.get("username")
    display_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    text = msg.get("text", "")
    message_id = str(msg.get("message_id", ""))

    if not chat_id:
        raise HTTPException(status_code=400, detail="Missing chat id")

    # ── Find Integration ──────────────────────────────────────────────────────
    if bot_id_filter:
        # Specific bot — find integration with matching bot_id in config_json
        stmt = select(Integration).where(
            Integration.provider == "telegram",
            Integration.status == "connected",
            Integration.config_json.contains({"bot_id": int(bot_id_filter)})
        ).limit(1)
    else:
        # Legacy route — fallback to most recently connected
        stmt = select(Integration).where(
            Integration.provider == "telegram",
            Integration.status == "connected"
        ).order_by(Integration.id.desc()).limit(1)

    result = await db.execute(stmt)
    integration = result.scalars().first()

    if not integration:
        company_id, integration_id = 2, 1
    else:
        company_id = integration.company_id
        integration_id = integration.id

    # ── Get or Create Conversation ────────────────────────────────────────────
    conv_stmt = select(TelegramConversation).where(
        TelegramConversation.external_chat_id == chat_id,
        TelegramConversation.integration_id == integration_id
    )
    conv_result = await db.execute(conv_stmt)
    conv = conv_result.scalar_one_or_none()

    if not conv:
        conv = TelegramConversation(
            company_id=company_id,
            integration_id=integration_id,
            external_chat_id=chat_id,
            external_user_id=user_id,
            username=username,
            display_name=display_name,
            status="open"
        )
        db.add(conv)
        await db.flush()
    else:
        conv.username = username
        conv.display_name = display_name
        conv.last_message_at = func.now()

    # ── Store Message ────────────────────────────────────────────────────────
    db.add(TelegramMessage(
        conversation_id=conv.id,
        direction="inbound",
        sender_type="user",
        content_text=text,
        content_json=msg,
        external_message_id=message_id
    ))

    # ── Human Takeover Guard ─────────────────────────────────────────────────
    if conv.status == "human_takeover" and not text.startswith("/bot"):
        logger.info(f"⏭️ Human Takeover active for chat {chat_id}")
        await db.commit()
        return {"status": "ignored", "reason": "human_takeover"}

    # ── Typing Indicator ─────────────────────────────────────────────────────
    try:
        _bot_token = None
        if integration and integration.config_json:
            _cfg = integration.config_json if isinstance(integration.config_json, dict) else _json.loads(integration.config_json)
            _bot_token = _cfg.get("bot_token")
        if _bot_token:
            async with _httpx.AsyncClient(timeout=3) as _tc:
                await _tc.post(
                    f"https://api.telegram.org/bot{_bot_token}/sendChatAction",
                    json={"chat_id": chat_id, "action": "typing"},
                )
    except Exception as e:
        logger.debug(f"Typing indicator failed: {e}")

    # ── Enqueue Flow ─────────────────────────────────────────────────────────
    await enqueue_channel_message(db, conv.id, text, channel="telegram")
    await db.commit()
    return {"status": "ok", "message": "Message received and persisted"}


@router.post("/webhook/telegram/{bot_id}/receive", tags=["Telegram Webhook"])
async def receive_telegram_by_bot(
    bot_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook URL dedicado por bot. Cada bot Telegram usa sua própria URL."""
    _verify_telegram_secret(request)
    payload = await request.json()
    logger.info(f"📬 Telegram webhook → bot_id={bot_id}")
    return await _process_telegram_update(payload, db, bot_id_filter=bot_id)


@router.post("/webhook/telegram/receive", tags=["Telegram Webhook"])
async def receive_telegram_legacy(
    request: Request,
    token: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Legacy webhook (retrocompatibilidade)."""
    _verify_telegram_secret(request)
    payload = await request.json()
    return await _process_telegram_update(payload, db, bot_id_filter=None)


@router.get("/telegram/conversations", tags=["Telegram Admin"])
async def list_conversations(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    List telegram conversations of the caller's company with latest message.
    """
    result = await db.execute(
        select(TelegramConversation)
        .where(TelegramConversation.company_id == user._token_company_id)
        .order_by(TelegramConversation.updated_at.desc())
        .limit(100)
    )
    conversations = result.scalars().all()
    
    # Enrich with latest message (simple approach for MVP)
    enriched = []
    for conv in conversations:
        msg_result = await db.execute(
            select(TelegramMessage)
            .where(TelegramMessage.conversation_id == conv.id)
            .order_by(TelegramMessage.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        
        enriched.append({
            "id": conv.id,
            "external_chat_id": conv.external_chat_id,
            "display_name": conv.display_name,
            "username": conv.username,
            "status": conv.status,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "last_message": last_msg.content_text if last_msg else "Nenhuma mensagem",
            "bot_name": "Nexus Bot" # Placeholder for now
        })
    
    return enriched

@router.get("/telegram/stats", tags=["Telegram Admin"])
async def get_stats(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Get basic telegram monitoring stats for the caller's company.
    """
    cid = user._token_company_id
    total_convs = await db.scalar(
        select(func.count(TelegramConversation.id)).where(TelegramConversation.company_id == cid)
    )
    total_msgs = await db.scalar(
        select(func.count(TelegramMessage.id))
        .join(TelegramConversation, TelegramConversation.id == TelegramMessage.conversation_id)
        .where(TelegramConversation.company_id == cid)
    )
    
    return {
        "total_conversations": total_convs or 0,
        "total_messages": total_msgs or 0,
        "active_bots": 1,
        "waiting_feedback": 0
    }

@router.get("/telegram/conversations/{conversation_id}", tags=["Telegram Admin"])
async def get_conversation(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Get unique conversation details.
    """
    conv = await _get_company_conversation(db, conversation_id, user._token_company_id)

    # Load state as well
    from app.models.telegram_models import TelegramConversationState
    state_result = await db.execute(
        select(TelegramConversationState).where(TelegramConversationState.conversation_id == conversation_id)
    )
    state = state_result.scalar_one_or_none()
        
    return {
        "id": conv.id,
        "external_chat_id": conv.external_chat_id,
        "display_name": conv.display_name,
        "username": conv.username,
        "status": conv.status,
        "created_at": conv.created_at.isoformat(),
        "summary": state.summary if state else None,
        "facts": state.facts_extracted if state else [],
        "main_topic": state.main_topic if state else None
    }

@router.post("/telegram/conversations/{conversation_id}/analyze", tags=["Telegram Admin"])
async def analyze_conversation(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Trigger AI analysis for a conversation.
    """
    await _get_company_conversation(db, conversation_id, user._token_company_id)
    state = await process_conversation_intelligence(db, conversation_id)
    if not state:
        raise HTTPException(status_code=500, detail="Intelligence processing failed")
    return {"status": "ok", "summary": state.summary, "facts": state.facts_extracted}

@router.post("/telegram/conversations/{conversation_id}/handoff", tags=["Telegram Admin"])
async def conversation_handoff(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Switch conversation to human takeover mode (disables bot responses).
    """
    conv = await _get_company_conversation(db, conversation_id, user._token_company_id)
    conv.status = "human_takeover"
    await db.commit()
    return {"status": "human_takeover"}

@router.post("/telegram/conversations/{conversation_id}/resume", tags=["Telegram Admin"])
async def conversation_resume(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Switch conversation back to AI mode.
    """
    conv = await _get_company_conversation(db, conversation_id, user._token_company_id)
    conv.status = "active"
    await db.commit()
    return {"status": "active"}

@router.get("/telegram/conversations/{conversation_id}/feedback", tags=["Telegram Admin"])
async def get_conversation_feedback(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Get human feedback for a conversation.
    """
    await _get_company_conversation(db, conversation_id, user._token_company_id)
    from app.models.telegram_models import TelegramFeedback
    result = await db.execute(
        select(TelegramFeedback).where(TelegramFeedback.conversation_id == conversation_id)
    )
    return result.scalars().all()

@router.post("/telegram/conversations/{conversation_id}/feedback", tags=["Telegram Admin"])
async def add_conversation_feedback(
    conversation_id: int, 
    content: str, 
    rating: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Add human feedback for a conversation.
    """
    await _get_company_conversation(db, conversation_id, user._token_company_id)
    from app.models.telegram_models import TelegramFeedback
    new_fb = TelegramFeedback(
        conversation_id=conversation_id,
        content=content,
        rating=rating
    )
    db.add(new_fb)
    await db.commit()
    return {"status": "ok"}

@router.get("/telegram/conversations/{conversation_id}/messages", tags=["Telegram Admin"])
async def get_conversation_messages(conversation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """
    Get message history for a conversation.
    """
    await _get_company_conversation(db, conversation_id, user._token_company_id)
    result = await db.execute(
        select(TelegramMessage)
        .where(TelegramMessage.conversation_id == conversation_id)
        .order_by(TelegramMessage.created_at.asc())
        .limit(200)
    )
    messages = result.scalars().all()
    return messages



# ── Multi-Bot Management ──────────────────────────────────────────────────────

from app.core.dependencies import get_current_user

@router.get("/telegram/bots")
async def list_telegram_bots(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Lista todos os bots Telegram da empresa com flow conectado."""
    import json as _json
    from app.models import Flow

    result = await db.execute(
        select(Integration).where(
            Integration.company_id == user.company_id,
            Integration.provider == "telegram",
            Integration.status == "connected"
        ).order_by(Integration.id.asc())
    )
    integrations = result.scalars().all()

    bots = []
    for intg in integrations:
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = _json.loads(cfg)

        flow_id = cfg.get("flow_id")
        flow_name = None
        if flow_id:
            fr = await db.execute(select(Flow).where(Flow.id == int(flow_id)))
            flow = fr.scalar_one_or_none()
            if flow:
                flow_name = flow.name

        bots.append({
            "id": intg.id,
            "label": cfg.get("label", f"Bot #{intg.id}"),
            "bot_id": cfg.get("bot_id"),
            "username": cfg.get("username"),
            "flow_id": flow_id,
            "flow_name": flow_name,
            "webhook_url": f"http://localhost:8000/webhook/telegram/{cfg.get('bot_id')}/receive",
        })

    return bots


@router.post("/telegram/bots")
async def add_telegram_bot(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Adiciona novo bot Telegram. 
    Body: { bot_token, label? }
    Consulta a API do Telegram para obter bot_id/username e registra o webhook.
    """
    import json as _json
    import httpx

    bot_token = body.get("bot_token", "").strip()
    label = body.get("label", "").strip()

    if not bot_token:
        raise HTTPException(status_code=400, detail="bot_token é obrigatório")

    # Validate token with Telegram
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
        if r.status_code != 200:
            detail = r.json().get("description", "Token inválido")
            raise HTTPException(status_code=400, detail=f"Telegram: {detail}")
        bot_info = r.json().get("result", {})

    bot_id = bot_info.get("id")
    username = bot_info.get("username")
    first_name = bot_info.get("first_name", username)

    if not label:
        label = f"@{username}"

    # Check if already registered
    existing = await db.execute(
        select(Integration).where(
            Integration.company_id == user.company_id,
            Integration.provider == "telegram",
            Integration.config_json.contains({"bot_id": bot_id})
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"Bot @{username} já está registrado")

    # Register webhook at Telegram
    base = (settings.WEBHOOK_BASE_URL or settings.PUBLIC_API_URL).rstrip("/")
    webhook_url = f"{base}/webhook/telegram/{bot_id}/receive"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={"url": webhook_url, "secret_token": settings.TELEGRAM_WEBHOOK_SECRET}
            )
        logger.info(f"🔗 Webhook registrado: {webhook_url}")
    except Exception as e:
        logger.warning(f"Webhook registration failed (can set manually): {e}")

    # Create integration record
    cfg = {
        "label": label,
        "bot_id": bot_id,
        "bot_token": bot_token,
        "username": username,
        "first_name": first_name,
        "webhook_url": webhook_url,
    }

    intg = Integration(
        company_id=user.company_id,
        provider="telegram",
        status="connected",
        config_json=cfg,
    )
    db.add(intg)
    await db.commit()
    await db.refresh(intg)

    logger.info(f"✅ Bot @{username} (id={bot_id}) adicionado pela empresa {user.company_id}")

    return {
        "id": intg.id,
        "label": label,
        "bot_id": bot_id,
        "username": username,
        "webhook_url": webhook_url,
        "flow_id": None,
    }


@router.patch("/telegram/bots/{integration_id}/connect-flow")
async def connect_flow_to_bot(
    integration_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Conecta (ou desconecta) um flow a um bot Telegram específico.
    Body: { flow_id: 2 } ou { flow_id: null }
    """
    import json as _json
    from app.models import Flow

    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.company_id == user.company_id,
            Integration.provider == "telegram"
        )
    )
    intg = result.scalars().first()
    if not intg:
        raise HTTPException(status_code=404, detail="Bot não encontrado")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = _json.loads(cfg)

    flow_id = body.get("flow_id")
    if flow_id:
        fr = await db.execute(
            select(Flow).where(Flow.id == int(flow_id), Flow.company_id == user.company_id)
        )
        flow = fr.scalar_one_or_none()
        if not flow:
            raise HTTPException(status_code=404, detail=f"Flow {flow_id} não encontrado")
        cfg["flow_id"] = int(flow_id)
        msg = f"✅ Flow '{flow.name}' conectado ao bot @{cfg.get('username')}"
    else:
        cfg.pop("flow_id", None)
        msg = f"🔌 Flow desconectado do bot @{cfg.get('username')}"

    intg.config_json = cfg
    await db.commit()
    logger.info(msg)
    return {"status": "ok", "message": msg, "flow_id": cfg.get("flow_id")}


@router.delete("/telegram/bots/{integration_id}")
async def remove_telegram_bot(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Remove um bot Telegram (desregistra webhook e apaga a integração)."""
    import json as _json
    import httpx

    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.company_id == user.company_id,
            Integration.provider == "telegram"
        )
    )
    intg = result.scalars().first()
    if not intg:
        raise HTTPException(status_code=404, detail="Bot não encontrado")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = _json.loads(cfg)

    bot_token = cfg.get("bot_token")
    username = cfg.get("username", f"id={integration_id}")

    # Remove webhook at Telegram
    if bot_token:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/deleteWebhook"
                )
        except Exception:
            pass

    intg.status = "disconnected"
    await db.commit()

    logger.info(f"🗑️ Bot @{username} removido pela empresa {user.company_id}")
    return {"status": "ok", "message": f"Bot @{username} removido"}


# Legacy single-bot routes (backward compat)
@router.get("/telegram/integration/status")
async def get_telegram_integration_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    bots = await list_telegram_bots(db=db, user=user)
    if not bots:
        return {"connected": False, "flow_id": None}
    first = bots[0]
    return {"connected": True, **first}


@router.patch("/telegram/integration/connect-flow")
async def connect_flow_to_telegram_legacy(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    bots = await list_telegram_bots(db=db, user=user)
    if not bots:
        raise HTTPException(status_code=404, detail="Nenhuma integração Telegram")
    return await connect_flow_to_bot(bots[0]["id"], body, db=db, user=user)
