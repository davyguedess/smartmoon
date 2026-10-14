"""
SmartMoon WhatsApp Engine Client — Internal bridge to the Node.js microservice.

Replaces Z-API for sending messages, managing instances, and checking status.
Communicates via Docker internal network (http://smartmoon_engine:3100).

All media is passed as file paths on the shared Docker volume (/data/media).
No Base64 encoding is used — the engine reads files directly from disk.

Usage:
    from app.services.smartmoon_client import SmartMoonClient

    # Send text via anti-ban queue
    await SmartMoonClient.send_text("instance-abc", "5511999998888", "Hello!")

    # Create instance + get QR
    await SmartMoonClient.create_instance("instance-abc")
    qr = await SmartMoonClient.get_qr_code("instance-abc")
"""
import httpx
from loguru import logger
from typing import Optional
from app.core.config import settings


# Engine base URL — internal Docker network (NOT exposed to internet)
SMARTMOON_BASE = getattr(settings, "SMARTMOON_ENGINE_URL", "http://smartmoon_engine:3100")
SMARTMOON_API_KEY = getattr(settings, "SMARTMOON_ENGINE_KEY", "smartmoon-dev-key")

_TIMEOUT = 15  # seconds


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-API-Key": SMARTMOON_API_KEY,
    }


async def _post(url: str, payload: dict) -> dict:
    """POST to SmartMoon Engine with error handling."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=_headers())
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:500] if e.response else "no response"
        logger.error(f"SmartMoon API error: {e.response.status_code} {error_body}")
        return {"error": f"HTTP {e.response.status_code}", "detail": error_body}
    except Exception as e:
        logger.error(f"SmartMoon API connection failed: {e}")
        return {"error": str(e)}


async def _get(url: str) -> dict:
    """GET from SmartMoon Engine with error handling."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url, headers=_headers())
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:500] if e.response else "no response"
        logger.error(f"SmartMoon API error: {e.response.status_code} {error_body}")
        return {"error": f"HTTP {e.response.status_code}", "detail": error_body}
    except Exception as e:
        logger.error(f"SmartMoon API connection failed: {e}")
        return {"error": str(e)}


