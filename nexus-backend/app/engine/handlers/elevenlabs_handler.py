"""ElevenLabs TTS Handler — with timeout, retry, and masked errors."""
import httpx
import base64
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class ElevenLabsHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        text = (
            self.context.get("message")
            or self.context.get("openai_response")
            or self.context.get("claude_response")
            or self.config.get("text", "")
            or input_payload.get("message", "")
        )
        voice_id = self.config.get("voice_id", "onwK4e9ZLuTAKqWW03F9")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("elevenlabs", company_id, db, settings.ELEVENLABS_API_KEY)

        if not api_key:
            logger.warning("ElevenLabs not configured — mock mode")
            return {
                "elevenlabs_status": "mock",
                "audio_text": text[:100],
                "note": "Configure ELEVENLABS_API_KEY para gerar áudio real",
            }

        try:
            async with httpx.AsyncClient(timeout=get_timeout("elevenlabs")) as client:
                async def _call():
                    resp = await client.post(
                        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                        json={
                            "text": text,
                            "model_id": "eleven_multilingual_v2",
                            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                        },
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="elevenlabs")
                audio_bytes = resp.content
                audio_b64 = base64.b64encode(audio_bytes).decode()

                phone = self.context.get("customer_phone") or input_payload.get("phone")
                if phone and settings.WHATSAPP_API_URL:
                    await self._send_whatsapp_audio(phone, audio_b64)

                logger.success(f"🔊 ElevenLabs audio: {len(audio_bytes)} bytes for '{text[:40]}...'")
                return {
                    "elevenlabs_status": "generated",
                    "audio_size_bytes": len(audio_bytes),
                    "audio_b64": audio_b64[:50] + "...",
                    "phone": phone,
                }
        except Exception as e:
            logger.error(f"ElevenLabs error: {mask_error(e)}")
            return {"elevenlabs_status": "error", "error": mask_error(e)}

    async def _send_whatsapp_audio(self, phone: str, audio_b64: str):
        try:
            async with httpx.AsyncClient(timeout=get_timeout("whatsapp")) as client:
                await client.post(
                    f"{settings.WHATSAPP_API_URL}/message/sendMedia/{settings.WHATSAPP_INSTANCE}",
                    headers={"apikey": settings.WHATSAPP_API_KEY},
                    json={"number": phone, "mediatype": "audio", "base64": audio_b64, "caption": ""},
                )
                logger.success(f"🔊 Audio sent to WhatsApp {phone}")
        except Exception as e:
            logger.warning(f"WhatsApp audio send failed: {mask_error(e)}")
