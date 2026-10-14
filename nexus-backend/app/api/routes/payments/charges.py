"""
NEXUS.IA — Payment Charges API Routes
"""
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models import User
from app.payments.models import PaymentCharge, PaymentClient, ChargeStatus
from app.payments.schemas import (
    ChargeCreate, ChargeSendRequest, ChargeOut, ChargeListOut
)
from app.payments.services.charge_service import ChargeService
from app.payments.services.ledger_service import LedgerService

router = APIRouter(prefix="/payments", tags=["Payments"])


def _charge_to_out(charge: PaymentCharge) -> ChargeOut:
    """Converte PaymentCharge para ChargeOut.
    BUG-06 FIX: usa sqlalchemy.inspect para checar se o relacionamento
    'client' já está carregado antes de acessá-lo, evitando greenlet_spawn
    em endpoints sem joinedload (send_charge, cancel_charge).
    BUG-23 FIX: simplificado para usar only try/except ao invés de
    lógica de inspect com precedência incorreta.
    """
    out = ChargeOut.from_orm(charge)
    try:
        from sqlalchemy import inspect as sa_inspect
        state = sa_inspect(charge)
        # loaded_value é None ou o objeto carregado; se for NEVER_SET lança AttributeError
        loaded = state.attrs["client"].loaded_value
        if loaded is not None and charge.client is not None:
            out.client_name  = charge.client.name
            out.client_phone = charge.client.phone
            out.client_email = charge.client.email
    except Exception:
        pass
    return out


def _charge_to_out_safe(
    charge: PaymentCharge,
    client_name: Optional[str] = None,
    client_phone: Optional[str] = None,
    client_email: Optional[str] = None,
) -> ChargeOut:
    """Versão segura que não acessa relacionamentos lazy."""
    out = ChargeOut.from_orm(charge)
    if client_name:
        out.client_name = client_name
    if client_phone:
        out.client_phone = client_phone
    if client_email:
        out.client_email = client_email
    return out


# ── Criar cobrança PIX ────────────────────────────────────────────────────────

