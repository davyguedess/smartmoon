"""
NEXUS.IA — Campaign Posts Routes
Skill: Instagram Campaign Publisher
~20 endpoints cobrindo CRUD, assets, aprovações, análise e publicação.
"""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models import User
from app.models.campaign import (
    CampaignPost, CampaignAsset, CampaignApproval,
    CampaignPublishLog, CampaignAudienceAnalysis, CampaignReference,
)
from app.schemas.campaign import (
    CampaignPostCreate, CampaignPostUpdate, CampaignPostOut, CampaignPostListItem,
    CampaignAssetOut, CampaignApprovalOut, CampaignPublishLogOut,
    CampaignAudienceAnalysisOut, ApprovalDecision,
    GenerateCaptionRequest, GenerateHashtagsRequest,
)
from app.services import campaign_service, approval_service
from app.services.caption_generation_service import generate_caption, generate_hashtags
from app.services.creative_generation_service import generate_image_stub, save_uploaded_asset
from app.services.instagram_publish_service import publish_campaign, get_publish_logs
from app.services.audience_analysis_service import generate_audience_analysis, generate_pdf_stub

router = APIRouter(prefix="/campaign-posts", tags=["Campaign Posts"])

UPLOAD_DIR = "/tmp/nexus_campaign_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Helper ───────────────────────────────────────────────────────────────────

