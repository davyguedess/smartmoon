"""
NEXUS.IA — Caption Generation Service
Skill: Instagram Campaign Publisher
Gera legenda, CTA e hashtags via Ollama (LLM local).
"""
import httpx
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.models.campaign import CampaignPost, CampaignAsset
from app.core.config import settings


async def _call_ollama(prompt: str, model: str = "llama3.2") -> str:
    """Chama o Ollama local para geração de texto."""
    ollama_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{ollama_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


async def generate_caption(
    db: AsyncSession,
    campaign: CampaignPost,
    tone: str = "profissional",
    length: str = "medium",
    include_cta: bool = True,
    include_hashtags: bool = True,
    num_hashtags: int = 10,
    language: str = "pt-BR",
) -> CampaignAsset:
    """Gera legenda para Instagram via LLM e salva como asset versionado."""

    length_map = {"short": "curta (até 50 palavras)", "medium": "média (100–150 palavras)", "long": "longa (200 palavras)"}
    length_desc = length_map.get(length, "média (100–150 palavras)")

    prompt = f"""Você é um especialista em marketing digital e copywriting para Instagram.

Crie uma legenda para um post de Instagram com as seguintes características:

- Tom: {tone}
- Comprimento: {length_desc}
- Idioma: {language}
- Produto/Serviço: {campaign.product_or_service or campaign.campaign_name}
- Nicho: {campaign.niche or "geral"}
- Objetivo: {campaign.objective}
- Briefing: {campaign.briefing_text or "sem briefing específico"}
{"- Inclua um CTA (call to action) no final" if include_cta else ""}
{"- Inclua " + str(num_hashtags) + " hashtags relevantes ao final (precedidas de #)" if include_hashtags else ""}

Retorne APENAS a legenda completa, sem explicações ou meta-texto."""

    caption_text = await _call_ollama(prompt)

    # Verificar versão atual
    from sqlalchemy import select, func
    result = await db.execute(
        select(func.max(CampaignAsset.version_number)).where(
            CampaignAsset.campaign_post_id == campaign.id,
            CampaignAsset.asset_type == "caption",
        )
    )
    max_version = result.scalar() or 0

    asset = CampaignAsset(
        campaign_post_id=campaign.id,
        asset_type="caption",
        origin="ai",
        version_number=max_version + 1,
        content_text=caption_text,
        approval_status="pending",
        metadata_json={
            "tone": tone,
            "length": length,
            "language": language,
            "include_cta": include_cta,
            "include_hashtags": include_hashtags,
            "num_hashtags": num_hashtags,
            "model": "llama3.2",
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def generate_hashtags(
    db: AsyncSession,
    campaign: CampaignPost,
    count: int = 15,
    include_niche: bool = True,
) -> CampaignAsset:
    """Gera hashtags para o post via LLM."""
    prompt = f"""Gere {count} hashtags para um post de Instagram.

Nicho: {campaign.niche or "geral"}
Produto/serviço: {campaign.product_or_service or campaign.campaign_name}
Objetivo: {campaign.objective}

{"Inclua hashtags específicas do nicho." if include_niche else ""}

Retorne APENAS as hashtags, uma por linha, com # no início. Sem explicações."""

    hashtags_text = await _call_ollama(prompt)

    from sqlalchemy import select, func
    result = await db.execute(
        select(func.max(CampaignAsset.version_number)).where(
            CampaignAsset.campaign_post_id == campaign.id,
            CampaignAsset.asset_type == "hashtags",
        )
    )
    max_version = result.scalar() or 0

    asset = CampaignAsset(
        campaign_post_id=campaign.id,
        asset_type="hashtags",
        origin="ai",
        version_number=max_version + 1,
        content_text=hashtags_text,
        approval_status="pending",
        metadata_json={"count": count, "include_niche": include_niche},
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset
