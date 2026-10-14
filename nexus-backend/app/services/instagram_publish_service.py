"""
NEXUS.IA — Instagram Publish Service
Skill: Instagram Campaign Publisher
Integração com a Graph API do Instagram (Meta) para publicação.
"""
import httpx
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.models.campaign import CampaignPost, CampaignPublishLog, CampaignAsset
from sqlalchemy import select

META_GRAPH_URL = "https://graph.facebook.com/v18.0"


async def _get_integration_config(db: AsyncSession, integration_id: int) -> dict:
    from app.models import Integration
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise ValueError(f"Integração {integration_id} não encontrada")
    config = integration.config_json or {}
    return config


async def create_media_container(
    access_token: str,
    ig_user_id: str,
    image_url: str,
    caption: str,
) -> tuple[Optional[str], Optional[str]]:
    """
    Cria container de mídia na Graph API do Instagram.
    Retorna (creation_id, error_message).
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/{ig_user_id}/media",
            params={
                "image_url": image_url,
                "caption": caption,
                "access_token": access_token,
            },
        )
        data = resp.json()
        if "id" in data:
            return data["id"], None
        error = data.get("error", {})
        return None, error.get("message", "Erro desconhecido na criação do container")


async def publish_container(
    access_token: str,
    ig_user_id: str,
    creation_id: str,
) -> tuple[Optional[str], Optional[str]]:
    """
    Publica o container criado.
    Retorna (media_id, error_message).
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/{ig_user_id}/media_publish",
            params={
                "creation_id": creation_id,
                "access_token": access_token,
            },
        )
        data = resp.json()
        if "id" in data:
            return data["id"], None
        error = data.get("error", {})
        return None, error.get("message", "Erro desconhecido na publicação")


async def publish_campaign(
    db: AsyncSession,
    campaign: CampaignPost,
) -> CampaignPublishLog:
    """
    Fluxo completo de publicação Instagram:
    1. Obter token + ig_user_id da integration
    2. Obter caption e image aprovados
    3. Criar container
    4. Publicar container
    5. Salvar log
    """
    request_payload = {}
    publish_log = CampaignPublishLog(
        campaign_post_id=campaign.id,
        provider="meta_instagram",
        publish_status="pending",
    )
    db.add(publish_log)
    await db.flush()

    try:
        if not campaign.integration_id:
            raise ValueError("Nenhuma conta Instagram vinculada a esta campanha.")

        config = await _get_integration_config(db, campaign.integration_id)
        access_token = config.get("access_token")
        ig_user_id = config.get("ig_user_id")

        if not access_token or not ig_user_id:
            raise ValueError("Token de acesso ou ID de usuário Instagram não configurados na integração.")

        # Buscar caption aprovado mais recente
        cap_result = await db.execute(
            select(CampaignAsset)
            .where(
                CampaignAsset.campaign_post_id == campaign.id,
                CampaignAsset.asset_type == "caption",
                CampaignAsset.approval_status == "approved",
            )
            .order_by(CampaignAsset.version_number.desc())
        )
        caption_asset = cap_result.scalars().first()
        caption_text = caption_asset.content_text if caption_asset else ""

        # Buscar imagem aprovada mais recente
        img_result = await db.execute(
            select(CampaignAsset)
            .where(
                CampaignAsset.campaign_post_id == campaign.id,
                CampaignAsset.asset_type == "image",
                CampaignAsset.approval_status == "approved",
            )
            .order_by(CampaignAsset.version_number.desc())
        )
        image_asset = img_result.scalars().first()

        if not image_asset or not image_asset.file_path:
            raise ValueError("Nenhuma imagem aprovada encontrada para publicação.")

        request_payload = {
            "ig_user_id": ig_user_id,
            "image_file": image_asset.file_path,
            "caption": caption_text[:2200],  # limite Instagram
        }
        publish_log.request_payload_json = request_payload

        # Criar container (requer URL pública da imagem)
        image_url = image_asset.file_path  # em produção: URL pública
        creation_id, create_error = await create_media_container(
            access_token, ig_user_id, image_url, caption_text[:2200]
        )

        if create_error:
            raise ValueError(f"Erro ao criar container: {create_error}")

        publish_log.container_id = creation_id

        # Publicar container
        media_id, publish_error = await publish_container(
            access_token, ig_user_id, creation_id
        )

        if publish_error:
            raise ValueError(f"Erro ao publicar: {publish_error}")

        publish_log.media_id = media_id
        publish_log.publish_status = "success"
        publish_log.response_payload_json = {"media_id": media_id}
        campaign.status = "published"
        campaign.published_at = datetime.now(timezone.utc)

    except Exception as e:
        publish_log.publish_status = "error"
        publish_log.error_message = str(e)
        publish_log.request_payload_json = request_payload
        campaign.status = "error"

    await db.commit()
    await db.refresh(publish_log)
    return publish_log


async def get_publish_logs(
    db: AsyncSession,
    campaign_post_id: int,
) -> list:
    result = await db.execute(
        select(CampaignPublishLog)
        .where(CampaignPublishLog.campaign_post_id == campaign_post_id)
        .order_by(CampaignPublishLog.created_at.desc())
    )
    return result.scalars().all()
