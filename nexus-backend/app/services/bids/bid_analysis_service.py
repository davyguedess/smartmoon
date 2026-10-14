"""
Serviço de análise IA de licitações — gera resumo executivo, riscos e recomendação.
Usa Ollama (local) como primário e OpenAI como fallback.
"""
import json
import httpx
from typing import Optional
from loguru import logger


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

ANALYSIS_PROMPT_TEMPLATE = """
Você é um especialista em licitações públicas brasileiras. Analise a licitação abaixo e responda EXCLUSIVAMENTE em JSON válido com a estrutura especificada.

## LICITAÇÃO
Órgão: {organ_name}
Estado: {state} | Município: {municipality}
Modalidade: {modality}
Valor Estimado: R$ {estimated_value}
Prazo: {deadline_date}
Objeto: {object_text}

## RESPOSTA ESPERADA (JSON puro, sem markdown):
{{
  "executive_summary": "Resumo executivo em 3-4 frases claras e objetivas sobre o que é essa licitação",
  "commercial_potential": "alto|medio|baixo",
  "participation_complexity": "alto|medio|baixo",
  "main_requirements": ["requisito 1", "requisito 2", "requisito 3"],
  "main_risks": ["risco 1", "risco 2", "risco 3"],
  "documents_needed": ["documento 1", "documento 2"],
  "recommendation": "participar|avaliar_com_cautela|descartar",
  "justification": "Justificativa objetiva da recomendação em 2-3 frases"
}}
"""


async def analyze_bid(bid: dict, analysis_level: str = "preliminar") -> dict:
    """
    Analisa uma licitação com IA. Retorna dict com todos os campos de análise.
    Tenta Ollama → OpenAI → fallback estruturado.
    """
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        organ_name=bid.get("organ_name", "Não informado"),
        state=bid.get("state", ""),
        municipality=bid.get("municipality", ""),
        modality=bid.get("modality", "Não informada"),
        estimated_value=f"{bid.get('estimated_value', 0):,.2f}" if bid.get("estimated_value") else "Não informado",
        deadline_date=str(bid.get("deadline_date", "Não informado")),
        object_text=(bid.get("object_text") or bid.get("title") or "")[:2000],
    )

    # Tenta Ollama local
    result = await _call_ollama(prompt)
    if not result:
        # Fallback: OpenAI
        result = await _call_openai(prompt)
    if not result:
        # Último fallback: análise estruturada básica
        result = _fallback_analysis(bid)

    result["analysis_level"] = analysis_level
    return result


async def _call_ollama(prompt: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 800},
                },
            )
            resp.raise_for_status()
            text = resp.json().get("response", "")
            return _parse_json_response(text)
    except Exception as e:
        logger.warning(f"[BidAnalysis] Ollama error: {e}")
        return None


async def _call_openai(prompt: str) -> Optional[dict]:
    import os
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            return _parse_json_response(text)
    except Exception as e:
        logger.warning(f"[BidAnalysis] OpenAI error: {e}")
        return None


def _parse_json_response(text: str) -> Optional[dict]:
    """Extrai JSON da resposta do LLM."""
    text = text.strip()
    # Remove markdown code blocks se presentes
    if "```" in text:
        start = text.find("{")
        end = text.rfind("}") + 1
        text = text[start:end]
    try:
        data = json.loads(text)
        required = ["executive_summary", "recommendation"]
        if all(k in data for k in required):
            return data
    except Exception:
        pass
    return None


def _fallback_analysis(bid: dict) -> dict:
    """Análise estruturada básica sem LLM."""
    val = bid.get("estimated_value") or 0
    return {
        "executive_summary": (
            f"Licitação de {bid.get('modality', 'modalidade não informada')} publicada pelo órgão "
            f"{bid.get('organ_name', 'não identificado')} ({bid.get('state', '')}). "
            f"Objeto: {(bid.get('object_text') or bid.get('title', ''))[:150]}. "
            f"Valor estimado: R$ {val:,.2f}." if val else ""
        ),
        "commercial_potential": "medio",
        "participation_complexity": "medio",
        "main_requirements": [
            "Documentação de habilitação jurídica",
            "Regularidade fiscal e trabalhista",
            "Qualificação técnica conforme edital",
        ],
        "main_risks": [
            "Prazo apertado para elaboração da proposta",
            "Exigências técnicas específicas no edital",
            "Concorrência com empresas estabelecidas no segmento",
        ],
        "documents_needed": [
            "Contrato Social e alterações",
            "Certidões negativas de débitos (Federal, Estadual, Municipal)",
            "Atestado de capacidade técnica",
        ],
        "recommendation": "avaliar_com_cautela",
        "justification": (
            "Análise preliminar automática — leia o edital completo antes de decidir. "
            "Configure um perfil de nicho para obter análise personalizada."
        ),
    }
