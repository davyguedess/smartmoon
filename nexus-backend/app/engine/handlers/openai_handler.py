"""OpenAI GPT-4o Node Handler — with retry, timeout, and masked errors."""
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class OpenAIHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        message = (
            self.context.get("message")
            or self.config.get("prompt")
            or input_payload.get("message", "")
        )
        system_prompt = self.config.get("system_prompt", "Você é um assistente da Smart Moon. Responda em Português.")
        model = self.config.get("model", "gpt-4o")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("openai", company_id, db, settings.OPENAI_API_KEY)

        if not api_key:
            logger.warning("OpenAI API key not configured — mock response")
            return {"openai_response": f"[MOCK GPT-4o] {message[:60]}...", "model": model}

        try:
            async with httpx.AsyncClient(timeout=get_timeout("openai")) as client:
                async def _call():
                    resp = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": message},
                            ],
                            "temperature": float(self.config.get("temperature", 0.7)),
                            "max_tokens": int(self.config.get("max_tokens", 1000)),
                        },
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="openai")
                data = resp.json()
                reply = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                logger.success(f"🤖 OpenAI {model} → {len(reply)} chars, {usage.get('total_tokens', 0)} tokens")
                return {
                    "openai_response": reply,
                    "model": model,
                    "tokens_used": usage.get("total_tokens", 0),
                    "message": reply,
                }
        except Exception as e:
            logger.error(f"OpenAI error: {mask_error(e)}")
            return {"openai_response": None, "error": mask_error(e)}
