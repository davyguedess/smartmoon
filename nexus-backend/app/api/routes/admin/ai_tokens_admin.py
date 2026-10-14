"""
NEXUS.IA — Admin AI Tokens Routes
Gerencia o catálogo de packs de IA tokens (superadmin only).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import require_superadmin

router = APIRouter(prefix="/admin/ai-tokens", tags=["Admin AI Tokens"])


class PackIn(BaseModel):
    name:            str
    description:     Optional[str] = None
    badge_text:      Optional[str] = None
    provider:        str = "any"
    tokens_included: int = 1_000_000
    price_brl:       float = 0
    price_credits:   int = 0
    is_highlighted:  bool = False
    tier:            str = "starter"
    sort_order:      int = 0
    renews_monthly:  bool = False
    color:           str = "#a78bfa"
    icon:            str = "zap"
    is_active:       bool = True


# ── GET /admin/ai-tokens/packs ─────────────────────────────────────────────────

@router.get("/packs")
async def list_packs(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    result = await db.execute(text(
        "SELECT * FROM ai_token_packs ORDER BY sort_order ASC, id ASC"
    ))
    packs = [dict(r) for r in result.mappings().all()]
    for p in packs:
        p["price_brl"] = float(p["price_brl"] or 0)
        if p.get("created_at"): p["created_at"] = p["created_at"].isoformat()
        if p.get("updated_at"): p["updated_at"] = p["updated_at"].isoformat()
    return {"packs": packs}


# ── POST /admin/ai-tokens/packs ────────────────────────────────────────────────

@router.post("/packs")
async def create_pack(
    body: PackIn,
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    try:
        result = await db.execute(text("""
            INSERT INTO ai_token_packs
                (name, description, badge_text, provider, tokens_included,
                 price_brl, price_credits, is_highlighted, tier, sort_order,
                 renews_monthly, color, icon, is_active)
            VALUES
                (:name, :desc, :badge, :provider, :tokens,
                 :price_brl, :price_cr, :highlight, :tier, :sort,
                 :renews, :color, :icon, :active)
            RETURNING id
        """), {
            "name": body.name, "desc": body.description, "badge": body.badge_text,
            "provider": body.provider, "tokens": body.tokens_included,
            "price_brl": body.price_brl, "price_cr": body.price_credits,
            "highlight": body.is_highlighted, "tier": body.tier, "sort": body.sort_order,
            "renews": body.renews_monthly, "color": body.color, "icon": body.icon,
            "active": body.is_active,
        })
        new_id = result.scalar()
        await db.commit()
        logger.info(f"📦 Admin criou pack AI tokens: {body.name} (id={new_id})")
        return {"ok": True, "id": new_id, "message": "Pack criado com sucesso"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── PATCH /admin/ai-tokens/packs/{id} ─────────────────────────────────────────

@router.patch("/packs/{pack_id}")
async def update_pack(
    pack_id: int,
    body:    PackIn,
    db:      AsyncSession = Depends(get_db),
    user     = Depends(require_superadmin),
):
    try:
        await db.execute(text("""
            UPDATE ai_token_packs SET
                name=:name, description=:desc, badge_text=:badge,
                provider=:provider, tokens_included=:tokens,
                price_brl=:price_brl, price_credits=:price_cr,
                is_highlighted=:highlight, tier=:tier, sort_order=:sort,
                renews_monthly=:renews, color=:color, icon=:icon,
                is_active=:active, updated_at=NOW()
            WHERE id=:id
        """), {
            "id": pack_id, "name": body.name, "desc": body.description,
            "badge": body.badge_text, "provider": body.provider,
            "tokens": body.tokens_included, "price_brl": body.price_brl,
            "price_cr": body.price_credits, "highlight": body.is_highlighted,
            "tier": body.tier, "sort": body.sort_order, "renews": body.renews_monthly,
            "color": body.color, "icon": body.icon, "active": body.is_active,
        })
        await db.commit()
        return {"ok": True, "message": "Pack atualizado"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── DELETE /admin/ai-tokens/packs/{id} ────────────────────────────────────────

@router.delete("/packs/{pack_id}")
async def delete_pack(
    pack_id: int,
    db:      AsyncSession = Depends(get_db),
    user     = Depends(require_superadmin),
):
    await db.execute(
        text("UPDATE ai_token_packs SET is_active=false WHERE id=:id"),
        {"id": pack_id}
    )
    await db.commit()
    return {"ok": True, "message": "Pack desativado"}


# ── GET /admin/ai-tokens/usage ─────────────────────────────────────────────────

@router.get("/usage")
async def platform_usage(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Métricas globais de uso de tokens na plataforma."""
    try:
        totals = await db.execute(text("""
            SELECT
                COUNT(DISTINCT company_id)          AS companies_using,
                SUM(CASE WHEN tx_type='usage' THEN nexus_tokens_cost ELSE 0 END) AS total_consumed,
                SUM(CASE WHEN tx_type='credit' THEN nexus_tokens_cost ELSE 0 END) AS total_issued,
                SUM(CASE WHEN tx_type='usage' AND created_at >= date_trunc('month',NOW())
                    THEN nexus_tokens_cost ELSE 0 END) AS consumed_this_month
            FROM ai_token_transactions
        """))
        row = totals.mappings().first() or {}

        top_companies = await db.execute(text("""
            SELECT c.name, SUM(t.nexus_tokens_cost) as consumed
            FROM ai_token_transactions t
            JOIN companies c ON c.id = t.company_id
            WHERE t.tx_type='usage'
            GROUP BY c.name
            ORDER BY consumed DESC LIMIT 10
        """))

        by_provider = await db.execute(text("""
            SELECT provider, SUM(nexus_tokens_cost) as consumed
            FROM ai_token_transactions WHERE tx_type='usage'
            GROUP BY provider ORDER BY consumed DESC
        """))

        return {
            "summary": {
                "companies_using":     int(row.get("companies_using") or 0),
                "total_consumed":      int(row.get("total_consumed") or 0),
                "total_issued":        int(row.get("total_issued") or 0),
                "consumed_this_month": int(row.get("consumed_this_month") or 0),
            },
            "top_companies": [{"name": r.name, "consumed": int(r.consumed)} for r in top_companies.fetchall()],
            "by_provider":   [{"provider": r.provider, "consumed": int(r.consumed)} for r in by_provider.fetchall()],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── GET /admin/ai-tokens/balances ─────────────────────────────────────────────

@router.get("/balances")
async def all_balances(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Lista o saldo de todas as empresas."""
    try:
        result = await db.execute(text("""
            SELECT c.id as company_id, c.name as company_name, b.provider, b.balance_tokens,
                   b.total_purchased, b.total_used, b.updated_at
            FROM ai_token_balances b
            JOIN companies c ON c.id = b.company_id
            ORDER BY b.balance_tokens DESC
            LIMIT 100
        """))
        rows = []
        for r in result.mappings().all():
            d = dict(r)
            if d.get("updated_at"): d["updated_at"] = d["updated_at"].isoformat()
            rows.append(d)
        return {"balances": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── GET /admin/ai-tokens/purchases ────────────────────────────────────────────

@router.get("/purchases")
async def list_purchases(
    db:     AsyncSession = Depends(get_db),
    user    = Depends(require_superadmin),
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lista todas as compras de packs de tokens com status PIX."""
    try:
        result = await db.execute(text("""
            SELECT
                pc.id as charge_id,
                pc.created_at,
                pc.status,
                pc.amount,
                pc.paid_at,
                pc.expires_at,
                pc.tokens_to_credit,
                c.name as company_name,
                atp.name as pack_name,
                atp.tokens_included
            FROM payment_charges pc
            JOIN companies c ON c.id = pc.company_id
            LEFT JOIN ai_token_packs atp ON atp.id = pc.token_pack_id
            WHERE pc.token_pack_id IS NOT NULL
            ORDER BY pc.created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"limit": limit, "offset": offset})

        rows = []
        for r in result.mappings().all():
            d = dict(r)
            for f in ["created_at", "paid_at", "expires_at"]:
                if d.get(f): d[f] = d[f].isoformat()
            rows.append(d)

        total = await db.execute(text(
            "SELECT COUNT(*) FROM payment_charges WHERE token_pack_id IS NOT NULL"
        ))
        return {"purchases": rows, "total": total.scalar() or 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── POST /admin/ai-tokens/grant ───────────────────────────────────────────────

class GrantTokensIn(BaseModel):
    company_id:  int
    tokens:      int
    provider:    str = "any"
    reason:      str = "Concessão administrativa"


@router.post("/grant")
async def grant_tokens(
    body: GrantTokensIn,
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Concede tokens manualmente a uma empresa (sem cobrança)."""
    if body.tokens <= 0:
        raise HTTPException(status_code=400, detail="Quantidade de tokens deve ser maior que zero")

    try:
        # Verificar empresa
        co = await db.execute(
            text("SELECT id, name FROM companies WHERE id=:id"), {"id": body.company_id}
        )
        company = co.mappings().first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")

        # Upsert no saldo
        await db.execute(text("""
            INSERT INTO ai_token_balances
                (company_id, provider, balance_tokens, total_purchased, total_used, updated_at)
            VALUES (:cid, :prov, :tokens, :tokens, 0, NOW())
            ON CONFLICT (company_id, provider)
            DO UPDATE SET
                balance_tokens  = ai_token_balances.balance_tokens + :tokens,
                total_purchased = ai_token_balances.total_purchased + :tokens,
                updated_at      = NOW()
        """), {"cid": body.company_id, "prov": body.provider, "tokens": body.tokens})

        # Registrar transação de auditoria
        await db.execute(text("""
            INSERT INTO ai_token_transactions
                (company_id, provider, tx_type, nexus_tokens_cost, description, created_at)
            VALUES (:cid, :prov, 'credit', :tokens, :desc, NOW())
        """), {
            "cid": body.company_id,
            "prov": body.provider,
            "tokens": body.tokens,
            "desc": f"Concessão administrativa: {body.reason} (by superadmin id={user.id})",
        })

        await db.commit()
        logger.info(
            f"🎁 Admin {user.id} concedeu {body.tokens:,} tokens "
            f"para empresa {body.company_id} | motivo: {body.reason}"
        )
        return {
            "ok": True,
            "company_id": body.company_id,
            "company_name": company["name"],
            "tokens_granted": body.tokens,
            "provider": body.provider,
            "message": f"✅ {body.tokens:,} tokens concedidos para {company['name']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── GET /admin/ai-tokens/company/{company_id} ─────────────────────────────────

@router.get("/company/{company_id}")
async def company_token_detail(
    company_id: int,
    db:         AsyncSession = Depends(get_db),
    user        = Depends(require_superadmin),
):
    """Saldo + histórico de transações de uma empresa específica."""
    try:
        # Saldo por provider
        balances = await db.execute(text("""
            SELECT provider, balance_tokens, total_purchased, total_used, updated_at
            FROM ai_token_balances WHERE company_id=:cid
            ORDER BY balance_tokens DESC
        """), {"cid": company_id})

        balance_rows = []
        for r in balances.mappings().all():
            d = dict(r)
            if d.get("updated_at"): d["updated_at"] = d["updated_at"].isoformat()
            balance_rows.append(d)

        # Transações recentes
        txs = await db.execute(text("""
            SELECT id, provider, tx_type, nexus_tokens_cost as tokens,
                   description, created_at
            FROM ai_token_transactions
            WHERE company_id=:cid
            ORDER BY created_at DESC LIMIT 50
        """), {"cid": company_id})

        tx_rows = []
        for r in txs.mappings().all():
            d = dict(r)
            if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
            tx_rows.append(d)

        # Compras de packs
        purchases = await db.execute(text("""
            SELECT pc.id, pc.status, pc.amount, pc.paid_at, pc.created_at,
                   pc.tokens_to_credit, atp.name as pack_name
            FROM payment_charges pc
            LEFT JOIN ai_token_packs atp ON atp.id = pc.token_pack_id
            WHERE pc.company_id=:cid AND pc.token_pack_id IS NOT NULL
            ORDER BY pc.created_at DESC LIMIT 20
        """), {"cid": company_id})

        purchase_rows = []
        for r in purchases.mappings().all():
            d = dict(r)
            for f in ["paid_at", "created_at"]:
                if d.get(f): d[f] = d[f].isoformat()
            purchase_rows.append(d)

        total_balance = sum(int(b.get("balance_tokens") or 0) for b in balance_rows)

        return {
            "company_id": company_id,
            "total_balance": total_balance,
            "balances": balance_rows,
            "transactions": tx_rows,
            "purchases": purchase_rows,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")

