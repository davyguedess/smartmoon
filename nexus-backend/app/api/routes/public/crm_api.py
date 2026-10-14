"""
API Pública — CRM WhatsApp
Permite sistemas externos gerenciar contatos, tags, quick replies,
broadcasts e métricas via API Key.

Autenticação: Authorization: Bearer sm_<chave>
Base URL:     /v1/crm
"""
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.api_key_auth import verify_api_key, log_api_usage
from app.models.crm_models import (
    CRMContact, CRMTag, CRMQuickReply, CRMOperator,
    CRMBroadcast, CRMBroadcastLog, CRMInteraction,
)

router = APIRouter(prefix="/v1/crm", tags=["Public API — CRM"])


# ── Schemas ──────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    source: Optional[str] = "api"
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    custom_fields: dict = Field(default_factory=dict)

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[dict] = None
    status: Optional[str] = None

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#6366f1"

class QuickReplyCreate(BaseModel):
    title: str
    shortcut: str
    content: str

class BroadcastCreate(BaseModel):
    name: str
    message_template: str
    media_url: Optional[str] = None
    target_filter: dict = Field(default_factory=dict)

class SendMessageRequest(BaseModel):
    contact_id: int
    message: str
    operator_name: Optional[str] = None


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 11:
        digits = "55" + digits
    elif len(digits) == 10:
        digits = "55" + digits
    return digits


