"""
NEXUS.IA — SM Credit Packs: Compra de créditos SM pelo cliente
Rotas autenticadas para listagem, compra (PIX ou wallet) e saldo.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
import json
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.payments.services.charge_service import ChargeService
from app.payments.schemas import ChargeCreate

router = APIRouter(prefix="/billing/credit-packs", tags=["Billing — SM Credits"])


# ── GET /billing/credit-packs — listar packs ativos ─────────────────────────

@router.get("")
async def list_credit_packs(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista todos os pacotes de créditos SM ativos."""
    result = await db.execute(text(
        "SELECT * FROM sm_credit_packs WHERE is_active=true ORDER BY sort_order ASC, price_brl ASC"
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


# ── GET /billing/credit-packs/my-balance — saldo SM ─────────────────────────

@router.get("/my-balance")
async def my_credit_balance(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna saldo de créditos SM da empresa do usuário."""
    company_id = user.company_id
    if not company_id:
        return {"balance": 0, "lifetime_earned": 0}

    result = await db.execute(text(
        "SELECT balance, lifetime_earned FROM user_credits WHERE company_id = :cid"
    ), {"cid": company_id})
    row = result.mappings().first()
    if not row:
        return {"balance": 0, "lifetime_earned": 0}
    return {"balance": int(row["balance"] or 0), "lifetime_earned": int(row["lifetime_earned"] or 0)}


# ── POST /billing/credit-packs/{pack_id}/purchase ───────────────────────────

@router.post("/{pack_id}/purchase")
async def purchase_credit_pack(
    pack_id: int,
    payment_method: str = Body(default="pix", embed=True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Compra de créditos SM.
    payment_method: 'pix' (Mercado Pago) ou 'wallet' (saldo interno BRL).
    """
    company_id = user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuário sem empresa associada")

    # 1. Buscar pack
    result = await db.execute(
        text("SELECT * FROM sm_credit_packs WHERE id=:id AND is_active=true"),
        {"id": pack_id}
    )
    pack = result.mappings().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack não encontrado ou inativo")
    pack = dict(pack)
    price = float(pack["price_brl"] or 0)

    # 2. Pack gratuito — creditar direto
    if price == 0:
        already = await db.execute(text("""
            SELECT id FROM credit_transactions
            WHERE company_id=:cid AND description LIKE :desc LIMIT 1
        """), {"cid": company_id, "desc": f"%sm_pack_id={pack_id}%"})
        if already.scalar():
            raise HTTPException(status_code=409, detail="Você já resgatou este pack gratuito")

        new_bal = await _credit_sm(db, company_id, pack, source="free_pack")
        await db.commit()
        return {"ok": True, "free": True, "credits_added": pack["credits_amount"], "new_balance": new_bal}

    # 3. Pagamento via Wallet (saldo BRL interno)
    if payment_method == "wallet":
        wallet_r = await db.execute(
            text("SELECT id, balance FROM wallets WHERE company_id=:cid FOR UPDATE"),
            {"cid": company_id}
        )
        wallet = wallet_r.mappings().first()
        if not wallet or float(wallet["balance"]) < price:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Necessário: R$ {price:.2f}, Disponível: R$ {float(wallet['balance'] if wallet else 0):.2f}"
            )

        # Debitar wallet
        await db.execute(text("""
            UPDATE wallets SET balance = balance - :price, updated_at = NOW()
            WHERE id = :wid
        """), {"price": price, "wid": wallet["id"]})

        new_wallet_bal = float(wallet["balance"]) - price

        # Registrar transação na wallet
        await db.execute(text("""
            INSERT INTO wallet_transactions
                (company_id, wallet_id, type, amount, balance_after, description, source, created_by_system, created_at)
            VALUES
                (:cid, :wid, 'debit', :amt, :bal_after, :desc, 'sm_credits', true, NOW())
        """), {
            "cid": company_id, "wid": wallet["id"], "amt": price, "bal_after": new_wallet_bal,
            "desc": f"Compra de créditos SM: {pack['name']} ({pack['credits_amount']} SM)",
        })

        # Creditar SM
        new_bal = await _credit_sm(db, company_id, pack, source="wallet_purchase")

        # Registrar na payment_charges para histórico admin
        await db.execute(text("""
            INSERT INTO payment_charges
                (company_id, amount, status, description, created_by_user_id,
                 token_pack_id, tokens_to_credit, paid_at, created_at, updated_at,
                 metadata)
            VALUES
                (:cid, :amt, 'paid', :desc, :uid,
                 NULL, 0, NOW(), NOW(), NOW(),
                 :meta::jsonb)
        """), {
            "cid": company_id, "amt": price, "uid": user.id,
            "desc": f"SM Credits: {pack['name']}",
            "meta": json.dumps({"sm_pack_id": pack_id, "sm_pack_name": pack["name"], "credits_amount": pack["credits_amount"], "payment_method": "wallet"}),
        })

        await db.commit()
        logger.info(f"💰 SM Credits via wallet: {pack['name']} ({pack['credits_amount']} SM) | company={company_id}")
        return {
            "ok": True, "free": False, "payment_method": "wallet",
            "credits_added": pack["credits_amount"], "new_balance": new_bal,
            "wallet_balance": new_wallet_bal,
        }

    # 4. Pagamento via PIX (Mercado Pago)
    company_r = await db.execute(
        text("SELECT name, email FROM companies WHERE id=:id"),
        {"id": company_id}
    )
    company = company_r.mappings().first()

    charge_data = ChargeCreate(
        amount=price,
        description=f"Créditos SM: {pack['name']} — {pack['credits_amount']} créditos",
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

        # Metadata para callback de pagamento
        await db.execute(text("""
            UPDATE payment_charges
            SET metadata = COALESCE(metadata, '{}'::jsonb) || :meta::jsonb
            WHERE id = :charge_id
        """), {
            "meta": json.dumps({"sm_pack_id": pack_id, "sm_pack_name": pack["name"], "credits_amount": pack["credits_amount"], "payment_type": "sm_credits"}),
            "charge_id": charge.id,
        })
        await db.commit()

        logger.info(f"📱 PIX gerado para SM Credits: {pack['name']} | company={company_id} | charge={charge.id}")

        return {
            "ok": True, "free": False, "payment_method": "pix",
            "charge_id": charge.id,
            "external_reference": charge.external_reference,
            "amount": float(charge.amount),
            "pack_name": pack["name"],
            "credits_amount": pack["credits_amount"],
            "pix_qr_code": charge.pix_qr_code,
            "pix_copy_paste": charge.pix_copy_paste_code,
            "payment_link": charge.payment_link,
            "expires_at": charge.expires_at.isoformat() if charge.expires_at else None,
            "status": charge.status.value if charge.status else "pending",
        }
    except Exception as e:
        logger.error(f"Erro PIX SM Credits pack {pack_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar cobrança: {str(e)}")


# ── GET /billing/credit-packs/status/{charge_id} ────────────────────────────

@router.get("/status/{charge_id}")
async def check_sm_purchase_status(
    charge_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Polling de status da cobrança PIX para SM Credits."""
    result = await db.execute(text("""
        SELECT id, status, paid_at, expires_at, metadata
        FROM payment_charges
        WHERE id = :charge_id AND company_id = :company_id
    """), {"charge_id": charge_id, "company_id": user.company_id})

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    status = row["status"]
    meta = row["metadata"] or {}

    # Se pago e tem sm_pack_id, creditar tokens automaticamente
    if status == "paid" and meta.get("sm_pack_id") and not meta.get("sm_credited"):
        try:
            pack_r = await db.execute(
                text("SELECT * FROM sm_credit_packs WHERE id=:id"),
                {"id": meta["sm_pack_id"]}
            )
            pack = pack_r.mappings().first()
            if pack:
                pack = dict(pack)
                await _credit_sm(db, user.company_id, pack, source="pix_purchase")
                # Marcar como creditado
                await db.execute(text("""
                    UPDATE payment_charges
                    SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"sm_credited": true}'::jsonb
                    WHERE id = :id
                """), {"id": charge_id})
                await db.commit()
                logger.info(f"✅ SM Credits creditados via PIX: {pack['credits_amount']} SM | company={user.company_id}")
        except Exception as e:
            logger.error(f"Erro ao creditar SM via PIX polling: {e}")

    return {
        "charge_id": row["id"],
        "status": status,
        "paid_at": row["paid_at"].isoformat() if row["paid_at"] else None,
        "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        "pack_name": meta.get("sm_pack_name"),
        "credits_amount": meta.get("credits_amount"),
        "sm_credited": meta.get("sm_credited", False),
    }


# ── GET /billing/credit-packs/wallet-balance — saldo wallet BRL ─────────────

@router.get("/wallet-balance")
async def my_wallet_balance(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna saldo BRL da wallet para usar na compra de SM credits."""
    company_id = user.company_id
    if not company_id:
        return {"balance": 0}
    result = await db.execute(
        text("SELECT balance FROM wallets WHERE company_id=:cid"),
        {"cid": company_id}
    )
    bal = result.scalar_one_or_none()
    return {"balance": float(bal or 0)}


# ── GET /billing/credit-packs/history — histórico de compras ─────────────────

@router.get("/history")
async def my_credit_history(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Histórico de transações de créditos SM do usuário."""
    company_id = user.company_id
    if not company_id:
        return {"transactions": [], "total": 0}

    offset = (page - 1) * limit
    rows = await db.execute(text("""
        SELECT id, type, amount, balance_after, ref_type, description, created_at
        FROM credit_transactions
        WHERE company_id = :cid
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """), {"cid": company_id, "limit": limit, "offset": offset})

    total_r = await db.execute(
        text("SELECT COUNT(*) FROM credit_transactions WHERE company_id=:cid"),
        {"cid": company_id}
    )

    tx = []
    for r in rows.mappings().all():
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        tx.append(d)

    return {"transactions": tx, "total": int(total_r.scalar() or 0), "page": page}


# ── Helper: creditar SM ─────────────────────────────────────────────────────

async def _credit_sm(db: AsyncSession, company_id: int, pack: dict, source: str = "purchase") -> int:
    """Credita créditos SM no saldo da empresa e registra transação. Returns new balance."""
    amount = int(pack.get("credits_amount") or 0)
    pack_id = pack.get("id")
    pack_name = pack.get("name", "Pack")

    # Upsert saldo
    await db.execute(text("""
        INSERT INTO user_credits (company_id, balance, lifetime_earned, updated_at)
        VALUES (:cid, :amt, :amt, NOW())
        ON CONFLICT (company_id) DO UPDATE SET
            balance = user_credits.balance + :amt,
            lifetime_earned = user_credits.lifetime_earned + :amt,
            updated_at = NOW()
    """), {"cid": company_id, "amt": amount})

    # Buscar novo saldo
    bal_r = await db.execute(
        text("SELECT balance FROM user_credits WHERE company_id=:cid"),
        {"cid": company_id}
    )
    new_balance = int(bal_r.scalar_one_or_none() or 0)

    # Registrar transação
    await db.execute(text("""
        INSERT INTO credit_transactions
            (company_id, type, amount, balance_after, ref_type, description, created_at)
        VALUES
            (:cid, 'purchase', :amt, :bal, 'sm_credit_pack', :desc, NOW())
    """), {
        "cid": company_id,
        "amt": amount,
        "bal": new_balance,
        "desc": f"Compra de pack: {pack_name} (sm_pack_id={pack_id}, source={source})",
    })

    return new_balance
