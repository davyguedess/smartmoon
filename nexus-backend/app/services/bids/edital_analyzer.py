"""
Análise profunda de editais de licitação usando IA.
Recebe o texto completo do edital e retorna um checklist detalhado
de exigências com status, referências e recomendações.
"""
import json
import httpx
from typing import Optional
from loguru import logger

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"

# Prompt focado em análise de exigências
EDITAL_ANALYSIS_PROMPT = """Você é um especialista em licitações públicas brasileiras com 20 anos de experiência.
Analise o texto do edital abaixo e identifique TODAS as exigências de habilitação e participação.

REGRAS:
1. Classifique cada exigência em uma das categorias: "juridica", "fiscal", "tecnica", "economica", "proposta", "outras"
2. Para cada exigência, indique a seção/cláusula do edital onde foi encontrada
3. Copie um trecho curto do texto original que comprova a exigência
4. Avalie a complexidade: "simples" (documento padrão), "medio" (precisa preparar), "complexo" (difícil de atender)

RESPONDA EXCLUSIVAMENTE em JSON válido (sem markdown):
{{
  "edital_summary": "Resumo executivo do edital em 3-4 frases",
  "objeto": "Descrição clara do objeto da licitação",
  "modalidade": "Tipo de licitação identificado",
  "valor_estimado": "Valor se mencionado",
  "prazo_proposta": "Data/prazo para envio de propostas",
  "checklist": [
    {{
      "id": 1,
      "category": "juridica|fiscal|tecnica|economica|proposta|outras",
      "requirement": "Descrição clara da exigência",
      "complexity": "simples|medio|complexo",
      "document_section": "Cláusula X.Y.Z — pág. N",
      "excerpt": "Trecho do edital que menciona esta exigência...",
      "action_needed": "O que a empresa precisa fazer para atender",
      "common_documents": ["Documento 1", "Documento 2"]
    }}
  ],
  "summary": {{
    "total_requirements": 0,
    "simples": 0,
    "medio": 0,
    "complexo": 0
  }},
  "risks": ["Risco 1", "Risco 2"],
  "estimated_preparation_days": 5,
  "recommendation": "participar|avaliar_com_cautela|descartar",
  "recommendation_justification": "Justificativa da recomendação"
}}

## TEXTO DO EDITAL (primeiros {max_chars} caracteres):
{edital_text}
"""


async def analyze_edital(edital_text: str, bid_info: dict = None) -> dict:
    """
    Analisa o texto completo do edital com IA.
    Retorna checklist detalhado de exigências.
    """
    if not edital_text or len(edital_text) < 100:
        return _error_response("Texto do edital muito curto ou vazio para análise")

    # Limita texto para o contexto do modelo
    max_chars = 12000  # ~3000 tokens para modelos menores
    prompt = EDITAL_ANALYSIS_PROMPT.format(
        edital_text=edital_text[:max_chars],
        max_chars=max_chars,
    )

    # Tenta Groq primeiro (sempre disponível na VPS, ultra-rápido)
    result = await _call_groq(prompt, edital_text)
    if result:
        return result

    # Fallback: OpenAI (melhor para análise longa)
    result = await _call_openai(prompt, edital_text)
    if result:
        return result

    # Fallback: Ollama local
    result = await _call_ollama(prompt)
    if result:
        return result

    # Último fallback: análise básica por regex
    return _regex_analysis(edital_text, bid_info)