def _serialize_contact(c):
    return {
        "id": c.id, "name": c.name, "phone": c.phone,
        "email": c.email, "source": c.source, "status": c.status,
        "tags": c.tags or [], "notes": c.notes,
        "custom_fields": c.custom_fields or {},
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONTACTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/contacts", summary="Listar contatos")
async def list_contacts(
    search: Optional[str] = None,
    tag: Optional[str] = None,
    status: Optional[str] = "active",
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    """Lista contatos do CRM com filtros opcionais."""
    q = select(CRMContact).where(CRMContact.company_id == api_key.company_id)
    if status:
        q = q.where(CRMContact.status == status)
    if search:
        q = q.where(CRMContact.name.ilike(f"%{search}%") | CRMContact.phone.ilike(f"%{search}%"))
    if tag:
        q = q.where(CRMContact.tags.contains([tag]))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(CRMContact.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    await log_api_usage(api_key, "GET /v1/crm/contacts")
    return {"total": total, "page": page, "contacts": [_serialize_contact(c) for c in rows]}


@router.post("/contacts", summary="Criar contato", status_code=201)
async def create_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    """Cria um novo contato no CRM."""
    phone = _normalize_phone(body.phone)
    existing = await db.execute(
        select(CRMContact).where(
            CRMContact.company_id == api_key.company_id,
            CRMContact.phone == phone,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Contato com telefone {phone} já existe")

    contact = CRMContact(
        company_id=api_key.company_id, name=body.name, phone=phone,
        email=body.email, source=body.source or "api",
        notes=body.notes, tags=body.tags, custom_fields=body.custom_fields,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    await log_api_usage(api_key, "POST /v1/crm/contacts")
    return _serialize_contact(contact)


@router.get("/contacts/{contact_id}", summary="Detalhe do contato")
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    result = await db.execute(
        select(CRMContact).where(CRMContact.id == contact_id, CRMContact.company_id == api_key.company_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")
    return _serialize_contact(contact)


@router.put("/contacts/{contact_id}", summary="Atualizar contato")
async def update_contact(
    contact_id: int, body: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    result = await db.execute(
        select(CRMContact).where(CRMContact.id == contact_id, CRMContact.company_id == api_key.company_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    await db.commit()
    await log_api_usage(api_key, "PUT /v1/crm/contacts")
    return {"success": True}


@router.delete("/contacts/{contact_id}", summary="Remover contato")
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    await db.execute(
        delete(CRMContact).where(CRMContact.id == contact_id, CRMContact.company_id == api_key.company_id)
    )
    await db.commit()
    return {"success": True}


@router.post("/contacts/import-csv", summary="Importar contatos via CSV")
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    """Importa contatos de um CSV. Colunas: name, phone, email (opcional), tags (opcional)."""
    import csv, io
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []

    for i, row in enumerate(reader, 1):
        try:
            phone = _normalize_phone(row.get("phone", row.get("telefone", "")))
            if not phone or len(phone) < 10:
                errors.append(f"Linha {i}: telefone inválido")
                continue
            existing = await db.execute(
                select(CRMContact.id).where(CRMContact.company_id == api_key.company_id, CRMContact.phone == phone)
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue
            tags_str = row.get("tags", "")
            tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
            db.add(CRMContact(
                company_id=api_key.company_id,
                name=row.get("name", row.get("nome", f"Contato {phone[-4:]}")),
                phone=phone, email=row.get("email", ""),
                source="csv_import", tags=tags,
            ))
            created += 1
        except Exception as e:
            errors.append(f"Linha {i}: {str(e)[:80]}")

    await db.commit()
    await log_api_usage(api_key, "POST /v1/crm/contacts/import-csv", msgs_sent=created)
    return {"created": created, "skipped": skipped, "errors": errors[:20]}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TAGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/tags", summary="Listar tags")
async def list_tags(db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    rows = (await db.execute(
        select(CRMTag).where(CRMTag.company_id == api_key.company_id).order_by(CRMTag.name)
    )).scalars().all()
    return {"tags": [{"id": t.id, "name": t.name, "color": t.color} for t in rows]}


@router.post("/tags", summary="Criar tag", status_code=201)
async def create_tag(body: TagCreate, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    tag = CRMTag(company_id=api_key.company_id, name=body.name, color=body.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@router.delete("/tags/{tag_id}", summary="Remover tag")
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    await db.execute(delete(CRMTag).where(CRMTag.id == tag_id, CRMTag.company_id == api_key.company_id))
    await db.commit()
    return {"success": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  QUICK REPLIES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/quick-replies", summary="Listar respostas rápidas")
async def list_quick_replies(db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    rows = (await db.execute(
        select(CRMQuickReply).where(CRMQuickReply.company_id == api_key.company_id)
    )).scalars().all()
    return {"quick_replies": [{"id": r.id, "title": r.title, "shortcut": r.shortcut, "content": r.content} for r in rows]}


@router.post("/quick-replies", summary="Criar resposta rápida", status_code=201)
async def create_quick_reply(body: QuickReplyCreate, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    qr = CRMQuickReply(company_id=api_key.company_id, title=body.title, shortcut=body.shortcut, content=body.content)
    db.add(qr)
    await db.commit()
    await db.refresh(qr)
    return {"id": qr.id, "title": qr.title, "shortcut": qr.shortcut}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BROADCASTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/broadcasts", summary="Listar campanhas")
async def list_broadcasts(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    q = select(CRMBroadcast).where(CRMBroadcast.company_id == api_key.company_id)
    if status:
        q = q.where(CRMBroadcast.status == status)
    q = q.order_by(CRMBroadcast.created_at.desc()).limit(50)
    rows = (await db.execute(q)).scalars().all()
    return {"broadcasts": [
        {"id": b.id, "name": b.name, "status": b.status, "total_targets": b.total_targets,
         "sent_count": b.sent_count, "failed_count": b.failed_count,
         "created_at": b.created_at.isoformat() if b.created_at else None}
        for b in rows
    ]}


@router.post("/broadcasts", summary="Criar campanha", status_code=201)
async def create_broadcast(body: BroadcastCreate, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    target_q = select(func.count()).select_from(CRMContact).where(
        CRMContact.company_id == api_key.company_id, CRMContact.status == "active"
    )
    if body.target_filter.get("tags"):
        for tag in body.target_filter["tags"]:
            target_q = target_q.where(CRMContact.tags.contains([tag]))
    total = (await db.execute(target_q)).scalar() or 0

    bc = CRMBroadcast(
        company_id=api_key.company_id, created_by=None,
        name=body.name, message_template=body.message_template,
        media_url=body.media_url, target_filter=body.target_filter,
        total_targets=total,
    )
    db.add(bc)
    await db.commit()
    await db.refresh(bc)
    await log_api_usage(api_key, "POST /v1/crm/broadcasts")
    return {"id": bc.id, "name": bc.name, "total_targets": total}


@router.post("/broadcasts/{broadcast_id}/start", summary="Iniciar campanha")
async def start_broadcast(broadcast_id: int, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    result = await db.execute(
        select(CRMBroadcast).where(CRMBroadcast.id == broadcast_id, CRMBroadcast.company_id == api_key.company_id)
    )
    bc = result.scalar_one_or_none()
    if not bc:
        raise HTTPException(404, "Campanha não encontrada")
    if bc.status not in ("draft", "paused"):
        raise HTTPException(400, f"Campanha está '{bc.status}'")

    contacts = (await db.execute(
        select(CRMContact).where(CRMContact.company_id == api_key.company_id, CRMContact.status == "active")
    )).scalars().all()

    for c in contacts:
        existing = await db.execute(
            select(CRMBroadcastLog.id).where(CRMBroadcastLog.broadcast_id == bc.id, CRMBroadcastLog.contact_id == c.id)
        )
        if not existing.scalar_one_or_none():
            db.add(CRMBroadcastLog(broadcast_id=bc.id, contact_id=c.id, phone=c.phone, status="pending"))

    bc.status = "sending"
    bc.total_targets = len(contacts)
    bc.started_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        from app.workers.tasks import dispatch_crm_broadcast
        dispatch_crm_broadcast.delay(bc.id)
    except Exception:
        pass

    await log_api_usage(api_key, "POST /v1/crm/broadcasts/start")
    return {"success": True, "status": "sending", "total_targets": len(contacts)}


@router.post("/broadcasts/{broadcast_id}/pause", summary="Pausar campanha")
async def pause_broadcast(broadcast_id: int, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    await db.execute(
        update(CRMBroadcast).where(
            CRMBroadcast.id == broadcast_id, CRMBroadcast.company_id == api_key.company_id, CRMBroadcast.status == "sending"
        ).values(status="paused")
    )
    await db.commit()
    return {"success": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MESSAGES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/messages/send", summary="Enviar mensagem a contato")
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    """Envia mensagem de texto para um contato do CRM via WhatsApp."""
    contact = (await db.execute(
        select(CRMContact).where(CRMContact.id == body.contact_id, CRMContact.company_id == api_key.company_id)
    )).scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")

    from app.models import Integration
    from app.services.smartmoon_client import SmartMoonClient

    intg = (await db.execute(
        select(Integration).where(Integration.company_id == api_key.company_id, Integration.provider == "smartmoon", Integration.status == "connected")
    )).scalar_one_or_none()
    if not intg:
        raise HTTPException(400, "Nenhuma instância WhatsApp conectada")

    instance_id = (intg.config_json or {}).get("instance_id")
    text = f"*{body.operator_name}*\n{body.message}" if body.operator_name else body.message

    result = await SmartMoonClient.send_text(instance_id, contact.phone, text)

    db.add(CRMInteraction(
        company_id=api_key.company_id, contact_id=contact.id,
        interaction_type="message_sent", channel="whatsapp",
        content=body.message, operator_id=None,
    ))
    await db.commit()
    await log_api_usage(api_key, "POST /v1/crm/messages/send", msgs_sent=1)
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  METRICS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/metrics/overview", summary="Métricas gerais do CRM")
async def metrics_overview(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    api_key=Depends(verify_api_key),
):
    cid = api_key.company_id
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_contacts = (await db.execute(
        select(func.count()).select_from(CRMContact).where(CRMContact.company_id == cid, CRMContact.status == "active")
    )).scalar() or 0

    new_contacts = (await db.execute(
        select(func.count()).select_from(CRMContact).where(CRMContact.company_id == cid, CRMContact.created_at >= since)
    )).scalar() or 0

    msgs_sent = (await db.execute(
        select(func.count()).select_from(CRMInteraction).where(
            CRMInteraction.company_id == cid, CRMInteraction.interaction_type == "message_sent", CRMInteraction.created_at >= since
        )
    )).scalar() or 0

    sales_result = await db.execute(
        select(func.count(), func.coalesce(func.sum(CRMInteraction.value), 0)).where(
            CRMInteraction.company_id == cid, CRMInteraction.interaction_type == "sale", CRMInteraction.created_at >= since
        )
    )
    sr = sales_result.one()

    await log_api_usage(api_key, "GET /v1/crm/metrics/overview")
    return {
        "period_days": days, "total_contacts": total_contacts,
        "new_contacts": new_contacts, "messages_sent": msgs_sent,
        "total_sales": sr[0] or 0, "total_revenue": float(sr[1] or 0),
    }
