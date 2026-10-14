"""
NEXUS.IA — Router Agent
Analyzes incoming messages and classifies intent, extracts entities,
and builds an execution plan using the local Ollama LLM.
"""
import json
import httpx
from loguru import logger
from app.core.config import settings


ROUTER_SYSTEM_PROMPT = """Você é o Agente Roteador da NEXUS.IA — uma plataforma de automação com IA.

Seu trabalho é analisar mensagens de texto e retornar um JSON estruturado com:
{
  "intent": "string — a intenção detectada",
  "confidence": 0.0-1.0,
  "entities": {
    "customer_name": "string ou null",
    "amount": "number ou null",
    "phone": "string ou null",
    "campaign_id": "string ou null"
  },
  "plan": ["lista", "de", "ações", "em", "ordem"],
  "permissions_required": ["finance", "ads", "messaging"]
}

Exemplos de intenções:
- "Cobra o João em R$1500" → intent: "generate_charge"
- "Ativa a campanha quando João pagar" → intent: "charge_and_activate_campaign"
- "Manda mensagem para o cliente" → intent: "send_message"
- "Relatório do dia" → intent: "generate_report"

Responda APENAS com JSON válido."""


class RouterAgent:
    def __init__(self, model: str = None):
        self.model = model or settings.OLLAMA_MODEL

    async def analyze(self, message: str, context: dict = None) -> dict:
        """Analyze a message and return structured intent + plan."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": self.model,
                        "stream": False,
                        "messages": [
                            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                            {"role": "user", "content": message},
                        ],
                    },
                )
                response.raise_for_status()
                content = response.json()["message"]["content"]
                result = json.loads(content)
                logger.info(f"🧠 RouterAgent → intent: {result.get('intent')} ({result.get('confidence', 0):.0%})")
                return result

        except Exception as e:
            logger.warning(f"RouterAgent fallback (Ollama unavailable): {e}")
            return {
                "intent": "unknown",
                "confidence": 0.0,
                "entities": {},
                "plan": [],
                "error": str(e),
            }
