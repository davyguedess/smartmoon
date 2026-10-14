"""Google Gemini Node Handler — with retry, timeout, and masked errors."""
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class GeminiHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        message = (
            self.context.get("message")
            or self.config.get("prompt")
            or input_payload.get("message", "")
        )
        model = self.config.get("model", "gemini-1.5-pro")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("gemini", company_id, db, settings.GEMINI_API_KEY)

        if not api_key:
            logger.warning("Gemini API key not configured — mock response")
            return {"gemini_response": f"[MOCK Gemini] {message[:60]}...", "model": model}

        try:
            async with httpx.AsyncClient(timeout=get_timeout("gemini")) as client:
                async def _call():
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        params={"key": api_key},
                        json={
                            "contents": [{"parts": [{"text": message}]}],
                            "generationConfig": {
                                "temperature": float(self.config.get("temperature", 0.7)),
                                "maxOutputTokens": int(self.config.get("max_tokens", 1000)),
                            },
                        },
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="gemini")
                data = resp.json()
                reply = data["candidates"][0]["content"]["parts"][0]["text"]
                logger.success(f"🔷 Gemini {model} → {len(reply)} chars")
                return {"gemini_response": reply, "model": model, "message": reply}
        except Exception as e:
            logger.error(f"Gemini error: {mask_error(e)}")
            return {"gemini_response": None, "error": mask_error(e)}
