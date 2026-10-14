"""CRM Quick Replies — CRUD for message templates / drafts."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import CRMQuickReply

router = APIRouter(prefix="/quick-replies")


class QuickReplyCreate(BaseModel):
    title: str
    content: str
    category: str = "geral"
    shortcut: Optional[str] = None

class QuickReplyUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    shortcut: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_quick_replies(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(CRMQuickReply).where(
        CRMQuickReply.company_id == user.company_id,
        CRMQuickReply.is_active == True,
    )
    if category:
        q = q.where(CRMQuickReply.category == category)
    q = q.order_by(CRMQuickReply.use_count.desc(), CRMQuickReply.title)

    result = await db.execute(q)
    replies = result.scalars().all()
    return {
        "quick_replies": [
            {
                "id": r.id,
                "title": r.title,
                "content": r.content,
                "category": r.category,
                "shortcut": r.shortcut,
                "use_count": r.use_count,
            }
            for r in replies
        ]
    }


@router.post("", status_code=201)
async def create_quick_reply(
    body: QuickReplyCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    reply = CRMQuickReply(
        company_id=user.company_id,
        created_by=user.id,
        title=body.title,
        content=body.content,
        category=body.category,
        shortcut=body.shortcut,
    )
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return {"id": reply.id, "title": reply.title}


@router.put("/{reply_id}")
async def update_quick_reply(
    reply_id: int,
    body: QuickReplyUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMQuickReply).where(
            CRMQuickReply.id == reply_id,
            CRMQuickReply.company_id == user.company_id,
        )
    )
    reply = result.scalar_one_or_none()
    if not reply:
        raise HTTPException(404, "Mensagem rápida não encontrada")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(reply, key, val)
    await db.commit()
    return {"success": True}


@router.delete("/{reply_id}")
async def delete_quick_reply(
    reply_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await db.execute(
        delete(CRMQuickReply).where(
            CRMQuickReply.id == reply_id,
            CRMQuickReply.company_id == user.company_id,
        )
    )
    await db.commit()
    return {"success": True}
