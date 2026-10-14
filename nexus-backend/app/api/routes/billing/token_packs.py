"""
NEXUS.IA — Token Packs: Compra de pacotes de AI tokens pelo cliente
Rotas públicas (autenticadas) para listagem e purchase de packs.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.payments.services.charge_service import ChargeService
from app.payments.schemas import ChargeCreate

router = APIRouter(prefix="/billing/token-packs", tags=["Billing — Token Packs"])


# ── GET /billing/token-packs ─────────────────────────────────────────────────

@router.get("")
async def list_token_packs(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista todos os packs de tokens ativos para compra."""
    result = await db.execute(text(
        "SELECT * FROM ai_token_packs WHERE is_active=true ORDER BY sort_order ASC, price_brl ASC"
    ))
    packs = []
    for row in result.mappings().all():
        p = dict(row)
        p["price_brl"] = float(p["price_brl"] or 0)
        if p.get("created_at"):
            p["created_at"] = p["created_at"].isoformat()
        if p.get("updated_at"):
            p["updated_at"] = p["updated_at"].isoformat()
        packs.append(p)
    return {"packs": packs}


# ── POST /billing/token-packs/{pack_id}/purchase ─────────────────────────────

@router.post("/{pack_id}/purchase")
async def purchase_token_pack(
    pack_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Inicia compra de um pack de tokens via PIX (Mercado Pago).
    Retorna QR Code + código copia e cola + expiry.
    """
    # 1. Buscar pack
    result = await db.execute(
        text("SELECT * FROM ai_token_packs WHERE id=:id AND is_active=true"),
        {"id": pack_id}
    )
    pack = result.mappings().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack não encontrado ou inativo")

    pack = dict(pack)
    price = float(pack["price_brl"] or 0)

    # 2. Pack gratuito — creditar direto sem cobrança
    if price == 0:
        company_id = user.company_id
        if not company_id:
            raise HTTPException(status_code=400, detail="Usuário sem empresa associada")

        # Verificar se já recebeu esse pack gratuito
        already = await db.execute(text("""
            SELECT id FROM ai_token_transactions
            WHERE company_id=:cid AND description LIKE :desc
            LIMIT 1
        """), {"cid": company_id, "desc": f"%pack_id={pack_id}%"})
        if already.scalar():
            raise HTTPException(
                status_code=409,
                detail="Você já resgatou este pack gratuito anteriormente"
            )

        # Creditar tokens diretamente
        await _credit_tokens(db, company_id, pack, source="free_pack")
        await db.commit()
        logger.info(f"🎁 Pack gratuito {pack['name']} creditado para company {company_id}")
        return {
            "ok": True,
            "free": True,
            "tokens_credited": pack["tokens_included"],
            "message": f"✅ {pack['tokens_included']:,} tokens creditados com sucesso!"
        }

    # 3. Pack pago — gerar cobrança PIX
    company_id = user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuário sem empresa associada")

    # Buscar dados da empresa para o cliente
    company_result = await db.execute(
        text("SELECT name, email FROM companies WHERE id=:id"),
        {"id": company_id}
    )
    company = company_result.mappings().first()

    charge_data = ChargeCreate(
        amount=price,
        description=f"Pack de Tokens IA: {pack['name']} — {pack['tokens_included']:,} tokens",
        client_name=company["name"] if company else f"Empresa #{company_id}",
        client_email=company["email"] if company else None,
    )

    try:
        charge = await ChargeService.create_charge(
            db=db,
            company_id=company_id,
            data=charge_data,
            created_by_user_id=user.id,
        )

        # Salvar referência ao pack + tokens a creditar no metadata
        await db.execute(text("""
            UPDATE payment_charges
            SET token_pack_id = :pack_id,
                tokens_to_credit = :tokens,
                metadata = metadata || :meta
            WHERE id = :charge_id
        """), {
            "pack_id": pack_id,
            "tokens": pack["tokens_included"],
            "meta": f'{{"pack_id": {pack_id}, "pack_name": "{pack["name"]}", "tokens_included": {pack["tokens_included"]}}}',
            "charge_id": charge.id,
        })
        await db.commit()

        logger.info(
            f"💳 PIX gerado para pack '{pack['name']}' "
            f"| company={company_id} | charge={charge.id}"
        )

        expires_at = charge.expires_at.isoformat() if charge.expires_at else None

        return {
            "ok": True,
            "free": False,
            "charge_id": charge.id,
            "external_reference": charge.external_reference,
            "amount": float(charge.amount),
            "pack_name": pack["name"],
            "tokens_included": pack["tokens_included"],
            "pix_qr_code": charge.pix_qr_code,
            "pix_copy_paste": charge.pix_copy_paste_code,
            "payment_link": charge.payment_link,
            "expires_at": expires_at,
            "status": charge.status.value if charge.status else "pending",
        }
    except Exception as e:
        logger.error(f"Erro ao criar cobrança PIX para pack {pack_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar cobrança: {str(e)}")


# ── GET /billing/token-packs/status/{charge_id} ───────────────────────────────

@router.get("/status/{charge_id}")
async def check_purchase_status(
    charge_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Polling de status da cobrança PIX. Usado pelo frontend a cada 5s."""
    result = await db.execute(text("""
        SELECT pc.id, pc.status, pc.paid_at, pc.expires_at,
               pc.token_pack_id, pc.tokens_to_credit,
               atp.name as pack_name
        FROM payment_charges pc
        LEFT JOIN ai_token_packs atp ON atp.id = pc.token_pack_id
        WHERE pc.id = :charge_id AND pc.company_id = :company_id
    """), {"charge_id": charge_id, "company_id": user.company_id})

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    return {
        "charge_id": row["id"],
        "status": row["status"],
        "paid_at": row["paid_at"].isoformat() if row["paid_at"] else None,
        "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        "pack_name": row["pack_name"],
        "tokens_to_credit": row["tokens_to_credit"],
    }


# ── GET /billing/token-packs/my-balance ───────────────────────────────────────

@router.get("/my-balance")
async def my_token_balance(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna saldo de tokens IA da empresa do usuário autenticado."""
    company_id = user.company_id
    if not company_id:
        return {"balances": [], "total": 0}

    result = await db.execute(text("""
        SELECT provider, balance_tokens, total_purchased, total_used, updated_at
        FROM ai_token_balances
        WHERE company_id = :cid
        ORDER BY balance_tokens DESC
    """), {"cid": company_id})

    balances = []
    total = 0
    for row in result.mappings().all():
        d = dict(row)
        if d.get("updated_at"):
            d["updated_at"] = d["updated_at"].isoformat()
        balances.append(d)
        total += int(d.get("balance_tokens") or 0)

    return {"balances": balances, "total": total}


# ── Helpers internos ───────────────────────────────────────────────────────────

async def _credit_tokens(db: AsyncSession, company_id: int, pack: dict, source: str = "purchase"):
    """Credita tokens no ai_token_balances e registra transação."""
    provider = pack.get("provider") or "any"
    tokens = int(pack.get("tokens_included") or 0)
    pack_id = pack.get("id")
    pack_name = pack.get("name", "Pack")

    # Upsert no saldo
    await db.execute(text("""
        INSERT INTO ai_token_balances (company_id, provider, balance_tokens, total_purchased, total_used, updated_at)
        VALUES (:cid, :prov, :tokens, :tokens, 0, NOW())
        ON CONFLICT (company_id, provider)
        DO UPDATE SET
            balance_tokens  = ai_token_balances.balance_tokens + :tokens,
            total_purchased = ai_token_balances.total_purchased + :tokens,
            updated_at      = NOW()
    """), {"cid": company_id, "prov": provider, "tokens": tokens})

    # Registrar transação
    await db.execute(text("""
        INSERT INTO ai_token_transactions
            (company_id, provider, tx_type, nexus_tokens_cost, description, created_at)
        VALUES
            (:cid, :prov, 'credit', :tokens, :desc, NOW())
    """), {
        "cid": company_id,
        "prov": provider,
        "tokens": tokens,
        "desc": f"Compra de pack: {pack_name} (pack_id={pack_id}, source={source})",
    })
