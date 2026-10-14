"""Anthropic Claude Node Handler — with retry, timeout, and masked errors."""
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
from app.utils.resilience import get_timeout, with_retry
from app.utils.masks import mask_error


class ClaudeHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        message = (
            self.context.get("message")
            or self.config.get("prompt")
            or input_payload.get("message", "")
        )
        model = self.config.get("model", "claude-3-5-sonnet-20241022")
        system_prompt = self.config.get("system_prompt", "Você é um assistente especializado da Smart Moon. Responda em Português.")

        company_id = self.context.get("company_id") or input_payload.get("company_id")
        db = self.context.get("_db")
        api_key = await resolve_api_key("claude", company_id, db, settings.ANTHROPIC_API_KEY)

        if not api_key:
            logger.warning("Anthropic API key not configured — mock response")
            return {"claude_response": f"[MOCK Claude] Análise: {message[:60]}...", "model": model}

        try:
            async with httpx.AsyncClient(timeout=get_timeout("claude")) as client:
                async def _call():
                    resp = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json",
                        },
                        json={
                            "model": model,
                            "max_tokens": int(self.config.get("max_tokens", 2000)),
                            "system": system_prompt,
                            "messages": [{"role": "user", "content": message}],
                        },
                    )
                    resp.raise_for_status()
                    return resp

                resp = await with_retry(_call, provider="claude")
                data = resp.json()
                reply = data["content"][0]["text"]
                usage = data.get("usage", {})
                logger.success(f"🟠 Claude {model} → {len(reply)} chars")
                return {
                    "claude_response": reply,
                    "model": model,
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "message": reply,
                }
        except Exception as e:
            logger.error(f"Claude error: {mask_error(e)}")
            return {"claude_response": None, "error": mask_error(e)}
