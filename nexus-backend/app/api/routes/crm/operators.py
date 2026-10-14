"""CRM Operators — CRUD for WhatsApp operator identification."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import CRMOperator

router = APIRouter(prefix="/operators")


class OperatorCreate(BaseModel):
    display_name: str
    user_id: Optional[int] = None
    avatar_url: Optional[str] = None
    signature_template: str = "*{{name}}*\n{{message}}"

class OperatorUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    signature_template: Optional[str] = None


@router.get("")
async def list_operators(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMOperator)
        .where(CRMOperator.company_id == user.company_id)
        .order_by(CRMOperator.display_name)
    )
    ops = result.scalars().all()
    return {
        "operators": [
            {
                "id": o.id,
                "display_name": o.display_name,
                "user_id": o.user_id,
                "avatar_url": o.avatar_url,
                "is_active": o.is_active,
                "signature_template": o.signature_template,
            }
            for o in ops
        ]
    }


@router.post("", status_code=201)
async def create_operator(
    body: OperatorCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    op = CRMOperator(
        company_id=user.company_id,
        user_id=body.user_id or user.id,
        display_name=body.display_name,
        avatar_url=body.avatar_url,
        signature_template=body.signature_template,
    )
    db.add(op)
    await db.commit()
    await db.refresh(op)
    return {"id": op.id, "display_name": op.display_name}


@router.put("/{operator_id}")
async def update_operator(
    operator_id: int,
    body: OperatorUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMOperator).where(
            CRMOperator.id == operator_id,
            CRMOperator.company_id == user.company_id,
        )
    )
    op = result.scalar_one_or_none()
    if not op:
        raise HTTPException(404, "Operador não encontrado")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(op, key, val)
    await db.commit()
    return {"success": True}