async def _delete(url: str) -> dict:
    """DELETE from SmartMoon Engine."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.delete(url, headers=_headers())
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"SmartMoon API delete failed: {e}")
        return {"error": str(e)}


class SmartMoonClient:
    """Stateless client for the SmartMoon WhatsApp Engine microservice.

    Drop-in replacement for ZAPIClient with the same interface pattern.
    All methods are async static — no state, no initialization required.
    """

    # ── Instance Management ──────────────────────────

    @staticmethod
    async def create_instance(
        instance_id: str,
        webhook_url: Optional[str] = None,
        status_webhook_url: Optional[str] = None,
    ) -> dict:
        """Create a new WhatsApp instance. Returns instance info with QR when ready."""
        url = f"{SMARTMOON_BASE}/instances"
        payload = {
            "id": instance_id,
        }
        if webhook_url:
            payload["webhookUrl"] = webhook_url
        if status_webhook_url:
            payload["statusWebhookUrl"] = status_webhook_url
        return await _post(url, payload)

    @staticmethod
    async def get_instance_status(instance_id: str) -> dict:
        """Get current status of a SmartMoon instance.

        Returns dict with: id, status, phoneNumber, pushName, connectedAt, etc.
        Status values: INITIALIZING, QR_READY, CONNECTING, CONNECTED, DISCONNECTED, LOGGED_OUT, ERROR
        """
        url = f"{SMARTMOON_BASE}/instances/{instance_id}"
        return await _get(url)

    @staticmethod
    async def get_qr_code(instance_id: str) -> dict:
        """Get QR code for pairing.

        Returns: { status, qrCode (data URI), qrRaw (string) }
        If already connected: { status: "CONNECTED", phoneNumber, pushName }
        """
        url = f"{SMARTMOON_BASE}/instances/{instance_id}/qr"
        return await _get(url)

    @staticmethod
    async def list_instances() -> dict:
        """List all active instances with stats."""
        url = f"{SMARTMOON_BASE}/instances"
        return await _get(url)

    @staticmethod
    async def restart_instance(instance_id: str) -> dict:
        """Restart an instance (reconnect with existing session)."""
        url = f"{SMARTMOON_BASE}/instances/{instance_id}/restart"
        return await _post(url, {})

    @staticmethod
    async def logout_instance(instance_id: str) -> dict:
        """Disconnect from WhatsApp and clear session (requires new QR)."""
        url = f"{SMARTMOON_BASE}/instances/{instance_id}/logout"
        return await _post(url, {})

    @staticmethod
    async def delete_instance(instance_id: str) -> dict:
        """Permanently delete an instance and its session data."""
        url = f"{SMARTMOON_BASE}/instances/{instance_id}"
        return await _delete(url)

    # ── Send Messages (via anti-ban queue) ───────────

    @staticmethod
    async def send_text(
        instance_id: str,
        phone: str,
        message: str,
        direct: bool = False,
    ) -> dict:
        """Send a text message via the anti-ban queue.

        Args:
            instance_id: SmartMoon instance ID
            phone: Recipient phone number (e.g. "5511999998888")
            message: Text content
            direct: If True, bypass queue and send immediately (for urgent system msgs)

        Returns:
            { queued: true, jobId: "..." } or { queued: false, messageId: "..." }
        """
        url = f"{SMARTMOON_BASE}/messages/send-text"
        return await _post(url, {
            "instanceId": instance_id,
            "phone": phone,
            "text": message,
            "direct": direct,
        })

    @staticmethod
    async def send_image(
        instance_id: str,
        phone: str,
        image_path: str,
        caption: Optional[str] = None,
    ) -> dict:
        """Send an image. image_path must be on the shared Docker volume."""
        url = f"{SMARTMOON_BASE}/messages/send-image"
        payload = {
            "instanceId": instance_id,
            "phone": phone,
            "imagePath": image_path,
        }
        if caption:
            payload["caption"] = caption
        return await _post(url, payload)

    @staticmethod
    async def send_audio(
        instance_id: str,
        phone: str,
        audio_path: str,
        ptt: bool = True,
    ) -> dict:
        """Send audio/voice note. audio_path must be on the shared Docker volume."""
        url = f"{SMARTMOON_BASE}/messages/send-audio"
        return await _post(url, {
            "instanceId": instance_id,
            "phone": phone,
            "audioPath": audio_path,
            "ptt": ptt,
        })

    @staticmethod
    async def send_document(
        instance_id: str,
        phone: str,
        document_path: str,
        filename: Optional[str] = None,
        mimetype: Optional[str] = None,
    ) -> dict:
        """Send a document. document_path must be on the shared Docker volume."""
        url = f"{SMARTMOON_BASE}/messages/send-document"
        payload = {
            "instanceId": instance_id,
            "phone": phone,
            "documentPath": document_path,
        }
        if filename:
            payload["filename"] = filename
        if mimetype:
            payload["mimetype"] = mimetype
        return await _post(url, payload)

    # ── Groups ──────────────────────────────────────

    @staticmethod
    async def fetch_groups(instance_id: str) -> dict:
        """Fetch all WhatsApp groups that this instance is a member of.

        Returns list of { id, subject, size, isAdmin } from the engine.
        Falls back to empty list if engine doesn't support the endpoint yet.
        """
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{SMARTMOON_BASE}/instances/{instance_id}/groups",
                    headers=_headers(),
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"SmartMoon fetch_groups HTTP error: {e.response.status_code}")
            return {"groups": [], "error": f"HTTP {e.response.status_code}"}
        except Exception as e:
            logger.warning(f"SmartMoon fetch_groups failed: {e}")
            return {"groups": [], "error": str(e)}

    # ── Health ───────────────────────────────────────

    @staticmethod
    async def health() -> dict:
        """Check if the SmartMoon Engine is running."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{SMARTMOON_BASE}/health")
                return resp.json()
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}