async def _call_groq(prompt: str, full_text: str) -> Optional[dict]:
    """Usa Groq (Llama 3.3 70B) para análise — ultra-rápido, sempre disponível."""
    import os
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.info("[EditalAnalyzer] Groq key não configurada, tentando próximo provider")
        return None

    max_chars = 30000  # Groq aceita até 128k tokens
    analysis_prompt = EDITAL_ANALYSIS_PROMPT.format(
        edital_text=full_text[:max_chars],
        max_chars=max_chars,
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    "messages": [{"role": "user", "content": analysis_prompt}],
                    "temperature": 0.15,
                    "max_tokens": 4096,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(text)
            logger.info(f"[EditalAnalyzer] Groq: {len(data.get('checklist', []))} exigências encontradas")
            return data
    except Exception as e:
        logger.warning(f"[EditalAnalyzer] Groq error: {e}")
        return None


async def _call_openai(prompt: str, full_text: str) -> Optional[dict]:
    """Usa OpenAI GPT-4o-mini para análise profunda (contexto maior)."""
    import os
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.info("[EditalAnalyzer] OpenAI key não configurada, usando fallback")
        return None

    # GPT-4o-mini aceita até 128k tokens — envia texto mais completo
    max_chars = 50000
    analysis_prompt = EDITAL_ANALYSIS_PROMPT.format(
        edital_text=full_text[:max_chars],
        max_chars=max_chars,
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": analysis_prompt}],
                    "temperature": 0.15,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(text)
            logger.info(f"[EditalAnalyzer] OpenAI: {len(data.get('checklist', []))} exigências encontradas")
            return data
    except Exception as e:
        logger.warning(f"[EditalAnalyzer] OpenAI error: {e}")
        return None


async def _call_ollama(prompt: str) -> Optional[dict]:
    """Usa Ollama local como fallback."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.15, "num_predict": 2000},
                },
            )
            resp.raise_for_status()
            text = resp.json().get("response", "")
            # Extrai JSON
            text = text.strip()
            if "```" in text:
                start = text.find("{")
                end = text.rfind("}") + 1
                text = text[start:end]
            data = json.loads(text)
            return data
    except Exception as e:
        logger.warning(f"[EditalAnalyzer] Ollama error: {e}")
        return None


def _regex_analysis(text: str, bid_info: dict = None) -> dict:
    """Análise básica por regex quando IA não está disponível."""
    import re

    checklist = []
    idx = 1

    # Patterns de exigências comuns
    patterns = {
        "juridica": [
            (r"contrato social|ato constitutivo", "Contrato Social ou Ato Constitutivo"),
            (r"procuração|representante legal", "Procuração do representante legal"),
            (r"cédula de identidade|RG|CPF", "Documentos de identificação do representante"),
        ],
        "fiscal": [
            (r"certidão negativa|CND|FGTS", "Certidões negativas de débitos"),
            (r"regularidade fiscal|prova de regularidade", "Comprovação de regularidade fiscal"),
            (r"CNDT|certidão.*trabalhist", "Certidão de débitos trabalhistas"),
            (r"inscrição.*estadual|inscrição.*municipal", "Inscrição estadual/municipal"),
        ],
        "tecnica": [
            (r"atestado.*capacidade.*técnica", "Atestado de capacidade técnica"),
            (r"registro.*CREA|registro.*CRA|registro.*CRM", "Registro em conselho profissional"),
            (r"experiência.*anterior|comprovação.*experiência", "Comprovação de experiência prévia"),
        ],
        "economica": [
            (r"balanço patrimonial|demonstrações contábeis", "Balanço patrimonial"),
            (r"capital social.*mínimo|patrimônio.*líquido", "Capital social mínimo"),
            (r"garantia.*proposta|caução", "Garantia de proposta"),
        ],
    }

    text_lower = text.lower()
    for category, items in patterns.items():
        for pattern, label in items:
            matches = list(re.finditer(pattern, text_lower))
            if matches:
                # Encontra trecho do contexto
                match = matches[0]
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 100)
                excerpt = text[start:end].strip()

                # Tenta encontrar seção
                section_match = re.search(
                    r'(\d+\.\d+[\.\d]*)',
                    text[max(0, match.start() - 200):match.start()]
                )
                section = f"Seção {section_match.group(1)}" if section_match else "Seção não identificada"

                checklist.append({
                    "id": idx,
                    "category": category,
                    "requirement": label,
                    "complexity": "simples" if category == "fiscal" else "medio",
                    "document_section": section,
                    "excerpt": excerpt[:200],
                    "action_needed": f"Providenciar {label}",
                    "common_documents": [label],
                })
                idx += 1

    simples = sum(1 for c in checklist if c["complexity"] == "simples")
    medio = sum(1 for c in checklist if c["complexity"] == "medio")
    complexo = sum(1 for c in checklist if c["complexity"] == "complexo")

    return {
        "edital_summary": f"Edital analisado por regex — {len(checklist)} exigências identificadas automaticamente. Análise por IA recomendada para resultado mais preciso.",
        "objeto": (bid_info or {}).get("object_text", "Não identificado")[:300],
        "checklist": checklist,
        "summary": {
            "total_requirements": len(checklist),
            "simples": simples,
            "medio": medio,
            "complexo": complexo,
        },
        "risks": ["Análise automática — consulte o edital completo para informações precisas"],
        "estimated_preparation_days": 7,
        "recommendation": "avaliar_com_cautela",
        "recommendation_justification": "Análise gerada por regex. Recomenda-se análise detalhada com IA ou manualmente.",
        "_analysis_method": "regex_fallback",
    }


def _error_response(msg: str) -> dict:
    return {
        "error": msg,
        "checklist": [],
        "summary": {"total_requirements": 0, "simples": 0, "medio": 0, "complexo": 0},
    }
