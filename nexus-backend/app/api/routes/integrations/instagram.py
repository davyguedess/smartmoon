"""
Instagram DM Integration — OAuth2 + CRUD routes.

Endpoints:
  GET  /integrations/instagram/auth-url       → Generate Meta OAuth URL
  GET  /integrations/instagram/callback        → OAuth callback (code → token)
  GET  /integrations/instagram/accounts        → List connected Instagram accounts
  POST /integrations/instagram/{id}/send       → Send a DM
  DELETE /integrations/instagram/{id}          → Disconnect account
"""
import json
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models import Integration
from app.models.instagram_models import InstagramConversation, InstagramMessage
from app.services.instagram_dm_service import (
    send_text_dm,
    exchange_token_long_lived,
    get_user_profile,
)

router = APIRouter(prefix="/integrations/instagram", tags=["Instagram DM"])

# Meta App credentials (from platform_api_keys or env)
META_APP_ID = getattr(settings, "META_APP_ID", "")
META_APP_SECRET = getattr(settings, "META_APP_SECRET", "")
META_REDIRECT_URI = getattr(settings, "META_REDIRECT_URI", "https://smartmoon.online/integrations/instagram/callback")
META_GRAPH_URL = "https://graph.facebook.com/v21.0"

# Scopes needed for Instagram Messaging
SCOPES = [
    "instagram_basic",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_messaging",
    "pages_read_engagement",
]


@router.get("/auth-url")
async def instagram_auth_url(
    user=Depends(get_current_user),
):
    """Generate Meta OAuth2 authorization URL."""
    if not META_APP_ID:
        raise HTTPException(status_code=500, detail="META_APP_ID não configurado. Configure nas chaves da plataforma.")

    params = {
        "client_id": META_APP_ID,
        "redirect_uri": META_REDIRECT_URI,
        "scope": ",".join(SCOPES),
        "response_type": "code",
        "state": f"{user.company_id}",  # Pass company_id in state for callback
    }
    url = f"https://www.facebook.com/v21.0/dialog/oauth?{urllib.parse.urlencode(params)}"
    return {"auth_url": url}


