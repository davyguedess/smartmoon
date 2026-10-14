"""
Smart Moon — Marketing Pro: Brand Kit Routes
GET/POST/PUT /marketing/brand-kit  (empresa atual)
POST         /marketing/brand-kit/logo
POST         /marketing/brand-kit/generate-prompt
"""
import os
import uuid
import asyncio
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.marketing import BrandKit, CompanyMarketingModules

router = APIRouter(prefix="/marketing", tags=["marketing-brand-kit"])

UPLOAD_DIR = "/app/uploads/brand"


# ── Schemas ───────────────────────────────────────────────────────────────────

class BrandKitIn(BaseModel):
    brand_name:       str
    product:          Optional[str] = None
    niche:            Optional[str] = None
    target_audience:  Optional[str] = None
    target_gender:    Optional[str] = 'todos'   # todos | masculino | feminino
    target_age_min:   Optional[int] = 18
    target_age_max:   Optional[int] = 65
    city_region:      Optional[str] = None
    color_primary:    Optional[str] = None
    color_secondary:  Optional[str] = None
    color_accent:     Optional[str] = None
    color_background: Optional[str] = None
    font_primary:     Optional[str] = None
    font_secondary:   Optional[str] = None
    visual_styles:    Optional[List[str]] = []
    texture_style:    Optional[str] = None
    comm_tone:        Optional[str] = None
    reference_images: Optional[List[str]] = []
    pre_prompt:       Optional[str] = None


class BrandKitOut(BaseModel):
    id:               int
    company_id:       int
    brand_name:       str
    product:          Optional[str]
    niche:            Optional[str]
    target_audience:  Optional[str]
    target_gender:    Optional[str]
    target_age_min:   Optional[int]
    target_age_max:   Optional[int]
    city_region:      Optional[str]
    logo_url:         Optional[str]
    color_primary:    Optional[str]
    color_secondary:  Optional[str]
    color_accent:     Optional[str]
    color_background: Optional[str]
    font_primary:     Optional[str]
    font_secondary:   Optional[str]
    visual_styles:    Optional[List[str]]
    texture_style:    Optional[str]
    comm_tone:        Optional[str]
    reference_images: Optional[List[str]]
    pre_prompt:       Optional[str]
    created_at:       Optional[datetime]
    updated_at:       Optional[datetime]

    class Config:
        from_attributes = True


class ModulesOut(BaseModel):
    has_brand_kit:    bool
    has_studio:       bool
    has_traffic_pro:  bool
    has_ig_campaigns: bool
    studio_limit:     int


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_modules(db: AsyncSession, company_id: int) -> Optional[CompanyMarketingModules]:
    result = await db.execute(
        select(CompanyMarketingModules).where(CompanyMarketingModules.company_id == company_id)
    )
    return result.scalar_one_or_none()


