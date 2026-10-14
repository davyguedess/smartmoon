"""Whisper STT Handler — with timeout, retry, key_resolver, and masked errors."""
import httpx
import base64
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class WhisperHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        audio_b64 = self.context.get("audio_b64") or input_payload.get("audio_b64")
        audio_url = self.context.get("audio_url") or input_payload.get("audio_url")
        language = self.config.get("language", "pt")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("openai", company_id, db, settings.OPENAI_API_KEY)

        # Audio DMs are pre-transcribed by the worker (Gemini) before the flow runs
        pre_transcript = (
            input_payload.get("whisper_transcript")
            or self.context.get("whisper_transcript")
        )
        if not audio_b64 and not audio_url:
            if pre_transcript:
                logger.info(f"🎙️ Using pre-transcribed audio: {pre_transcript[:80]}...")
                return {
                    "whisper_transcript": pre_transcript,
                    "message": pre_transcript,
                    "language": language,
                }
            return {"whisper_transcript": None, "error": "Nenhum áudio no contexto"}

        if not api_key:
            logger.warning("OpenAI Whisper: API key not configured — mock mode")
            return {
                "whisper_transcript": "[MOCK] Áudio transcrito: cliente solicitou informações sobre pagamento.",
                "language": language,
            }

        try:
            if audio_b64:
                audio_bytes = base64.b64decode(audio_b64)
            else:
                async with httpx.AsyncClient(timeout=get_timeout("default")) as client:
                    r = await client.get(audio_url)
                    audio_bytes = r.content

            async with httpx.AsyncClient(timeout=get_timeout("whisper")) as client:
                async def _call():
                    files = {"file": ("audio.ogg", audio_bytes, "audio/ogg")}
                    data = {"model": "whisper-1", "language": language}
                    resp = await client.post(
                        "https://api.openai.com/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {api_key}"},
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="whisper")
                transcript = resp.json().get("text", "")
                logger.success(f"🎙️ Whisper transcript: {transcript[:80]}...")
                return {
                    "whisper_transcript": transcript,
                    "message": transcript,
                    "language": language,
                }
        except Exception as e:
            logger.error(f"Whisper error: {mask_error(e)}")
            return {"whisper_transcript": None, "error": mask_error(e)}
