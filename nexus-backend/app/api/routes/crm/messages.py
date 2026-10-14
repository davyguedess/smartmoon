"""CRM Messages — Send messages with operator identification via SmartMoon Engine."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import httpx
from loguru import logger

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.core.config import settings
from app.models.crm_models import CRMContact, CRMOperator, CRMInteraction, CRMQuickReply

router = APIRouter(prefix="/messages")


@router.get("/history/{contact_id}")
async def get_message_history(
    contact_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna histórico de mensagens (interações) de um contato CRM."""
    # Verify contact belongs to company
    contact = (await db.execute(
        select(CRMContact).where(
            CRMContact.id == contact_id,
            CRMContact.company_id == user.company_id,
        )
    )).scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")

    # Fetch interactions that are messages
    q = (
        select(CRMInteraction)
        .where(
            CRMInteraction.contact_id == contact_id,
            CRMInteraction.company_id == user.company_id,
            CRMInteraction.interaction_type.in_(["message_sent", "message_received"]),
        )
        .order_by(CRMInteraction.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await db.execute(q)).scalars().all()

    # Get operator names
    operator_ids = [r.operator_id for r in rows if r.operator_id]
    operators = {}
    if operator_ids:
        op_result = await db.execute(
            select(CRMOperator).where(CRMOperator.id.in_(set(operator_ids)))
        )
        for op in op_result.scalars().all():
            operators[op.id] = op.display_name

    return {
        "contact_id": contact_id,
        "messages": [
            {
                "id": r.id,
                "type": r.interaction_type,
                "direction": "outbound" if r.interaction_type == "message_sent" else "inbound",
                "content": r.content or r.notes or "",
                "operator": operators.get(r.operator_id),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


class SendMessageBody(BaseModel):
    contact_id: int
    operator_id: int
    text: str
    quick_reply_id: Optional[int] = None  # if using a quick reply template


def _build_signed_message(operator: CRMOperator, text: str) -> str:
    """Prefix message with operator identity using the signature template."""
    template = operator.signature_template or "*{{name}}*\n{{message}}"
    return template.replace("{{name}}", operator.display_name).replace("{{message}}", text)


@router.post("/send")
async def send_message(
    body: SendMessageBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # Fetch contact
    result = await db.execute(
        select(CRMContact).where(
            CRMContact.id == body.contact_id,
            CRMContact.company_id == user.company_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")

    # Fetch operator
    result = await db.execute(
        select(CRMOperator).where(
            CRMOperator.id == body.operator_id,
            CRMOperator.company_id == user.company_id,
        )
    )
    operator = result.scalar_one_or_none()
    if not operator:
        raise HTTPException(404, "Operador não encontrado")

    # Resolve text from quick reply if provided
    text = body.text
    if body.quick_reply_id:
        qr_result = await db.execute(
            select(CRMQuickReply).where(
                CRMQuickReply.id == body.quick_reply_id,
                CRMQuickReply.company_id == user.company_id,
            )
        )
        qr = qr_result.scalar_one_or_none()
        if qr:
            text = qr.content.replace("{{contact_name}}", contact.name or "")
            # Increment use_count
            await db.execute(
                update(CRMQuickReply)
                .where(CRMQuickReply.id == qr.id)
                .values(use_count=CRMQuickReply.use_count + 1)
            )

    # Build signed message
    signed_text = _build_signed_message(operator, text)

    # Find the WhatsApp instance for this company
    # Look up from integrations table
    from app.models import Integration
    int_result = await db.execute(
        select(Integration).where(
            Integration.company_id == user.company_id,
            Integration.provider == "smartmoon",
            Integration.status == "connected",
        )
    )
    integration = int_result.scalar_one_or_none()

    instance_id = None
    if integration and integration.config_json:
        instance_id = integration.config_json.get("instance_id")

    if not instance_id:
        raise HTTPException(503, "Nenhuma instância WhatsApp conectada")

    # Send via SmartMoon Engine
    try:
        engine_url = settings.SMARTMOON_ENGINE_URL
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{engine_url}/messages/send-text",
                headers={"X-API-Key": settings.SMARTMOON_ENGINE_KEY},
                json={
                    "instanceId": instance_id,
                    "phone": contact.phone,
                    "text": signed_text,
                },
            )
            resp.raise_for_status()
            engine_data = resp.json()
    except Exception as e:
        logger.error(f"CRM send_message failed: {e}")
        raise HTTPException(502, f"Erro ao enviar mensagem: {str(e)}")

    # Record interaction
    interaction = CRMInteraction(
        company_id=user.company_id,
        contact_id=contact.id,
        operator_id=operator.id,
        interaction_type="message_sent",
        channel="whatsapp",
        content=text[:2000],
        notes=text[:500],
    )
    db.add(interaction)

    # Update last_contact_at
    await db.execute(
        update(CRMContact)
        .where(CRMContact.id == contact.id)
        .values(last_contact_at=datetime.now(timezone.utc))
    )

    await db.commit()

    return {
        "success": True,
        "message_id": engine_data.get("messageId") or engine_data.get("jobId"),
        "queued": engine_data.get("queued", False),
        "operator": operator.display_name,
        "contact_phone": contact.phone,
    }
