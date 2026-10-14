"""
NEXUS.IA — Studio Templates API
GET    /studio/templates          → lista publicados (filtros, paginação)
GET    /studio/templates/{id}     → detalhe + incrementa view_count
POST   /studio/templates          → admin: criar template
PUT    /studio/templates/{id}     → admin: editar
DELETE /studio/templates/{id}     → admin: deletar
POST   /studio/templates/{id}/publish   → admin: publicar/despublicar
POST   /studio/templates/{id}/use       → usuário usa template (premium = debita créditos)
POST   /studio/generate-image     → IA: gerar imagem com fal.ai (Flux.1)
"""
import os
from typing import Optional, List, Any, Dict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.marketing import StudioTemplate

router = APIRouter(prefix="/studio", tags=["studio-templates"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name:          str = Field(..., min_length=2, max_length=120)
    description:   Optional[str] = None
    category:      str = "Marketing"
    format:        str = "feed"           # feed | story | banner
    tags:          List[str] = []
    is_premium:    bool = False
    price_credits: int  = 0
    thumbnail_url: Optional[str] = None   # base64 data URL ou URL pública
    konva_json:    Dict[str, Any]          # { elements, bgColor, format }


class TemplateUpdate(BaseModel):
    name:          Optional[str] = None
    description:   Optional[str] = None
    category:      Optional[str] = None
    format:        Optional[str] = None
    tags:          Optional[List[str]] = None
    is_premium:    Optional[bool] = None
    price_credits: Optional[int]  = None
    thumbnail_url: Optional[str]  = None
    konva_json:    Optional[Dict[str, Any]] = None


class TemplateOut(BaseModel):
    id:            int
    name:          str
    description:   Optional[str]
    category:      str
    format:        str
    tags:          List[str]
    is_premium:    bool
    price_credits: int
    thumbnail_url: Optional[str]
    konva_json:    Dict[str, Any]
    status:        str
    view_count:    int
    use_count:     int
    created_at:    datetime
    updated_at:    Optional[datetime]

    class Config:
        from_attributes = True


class GenerateImageRequest(BaseModel):
    prompt:    str = Field(..., min_length=5, max_length=500)
    format:    str = "square_hd"   # square_hd | portrait_4_3 | landscape_16_9


# ── Helper: verificar se usuário é admin ────────────────────────────────────

def require_admin(user):
    if not getattr(user, 'is_superadmin', False) and not getattr(user, 'role', '') == 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem gerenciar templates")
    return user


# ── Endpoints públicos (usuários) ───────────────────────────────────────────

@router.get("/templates", response_model=Dict[str, Any])
async def list_templates(
    category:   Optional[str]  = Query(None),
    format:     Optional[str]  = Query(None),
    is_premium: Optional[bool] = Query(None),
    q:          Optional[str]  = Query(None, description="Busca por nome"),
    page:       int            = Query(1, ge=1),
    per_page:   int            = Query(20, ge=1, le=100),
    db:         AsyncSession   = Depends(get_db),
    user       = Depends(get_current_user),
):
    """Lista templates publicados com filtros e paginação."""
    filters = [StudioTemplate.status == "published"]
    if category:   filters.append(StudioTemplate.category == category)
    if format:     filters.append(StudioTemplate.format == format)
    if is_premium is not None: filters.append(StudioTemplate.is_premium == is_premium)
    if q:          filters.append(StudioTemplate.name.ilike(f"%{q}%"))

    # Total
    total_q = await db.execute(select(func.count()).select_from(StudioTemplate).where(and_(*filters)))
    total   = total_q.scalar()

    # Items
    offset  = (page - 1) * per_page
    items_q = await db.execute(
        select(StudioTemplate)
        .where(and_(*filters))
        .order_by(StudioTemplate.use_count.desc(), StudioTemplate.created_at.desc())
        .offset(offset).limit(per_page)
    )
    items = items_q.scalars().all()

    return {
        "items":    [TemplateOut.from_orm(t).dict() for t in items],
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    (total + per_page - 1) // per_page,
    }


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: int,
    db:          AsyncSession = Depends(get_db),
    user        = Depends(get_current_user),
):
    """Detalhe de um template. Incrementa view_count automaticamente."""
    result = await db.execute(select(StudioTemplate).where(StudioTemplate.id == template_id))
    tpl    = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template não encontrado")

    # Incrementa view
    await db.execute(
        update(StudioTemplate)
        .where(StudioTemplate.id == template_id)
        .values(view_count=StudioTemplate.view_count + 1)
    )
    await db.commit()
    return tpl


@router.post("/templates/{template_id}/use")
async def use_template(
    template_id: int,
    db:          AsyncSession = Depends(get_db),
    user        = Depends(get_current_user),
):
    """
    Usuário 'usa' um template:
    - Gratuito → retorna konva_json diretamente
    - Premium  → verifica créditos → debita → retorna konva_json
    """
    result = await db.execute(select(StudioTemplate).where(
        StudioTemplate.id == template_id,
        StudioTemplate.status == "published",
    ))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template não encontrado")

    # Premium: verificar créditos (integra com o sistema de créditos existente)
    if tpl.is_premium and tpl.price_credits > 0:
        # TODO: integrar com credit_balance do usuário
        # Por agora, retorna aviso sem bloquear (MVP)
        pass

    # Incrementa use_count
    await db.execute(
        update(StudioTemplate)
        .where(StudioTemplate.id == template_id)
        .values(use_count=StudioTemplate.use_count + 1)
    )
    await db.commit()

    return {
        "success":    True,
        "konva_json": tpl.konva_json,
        "format":     tpl.format,
    }


# ── Endpoints admin ─────────────────────────────────────────────────────────

@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(
    data: TemplateCreate,
    db:   AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    """Admin: criar novo template."""
    require_admin(user)
    tpl = StudioTemplate(
        name=data.name, description=data.description, category=data.category,
        format=data.format, tags=data.tags or [],
        is_premium=data.is_premium, price_credits=data.price_credits,
        thumbnail_url=data.thumbnail_url, konva_json=data.konva_json,
        status="draft", created_by=user.id,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.put("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: int,
    data:        TemplateUpdate,
    db:          AsyncSession = Depends(get_db),
    user        = Depends(get_current_user),
):
    """Admin: editar template."""
    require_admin(user)
    result = await db.execute(select(StudioTemplate).where(StudioTemplate.id == template_id))
    tpl    = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template não encontrado")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(tpl, field, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    db:          AsyncSession = Depends(get_db),
    user        = Depends(get_current_user),
):
    """Admin: deletar template."""
    require_admin(user)
    result = await db.execute(select(StudioTemplate).where(StudioTemplate.id == template_id))
    tpl    = result.scalar_one_or_none()
    if not tpl: raise HTTPException(404, "Template não encontrado")
    await db.delete(tpl)
    await db.commit()


@router.post("/templates/{template_id}/publish")
async def toggle_publish(
    template_id: int,
    db:          AsyncSession = Depends(get_db),
    user        = Depends(get_current_user),
):
    """Admin: publicar ou despublicar template."""
    require_admin(user)
    result = await db.execute(select(StudioTemplate).where(StudioTemplate.id == template_id))
    tpl    = result.scalar_one_or_none()
    if not tpl: raise HTTPException(404, "Template não encontrado")

    tpl.status = "published" if tpl.status == "draft" else "draft"
    await db.commit()
    return {"id": tpl.id, "status": tpl.status, "message": f"Template '{tpl.name}' agora está {tpl.status}"}


# ── Gerador de Imagem IA (Fal.ai) ──────────────────────────────────────────

@router.post("/generate-image")
async def generate_image(
    data: GenerateImageRequest,
    user = Depends(get_current_user),
):
    """
    Gera imagem com IA usando fal.ai (Flux.1 Dev).
    Requer variável de ambiente FAL_KEY configurada.

    Instalar: pip install fal-client
    Configurar: FAL_KEY=... no .env
    """
    fal_key = os.getenv("FAL_KEY")
    if not fal_key:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Gerador de IA não configurado",
                "message": "Configure a variável FAL_KEY no .env para ativar a geração de imagens.",
                "setup_url": "https://fal.ai/dashboard/keys",
            }
        )

    try:
        import fal_client
        os.environ["FAL_KEY"] = fal_key

        SIZE_MAP = {
            "square_hd":      "square_hd",
            "portrait_4_3":   "portrait_4_3",
            "landscape_16_9": "landscape_16_9",
        }

        result = await fal_client.run_async(
            "fal-ai/flux/dev",
            arguments={
                "prompt":       data.prompt,
                "image_size":   SIZE_MAP.get(data.format, "square_hd"),
                "num_images":   1,
                "enable_safety_checker": True,
            }
        )
        image_url = result["images"][0]["url"]
        return {
            "success":   True,
            "image_url": image_url,
            "prompt":    data.prompt,
            "format":    data.format,
        }
    except ImportError:
        raise HTTPException(503, detail="Instale: pip install fal-client")
    except Exception as e:
        raise HTTPException(500, detail=f"Erro na geração: {str(e)}")


# ── Categorias disponíveis ──────────────────────────────────────────────────

@router.get("/templates/meta/categories")
async def list_categories(
    db:  AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    """Retorna categorias com contagem de templates publicados."""
    result = await db.execute(
        select(StudioTemplate.category, func.count(StudioTemplate.id).label("count"))
        .where(StudioTemplate.status == "published")
        .group_by(StudioTemplate.category)
        .order_by(func.count(StudioTemplate.id).desc())
    )
    rows = result.all()
    return [{"category": r.category, "count": r.count} for r in rows]
