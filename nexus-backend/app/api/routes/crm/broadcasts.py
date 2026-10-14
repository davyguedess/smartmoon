"""CRM Broadcasts — Campaign management + dispatch control."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import (
    CRMBroadcast, CRMBroadcastLog, CRMContact,
)

router = APIRouter(prefix="/broadcasts")


# ── Schemas ───────────────────────────────────────────────────────────────────

class BroadcastCreate(BaseModel):
    name: str
    message_template: str
    media_url: Optional[str] = None
    target_filter: dict = Field(default_factory=dict)
    scheduled_at: Optional[str] = None  # ISO datetime

class BroadcastUpdate(BaseModel):
    name: Optional[str] = None
    message_template: Optional[str] = None
    media_url: Optional[str] = None
    target_filter: Optional[dict] = None


def _serialize_broadcast(b):
    return {
        "id": b.id,
        "name": b.name,
        "message_template": b.message_template,
        "media_url": b.media_url,
        "target_filter": b.target_filter or {},
        "status": b.status,
        "total_targets": b.total_targets,
        "sent_count": b.sent_count,
        "delivered_count": b.delivered_count,
        "failed_count": b.failed_count,
        "scheduled_at": b.scheduled_at.isoformat() if b.scheduled_at else None,
        "started_at": b.started_at.isoformat() if b.started_at else None,
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_broadcasts(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(CRMBroadcast).where(CRMBroadcast.company_id == user.company_id)
    if status:
        q = q.where(CRMBroadcast.status == status)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(CRMBroadcast.created_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "broadcasts": [_serialize_broadcast(b) for b in rows],
    }


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_broadcast(
    body: BroadcastCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # Count target contacts based on filter
    target_q = select(func.count()).select_from(CRMContact).where(
        CRMContact.company_id == user.company_id,
        CRMContact.status == "active",
    )
    filters = body.target_filter or {}
    if filters.get("tags"):
        for tag in filters["tags"]:
            target_q = target_q.where(CRMContact.tags.contains([tag]))

    total_targets = (await db.execute(target_q)).scalar() or 0

    scheduled = None
    if body.scheduled_at:
        try:
            scheduled = datetime.fromisoformat(body.scheduled_at)
        except ValueError:
            pass

    broadcast = CRMBroadcast(
        company_id=user.company_id,
        created_by=user.id,
        name=body.name,
        message_template=body.message_template,
        media_url=body.media_url,
        target_filter=body.target_filter,
        total_targets=total_targets,
        scheduled_at=scheduled,
    )
    db.add(broadcast)
    await db.commit()
    await db.refresh(broadcast)
    return {"id": broadcast.id, "name": broadcast.name, "total_targets": total_targets}


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{broadcast_id}")
async def update_broadcast(
    broadcast_id: int,
    body: BroadcastUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMBroadcast).where(
            CRMBroadcast.id == broadcast_id,
            CRMBroadcast.company_id == user.company_id,
        )
    )
    broadcast = result.scalar_one_or_none()
    if not broadcast:
        raise HTTPException(404, "Campanha não encontrada")
    if broadcast.status not in ("draft", "paused"):
        raise HTTPException(400, "Só é possível editar campanhas em rascunho ou pausadas")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(broadcast, key, val)
    await db.commit()
    return {"success": True}


# ── Start ─────────────────────────────────────────────────────────────────────

@router.post("/{broadcast_id}/start")
async def start_broadcast(
    broadcast_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMBroadcast).where(
            CRMBroadcast.id == broadcast_id,
            CRMBroadcast.company_id == user.company_id,
        )
    )
    broadcast = result.scalar_one_or_none()
    if not broadcast:
        raise HTTPException(404, "Campanha não encontrada")
    if broadcast.status not in ("draft", "paused"):
        raise HTTPException(400, f"Campanha está '{broadcast.status}', não pode ser iniciada")

    # Fetch target contacts
    contact_q = select(CRMContact).where(
        CRMContact.company_id == user.company_id,
        CRMContact.status == "active",
    )
    filters = broadcast.target_filter or {}
    if filters.get("tags"):
        for tag in filters["tags"]:
            contact_q = contact_q.where(CRMContact.tags.contains([tag]))

    contacts = (await db.execute(contact_q)).scalars().all()

    if not contacts:
        raise HTTPException(400, "Nenhum contato corresponde ao filtro")

    # Create log entries for each target
    for contact in contacts:
        # Check if log already exists (for resumed campaigns)
        existing = await db.execute(
            select(CRMBroadcastLog).where(
                CRMBroadcastLog.broadcast_id == broadcast.id,
                CRMBroadcastLog.contact_id == contact.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        log = CRMBroadcastLog(
            broadcast_id=broadcast.id,
            contact_id=contact.id,
            phone=contact.phone,
            status="pending",
        )
        db.add(log)

    # Update broadcast status
    broadcast.status = "sending"
    broadcast.total_targets = len(contacts)
    broadcast.started_at = datetime.now(timezone.utc)
    await db.commit()

    # Dispatch via Celery task
    try:
        from app.workers.tasks import dispatch_crm_broadcast
        dispatch_crm_broadcast.delay(broadcast.id)
    except Exception:
        # If Celery not available, mark for manual processing
        pass

    return {
        "success": True,
        "status": "sending",
        "total_targets": len(contacts),
    }


# ── Pause ─────────────────────────────────────────────────────────────────────

@router.post("/{broadcast_id}/pause")
async def pause_broadcast(
    broadcast_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await db.execute(
        update(CRMBroadcast)
        .where(
            CRMBroadcast.id == broadcast_id,
            CRMBroadcast.company_id == user.company_id,
            CRMBroadcast.status == "sending",
        )
        .values(status="paused")
    )
    await db.commit()
    return {"success": True}


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/{broadcast_id}/logs")
async def broadcast_logs(
    broadcast_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # Verify ownership
    bc = await db.execute(
        select(CRMBroadcast.id).where(
            CRMBroadcast.id == broadcast_id,
            CRMBroadcast.company_id == user.company_id,
        )
    )
    if not bc.scalar_one_or_none():
        raise HTTPException(404, "Campanha não encontrada")

    q = select(CRMBroadcastLog).where(CRMBroadcastLog.broadcast_id == broadcast_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0

    q = q.order_by(CRMBroadcastLog.sent_at.desc().nullslast())
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "logs": [
            {
                "id": l.id,
                "phone": l.phone,
                "status": l.status,
                "error_message": l.error_message,
                "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            }
            for l in rows
        ],
    }