@router.post("/charges", response_model=ChargeOut, status_code=201)
async def create_charge(
    data:         ChargeCreate,
    current_user: User                = Depends(get_current_user),
    db:           AsyncSession        = Depends(get_db),
):
    """
    Cria cobrança PIX via Mercado Pago (conta Smart Moon).
    Retorna QR Code (base64) e código copia e cola.
    """
    try:
        charge = await ChargeService.create_charge(
            db                  = db,
            company_id          = current_user.company_id,
            data                = data,
            created_by_user_id  = current_user.id,
            creator_email       = current_user.email,
        )
        # Usar versão safe: não acessa relacionamento lazy (greenlet_spawn)
        return _charge_to_out_safe(
            charge,
            client_name  = data.client_name,
            client_phone = getattr(data, 'client_phone', None),
            client_email = data.client_email,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback; logger.error(f"create_charge error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=f"Erro ao gerar PIX: {str(e)}")


# ── Listar cobranças ──────────────────────────────────────────────────────────

@router.get("/charges", response_model=ChargeListOut)
async def list_charges(
    status:  Optional[str] = Query(None),
    page:    int            = Query(1, ge=1),
    limit:   int            = Query(20, ge=1, le=100),
    from_:   Optional[str] = Query(None, alias="from"),
    to_:     Optional[str] = Query(None, alias="to"),
    search:  Optional[str] = Query(None),
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Lista cobranças da empresa com filtros e paginação."""
    query = (
        select(PaymentCharge)
        .options(joinedload(PaymentCharge.client))
        .where(PaymentCharge.company_id == current_user.company_id)
        .order_by(PaymentCharge.created_at.desc())
    )

    if status:
        query = query.where(PaymentCharge.status == status)
    if from_:
        query = query.where(PaymentCharge.created_at >= from_)
    if to_:
        query = query.where(PaymentCharge.created_at <= to_)

    # BUG-34 FIX: count separado SEM joinedload.
    # select(func.count()).select_from(query.subquery()) com joinedload
    # gera LEFT OUTER JOIN que multiplica linhas (N cobranças × M clientes).
    # O count retornava valores inflados. Query de count deve ser simples.
    count_q = (
        select(func.count(PaymentCharge.id))
        .where(PaymentCharge.company_id == current_user.company_id)
    )
    if status:
        count_q = count_q.where(PaymentCharge.status == status)
    if from_:
        count_q = count_q.where(PaymentCharge.created_at >= from_)
    if to_:
        count_q = count_q.where(PaymentCharge.created_at <= to_)
    if search:
        count_q = count_q.join(
            PaymentClient,
            PaymentCharge.client_id == PaymentClient.id,
            isouter=True,
        ).where(
            or_(
                PaymentCharge.description.ilike(f"%{search}%"),
                PaymentClient.name.ilike(f"%{search}%"),
                PaymentClient.phone.ilike(f"%{search}%"),
            )
        )
    total = (await db.execute(count_q)).scalar_one()

    # Paginar
    items_q  = query.offset((page - 1) * limit).limit(limit)
    charges  = (await db.execute(items_q)).scalars().all()

    return ChargeListOut(
        items = [_charge_to_out(c) for c in charges],
        total = total,
        page  = page,
        limit = limit,
        pages = max(1, -(-total // limit)),
    )


# ── Detalhe de cobrança ───────────────────────────────────────────────────────

@router.get("/charges/{charge_id}", response_model=ChargeOut)
async def get_charge(
    charge_id:    int,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PaymentCharge)
        .options(joinedload(PaymentCharge.client))
        .where(
            PaymentCharge.id         == charge_id,
            PaymentCharge.company_id == current_user.company_id,
        )
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    return _charge_to_out(charge)


# ── Enviar cobrança ───────────────────────────────────────────────────────────

@router.post("/charges/{charge_id}/send", response_model=ChargeOut)
async def send_charge(
    charge_id:    int,
    data:         ChargeSendRequest,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Envia a cobrança por WhatsApp, email ou marca como manual."""
    try:
        charge = await ChargeService.send_charge(
            db         = db,
            charge_id  = charge_id,
            company_id = current_user.company_id,
            via        = data.via,
            phone      = data.phone,
            email      = data.email,
            message    = data.message,
        )
        return _charge_to_out(charge)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Cancelar cobrança ─────────────────────────────────────────────────────────

@router.post("/charges/{charge_id}/cancel", response_model=ChargeOut)
async def cancel_charge(
    charge_id:    int,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    try:
        charge = await ChargeService.cancel_charge(
            db         = db,
            charge_id  = charge_id,
            company_id = current_user.company_id,
        )
        return _charge_to_out(charge)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Status real no MP ─────────────────────────────────────────────────────────

@router.get("/charges/{charge_id}/status")
async def check_charge_status(
    charge_id:    int,
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Consulta status atual no Mercado Pago (não no banco)."""
    result = await db.execute(
        select(PaymentCharge).where(
            PaymentCharge.id         == charge_id,
            PaymentCharge.company_id == current_user.company_id,
        )
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    if not charge.external_payment_id:
        return {"status": charge.status, "mp_status": None}

    try:
        from app.payments.providers.mercadopago_provider import MercadoPagoProvider
        provider = await MercadoPagoProvider.get_instance(db=db)  # lê token do banco
        status   = await provider.get_payment_status(charge.external_payment_id)
        return {
            "internal_status": status.internal_status,
            "mp_status":       status.mp_status,
            "amount":          status.amount,
            "paid_at":         status.paid_at,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar MP: {str(e)}")


# ── Clientes ──────────────────────────────────────────────────────────────────

@router.get("/clients")
async def list_clients(
    search:       Optional[str] = Query(None),
    page:         int           = Query(1, ge=1),
    limit:        int           = Query(50, ge=1, le=100),
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentClient)
        .where(PaymentClient.company_id == current_user.company_id)
        .order_by(PaymentClient.name)
    )
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                PaymentClient.name.ilike(like),
                PaymentClient.phone.ilike(like),
                PaymentClient.email.ilike(like),
            )
        )

    total   = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    clients = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()

    return {
        "items": [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone} for c in clients],
        "total": total,
    }


@router.post("/clients", status_code=201)
async def create_client(
    data:         dict         = Body(...),   # BUG FIX: Body() para dict
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    client = PaymentClient(
        company_id = current_user.company_id,
        name       = data.get("name", ""),
        email      = data.get("email"),
        phone      = data.get("phone"),
        document   = data.get("document"),
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return {"id": client.id, "name": client.name}


# ── Reembolso ─────────────────────────────────────────────────────────────────

@router.post("/charges/{charge_id}/refund")
async def refund_charge(
    charge_id:    int,
    data:         dict          = Body(default={}),   # BUG FIX: Body() obrigatório para dict
    current_user: User          = Depends(get_current_user),
    db:           AsyncSession  = Depends(get_db),
):
    """
    Reembolso total ou parcial de uma cobrança PAGA.
    Body: { "amount": float | null }   # null ou ausente = total
    Válido até 180 dias após pagamento.
    """
    # BUG-36 FIX: with_for_update() prevêne reembolso duplo por double-click ou
    # requests concorrentes. Sem lock, ambas as requisições veem status=PAID
    # e chamam o ledger.refund() duas vezes, debitando o saldo em dobro.
    result = await db.execute(
        select(PaymentCharge)
        .where(
            PaymentCharge.id         == charge_id,
            PaymentCharge.company_id == current_user.company_id,
        )
        .with_for_update()
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    if charge.status == ChargeStatus.REFUNDED:
        raise HTTPException(
            status_code=400,
            detail="Cobrança já foi reembolsada anteriormente"
        )

    if charge.status != ChargeStatus.PAID:
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível reembolsar cobranças PAGAS (status atual: {charge.status.value})"
        )

    if not charge.external_payment_id:
        raise HTTPException(status_code=400, detail="Cobrança sem external_payment_id — reembolso indisponível")

    refund_amount_raw = data.get("amount")  # None = total
    # BUG FIX: normalizar float para garantir idempotência estável
    refund_amount = round(float(refund_amount_raw), 2) if refund_amount_raw is not None else None

    try:
        from app.payments.providers.mercadopago_provider import MercadoPagoProvider
        provider = await MercadoPagoProvider.get_instance(db=db)   # BUG-17 FIX: db=db
        refund = await provider.refund_payment(
            mp_payment_id   = charge.external_payment_id,
            amount          = refund_amount,
            idempotency_key = f"refund_{charge.id}_{refund_amount or 'total'}",
        )

        # Atualizar ledger ANTES de mudar o status
        # BUG-42 FIX: charge.status = REFUNDED deve ser feito SOMENTE após
        # o LedgerService.refund() ser bem-sucedido. Se o ledger falhar e
        # commitarmos com status=REFUNDED, o saldo fica inconsistente:
        # MP já reembolsou mas ledger não debitou.
        debit_amount = Decimal(str(refund.amount))
        await LedgerService.refund(
            db          = db,
            company_id  = charge.company_id,
            amount      = debit_amount,
            description = f"Reembolso: {charge.description}",
            charge_id   = charge.id,
            reference   = refund.refund_id,
        )

        # Só após ledger OK — atualiza status e commita
        charge.status       = ChargeStatus.REFUNDED
        charge.cancelled_at = datetime.now(timezone.utc)

        await db.commit()

        logger.info(
            f"🔄 Refund charge #{charge_id}: R${refund.amount:.2f} | "
            f"refund_id={refund.refund_id} | status={refund.status}"
        )

        return {
            "charge_id":     charge_id,
            "refund_id":     refund.refund_id,
            "status":        refund.status,
            "amount":        refund.amount,
            "charge_status": charge.status.value,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"refund_charge error: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao processar reembolso: {str(e)}")



# ── Dashboard consolidado ──────────────────────────────────────────────────────

@router.get("/dashboard")
async def payment_dashboard(
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Dashboard consolidado: saldo, métricas, histórico 30 dias e últimas cobranças."""
    from datetime import date, timedelta
    from sqlalchemy import text as _text
    from app.payments.models import Wallet

    company_id = current_user.company_id

    # ── Wallet
    wallet_result = await db.execute(select(Wallet).where(Wallet.company_id == company_id))
    wallet = wallet_result.scalar_one_or_none()

    # ── Métricas agregadas
    metrics_result = await db.execute(
        _text("""
            SELECT
                COUNT(*)                                                               AS total,
                COUNT(*) FILTER (WHERE status = 'paid')                                AS paid,
                COUNT(*) FILTER (WHERE status IN ('pending','sent','waiting_payment')) AS pending,
                COUNT(*) FILTER (WHERE status IN ('failed','cancelled','expired'))     AS failed,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)                AS total_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','sent','waiting_payment')), 0) AS total_pending
            FROM payment_charges
            WHERE company_id = :company_id
        """),
        {"company_id": company_id}
    )
    metrics = metrics_result.one()

    # ── Histórico 30 dias (receita paga por dia)
    chart_result = await db.execute(
        _text("""
            SELECT
                DATE(paid_at AT TIME ZONE 'America/Sao_Paulo') AS day,
                COALESCE(SUM(amount), 0)                        AS revenue
            FROM payment_charges
            WHERE company_id = :company_id
              AND status = 'paid'
              AND paid_at >= NOW() - INTERVAL '30 days'
            GROUP BY 1
            ORDER BY 1
        """),
        {"company_id": company_id}
    )
    chart_rows = chart_result.fetchall()
    # BUG-24 FIX: usar UTC para evitar discrepância com servidor em UTC
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date()
    day_map = {str(r.day): float(r.revenue) for r in chart_rows}
    chart_data = [
        {"date": (today - timedelta(days=i)).strftime("%d/%m"),
         "revenue": day_map.get(str(today - timedelta(days=i)), 0.0)}
        for i in range(29, -1, -1)
    ]

    # ── Últimas 5 cobranças
    recent_result = await db.execute(
        select(PaymentCharge)
        .where(PaymentCharge.company_id == company_id)
        .order_by(PaymentCharge.created_at.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()

    return {
        "wallet": {
            "balance":           float(wallet.balance)         if wallet else 0.0,
            "balance_available": float(wallet.balance)         if wallet else 0.0,
            "balance_blocked":   float(getattr(wallet, "balance_blocked", 0) or 0),
            "total_received":    float(wallet.total_received)  if wallet else 0.0,
            "total_withdrawn":   float(wallet.total_withdrawn) if wallet else 0.0,
        },
        "metrics": {
            "total_charges":   int(metrics.total   or 0),
            "paid_charges":    int(metrics.paid    or 0),
            "pending_charges": int(metrics.pending or 0),
            "failed_charges":  int(metrics.failed  or 0),
            "total_revenue":   float(metrics.total_revenue  or 0),
            "total_pending":   float(metrics.total_pending  or 0),
        },
        "chart_30d": chart_data,
        "recent_charges": [
            {
                "id":          c.id,
                "amount":      float(c.amount),
                "description": c.description,
                "status":      c.status.value,
                "created_at":  c.created_at.isoformat() if c.created_at else None,
                "paid_at":     c.paid_at.isoformat()    if c.paid_at    else None,
            }
            for c in recent
        ],
    }

