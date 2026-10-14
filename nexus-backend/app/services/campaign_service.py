"""
NEXUS.IA — Campaign Service
Skill: Instagram Campaign Publisher
Controla criação, estados e fluxo de aprovação das campanhas.
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.models.campaign import (
    CampaignPost, CampaignApproval, CampaignAsset,
)
from app.schemas.campaign import APPROVAL_STEPS as STEPS


# Transições válidas da máquina de estados
STATE_TRANSITIONS = {
    "draft_created": ["gathering_inputs", "canceled"],
    "gathering_inputs": ["creative_generation", "caption_generation", "canceled"],
    "creative_generation": ["creative_pending_approval", "error"],
    "creative_pending_approval": ["creative_approved", "needs_revision"],
    "creative_approved": ["caption_generation"],
    "caption_generation": ["caption_pending_approval", "error"],
    "caption_pending_approval": ["caption_approved", "needs_revision"],
    "caption_approved": ["publish_confirmation_pending"],
    "publish_confirmation_pending": ["ads_offer_pending", "publishing", "rejected"],
    "ads_offer_pending": ["audience_analysis_generation", "ready_to_publish"],
    "audience_analysis_generation": ["audience_analysis_pending_approval", "error"],
    "audience_analysis_pending_approval": ["ready_to_publish", "needs_revision"],
    "ready_to_publish": ["publishing", "canceled"],
    "publishing": ["published", "error"],
    "published": [],
    "rejected": ["draft_created"],
    "needs_revision": ["gathering_inputs", "creative_generation", "caption_generation"],
    "canceled": [],
    "error": ["draft_created"],
}


async def create_campaign(
    db: AsyncSession,
    company_id: int,
    created_by: int,
    data: dict,
) -> CampaignPost:
    """Cria uma nova campanha e inicializa as aprovações."""
    campaign = CampaignPost(
        company_id=company_id,
        created_by=created_by,
        status="draft_created",
        **data,
    )
    db.add(campaign)
    await db.flush()  # obter id

    # Criar aprovações iniciais (todas pending)
    for step in STEPS:
        approval = CampaignApproval(
            campaign_post_id=campaign.id,
            step_name=step["step_name"],
            step_order=step["step_order"],
            status="pending",
        )
        db.add(approval)

    await db.commit()
    await db.refresh(campaign)
    return campaign


async def advance_state(
    db: AsyncSession,
    campaign: CampaignPost,
    new_status: str,
) -> CampaignPost:
    """
    Avança o estado da campanha se a transição for válida.
    Lança ValueError se a transição for inválida.
    """
    allowed = STATE_TRANSITIONS.get(campaign.status, [])
    if new_status not in allowed:
        raise ValueError(
            f"Transição inválida: '{campaign.status}' → '{new_status}'. "
            f"Permitidas: {allowed}"
        )
    campaign.status = new_status
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def get_campaign_status_summary(
    db: AsyncSession,
    campaign: CampaignPost,
) -> dict:
    """Retorna o status atual com aprovações e próximo passo."""
    # Carregar aprovações
    result = await db.execute(
        select(CampaignApproval)
        .where(CampaignApproval.campaign_post_id == campaign.id)
        .order_by(CampaignApproval.step_order)
    )
    approvals = result.scalars().all()

    # Next allowed transitions
    next_states = STATE_TRANSITIONS.get(campaign.status, [])

    from app.schemas.campaign import STEP_LABELS
    return {
        "current_status": campaign.status,
        "current_label": STEP_LABELS.get(campaign.status, campaign.status),
        "next_states": next_states,
        "approvals": [
            {
                "step_name": a.step_name,
                "step_order": a.step_order,
                "status": a.status,
                "decision_by": a.decision_by,
                "decision_note": a.decision_note,
            }
            for a in approvals
        ],
        "pending_approvals": sum(1 for a in approvals if a.status == "pending"),
    }


async def get_next_step_hint(campaign: CampaignPost) -> str:
    """Retorna dica sobre a próxima ação esperada."""
    hints = {
        "draft_created": "Clique em 'Avançar' para começar a coletar os insumos da campanha.",
        "gathering_inputs": "Preencha o briefing e selecione a origem do material (upload ou geração por IA).",
        "creative_generation": "Aguardando geração do criativo...",
        "creative_pending_approval": "Revise o criativo e aprove ou rejeite na aba 'Criativo'.",
        "creative_approved": "Criativo aprovado! Avance para gerar a legenda.",
        "caption_generation": "Aguardando geração da legenda...",
        "caption_pending_approval": "Revise a legenda e aprove ou rejeite na aba 'Legenda'.",
        "caption_approved": "Legenda aprovada! Confirme a publicação.",
        "publish_confirmation_pending": "Confirme se deseja publicar agora e se quer análise de tráfego.",
        "ads_offer_pending": "Deseja gerar análise de público para tráfego pago?",
        "audience_analysis_generation": "Gerando análise de público...",
        "audience_analysis_pending_approval": "Revise a análise de público e aprove.",
        "ready_to_publish": "Tudo aprovado! Clique em 'Publicar' para publicar no Instagram.",
        "publishing": "Publicando no Instagram...",
        "published": "Campanha publicada com sucesso!",
        "needs_revision": "Alguma etapa foi rejeitada. Faça as revisões necessárias e reenvie.",
        "rejected": "Campanha rejeitada. Retorne ao rascunho para reiniciar.",
        "canceled": "Campanha cancelada.",
        "error": "Ocorreu um erro. Verifique os logs e tente novamente.",
    }
    return hints.get(campaign.status, "")