async def _get_campaign_or_404(
    campaign_id: int,
    db: AsyncSession,
    current_user: User,
) -> CampaignPost:
    result = await db.execute(
        select(CampaignPost).where(
            CampaignPost.id == campaign_id,
            CampaignPost.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return campaign


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CampaignPostListItem])
async def list_campaigns(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista campanhas da empresa com contagem de assets e aprovações pendentes."""
    q = select(CampaignPost).where(
        CampaignPost.company_id == current_user.company_id
    )
    if status:
        q = q.where(CampaignPost.status == status)
    q = q.order_by(CampaignPost.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    campaigns = result.scalars().all()

    items = []
    for c in campaigns:
        # Contar assets
        a_result = await db.execute(
            select(func.count(CampaignAsset.id)).where(CampaignAsset.campaign_post_id == c.id)
        )
        assets_count = a_result.scalar() or 0

        # Contar aprovações pendentes
        p_result = await db.execute(
            select(func.count(CampaignApproval.id)).where(
                CampaignApproval.campaign_post_id == c.id,
                CampaignApproval.status == "pending",
            )
        )
        pending = p_result.scalar() or 0

        items.append(CampaignPostListItem(
            id=c.id,
            campaign_name=c.campaign_name,
            channel=c.channel,
            objective=c.objective,
            post_type=c.post_type,
            source_type=c.source_type,
            status=c.status,
            niche=c.niche,
            created_at=c.created_at,
            updated_at=c.updated_at,
            assets_count=assets_count,
            pending_approvals=pending,
        ))

    return items


@router.post("", response_model=CampaignPostOut, status_code=201)
async def create_campaign(
    body: CampaignPostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria nova campanha e inicializa as etapas de aprovação."""
    data = body.model_dump(exclude_none=True)
    campaign = await campaign_service.create_campaign(
        db=db,
        company_id=current_user.company_id,
        created_by=current_user.id,
        data=data,
    )
    return campaign


@router.get("/{campaign_id}", response_model=CampaignPostOut)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_campaign_or_404(campaign_id, db, current_user)


@router.patch("/{campaign_id}", response_model=CampaignPostOut)
async def update_campaign(
    campaign_id: int,
    body: CampaignPostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(campaign, key, val)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    await db.delete(campaign)
    await db.commit()


# ─── Assets ───────────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/assets", response_model=List[CampaignAssetOut])
async def list_assets(
    campaign_id: int,
    asset_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_campaign_or_404(campaign_id, db, current_user)
    q = select(CampaignAsset).where(CampaignAsset.campaign_post_id == campaign_id)
    if asset_type:
        q = q.where(CampaignAsset.asset_type == asset_type)
    q = q.order_by(CampaignAsset.asset_type, CampaignAsset.version_number.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{campaign_id}/assets/upload", response_model=CampaignAssetOut)
async def upload_asset(
    campaign_id: int,
    file: UploadFile = File(...),
    asset_type: str = Form(default="image"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload manual de asset (imagem, vídeo, PDF)."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    file_path = os.path.join(UPLOAD_DIR, f"{campaign_id}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    asset = await save_uploaded_asset(
        db, campaign, file_path, file.content_type or "application/octet-stream", asset_type
    )
    return asset


@router.post("/{campaign_id}/assets/generate-image", response_model=CampaignAssetOut)
async def generate_image_asset(
    campaign_id: int,
    prompt_override: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera criativo com IA (stub). Configura skill image-generator para geração real."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    # Avança estado se necessário
    if campaign.status == "draft_created":
        try:
            await campaign_service.advance_state(db, campaign, "creative_generation")
        except ValueError:
            pass
    asset = await generate_image_stub(db, campaign, prompt_override or "")
    # Mover para pending_approval
    try:
        await campaign_service.advance_state(db, campaign, "creative_pending_approval")
    except ValueError:
        pass
    return asset


@router.post("/{campaign_id}/assets/generate-caption", response_model=CampaignAssetOut)
async def generate_caption_asset(
    campaign_id: int,
    body: GenerateCaptionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera legenda, CTA e hashtags via Ollama."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    if campaign.status in ["creative_approved", "draft_created", "gathering_inputs", "needs_revision"]:
        try:
            await campaign_service.advance_state(db, campaign, "caption_generation")
        except ValueError:
            pass
    asset = await generate_caption(
        db, campaign,
        tone=body.tone,
        length=body.length,
        include_cta=body.include_cta,
        include_hashtags=body.include_hashtags,
        num_hashtags=body.num_hashtags,
        language=body.language,
    )
    try:
        await campaign_service.advance_state(db, campaign, "caption_pending_approval")
    except ValueError:
        pass
    return asset


@router.post("/{campaign_id}/assets/generate-hashtags", response_model=CampaignAssetOut)
async def generate_hashtags_asset(
    campaign_id: int,
    body: GenerateHashtagsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    asset = await generate_hashtags(db, campaign, count=body.count, include_niche=body.include_niche)
    return asset


# ─── Aprovação ────────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/approvals", response_model=List[CampaignApprovalOut])
async def list_approvals(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_campaign_or_404(campaign_id, db, current_user)
    result = await db.execute(
        select(CampaignApproval)
        .where(CampaignApproval.campaign_post_id == campaign_id)
        .order_by(CampaignApproval.step_order)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/approvals/{step_name}/approve", response_model=CampaignApprovalOut)
async def approve_step(
    campaign_id: int,
    step_name: str,
    body: ApprovalDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aprova uma etapa e avança o fluxo da campanha."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    step = await approval_service.approve_step(
        db, campaign, step_name, current_user.id, body.decision_note or ""
    )
    return step


@router.post("/{campaign_id}/approvals/{step_name}/reject", response_model=CampaignApprovalOut)
async def reject_step(
    campaign_id: int,
    step_name: str,
    body: ApprovalDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rejeita uma etapa e move campanha para needs_revision."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    step = await approval_service.reject_step(
        db, campaign, step_name, current_user.id, body.decision_note or ""
    )
    return step


@router.post("/{campaign_id}/request-revision")
async def request_revision(
    campaign_id: int,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    await approval_service.request_revision(db, campaign, reason or "", current_user.id)
    return {"status": "needs_revision", "message": "Revisão solicitada"}


# ─── Análise de público ───────────────────────────────────────────────────────

@router.post("/{campaign_id}/audience-analysis/generate", response_model=CampaignAudienceAnalysisOut)
async def generate_analysis(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera análise de público via LLM (Ollama)."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    try:
        await campaign_service.advance_state(db, campaign, "audience_analysis_generation")
    except ValueError:
        pass
    analysis = await generate_audience_analysis(db, campaign)
    try:
        await campaign_service.advance_state(db, campaign, "audience_analysis_pending_approval")
    except ValueError:
        pass
    return analysis


@router.get("/{campaign_id}/audience-analysis", response_model=CampaignAudienceAnalysisOut)
async def get_analysis(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_campaign_or_404(campaign_id, db, current_user)
    result = await db.execute(
        select(CampaignAudienceAnalysis).where(
            CampaignAudienceAnalysis.campaign_post_id == campaign_id
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não gerada ainda")
    return analysis


@router.post("/{campaign_id}/audience-analysis/generate-pdf", response_model=CampaignAssetOut)
async def generate_pdf(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera PDF com a análise de públivco (stub textual)."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    result = await db.execute(
        select(CampaignAudienceAnalysis).where(
            CampaignAudienceAnalysis.campaign_post_id == campaign_id
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=400, detail="Gere a análise de público primeiro")
    asset = await generate_pdf_stub(db, campaign, analysis)
    return asset


@router.post("/{campaign_id}/references/search")
async def search_references(
    campaign_id: int,
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Salva referências manuais de benchmarking."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    ref = CampaignReference(
        campaign_post_id=campaign.id,
        reference_source="manual",
        reference_title=query or "Referência manual",
        reference_summary="Adicionado manualmente.",
        niche_tag=campaign.niche,
    )
    db.add(ref)
    await db.commit()
    await db.refresh(ref)
    return {"id": ref.id, "reference_title": ref.reference_title, "status": "saved"}


# ─── Publicação ───────────────────────────────────────────────────────────────

@router.post("/{campaign_id}/publish", response_model=CampaignPublishLogOut)
async def publish(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Publica a campanha no Instagram.
    Requer status ready_to_publish e integração com access_token configurado.
    """
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    if campaign.status not in ("ready_to_publish", "publish_confirmation_pending"):
        raise HTTPException(
            status_code=400,
            detail=f"Campanha no estado '{campaign.status}' não pode ser publicada. "
                   f"Status necessário: ready_to_publish"
        )
    try:
        await campaign_service.advance_state(db, campaign, "publishing")
    except ValueError:
        campaign.status = "publishing"
        await db.commit()

    log = await publish_campaign(db, campaign)
    return log


@router.get("/{campaign_id}/publish-logs", response_model=List[CampaignPublishLogOut])
async def list_publish_logs(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_campaign_or_404(campaign_id, db, current_user)
    logs = await get_publish_logs(db, campaign_id)
    return logs


# ─── Status / Fluxo Guiado ────────────────────────────────────────────────────

@router.get("/{campaign_id}/status")
async def get_status(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna status atual, aprovações e próximo passo."""
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    summary = await campaign_service.get_campaign_status_summary(db, campaign)
    hint = await campaign_service.get_next_step_hint(campaign)
    summary["hint"] = hint
    return summary


@router.post("/{campaign_id}/next-step")
async def next_step(
    campaign_id: int,
    target_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Avança para o próximo estado do fluxo.
    Se target_status não informado, usa o primeiro estado permitido.
    """
    campaign = await _get_campaign_or_404(campaign_id, db, current_user)
    from app.services.campaign_service import STATE_TRANSITIONS
    allowed = STATE_TRANSITIONS.get(campaign.status, [])
    if not allowed:
        raise HTTPException(status_code=400, detail=f"Sem transição possível em '{campaign.status}'")

    new_status = target_status if target_status in allowed else allowed[0]
    try:
        updated = await campaign_service.advance_state(db, campaign, new_status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "previous_status": campaign.status,
        "new_status": updated.status,
        "hint": await campaign_service.get_next_step_hint(updated),
    }
