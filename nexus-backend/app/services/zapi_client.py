"""
Z-API WhatsApp Client — Secondary WhatsApp provider.

Z-API provides WhatsApp integration via WhatsApp Web protocol.
Used as fallback/alternative to the official Meta Cloud API.

Docs: https://z-api.io/
Auth: Instance ID + Instance Token in URL + Client-Token header.
"""
import httpx
from loguru import logger
from typing import Optional


ZAPI_BASE = "https://api.z-api.io"


class ZAPIClient:
    """Stateless client for Z-API WhatsApp integration."""

    @staticmethod
    def _build_url(instance_id: str, token: str, endpoint: str) -> str:
        return f"{ZAPI_BASE}/instances/{instance_id}/token/{token}/{endpoint}"

    @staticmethod
    def _headers(client_token: str) -> dict:
        return {
            "Content-Type": "application/json",
            "Client-Token": client_token,
        }

    @staticmethod
    async def send_text(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        message: str,
        delay_typing: int = 10,
    ) -> dict:
        """Send a text message via Z-API.
        
        Args:
            delay_typing: Seconds to show "typing..." before the message arrives.
                          Range: 1-15s. Set 0 to disable. Default: 10s.
        """
        url = ZAPIClient._build_url(instance_id, token, "send-text")
        payload = {
            "phone": phone,
            "message": message,
        }
        if delay_typing and 1 <= delay_typing <= 15:
            payload["delayTyping"] = delay_typing
        return await _post(url, payload, client_token)

    @staticmethod
    async def send_image(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        image_url: str,
        caption: Optional[str] = None,
    ) -> dict:
        """Send an image message via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "send-image")
        payload = {
            "phone": phone,
            "image": image_url,
        }
        if caption:
            payload["caption"] = caption
        return await _post(url, payload, client_token)

    @staticmethod
    async def send_document(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        document_url: str,
        filename: Optional[str] = None,
    ) -> dict:
        """Send a document via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "send-document")
        payload = {
            "phone": phone,
            "document": document_url,
        }
        if filename:
            payload["fileName"] = filename
        return await _post(url, payload, client_token)

    @staticmethod
    async def send_audio(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        audio_url: str,
    ) -> dict:
        """Send an audio message via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "send-audio")
        payload = {
            "phone": phone,
            "audio": audio_url,
        }
        return await _post(url, payload, client_token)

    @staticmethod
    async def send_video(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        video_url: str,
        caption: Optional[str] = None,
    ) -> dict:
        """Send a video via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "send-video")
        payload = {
            "phone": phone,
            "video": video_url,
        }
        if caption:
            payload["caption"] = caption
        return await _post(url, payload, client_token)

    @staticmethod
    async def send_button_list(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        message: str,
        buttons: list[dict],
    ) -> dict:
        """Send interactive buttons via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "send-button-list")
        payload = {
            "phone": phone,
            "message": message,
            "buttonList": {
                "buttons": buttons,
            },
        }
        return await _post(url, payload, client_token)

    @staticmethod
    async def read_message(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
        message_id: str,
    ) -> dict:
        """Mark a message as read via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "read-message")
        payload = {
            "phone": phone,
            "messageId": message_id,
        }
        return await _post(url, payload, client_token)

    @staticmethod
    async def phone_exists(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
    ) -> dict:
        """Check if a phone number has WhatsApp."""
        url = ZAPIClient._build_url(instance_id, token, f"phone-exists/{phone}")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers=ZAPIClient._headers(client_token),
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Z-API phone-exists check failed: {e}")
            return {"exists": False, "error": str(e)}

    @staticmethod
    async def get_instance_status(
        instance_id: str,
        token: str,
        client_token: str,
    ) -> dict:
        """Check if the Z-API instance is connected to WhatsApp.
        
        Returns dict with 'connected' bool and optionally 'smartStatus',
        'error', 'statusCode'. Does NOT raise on HTTP errors — a 400
        simply means the instance exists but isn't paired yet.
        """
        url = ZAPIClient._build_url(instance_id, token, "status")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers=ZAPIClient._headers(client_token),
                )
                data = resp.json() if resp.status_code != 204 else {}

                # Z-API returns 200 + {"connected": true/false, ...}
                # or 400 when instance not yet paired — both are valid
                if resp.status_code == 200:
                    return {
                        "connected": data.get("connected", False),
                        "smartStatus": data.get("smartStatus", "unknown"),
                        "statusCode": resp.status_code,
                    }

                # Non-200 but still reachable = instance exists, not connected
                logger.warning(
                    f"Z-API status returned {resp.status_code} for {instance_id}: {data}"
                )
                return {
                    "connected": False,
                    "smartStatus": data.get("smartStatus", "disconnected"),
                    "statusCode": resp.status_code,
                }
        except httpx.TimeoutException:
            logger.error(f"Z-API status timeout for instance {instance_id}")
            return {"connected": False, "error": "timeout", "statusCode": 0}
        except Exception as e:
            logger.error(f"Z-API status check failed: {e}")
            return {"connected": False, "error": str(e), "statusCode": 0}

    @staticmethod
    async def get_profile_picture(
        instance_id: str,
        token: str,
        client_token: str,
        phone: str,
    ) -> Optional[str]:
        """Get the profile picture URL for a phone number."""
        url = ZAPIClient._build_url(instance_id, token, f"profile-picture/{phone}")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers=ZAPIClient._headers(client_token),
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("link")
        except Exception as e:
            logger.error(f"Z-API profile-picture failed: {e}")
            return None

    @staticmethod
    async def disconnect(
        instance_id: str,
        token: str,
        client_token: str,
    ) -> dict:
        """Disconnect the Z-API instance from WhatsApp."""
        url = ZAPIClient._build_url(instance_id, token, "disconnect")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    url,
                    headers=ZAPIClient._headers(client_token),
                )
                return resp.json()
        except Exception as e:
            logger.error(f"Z-API disconnect failed: {e}")
            return {"error": str(e)}

    @staticmethod
    async def get_qr_code(
        instance_id: str,
        token: str,
        client_token: str,
    ) -> dict:
        """Get the QR code to connect W via Z-API."""
        url = ZAPIClient._build_url(instance_id, token, "qr-code/image")
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    url,
                    headers=ZAPIClient._headers(client_token),
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Z-API QR code failed: {e}")
            return {"error": str(e)}


# ── Shared HTTP helper ───────────────────────────────
async def _post(url: str, payload: dict, client_token: str) -> dict:
    """POST to Z-API with auth and error handling."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Client-Token": client_token,
                },
            )
            data = resp.json()

            if resp.status_code >= 400:
                error_msg = data.get("message", data.get("error", "Unknown Z-API error"))
                logger.error(
                    f"Z-API error [{resp.status_code}]: {error_msg} "
                    f"(url={url})"
                )
                return {"error": error_msg, "status_code": resp.status_code}

            logger.debug(f"Z-API OK: {url}")
            return data
    except Exception as e:
        logger.error(f"Z-API request failed: {e}")
        return {"error": str(e)}
