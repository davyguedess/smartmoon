"""
NEXUS.IA — Campaign Schemas (Pydantic)
Skill: Instagram Campaign Publisher
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ─── CampaignPost ─────────────────────────────────────────────────────────────

class CampaignPostCreate(BaseModel):
    campaign_name: str
    objective: str = "engagement"
    post_type: str = "image"
    source_type: str = "ai_generated"
    briefing_text: Optional[str] = None
    target_audience_summary: Optional[str] = None
    niche: Optional[str] = None
    product_or_service: Optional[str] = None
    cta_text: Optional[str] = None
    notes: Optional[str] = None
    agent_id: Optional[int] = None
    integration_id: Optional[int] = None


class CampaignPostUpdate(BaseModel):
    campaign_name: Optional[str] = None
    objective: Optional[str] = None
    post_type: Optional[str] = None
    source_type: Optional[str] = None
    briefing_text: Optional[str] = None
    target_audience_summary: Optional[str] = None
    niche: Optional[str] = None
    product_or_service: Optional[str] = None
    cta_text: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    agent_id: Optional[int] = None
    integration_id: Optional[int] = None


class CampaignPostOut(BaseModel):
    id: int
    company_id: int
    agent_id: Optional[int]
    integration_id: Optional[int]
    campaign_name: str
    channel: str
    objective: str
    post_type: str
    source_type: str
    status: str
    briefing_text: Optional[str]
    target_audience_summary: Optional[str]
    niche: Optional[str]
    product_or_service: Optional[str]
    cta_text: Optional[str]
    notes: Optional[str]
    publish_scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    created_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CampaignPostListItem(BaseModel):
    id: int
    campaign_name: str
    channel: str
    objective: str
    post_type: str
    source_type: str
    status: str
    niche: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    assets_count: int = 0
    pending_approvals: int = 0

    class Config:
        from_attributes = True


# ─── CampaignAsset ────────────────────────────────────────────────────────────

class CampaignAssetOut(BaseModel):
    id: int
    campaign_post_id: int
    asset_type: str
    origin: str
    version_number: int
    content_text: Optional[str]
    file_path: Optional[str]
    mime_type: Optional[str]
    approval_status: str
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    metadata_json: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateCaptionRequest(BaseModel):
    tone: Optional[str] = "profissional"      # profissional | casual | inspirador | divertido
    length: Optional[str] = "medium"          # short | medium | long
    include_cta: Optional[bool] = True
    include_hashtags: Optional[bool] = True
    num_hashtags: Optional[int] = 10
    language: Optional[str] = "pt-BR"


class GenerateHashtagsRequest(BaseModel):
    count: Optional[int] = 15
    include_niche: Optional[bool] = True
    include_trending: Optional[bool] = True


# ─── CampaignApproval ─────────────────────────────────────────────────────────

class ApprovalDecision(BaseModel):
    decision_note: Optional[str] = None


class CampaignApprovalOut(BaseModel):
    id: int
    campaign_post_id: int
    step_name: str
    step_order: int
    status: str
    decision_by: Optional[int]
    decision_note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── CampaignPublishLog ───────────────────────────────────────────────────────

class CampaignPublishLogOut(BaseModel):
    id: int
    campaign_post_id: int
    provider: str
    container_id: Optional[str]
    media_id: Optional[str]
    publish_status: Optional[str]
    error_message: Optional[str]
    response_payload_json: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── CampaignAudienceAnalysis ─────────────────────────────────────────────────

class CampaignAudienceAnalysisOut(BaseModel):
    id: int
    campaign_post_id: int
    niche_summary: Optional[str]
    audience_profile: Optional[str]
    competitor_examples_json: Optional[list]
    recommended_interests_json: Optional[list]
    recommended_regions_json: Optional[list]
    estimated_budget_range: Optional[str]
    pdf_asset_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── CampaignReference ────────────────────────────────────────────────────────

class CampaignReferenceOut(BaseModel):
    id: int
    campaign_post_id: int
    reference_source: str
    reference_url: Optional[str]
    reference_title: Optional[str]
    reference_summary: Optional[str]
    niche_tag: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Flow Status ──────────────────────────────────────────────────────────────

STEP_LABELS = {
    "draft_created": "Rascunho criado",
    "gathering_inputs": "Coletando insumos",
    "creative_generation": "Gerando criativo",
    "creative_pending_approval": "Aguardando aprovação do criativo",
    "creative_approved": "Criativo aprovado",
    "caption_generation": "Gerando legenda",
    "caption_pending_approval": "Aguardando aprovação da legenda",
    "caption_approved": "Legenda aprovada",
    "publish_confirmation_pending": "Aguardando confirmação de publicação",
    "ads_offer_pending": "Aguardando decisão de tráfego pago",
    "audience_analysis_generation": "Gerando análise de público",
    "audience_analysis_pending_approval": "Aguardando aprovação da análise",
    "ready_to_publish": "Pronto para publicar",
    "publishing": "Publicando...",
    "published": "Publicado",
    "rejected": "Rejeitado",
    "needs_revision": "Precisa de revisão",
    "canceled": "Cancelado",
    "error": "Erro",
}

APPROVAL_STEPS = [
    {"step_name": "creative_approval", "step_order": 1, "label": "Aprovação do Criativo"},
    {"step_name": "caption_approval", "step_order": 2, "label": "Aprovação da Legenda"},
    {"step_name": "publish_confirmation", "step_order": 3, "label": "Confirmação de Publicação"},
    {"step_name": "ads_analysis_approval", "step_order": 4, "label": "Aprovação da Análise de Tráfego"},
    {"step_name": "final_publish_approval", "step_order": 5, "label": "Aprovação Final"},
]
