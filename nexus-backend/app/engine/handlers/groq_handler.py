"""Groq Handler — ultra-fast LLM. With retry, timeout, and masked errors."""
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class GroqHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        message = (
            self.context.get("message")
            or self.config.get("prompt")
            or input_payload.get("message", "")
        )
        model = self.config.get("model", "llama3-70b-8192")
        system_prompt = self.config.get("system_prompt", "Responda em Português de forma objetiva.")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("groq", company_id, db, settings.GROQ_API_KEY)

        if not api_key:
            logger.warning("Groq API key not configured — mock mode")
            return {"groq_response": f"[MOCK Groq] Rápido: {message[:60]}", "model": model}

        try:
            async with httpx.AsyncClient(timeout=get_timeout("groq")) as client:
                async def _call():
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": message},
                            ],
                            "temperature": float(self.config.get("temperature", 0.6)),
                        },
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="groq")
                data = resp.json()
                reply = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                logger.success(f"⚡ Groq {model} → {len(reply)} chars, {usage.get('total_tokens', 0)} tokens")
                return {
                    "groq_response": reply,
                    "model": model,
                    "tokens_used": usage.get("total_tokens", 0),
                    "message": reply,
                }
        except Exception as e:
            logger.error(f"Groq error: {mask_error(e)}")
            return {"groq_response": None, "error": mask_error(e)}
