"""
Financial Service — Gerenciamento de registros financeiros.

Funções para criar, consultar, exportar (CSV) e resumir registros
financeiros protocolados pelo Agente Financeiro via WhatsApp.
"""
import csv
import io
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from loguru import logger
from sqlalchemy import select, func, and_, desc, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial_models import FinancialRecord


# ── Timezone BRT ────────────────────────────────────────────────
BRT = timezone(timedelta(hours=-3))


def _now_brt() -> datetime:
    return datetime.now(BRT)


# ── Create ──────────────────────────────────────────────────────

async def create_record(
    db: AsyncSession,
    company_id: int,
    description: str,
    amount: Optional[float] = None,
    category: str = "compra",
    supplier_name: Optional[str] = None,
    payment_method: Optional[str] = None,
    has_invoice: bool = False,
    invoice_pending: bool = False,
    invoice_image_url: Optional[str] = None,
    invoice_number: Optional[str] = None,
    input_type: str = "text",
    raw_message: Optional[str] = None,
    session_id: Optional[str] = None,
    agent_id: Optional[int] = None,
    recorded_by_phone: Optional[str] = None,
    record_date: Optional[date] = None,
    notes: Optional[str] = None,
    tags: Optional[list] = None,
) -> dict:
    """Create a new financial record."""
    now = _now_brt()

    record = FinancialRecord(
        company_id=company_id,
        agent_id=agent_id,
        session_id=session_id,
        recorded_by_phone=recorded_by_phone,
        record_date=record_date or now.date(),
        record_time=now.strftime("%H:%M:%S"),
        description=description,
        amount=Decimal(str(amount)) if amount else None,
        category=category,
        supplier_name=supplier_name,
        payment_method=payment_method,
        has_invoice=has_invoice,
        invoice_pending=invoice_pending,
        invoice_image_url=invoice_image_url,
        invoice_number=invoice_number,
        input_type=input_type,
        raw_message=raw_message,
        status="confirmed",
        notes=notes,
        tags=tags or [],
    )
    db.add(record)
    await db.flush()
    logger.info(f"💰 Financial record #{record.id} created: {description} R${amount or '?'} [{category}]")
    return _record_to_dict(record)


# ── List / Query ────────────────────────────────────────────────

