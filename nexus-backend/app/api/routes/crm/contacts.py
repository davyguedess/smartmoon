"""CRM Contacts — CRUD + search + CSV import."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update, delete
from pydantic import BaseModel, Field
from typing import Optional
import csv
import io
import re

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import CRMContact, CRMInteraction

router = APIRouter(prefix="/contacts")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    custom_fields: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    source: str = "manual"

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def _normalize_phone(phone: str) -> str:
    """Strip non-digits and ensure country code."""
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 11 and digits.startswith(('1','2','3','4','5','6','7','8','9')):
        digits = '55' + digits
    return digits


# ── List / Search ─────────────────────────────────────────────────────────────

@router.get("")
async def list_contacts(
    search: Optional[str] = None,
    tag: Optional[str] = None,
    status: str = "active",
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(CRMContact).where(
        CRMContact.company_id == user.company_id,
        CRMContact.status == status,
    )
    if search:
        q = q.where(or_(
            CRMContact.name.ilike(f"%{search}%"),
            CRMContact.phone.ilike(f"%{search}%"),
            CRMContact.email.ilike(f"%{search}%"),
        ))
    if tag:
        q = q.where(CRMContact.tags.contains([tag]))

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    q = q.order_by(CRMContact.last_contact_at.desc().nullslast(), CRMContact.created_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "contacts": [
            {
                "id": c.id,
                "phone": c.phone,
                "name": c.name,
                "email": c.email,
                "tags": c.tags or [],
                "custom_fields": c.custom_fields or {},
                "notes": c.notes,
                "status": c.status,
                "source": c.source,
                "push_name": c.push_name,
                "profile_pic_url": c.profile_pic_url,
                "last_contact_at": c.last_contact_at.isoformat() if c.last_contact_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in rows
        ],
    }


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    phone = _normalize_phone(body.phone)
    # Check duplicate
    existing = await db.execute(
        select(CRMContact).where(
            CRMContact.company_id == user.company_id,
            CRMContact.phone == phone,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Contato com este telefone já existe")

    contact = CRMContact(
        company_id=user.company_id,
        phone=phone,
        name=body.name,
        email=body.email,
        tags=body.tags,
        custom_fields=body.custom_fields,
        notes=body.notes,
        source=body.source,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return {"id": contact.id, "phone": contact.phone, "name": contact.name}


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{contact_id}")
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMContact).where(
            CRMContact.id == contact_id,
            CRMContact.company_id == user.company_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    if "phone" in update_data and update_data["phone"]:
        update_data["phone"] = _normalize_phone(update_data["phone"])
    for key, val in update_data.items():
        setattr(contact, key, val)

    await db.commit()
    return {"success": True}


# ── Delete (archive) ─────────────────────────────────────────────────────────

@router.delete("/{contact_id}")
async def archive_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await db.execute(
        update(CRMContact)
        .where(CRMContact.id == contact_id, CRMContact.company_id == user.company_id)
        .values(status="archived")
    )
    await db.commit()
    return {"success": True}


# ── Contact History ───────────────────────────────────────────────────────────

@router.get("/{contact_id}/history")
async def contact_history(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CRMContact).where(
            CRMContact.id == contact_id,
            CRMContact.company_id == user.company_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contato não encontrado")

    interactions = await db.execute(
        select(CRMInteraction)
        .where(CRMInteraction.contact_id == contact_id)
        .order_by(CRMInteraction.created_at.desc())
        .limit(100)
    )
    rows = interactions.scalars().all()
    return {
        "contact_id": contact_id,
        "interactions": [
            {
                "id": i.id,
                "type": i.interaction_type,
                "channel": i.channel,
                "value": float(i.value) if i.value else None,
                "notes": i.notes,
                "custom_label": i.custom_label,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in rows
        ],
    }


# ── CSV Import ────────────────────────────────────────────────────────────────

@router.post("/import-csv")
async def import_csv(
    file: UploadFile = File(...),
    default_tags: str = Query("", description="Comma-separated tags to apply"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    tags = [t.strip() for t in default_tags.split(",") if t.strip()]
    created = 0
    duplicates = 0
    errors = []

    for idx, row in enumerate(reader, start=2):  # line 2 = first data row
        phone_raw = row.get("telefone") or row.get("phone") or row.get("numero") or ""
        if not phone_raw.strip():
            errors.append(f"Linha {idx}: telefone vazio")
            continue

        phone = _normalize_phone(phone_raw)
        if len(phone) < 10:
            errors.append(f"Linha {idx}: telefone inválido ({phone_raw})")
            continue

        # Check duplicate
        existing = await db.execute(
            select(CRMContact.id).where(
                CRMContact.company_id == user.company_id,
                CRMContact.phone == phone,
            )
        )
        if existing.scalar_one_or_none():
            duplicates += 1
            continue

        name = row.get("nome") or row.get("name") or None
        email = row.get("email") or None

        contact = CRMContact(
            company_id=user.company_id,
            phone=phone,
            name=name,
            email=email,
            tags=tags,
            source="csv_import",
        )
        db.add(contact)
        created += 1

    await db.commit()
    return {
        "created": created,
        "duplicates": duplicates,
        "errors": errors[:20],  # limit error list
        "total_processed": created + duplicates + len(errors),
    }
