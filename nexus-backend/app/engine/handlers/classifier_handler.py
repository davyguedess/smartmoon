"""Classifier Node Handler — calls Ollama with persistent company context and saves to AgentMemory."""
import json
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings
from app.utils.resilience import get_timeout
from app.utils.masks import mask_error


BASE_SYSTEM_PROMPT = """Você é o Agente Roteador da NEXUS.IA.
Analise a mensagem do usuário e retorne um JSON com:
- intent: a intenção detectada (ex: generate_charge, send_message, activate_campaign)
- entities: entidades extraídas (ex: customer_name, amount, phone)
- confidence: float de 0 a 1
- next_action: próxima ação sugerida

Responda APENAS com JSON válido, sem texto adicional."""


class ClassifierHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        message = self.context.get("message") or input_payload.get("message", "")
        if not message:
            return {"intent": "unknown", "confidence": 0.0}

        model = self.config.get("model") or settings.OLLAMA_MODEL
        company_id = self.context.get("company_id") or input_payload.get("company_id")
        session_id = self.context.get("session_id") or f"flow_{input_payload.get('execution_id', 'default')}"

        # Build system prompt (can be enriched with company context later)
        custom_system = self.config.get("system_prompt", BASE_SYSTEM_PROMPT)

        try:
            async with httpx.AsyncClient(timeout=get_timeout("ollama")) as client:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": model,
                        "stream": False,
                        "keep_alive": -1,
                        "messages": [
                            {"role": "system", "content": custom_system},
                            {"role": "user", "content": message},
                        ],
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["message"]["content"]

                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    # Ollama sometimes wraps JSON in markdown — strip it
                    clean = content.strip().lstrip("```json").rstrip("```").strip()
                    result = json.loads(clean)

                logger.info(f"🧠 Classifier intent: {result.get('intent')} ({result.get('confidence', 0):.0%})")

                # Save to AgentMemory if DB available
                db = self.context.get("_db")
                if db and company_id:
                    try:
                        from app.models import AgentMemory
                        db.add(AgentMemory(
                            company_id=company_id,
                            session_id=session_id,
                            role="user",
                            content=message,
                            model=model,
                            provider="ollama",
                        ))
                        db.add(AgentMemory(
                            company_id=company_id,
                            session_id=session_id,
                            role="assistant",
                            content=json.dumps(result, ensure_ascii=False),
                            model=model,
                            provider="ollama",
                        ))
                        await db.commit()
                    except Exception as mem_err:
                        logger.warning(f"AgentMemory save failed: {mem_err}")

                return {
                    "ai_result": result,
                    "intent": result.get("intent"),
                    "entities": result.get("entities", {}),
                    "confidence": result.get("confidence", 0.0),
                    "next_action": result.get("next_action"),
                }

        except Exception as e:
            logger.warning(f"Classifier failed (Ollama may not be running): {mask_error(e)}")
            return {"intent": "unknown", "confidence": 0.0, "error": mask_error(e)}
