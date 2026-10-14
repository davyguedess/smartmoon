"""CRM Tags — CRUD for custom contact tags."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import CRMTag

router = APIRouter(prefix="/tags")


class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    icon: str = "🏷️"

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


@router.get("")
async def list_tags(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMTag)
        .where(CRMTag.company_id == user.company_id)
        .order_by(CRMTag.name)
    )
    tags = result.scalars().all()
    return {
        "tags": [
            {"id": t.id, "name": t.name, "color": t.color, "icon": t.icon}
            for t in tags
        ]
    }


@router.post("", status_code=201)
async def create_tag(
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    existing = await db.execute(
        select(CRMTag).where(
            CRMTag.company_id == user.company_id,
            CRMTag.name == body.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Tag já existe")

    tag = CRMTag(
        company_id=user.company_id,
        created_by=user.id,
        name=body.name,
        color=body.color,
        icon=body.icon,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@router.put("/{tag_id}")
async def update_tag(
    tag_id: int,
    body: TagUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMTag).where(CRMTag.id == tag_id, CRMTag.company_id == user.company_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(404, "Tag não encontrada")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(tag, key, val)
    await db.commit()
    return {"success": True}


@router.delete("/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await db.execute(
        delete(CRMTag).where(CRMTag.id == tag_id, CRMTag.company_id == user.company_id)
    )
    await db.commit()
    return {"success": True}
