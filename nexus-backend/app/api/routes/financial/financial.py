"""
NEXUS.IA — /financial routes
Endpoints para gerenciamento de registros financeiros.
Dashboard, CRUD, resumos e exportação CSV.
"""
from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.services import financial_service
from app.services.audit_service import audit

router = APIRouter(prefix="/financial", tags=["Financial"])


# ── Schemas ───────────────────────────────────────────────

class RecordCreate(BaseModel):
    description: str
    amount: Optional[float] = None
    category: str = "compra"
    supplier_name: Optional[str] = None
    payment_method: Optional[str] = None
    has_invoice: bool = False
    invoice_number: Optional[str] = None
    record_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class RecordUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    supplier_name: Optional[str] = None
    payment_method: Optional[str] = None
    has_invoice: Optional[bool] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────

@router.get("/records")
async def list_records(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    category: Optional[str] = None,
    has_invoice: Optional[bool] = None,
    status_filter: Optional[str] = Query("confirmed", alias="status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List financial records with filters."""
    d_from = date.fromisoformat(date_from) if date_from else None
    d_to = date.fromisoformat(date_to) if date_to else None

    return await financial_service.list_records(
        db=db,
        company_id=user.company_id,
        date_from=d_from,
        date_to=d_to,
        category=category,
        status=status_filter,
        has_invoice=has_invoice,
        limit=limit,
        offset=offset,
    )


@router.post("/records", status_code=status.HTTP_201_CREATED)
async def create_record(
    body: RecordCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a financial record manually."""
    parsed_date = None
    if body.record_date:
        try:
            parsed_date = date.fromisoformat(body.record_date)
        except (ValueError, TypeError):
            raise HTTPException(400, "Data inválida. Use formato YYYY-MM-DD")

    result = await financial_service.create_record(
        db=db,
        company_id=user.company_id,
        description=body.description,
        amount=body.amount,
        category=body.category,
        supplier_name=body.supplier_name,
        payment_method=body.payment_method,
        has_invoice=body.has_invoice,
        invoice_number=body.invoice_number,
        input_type="manual",
        record_date=parsed_date,
        notes=body.notes,
        tags=body.tags,
    )
    await db.commit()
    await audit(db, user, "financial.record_created", "financial_record", result["id"], {
        "description": body.description,
        "amount": body.amount,
    })
    return result


@router.get("/records/{record_id}")
async def get_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get a single financial record."""
    result = await financial_service.get_record(db, record_id, user.company_id)
    if not result:
        raise HTTPException(404, "Registro não encontrado")
    return result


@router.delete("/records/{record_id}")
async def cancel_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Cancel a financial record."""
    success = await financial_service.cancel_record(db, record_id, user.company_id)
    if not success:
        raise HTTPException(404, "Registro não encontrado ou já cancelado")
    await db.commit()
    await audit(db, user, "financial.record_cancelled", "financial_record", record_id, {})
    return {"message": f"Registro #{record_id} cancelado"}


@router.get("/summary")
async def get_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get financial summary by period and category."""
    d_from = date.fromisoformat(date_from) if date_from else None
    d_to = date.fromisoformat(date_to) if date_to else None

    return await financial_service.get_summary(
        db=db,
        company_id=user.company_id,
        date_from=d_from,
        date_to=d_to,
    )


@router.get("/export/csv")
async def export_csv(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Export financial records as CSV file."""
    d_from = date.fromisoformat(date_from) if date_from else None
    d_to = date.fromisoformat(date_to) if date_to else None

    filepath, filename, count = await financial_service.export_csv(
        db=db,
        company_id=user.company_id,
        date_from=d_from,
        date_to=d_to,
    )

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="text/csv",
        headers={"X-Record-Count": str(count)},
    )