async def list_records(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category: Optional[str] = None,
    status: Optional[str] = "confirmed",
    has_invoice: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List financial records with filters."""
    q = select(FinancialRecord).where(FinancialRecord.company_id == company_id)

    if date_from:
        q = q.where(FinancialRecord.record_date >= date_from)
    if date_to:
        q = q.where(FinancialRecord.record_date <= date_to)
    if category:
        q = q.where(FinancialRecord.category == category)
    if status:
        q = q.where(FinancialRecord.status == status)
    if has_invoice is not None:
        q = q.where(FinancialRecord.has_invoice == has_invoice)

    # Count total
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page
    q = q.order_by(desc(FinancialRecord.record_date), desc(FinancialRecord.id))
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    records = result.scalars().all()

    return {
        "records": [_record_to_dict(r) for r in records],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def get_record(db: AsyncSession, record_id: int, company_id: int) -> Optional[dict]:
    """Get a single record by ID."""
    result = await db.execute(
        select(FinancialRecord).where(
            FinancialRecord.id == record_id,
            FinancialRecord.company_id == company_id,
        )
    )
    record = result.scalar_one_or_none()
    return _record_to_dict(record) if record else None


# ── Summary ─────────────────────────────────────────────────────

async def get_summary(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    """Get financial summary grouped by category."""
    now = _now_brt()
    if not date_from:
        date_from = now.date().replace(day=1)  # Primeiro dia do mês
    if not date_to:
        date_to = now.date()

    # Total by category
    q = (
        select(
            FinancialRecord.category,
            func.count(FinancialRecord.id).label("count"),
            func.coalesce(func.sum(FinancialRecord.amount), 0).label("total"),
        )
        .where(
            FinancialRecord.company_id == company_id,
            FinancialRecord.status == "confirmed",
            FinancialRecord.record_date >= date_from,
            FinancialRecord.record_date <= date_to,
        )
        .group_by(FinancialRecord.category)
    )
    result = await db.execute(q)
    by_category = {}
    grand_total = Decimal("0")
    grand_count = 0
    for row in result.fetchall():
        cat, count, total = row
        by_category[cat] = {"count": count, "total": float(total)}
        grand_total += total
        grand_count += count

    # Invoice stats
    invoice_q = (
        select(
            func.count(FinancialRecord.id).label("total"),
            func.sum(
                func.cast(FinancialRecord.has_invoice, Integer)
            ).label("with_invoice"),
        )
        .where(
            FinancialRecord.company_id == company_id,
            FinancialRecord.status == "confirmed",
            FinancialRecord.record_date >= date_from,
            FinancialRecord.record_date <= date_to,
        )
    )
    inv_result = await db.execute(invoice_q)
    inv_row = inv_result.one()
    with_invoice = inv_row.with_invoice or 0
    total_records = inv_row.total or 0

    return {
        "period": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "grand_total": float(grand_total),
        "grand_count": grand_count,
        "by_category": by_category,
        "invoices": {
            "with_invoice": with_invoice,
            "without_invoice": total_records - with_invoice,
            "total": total_records,
        },
    }


# ── Export CSV ──────────────────────────────────────────────────

async def export_csv(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> tuple:
    """Export financial records to CSV. Returns (filepath, filename, record_count)."""
    now = _now_brt()
    if not date_from:
        date_from = now.date().replace(day=1)
    if not date_to:
        date_to = now.date()

    result = await db.execute(
        select(FinancialRecord)
        .where(
            FinancialRecord.company_id == company_id,
            FinancialRecord.status == "confirmed",
            FinancialRecord.record_date >= date_from,
            FinancialRecord.record_date <= date_to,
        )
        .order_by(FinancialRecord.record_date, FinancialRecord.id)
    )
    records = result.scalars().all()

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    # Header
    writer.writerow([
        "ID", "Data", "Hora", "Descrição", "Valor (R$)", "Categoria",
        "Fornecedor", "Forma Pgto", "Tem Nota", "Nº Nota",
        "Tipo Entrada", "Status", "Observações",
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.record_date.strftime("%d/%m/%Y") if r.record_date else "",
            r.record_time or "",
            r.description,
            f"{r.amount:.2f}" if r.amount else "",
            _category_label(r.category),
            r.supplier_name or "",
            r.payment_method or "",
            "Sim" if r.has_invoice else ("Pendente" if r.invoice_pending else "Não"),
            r.invoice_number or "",
            r.input_type or "",
            r.status,
            r.notes or "",
        ])

    # Save to storage
    storage_dir = "/app/storage/financial"
    os.makedirs(storage_dir, exist_ok=True)
    filename = f"financeiro_{date_from.strftime('%Y%m%d')}_{date_to.strftime('%Y%m%d')}.csv"
    filepath = os.path.join(storage_dir, filename)

    with open(filepath, "w", encoding="utf-8-sig") as f:
        f.write(output.getvalue())

    logger.info(f"📊 CSV exported: {filepath} ({len(records)} records)")
    return filepath, filename, len(records)


# ── Cancel ──────────────────────────────────────────────────────

async def cancel_record(
    db: AsyncSession,
    record_id: int,
    company_id: int,
) -> bool:
    """Cancel (soft delete) a financial record."""
    result = await db.execute(
        select(FinancialRecord).where(
            FinancialRecord.id == record_id,
            FinancialRecord.company_id == company_id,
            FinancialRecord.status != "cancelled",
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return False

    record.status = "cancelled"
    await db.flush()
    logger.info(f"💰 Financial record #{record_id} cancelled")
    return True


# ── Update invoice status ───────────────────────────────────────

async def update_invoice_status(
    db: AsyncSession,
    record_id: int,
    company_id: int,
    has_invoice: bool,
    invoice_image_url: Optional[str] = None,
    invoice_number: Optional[str] = None,
) -> Optional[dict]:
    """Update the invoice status of a record."""
    result = await db.execute(
        select(FinancialRecord).where(
            FinancialRecord.id == record_id,
            FinancialRecord.company_id == company_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return None

    record.has_invoice = has_invoice
    record.invoice_pending = False
    if invoice_image_url:
        record.invoice_image_url = invoice_image_url
    if invoice_number:
        record.invoice_number = invoice_number

    await db.flush()
    return _record_to_dict(record)


# ── Helpers ─────────────────────────────────────────────────────

CATEGORY_LABELS = {
    "compra": "Compra",
    "fornecedor": "Pagamento Fornecedor",
    "colaborador": "Pagamento Colaborador",
    "operacional": "Despesa Operacional",
    "outro": "Outro",
}


def _category_label(category: str) -> str:
    return CATEGORY_LABELS.get(category, category)


def _record_to_dict(record: FinancialRecord) -> dict:
    return {
        "id": record.id,
        "company_id": record.company_id,
        "record_date": record.record_date.isoformat() if record.record_date else None,
        "record_time": record.record_time,
        "description": record.description,
        "amount": float(record.amount) if record.amount else None,
        "category": record.category,
        "category_label": _category_label(record.category),
        "supplier_name": record.supplier_name,
        "payment_method": record.payment_method,
        "has_invoice": record.has_invoice,
        "invoice_pending": record.invoice_pending,
        "invoice_image_url": record.invoice_image_url,
        "invoice_number": record.invoice_number,
        "input_type": record.input_type,
        "raw_message": record.raw_message,
        "status": record.status,
        "notes": record.notes,
        "tags": record.tags or [],
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
