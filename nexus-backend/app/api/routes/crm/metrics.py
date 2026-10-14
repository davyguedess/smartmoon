"""CRM Metrics — Overview, operator performance, and sales funnel."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, extract
from datetime import datetime, timedelta, timezone

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models.crm_models import (
    CRMContact, CRMOperator, CRMInteraction,
    CRMBroadcast, CRMBroadcastLog,
)

router = APIRouter(prefix="/metrics")


@router.get("/overview")
async def metrics_overview(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Global CRM KPIs for the company."""
    cid = user.company_id
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total contacts
    total_contacts = (await db.execute(
        select(func.count()).select_from(CRMContact).where(
            CRMContact.company_id == cid, CRMContact.status == "active"
        )
    )).scalar() or 0

    # New contacts in period
    new_contacts = (await db.execute(
        select(func.count()).select_from(CRMContact).where(
            CRMContact.company_id == cid,
            CRMContact.created_at >= since,
        )
    )).scalar() or 0

    # Messages sent
    messages_sent = (await db.execute(
        select(func.count()).select_from(CRMInteraction).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "message_sent",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # Messages received
    messages_received = (await db.execute(
        select(func.count()).select_from(CRMInteraction).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "message_received",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # Sales count and total value
    sales_result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(CRMInteraction.value), 0),
        ).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "sale",
            CRMInteraction.created_at >= since,
        )
    )
    sales_row = sales_result.one()
    total_sales = sales_row[0] or 0
    total_revenue = float(sales_row[1] or 0)

    # Appointments
    appointments = (await db.execute(
        select(func.count()).select_from(CRMInteraction).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "appointment",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # Active operators
    active_operators = (await db.execute(
        select(func.count()).select_from(CRMOperator).where(
            CRMOperator.company_id == cid,
            CRMOperator.is_active == True,
        )
    )).scalar() or 0

    # Broadcasts stats
    broadcasts_sent = (await db.execute(
        select(func.count()).select_from(CRMBroadcast).where(
            CRMBroadcast.company_id == cid,
            CRMBroadcast.status == "completed",
        )
    )).scalar() or 0

    # Conversion rate: sales / contacts contacted
    contacted = (await db.execute(
        select(func.count(func.distinct(CRMInteraction.contact_id))).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    conversion_rate = round((total_sales / contacted * 100), 1) if contacted > 0 else 0

    # Daily activity (last 14 days for chart)
    chart_since = datetime.now(timezone.utc) - timedelta(days=14)
    daily_result = await db.execute(
        select(
            func.date(CRMInteraction.created_at).label("day"),
            func.count().label("count"),
        ).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.created_at >= chart_since,
        ).group_by("day").order_by("day")
    )
    daily_activity = [
        {"date": str(row.day), "count": row.count}
        for row in daily_result.all()
    ]

    return {
        "period_days": days,
        "total_contacts": total_contacts,
        "new_contacts": new_contacts,
        "messages_sent": messages_sent,
        "messages_received": messages_received,
        "total_sales": total_sales,
        "total_revenue": total_revenue,
        "appointments": appointments,
        "active_operators": active_operators,
        "broadcasts_sent": broadcasts_sent,
        "conversion_rate": conversion_rate,
        "daily_activity": daily_activity,
    }


@router.get("/operator/{operator_id}")
async def operator_metrics(
    operator_id: int,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Performance metrics for a specific operator."""
    cid = user.company_id
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Verify operator belongs to company
    op = await db.execute(
        select(CRMOperator).where(
            CRMOperator.id == operator_id,
            CRMOperator.company_id == cid,
        )
    )
    operator = op.scalar_one_or_none()
    if not operator:
        return {"error": "Operador não encontrado"}

    # Messages sent by this operator
    msgs_sent = (await db.execute(
        select(func.count()).select_from(CRMInteraction).where(
            CRMInteraction.operator_id == operator_id,
            CRMInteraction.interaction_type == "message_sent",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # Sales by this operator
    sales_result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(CRMInteraction.value), 0),
        ).where(
            CRMInteraction.operator_id == operator_id,
            CRMInteraction.interaction_type == "sale",
            CRMInteraction.created_at >= since,
        )
    )
    sales_row = sales_result.one()

    # Unique contacts
    unique_contacts = (await db.execute(
        select(func.count(func.distinct(CRMInteraction.contact_id))).where(
            CRMInteraction.operator_id == operator_id,
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    return {
        "operator_id": operator_id,
        "operator_name": operator.display_name,
        "period_days": days,
        "messages_sent": msgs_sent,
        "sales_count": sales_row[0] or 0,
        "sales_revenue": float(sales_row[1] or 0),
        "unique_contacts": unique_contacts,
    }


@router.get("/funnel")
async def sales_funnel(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Sales funnel: contacts → contacted → appointments → sales."""
    cid = user.company_id
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total contacts
    total = (await db.execute(
        select(func.count()).select_from(CRMContact).where(
            CRMContact.company_id == cid, CRMContact.status == "active"
        )
    )).scalar() or 0

    # Contacted (have at least one interaction)
    contacted = (await db.execute(
        select(func.count(func.distinct(CRMInteraction.contact_id))).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # With appointments
    with_appointments = (await db.execute(
        select(func.count(func.distinct(CRMInteraction.contact_id))).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "appointment",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    # With sales
    with_sales = (await db.execute(
        select(func.count(func.distinct(CRMInteraction.contact_id))).where(
            CRMInteraction.company_id == cid,
            CRMInteraction.interaction_type == "sale",
            CRMInteraction.created_at >= since,
        )
    )).scalar() or 0

    return {
        "period_days": days,
        "funnel": [
            {"stage": "Contatos", "count": total, "percentage": 100},
            {"stage": "Contatados", "count": contacted, "percentage": round(contacted / total * 100, 1) if total > 0 else 0},
            {"stage": "Agendamentos", "count": with_appointments, "percentage": round(with_appointments / total * 100, 1) if total > 0 else 0},
            {"stage": "Vendas", "count": with_sales, "percentage": round(with_sales / total * 100, 1) if total > 0 else 0},
        ],
    }