async def _require_module(db: AsyncSession, company_id: int, module: str):
    # Verificar plano da empresa primeiro — planos premium têm tudo liberado
    try:
        result = await db.execute(
            text("SELECT plan FROM companies WHERE id = :cid"),
            {"cid": company_id},
        )
        row = result.first()
        if row and row[0] and row[0].lower() in {'enterprise', 'business', 'professional', 'pro'}:
            return  # Premium plans have all modules enabled
    except Exception:
        pass

    mods = await _get_modules(db, company_id)
    if not mods or not getattr(mods, module, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Módulo '{module}' não está habilitado para esta empresa. Consulte o administrador."
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=ModulesOut)
async def get_modules(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna quais módulos Marketing Pro estão ativos para a empresa."""
    # Superadmin tem acesso irrestrito a todos os módulos
    if getattr(user, 'is_superadmin', False):
        return ModulesOut(
            has_brand_kit=True, has_studio=True,
            has_traffic_pro=True, has_ig_campaigns=True,
            studio_limit=999,
        )

    # Verificar plano da empresa — Enterprise e Business têm tudo liberado
    company_plan = None
    try:
        result = await db.execute(
            text("SELECT plan FROM companies WHERE id = :cid"),
            {"cid": user.company_id},
        )
        row = result.first()
        company_plan = row[0] if row else None
    except Exception:
        pass

    # Planos premium concedem acesso total automaticamente
    PREMIUM_PLANS = {'enterprise', 'business', 'professional', 'pro'}
    if company_plan and company_plan.lower() in PREMIUM_PLANS:
        return ModulesOut(
            has_brand_kit=True, has_studio=True,
            has_traffic_pro=True, has_ig_campaigns=True,
            studio_limit=999,
        )

    mods = await _get_modules(db, user.company_id)
    if not mods:
        return ModulesOut(
            has_brand_kit=False, has_studio=False,
            has_traffic_pro=False, has_ig_campaigns=False,
            studio_limit=0,
        )
    return ModulesOut(
        has_brand_kit=mods.has_brand_kit,
        has_studio=mods.has_studio,
        has_traffic_pro=mods.has_traffic_pro,
        has_ig_campaigns=mods.has_ig_campaigns,
        studio_limit=mods.studio_limit,
    )



@router.get("/brand-kit", response_model=BrandKitOut)
async def get_brand_kit(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_module(db, user.company_id, "has_brand_kit")
    result = await db.execute(
        select(BrandKit).where(BrandKit.company_id == user.company_id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        raise HTTPException(status_code=404, detail="Brand Kit não encontrado. Crie o seu.")
    return kit


@router.post("/brand-kit", response_model=BrandKitOut)
async def upsert_brand_kit(
    body: BrandKitIn,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_module(db, user.company_id, "has_brand_kit")

    result = await db.execute(
        select(BrandKit).where(BrandKit.company_id == user.company_id)
    )
    kit = result.scalar_one_or_none()

    if kit:
        for k, v in body.model_dump(exclude_none=False).items():
            setattr(kit, k, v)
    else:
        kit = BrandKit(company_id=user.company_id, **body.model_dump())
        db.add(kit)

    await db.commit()
    await db.refresh(kit)
    return kit


@router.post("/brand-kit/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_module(db, user.company_id, "has_brand_kit")

    ext = os.path.splitext(file.filename or "logo.png")[1].lower()
    if ext not in (".png", ".svg", ".jpg", ".jpeg", ".webp"):
        raise HTTPException(400, "Formato inválido. Use PNG, SVG, JPG ou WebP.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{user.company_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()

    async def _write():
        with open(filepath, "wb") as fh:
            fh.write(content)
    await asyncio.to_thread(_write)

    logo_url = f"/uploads/brand/{filename}"

    # Salva a URL no BrandKit se já existir
    result = await db.execute(
        select(BrandKit).where(BrandKit.company_id == user.company_id)
    )
    kit = result.scalar_one_or_none()
    if kit:
        kit.logo_url = logo_url
        await db.commit()

    return {"logo_url": logo_url}


@router.post("/brand-kit/generate-prompt")
async def generate_prompt(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """IA gera o pré-prompt baseado no Brand Kit salvo."""
    await _require_module(db, user.company_id, "has_brand_kit")

    result = await db.execute(
        select(BrandKit).where(BrandKit.company_id == user.company_id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        raise HTTPException(404, "Cadastre o Brand Kit antes de gerar o prompt.")

    styles = ", ".join(kit.visual_styles or []) or "moderno"

    prompt = (
        f"Crie uma arte para {kit.brand_name}, "
        f"empresa de {kit.product or 'produtos/serviços'} "
        f"no nicho de {kit.niche or 'negócios'}. "
        f"Estilo visual: {styles}. "
    )
    if kit.color_primary:
        prompt += f"Use a cor primária {kit.color_primary}"
        if kit.color_secondary:
            prompt += f" e secundária {kit.color_secondary}"
        prompt += ". "
    if kit.font_primary:
        prompt += f"Tipografia no estilo {kit.font_primary}. "
    if kit.texture_style:
        prompt += f"Fundo com textura {kit.texture_style}. "
    if kit.comm_tone:
        prompt += f"Tom de comunicação: {kit.comm_tone}. "
    if kit.target_audience:
        prompt += f"Público-alvo: {kit.target_audience}. "
    prompt += "CTA: {CTA}. Briefing específico: {BRIEFING}"

    # Salva o prompt gerado
    kit.pre_prompt = prompt
    await db.commit()

    return {"pre_prompt": prompt}