@router.get("/callback")
async def instagram_callback(
    code: str = Query(...),
    state: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 callback — exchange code for access token and save integration."""
    import httpx

    if not META_APP_ID or not META_APP_SECRET:
        raise HTTPException(status_code=500, detail="Meta App credentials not configured")

    company_id = int(state) if state.isdigit() else None
    if not company_id:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # 1. Exchange code for short-lived token
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{META_GRAPH_URL}/oauth/access_token",
            params={
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "redirect_uri": META_REDIRECT_URI,
                "code": code,
            },
        )

    token_data = resp.json()
    short_token = token_data.get("access_token")
    if not short_token:
        error = token_data.get("error", {}).get("message", "Token exchange failed")
        logger.error(f"❌ Instagram OAuth failed: {error}")
        raise HTTPException(status_code=400, detail=f"Falha na autenticação: {error}")

    # 2. Exchange for long-lived token (60 days)
    long_token = await exchange_token_long_lived(META_APP_ID, META_APP_SECRET, short_token)
    if not long_token:
        long_token = short_token  # Fallback to short-lived

    # 3. Get page access tokens (Instagram requires page-level token)
    async with httpx.AsyncClient(timeout=15) as client:
        pages_resp = await client.get(
            f"{META_GRAPH_URL}/me/accounts",
            params={"access_token": long_token, "fields": "id,name,access_token,instagram_business_account"},
        )

    pages_data = pages_resp.json().get("data", [])
    if not pages_data:
        raise HTTPException(status_code=400, detail="Nenhuma página Facebook encontrada. Vincule uma página ao seu Instagram Business.")

    # 4. Find Instagram Business account linked to page
    created_integrations = []
    for page in pages_data:
        ig_account = page.get("instagram_business_account")
        if not ig_account:
            continue

        ig_id = ig_account.get("id")
        page_token = page.get("access_token")

        # Get Instagram profile info
        async with httpx.AsyncClient(timeout=10) as client:
            ig_resp = await client.get(
                f"{META_GRAPH_URL}/{ig_id}",
                params={"fields": "id,username,name,profile_picture_url", "access_token": page_token},
            )
        ig_data = ig_resp.json()

        config = {
            "ig_user_id": ig_id,
            "page_id": page.get("id"),
            "page_name": page.get("name"),
            "username": ig_data.get("username", ""),
            "display_name": ig_data.get("name", ""),
            "profile_pic_url": ig_data.get("profile_picture_url", ""),
            "access_token": page_token,  # Page-scoped token
        }

        # Check if already connected
        existing = await db.execute(
            select(Integration).where(
                Integration.company_id == company_id,
                Integration.provider == "instagram_dm",
            )
        )
        existing_intg = None
        for intg in existing.scalars().all():
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            if cfg.get("ig_user_id") == ig_id:
                existing_intg = intg
                break

        if existing_intg:
            # Update existing
            existing_intg.config_json = config
            existing_intg.status = "connected"
            flag_modified(existing_intg, "config_json")
        else:
            # Create new
            new_intg = Integration(
                company_id=company_id,
                provider="instagram_dm",
                status="connected",
                config_json=config,
            )
            db.add(new_intg)

        created_integrations.append({
            "ig_user_id": ig_id,
            "username": ig_data.get("username"),
            "page_name": page.get("name"),
        })

    await db.commit()

    logger.info(f"✅ Instagram connected for company {company_id}: {created_integrations}")

    # Redirect to integrations page with success
    return {
        "success": True,
        "message": f"{len(created_integrations)} conta(s) Instagram conectada(s)",
        "accounts": created_integrations,
        "redirect": "/integrations",
    }


@router.get("/accounts")
async def list_instagram_accounts(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List connected Instagram accounts for current company."""
    result = await db.execute(
        select(Integration).where(
            Integration.provider == "instagram_dm",
            Integration.company_id == user.company_id,
        )
    )
    accounts = []
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        # Count conversations and messages
        stats = await db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM instagram_conversations WHERE integration_id = :iid) as convs,
                (SELECT COUNT(*) FROM instagram_messages im
                 JOIN instagram_conversations ic ON ic.id = im.conversation_id
                 WHERE ic.integration_id = :iid) as msgs
        """), {"iid": intg.id})
        row = stats.fetchone()

        accounts.append({
            "id": intg.id,
            "ig_user_id": cfg.get("ig_user_id"),
            "username": cfg.get("username"),
            "display_name": cfg.get("display_name"),
            "profile_pic_url": cfg.get("profile_pic_url"),
            "page_name": cfg.get("page_name"),
            "status": intg.status,
            "conversations": int(row[0]) if row else 0,
            "messages": int(row[1]) if row else 0,
            "created_at": intg.created_at.isoformat() if intg.created_at else None,
        })

    return {"accounts": accounts}


@router.delete("/{integration_id}")
async def disconnect_instagram(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Disconnect an Instagram account."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "instagram_dm",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Integração não encontrada")

    intg.status = "disconnected"
    intg.config_json = {}
    flag_modified(intg, "config_json")
    await db.commit()

    return {"ok": True, "message": "Instagram desconectado"}


from pydantic import BaseModel


class SendDMBody(BaseModel):
    recipient_id: str
    text: str


@router.post("/{integration_id}/send")
async def send_dm(
    integration_id: int,
    body: SendDMBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Send a DM to an Instagram user via a connected account."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "instagram_dm",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Integração não encontrada")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    access_token = cfg.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Token de acesso não configurado")

    response = await send_text_dm(access_token, body.recipient_id, body.text)
    if "error" in response:
        raise HTTPException(status_code=502, detail=response["error"])

    # Save outbound message
    conv = await db.execute(
        select(InstagramConversation).where(
            InstagramConversation.ig_user_id == body.recipient_id,
            InstagramConversation.integration_id == integration_id,
        )
    )
    conversation = conv.scalar_one_or_none()
    if conversation:
        msg = InstagramMessage(
            conversation_id=conversation.id,
            direction="outbound",
            sender_type="bot",
            message_type="text",
            content_text=body.text,
            ig_message_id=response.get("message_id"),
            delivery_status="sent",
        )
        db.add(msg)
        await db.commit()

    return response
