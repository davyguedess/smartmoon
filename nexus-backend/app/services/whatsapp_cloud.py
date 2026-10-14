"""
WhatsApp Cloud API Client — Official Meta Graph API integration.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""
import hashlib
import hmac
import httpx
from loguru import logger
from typing import Optional


GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class WhatsAppCloudClient:
    """Stateless client for Meta WhatsApp Cloud API."""

    @staticmethod
    async def send_text(
        phone_number_id: str,
        to: str,
        text: str,
        access_token: str,
        preview_url: bool = False,
    ) -> dict:
        """Send a text message."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": preview_url, "body": text},
        }
        return await _post(url, payload, access_token)

    @staticmethod
    async def send_template(
        phone_number_id: str,
        to: str,
        template_name: str,
        language_code: str,
        access_token: str,
        components: Optional[list] = None,
    ) -> dict:
        """Send a template message (required for first contact within 24h)."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        template = {
            "name": template_name,
            "language": {"code": language_code},
        }
        if components:
            template["components"] = components

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": template,
        }
        return await _post(url, payload, access_token)

    @staticmethod
    async def send_media(
        phone_number_id: str,
        to: str,
        media_type: str,
        media_url: str,
        access_token: str,
        caption: Optional[str] = None,
    ) -> dict:
        """Send media (image, video, audio, document)."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        media_obj = {"link": media_url}
        if caption and media_type in ("image", "video", "document"):
            media_obj["caption"] = caption

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": media_type,
            media_type: media_obj,
        }
        return await _post(url, payload, access_token)

    @staticmethod
    async def send_interactive(
        phone_number_id: str,
        to: str,
        interactive: dict,
        access_token: str,
    ) -> dict:
        """Send interactive message (buttons, lists)."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": interactive,
        }
        return await _post(url, payload, access_token)

    @staticmethod
    async def mark_as_read(
        phone_number_id: str,
        message_id: str,
        access_token: str,
    ) -> dict:
        """Mark a message as read (blue ticks)."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        return await _post(url, payload, access_token)

    @staticmethod
    async def get_media_url(media_id: str, access_token: str) -> Optional[str]:
        """Retrieve the download URL for a media asset."""
        url = f"{GRAPH_API_BASE}/{media_id}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url, headers={"Authorization": f"Bearer {access_token}"}
                )
                resp.raise_for_status()
                return resp.json().get("url")
        except Exception as e:
            logger.error(f"Failed to get media URL for {media_id}: {e}")
            return None

    @staticmethod
    async def get_business_profile(
        phone_number_id: str, access_token: str
    ) -> dict:
        """Get WhatsApp Business profile info."""
        url = f"{GRAPH_API_BASE}/{phone_number_id}/whatsapp_business_profile"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"fields": "about,address,description,email,profile_picture_url,websites,vertical"},
                )
                resp.raise_for_status()
                data = resp.json().get("data", [])
                return data[0] if data else {}
        except Exception as e:
            logger.error(f"Failed to get business profile: {e}")
            return {}

    @staticmethod
    def verify_webhook_signature(
        payload_body: bytes, signature: str, app_secret: str
    ) -> bool:
        """Validate X-Hub-Signature-256 header from Meta webhook."""
        if not signature or not signature.startswith("sha256="):
            return False
        expected = hmac.new(
            app_secret.encode(), payload_body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)


async def _post(url: str, payload: dict, access_token: str) -> dict:
    """POST to Graph API with auth and error handling."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
            )
            data = resp.json()
            if resp.status_code >= 400:
                error = data.get("error", {})
                logger.error(
                    f"WhatsApp API error: {error.get('message', 'Unknown')} "
                    f"(code={error.get('code')}, type={error.get('type')})"
                )
                return {"error": error, "status_code": resp.status_code}
            logger.debug(f"WhatsApp API OK: {url}")
            return data
    except Exception as e:
        logger.error(f"WhatsApp API request failed: {e}")
        return {"error": str(e)}
