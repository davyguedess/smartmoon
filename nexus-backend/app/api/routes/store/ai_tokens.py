"""
NEXUS.IA — IA Store Routes (user-facing)
Catálogo de packs de tokens, compra, saldo e histórico.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from loguru import logger
from typing import Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.services import ai_token_service

router = APIRouter(prefix="/store/ai-tokens", tags=["IA Store"])


# ── Utilitário ─────────────────────────────────────────────────────────────────

def _pack_row(row: dict) -> dict:
    return {
        "id":              row["id"],
        "name":            row["name"],
        "description":     row["description"],
        "badge_text":      row["badge_text"],
        "provider":        row["provider"],
        "tokens_included": row["tokens_included"],
        "price_brl":       float(row["price_brl"] or 0),
        "price_credits":   row["price_credits"] or 0,
        "is_highlighted":  row["is_highlighted"],
        "tier":            row["tier"],
        "color":           row["color"] or "#a78bfa",
        "icon":            row["icon"] or "zap",
        "renews_monthly":  row["renews_monthly"],
        "is_free":         float(row["price_brl"] or 0) == 0 and int(row["price_credits"] or 0) == 0,
    }


# ── GET /store/ai-tokens/packs ─────────────────────────────────────────────────

@router.get("/packs")
async def list_packs(
    tier: Optional[str] = Query(None, description="free|starter|pro|enterprise"),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(get_current_user),
):
    """Lista todos os packs de tokens disponíveis (free e pagos)."""
    try:
        q = "SELECT * FROM ai_token_packs WHERE is_active = true"
        params = {}
        if tier:
            q += " AND tier = :tier"
            params["tier"] = tier
        q += " ORDER BY sort_order ASC, price_brl ASC"

        result = await db.execute(text(q), params)
        packs = [_pack_row(dict(r)) for r in result.mappings().all()]
        return {"packs": packs, "total": len(packs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── GET /store/ai-tokens/balance ───────────────────────────────────────────────

@router.get("/balance")
async def get_balance(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(get_current_user),
):
    """Retorna saldo de SM tokens da empresa e estatísticas de uso."""
    try:
        balances = await ai_token_service.get_all_balances(db, user.company_id)

        # Total unificado
        total_balance = sum(balances.values())

        # Uso do mês atual
        usage_row = await db.execute(text("""
            SELECT COALESCE(SUM(nexus_tokens_cost), 0) as used_this_month
            FROM ai_token_transactions
            WHERE company_id = :cid
              AND tx_type = 'usage'
              AND created_at >= date_trunc('month', NOW())
        """), {"cid": user.company_id})
        used_month = int(usage_row.scalar() or 0)

        # Packs ativos/instalados
        packs_row = await db.execute(text("""
            SELECT COUNT(*) FROM ai_token_transactions
            WHERE company_id = :cid AND tx_type = 'credit'
        """), {"cid": user.company_id})
        packs_count = int(packs_row.scalar() or 0)

        return {
            "total_balance": total_balance,
            "balances_by_provider": balances,
            "used_this_month": used_month,
            "packs_activated": packs_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ── POST /store/ai-tokens/packs/{id}/activate ─────────────────────────────────

@router.post("/packs/{pack_id}/activate")
async def activate_pack(
    pack_id: int,
    db:      AsyncSession = Depends(get_db),
    user     = Depends(get_current_user),
):
    """
    Ativa um pack de tokens.
    - Pack GRÁTIS: crédito imediato
    - Pack PAGO (R$): gera cobrança PIX (returns pix data)
    - Pack PAGO (créditos): debita créditos da conta
    """
    try:
        pack_row = await db.execute(
            text("SELECT * FROM ai_token_packs WHERE id = :id AND is_active = true"),
            {"id": pack_id}
        )
        pack = pack_row.mappings().first()
        if not pack:
            raise HTTPException(status_code=404, detail="Pack não encontrado")

        pack = dict(pack)
        price_brl     = float(pack["price_brl"] or 0)
        price_credits = int(pack["price_credits"] or 0)
        tokens        = int(pack["tokens_included"])

        # ── Pack Grátis ──────────────────────────────────────────────────────
        if price_brl == 0 and price_credits == 0:
            # Verificar se já tem este pack grátis ativo (evitar duplicata no mês)
            already = await db.execute(text("""
                SELECT id FROM ai_token_transactions
                WHERE company_id = :cid AND pack_id = :pid AND tx_type = 'credit'
                  AND created_at >= date_trunc('month', NOW())
            """), {"cid": user.company_id, "pid": pack_id})

            if already.fetchone() and pack.get("renews_monthly"):
                raise HTTPException(
                    status_code=409,
                    detail="Pack grátis já ativado este mês. Renova automaticamente no próximo."
                )

            new_balance = await ai_token_service.credit_tokens(
                db=db,
                company_id=user.company_id,
                amount=tokens,
                pack_id=pack_id,
                provider=pack["provider"] or "any",
                description=f"Pack grátis: {pack['name']}",
            )
            await db.commit()
            return {
                "ok": True,
                "type": "free",
                "message": f"✅ {tokens:,} SM tokens creditados!",
                "new_balance": new_balance,
                "pack_name": pack["name"],
            }



        # ── Pack Pago em R$ — gerar PIX ───────────────────────────────────────
        if price_brl > 0:
            from app.payments.services.charge_service import ChargeService
            from app.payments.schemas import ChargeCreate
            from decimal import Decimal
            from sqlalchemy import update as sa_update

            charge = await ChargeService.create_charge(
                db=db,
                company_id=user.company_id,
                data=ChargeCreate(
                    amount=Decimal(str(price_brl)),
                    description=f"IA Store — {pack['name']} ({tokens:,} tokens)",
                    client_name=getattr(user, 'name', None) or user.email,
                    client_email=user.email,
                ),
                created_by_user_id=user.id,
            )
            # Salvar pack_id em metadata_ para crédito automático pós-PIX
            from app.payments.models import PaymentCharge as _PC
            await db.execute(
                sa_update(_PC)
                .where(_PC.id == charge.id)
                .values(metadata_={
                    "ai_token_pack_id": pack_id,
                    "tokens": tokens,
                    "provider": pack.get("provider", "any"),
                })
            )
            await db.commit()
            return {
                "ok": True,
                "type": "pix",
                "message": "PIX gerado! Após o pagamento, seus tokens serão creditados automaticamente.",
                "pix_qr_code": charge.pix_qr_code,
                "pix_copy_paste_code": charge.pix_copy_paste_code,
                "charge_id": charge.id,
                "amount": price_brl,
                "pack_name": pack["name"],
                "tokens": tokens,
            }

        # ── Pack Pago em Créditos ──────────────────────────────────────────────
        if price_credits > 0:
            from app.db.repositories.plan_repository import PlanRepository
            repo = PlanRepository(db)
            balance = await repo.get_credit_balance(user.company_id)

            if balance < price_credits:
                raise HTTPException(
                    status_code=402,
                    detail=f"Créditos insuficientes: você tem {balance}, o pack custa {price_credits} créditos."
                )

            await repo.debit_credits(
                company_id=user.company_id,
                amount=price_credits,
                description=f"IA Store — {pack['name']}",
                reference_id=str(pack_id),
                reference_type="ai_token_pack",
                performed_by=user.id,
            )

            new_balance = await ai_token_service.credit_tokens(
                db=db,
                company_id=user.company_id,
                amount=tokens,
                pack_id=pack_id,
                provider=pack["provider"] or "any",
                description=f"Pack (créditos): {pack['name']}",
            )
            await db.commit()
            return {
                "ok": True,
                "type": "credits",
                "message": f"✅ {tokens:,} SM tokens creditados!",
                "new_balance": new_balance,
                "pack_name": pack["name"],
            }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao ativar pack: {e}")


# ── GET /store/ai-tokens/history ──────────────────────────────────────────────

@router.get("/history")
async def get_history(
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db:    AsyncSession = Depends(get_db),
    user   = Depends(get_current_user),
):
    """Histórico de uso e compra de tokens."""
    return await ai_token_service.get_history(db, user.company_id, page, limit)
