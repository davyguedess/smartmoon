"""
NEXUS.IA — Audience Analysis Service
Skill: Instagram Campaign Publisher
Geração de análise de público via LLM (Ollama).
"""
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.campaign import CampaignPost, CampaignAudienceAnalysis, CampaignAsset
from app.core.config import settings


async def _call_ollama(prompt: str, model: str = "llama3.2") -> str:
    ollama_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


async def generate_audience_analysis(
    db: AsyncSession,
    campaign: CampaignPost,
) -> CampaignAudienceAnalysis:
    """Gera análise de público via LLM e persiste em campaign_audience_analysis."""

    prompt = f"""Você é um especialista em tráfego pago e marketing digital.

Gere uma análise de público-alvo para a seguinte campanha de Instagram:

Campanha: {campaign.campaign_name}
Produto/Serviço: {campaign.product_or_service or "não especificado"}
Nicho: {campaign.niche or "não especificado"}
Objetivo: {campaign.objective}
Briefing: {campaign.briefing_text or "sem briefing"}

Retorne um JSON com a seguinte estrutura:
{{
  "niche_summary": "resumo do nicho em 2-3 frases",
  "audience_profile": "perfil detalhado do público-alvo em 3-4 frases",
  "competitor_examples": ["Exemplo de concorrente 1", "Exemplo 2", "Exemplo 3"],
  "recommended_interests": ["Interesse 1", "Interesse 2", "Interesse 3", "Interesse 4", "Interesse 5"],
  "recommended_regions": ["Estado/Cidade 1", "Estado/Cidade 2", "Estado/Cidade 3"],
  "estimated_budget_range": "R$ 300–R$ 1.500/mês"
}}

Retorne APENAS o JSON, sem texto adicional."""

    raw = await _call_ollama(prompt)

    # Parse JSON
    import json, re
    try:
        # Extrair JSON do texto (caso o modelo adicione texto adicional)
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback se o LLM não retornar JSON válido
        data = {
            "niche_summary": raw[:500],
            "audience_profile": "Análise gerada — formato inesperado do LLM.",
            "competitor_examples": [],
            "recommended_interests": [],
            "recommended_regions": [],
            "estimated_budget_range": "A determinar",
        }

    # Verificar se já existe análise para esta campanha
    result = await db.execute(
        select(CampaignAudienceAnalysis).where(
            CampaignAudienceAnalysis.campaign_post_id == campaign.id
        )
    )
    analysis = result.scalar_one_or_none()

    if analysis:
        # Atualizar existente
        analysis.niche_summary = data.get("niche_summary")
        analysis.audience_profile = data.get("audience_profile")
        analysis.competitor_examples_json = data.get("competitor_examples", [])
        analysis.recommended_interests_json = data.get("recommended_interests", [])
        analysis.recommended_regions_json = data.get("recommended_regions", [])
        analysis.estimated_budget_range = data.get("estimated_budget_range")
    else:
        analysis = CampaignAudienceAnalysis(
            campaign_post_id=campaign.id,
            niche_summary=data.get("niche_summary"),
            audience_profile=data.get("audience_profile"),
            competitor_examples_json=data.get("competitor_examples", []),
            recommended_interests_json=data.get("recommended_interests", []),
            recommended_regions_json=data.get("recommended_regions", []),
            estimated_budget_range=data.get("estimated_budget_range"),
        )
        db.add(analysis)

    await db.commit()
    await db.refresh(analysis)
    return analysis


async def generate_pdf_stub(
    db: AsyncSession,
    campaign: CampaignPost,
    analysis: CampaignAudienceAnalysis,
) -> CampaignAsset:
    """
    Stub: gera um asset de PDF com resumo da análise.
    Em produção: usar ReportLab ou WeasyPrint para gerar PDF real.
    """
    pdf_content = f"""ANÁLISE DE TRÁFEGO PAGO
Campanha: {campaign.campaign_name}

RESUMO DO NICHO
{analysis.niche_summary or 'Não disponível'}

PERFIL DO PÚBLICO
{analysis.audience_profile or 'Não disponível'}

INTERESSES RECOMENDADOS
{', '.join(analysis.recommended_interests_json or [])}

REGIÕES RECOMENDADAS
{', '.join(analysis.recommended_regions_json or [])}

CONCORRENTES REFERÊNCIA
{', '.join(analysis.competitor_examples_json or [])}

ESTIMATIVA DE INVESTIMENTO
{analysis.estimated_budget_range or 'A determinar'}

---
Gerado por Smart Moon — Instagram Campaign Publisher
"""

    result = await db.execute(
        select(func.max(CampaignAsset.version_number)).where(
            CampaignAsset.campaign_post_id == campaign.id,
            CampaignAsset.asset_type == "pdf",
        )
    )
    max_version = result.scalar() or 0

    asset = CampaignAsset(
        campaign_post_id=campaign.id,
        asset_type="pdf",
        origin="system",
        version_number=max_version + 1,
        content_text=pdf_content,
        mime_type="text/plain",  # stub; em produção: application/pdf
        approval_status="approved",
        metadata_json={"note": "PDF stub — integre ReportLab para PDF real"},
    )
    db.add(asset)

    if analysis:
        analysis.pdf_asset_id = None  # será atualizado após flush
        await db.flush()
        analysis.pdf_asset_id = asset.id

    await db.commit()
    await db.refresh(asset)
    return asset
