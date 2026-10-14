"""
NEXUS.IA — Approval Service
Skill: Instagram Campaign Publisher
Gerencia aprovações, rejeições e revisões por etapa.
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.campaign import CampaignPost, CampaignApproval
from app.services.campaign_service import advance_state


# Mapeamento: step_name → estado que a campanha entra após aprovação
STEP_APPROVAL_TRANSITION = {
    "creative_approval": "creative_approved",
    "caption_approval": "caption_approved",
    "publish_confirmation": "publish_confirmation_pending",
    "ads_analysis_approval": "ready_to_publish",
    "final_publish_approval": "ready_to_publish",
}

# Mapeamento: step_name → estado após rejeição
STEP_REJECTION_TRANSITION = {
    "creative_approval": "needs_revision",
    "caption_approval": "needs_revision",
    "publish_confirmation": "rejected",
    "ads_analysis_approval": "needs_revision",
    "final_publish_approval": "rejected",
}


async def _get_step(
    db: AsyncSession, campaign_post_id: int, step_name: str
) -> CampaignApproval:
    result = await db.execute(
        select(CampaignApproval).where(
            CampaignApproval.campaign_post_id == campaign_post_id,
            CampaignApproval.step_name == step_name,
        )
    )
    step = result.scalar_one_or_none()
    if not step:
        raise ValueError(f"Etapa '{step_name}' não encontrada para campanha {campaign_post_id}")
    return step


async def approve_step(
    db: AsyncSession,
    campaign: CampaignPost,
    step_name: str,
    decision_by: int,
    decision_note: str = "",
) -> CampaignApproval:
    """Aprova uma etapa e avança o estado da campanha."""
    step = await _get_step(db, campaign.id, step_name)

    step.status = "approved"
    step.decision_by = decision_by
    step.decision_note = decision_note
    step.updated_at = datetime.now(timezone.utc)

    # Avançar estado se houver transição definida
    next_status = STEP_APPROVAL_TRANSITION.get(step_name)
    if next_status:
        try:
            await advance_state(db, campaign, next_status)
        except ValueError:
            pass  # Se transição não for válida agora, ignora (estado já avançado)

    await db.commit()
    await db.refresh(step)
    return step


async def reject_step(
    db: AsyncSession,
    campaign: CampaignPost,
    step_name: str,
    decision_by: int,
    decision_note: str = "",
) -> CampaignApproval:
    """Rejeita uma etapa e move campanha para needs_revision."""
    step = await _get_step(db, campaign.id, step_name)

    step.status = "rejected"
    step.decision_by = decision_by
    step.decision_note = decision_note
    step.updated_at = datetime.now(timezone.utc)

    next_status = STEP_REJECTION_TRANSITION.get(step_name, "needs_revision")
    try:
        await advance_state(db, campaign, next_status)
    except ValueError:
        campaign.status = next_status
        await db.commit()

    await db.commit()
    await db.refresh(step)
    return step


async def request_revision(
    db: AsyncSession,
    campaign: CampaignPost,
    reason: str = "",
    requested_by: int = None,
) -> CampaignPost:
    """Move campanha para needs_revision e registra motivo."""
    try:
        await advance_state(db, campaign, "needs_revision")
    except ValueError:
        campaign.status = "needs_revision"
        campaign.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(campaign)
    return campaign
