"""
NEXUS.IA — Creative Generation Service (stub)
Skill: Instagram Campaign Publisher
Geração de imagem: stub com placeholder. 
Integração real com SD/DALL-E pode ser plugada via skill image-generator.
"""
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.campaign import CampaignPost, CampaignAsset

# Imagem placeholder SVG inline (base64-encodada em produção ou URL pública)
PLACEHOLDER_IMAGE_TEXT = "[Imagem gerada por IA — placeholder. Configure a skill image-generator para imagens reais.]"


async def generate_image_stub(
    db: AsyncSession,
    campaign: CampaignPost,
    prompt_override: str = "",
) -> CampaignAsset:
    """
    Stub: cria um asset de imagem com conteúdo placeholder.
    Em produção, chamar a API de geração de imagens (DALL-E, Stable Diffusion, etc).
    """
    image_prompt = prompt_override or (
        f"Post de Instagram para {campaign.product_or_service or campaign.campaign_name}. "
        f"Nicho: {campaign.niche or 'geral'}. Tom: profissional. Estilo: moderno e vibrante."
    )

    result = await db.execute(
        select(func.max(CampaignAsset.version_number)).where(
            CampaignAsset.campaign_post_id == campaign.id,
            CampaignAsset.asset_type == "image",
        )
    )
    max_version = result.scalar() or 0

    asset = CampaignAsset(
        campaign_post_id=campaign.id,
        asset_type="image",
        origin="ai",
        version_number=max_version + 1,
        content_text=PLACEHOLDER_IMAGE_TEXT,
        file_path=None,
        mime_type="image/png",
        approval_status="pending",
        metadata_json={
            "image_prompt": image_prompt,
            "generator": "stub",
            "note": "Conecte a skill image-generator para geração real.",
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def save_uploaded_asset(
    db: AsyncSession,
    campaign: CampaignPost,
    file_path: str,
    mime_type: str,
    asset_type: str = "image",
) -> CampaignAsset:
    """Salva um asset enviado pelo usuário (upload manual)."""
    result = await db.execute(
        select(func.max(CampaignAsset.version_number)).where(
            CampaignAsset.campaign_post_id == campaign.id,
            CampaignAsset.asset_type == asset_type,
        )
    )
    max_version = result.scalar() or 0

    asset = CampaignAsset(
        campaign_post_id=campaign.id,
        asset_type=asset_type,
        origin="user",
        version_number=max_version + 1,
        file_path=file_path,
        mime_type=mime_type,
        approval_status="pending",
        metadata_json={"uploaded_by": "user"},
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset
