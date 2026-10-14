"""
Instagram DM Service — Send messages via Meta Graph API.

Uses the Instagram Messaging API (part of Messenger Platform).
Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api

Key constraints:
  - 24h messaging window (like WhatsApp Business API)
  - Rate limit: ~200 calls/hour per page
  - Only works with Instagram Business/Creator accounts
"""
import httpx
from typing import Optional
from loguru import logger

META_GRAPH_URL = "https://graph.facebook.com/v21.0"


async def send_text_dm(
    access_token: str,
    recipient_id: str,
    text: str,
) -> dict:
    """Send a text DM to an Instagram user.

    Args:
        access_token: Page-level access token with instagram_manage_messages
        recipient_id: IGSID (Instagram Scoped User ID) of the recipient
        text: Message text (max 1000 chars)

    Returns:
        {"message_id": "m_xxx"} on success, or {"error": "..."} on failure
    """
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text[:1000]},
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/me/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    data = resp.json()
    if resp.status_code == 200 and "message_id" in data:
        logger.info(f"📤 Instagram DM sent to {recipient_id}: {text[:50]}")
        return {"message_id": data["message_id"]}

    error_msg = data.get("error", {}).get("message", resp.text[:200])
    logger.error(f"❌ Instagram DM failed to {recipient_id}: {error_msg}")
    return {"error": error_msg}


async def send_image_dm(
    access_token: str,
    recipient_id: str,
    image_url: str,
) -> dict:
    """Send an image DM via URL."""
    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "image",
                "payload": {"url": image_url},
            }
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/me/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    data = resp.json()
    if resp.status_code == 200 and "message_id" in data:
        return {"message_id": data["message_id"]}

    return {"error": data.get("error", {}).get("message", resp.text[:200])}


async def send_quick_replies(
    access_token: str,
    recipient_id: str,
    text: str,
    quick_replies: list[dict],
) -> dict:
    """Send a message with quick reply buttons.

    quick_replies format:
    [{"content_type": "text", "title": "Sim", "payload": "YES"},
     {"content_type": "text", "title": "Não", "payload": "NO"}]
    """
    payload = {
        "recipient": {"id": recipient_id},
        "message": {
            "text": text[:1000],
            "quick_replies": quick_replies[:13],  # Max 13 quick replies
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/me/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    data = resp.json()
    if resp.status_code == 200 and "message_id" in data:
        return {"message_id": data["message_id"]}

    return {"error": data.get("error", {}).get("message", resp.text[:200])}


async def get_user_profile(
    access_token: str,
    user_id: str,
) -> dict:
    """Get Instagram user profile info."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{META_GRAPH_URL}/{user_id}",
            params={
                "fields": "name,username,profile_pic",
                "access_token": access_token,
            },
        )

    if resp.status_code == 200:
        return resp.json()
    return {}


async def exchange_token_long_lived(
    app_id: str,
    app_secret: str,
    short_lived_token: str,
) -> Optional[str]:
    """Exchange a short-lived token for a long-lived one (60 days)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{META_GRAPH_URL}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": short_lived_token,
            },
        )

    data = resp.json()
    if "access_token" in data:
        logger.info(f"🔑 Long-lived token obtained (expires in {data.get('expires_in', '?')}s)")
        return data["access_token"]

    logger.error(f"❌ Token exchange failed: {data}")
    return None
