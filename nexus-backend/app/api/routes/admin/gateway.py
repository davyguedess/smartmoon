"""
NEXUS.IA — Admin Gateway Routes
Gerencia configurações do gateway de pagamento (Mercado Pago, etc.)
Exclusivo do superadmin — os tenantes não têm acesso a estas rotas.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func, and_
from loguru import logger
from typing import Optional
from datetime import datetime, timezone
import json

from app.db.session import get_db
from app.core.dependencies import require_superadmin
from app.core.config import settings

router = APIRouter(prefix="/admin/gateway", tags=["Admin Gateway"])

# ── Chave única no banco para config do gateway ────────────────────────────────
_CONFIG_KEY       = "platform_gateway_config"
_CONTROLS_KEY     = "platform_payment_controls"
_BLOCKED_KEY      = "payment_blocked_companies"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _load_gateway_config(db: AsyncSession) -> dict:
    """Carrega config do gateway do banco (tabela de settings globais)."""
    try:
        result = await db.execute(
            text("SELECT value FROM platform_settings WHERE key = :k"),
            {"k": _CONFIG_KEY}
        )
        row = result.scalar_one_or_none()
        if row:
            return json.loads(row)
    except Exception:
        pass
    return {}


async def _save_gateway_config(db: AsyncSession, config: dict) -> None:
    """Salva config do gateway no banco (upsert)."""
    val = json.dumps(config, ensure_ascii=False)
    await db.execute(text("""
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES (:k, :v, NOW())
        ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()
    """), {"k": _CONFIG_KEY, "v": val})
    await db.commit()


async def _load_controls(db: AsyncSession) -> dict:
    """Carrega configurações de controle operacional do gateway."""
    try:
        result = await db.execute(
            text("SELECT value FROM platform_settings WHERE key = :k"),
            {"k": _CONTROLS_KEY}
        )
        row = result.scalar_one_or_none()
        if row:
            return json.loads(row)
    except Exception:
        pass
    return {
        "auto_withdrawal_enabled": True,
        "deposits_enabled":        True,
        "active_provider":         "mercadopago",
    }


async def _save_controls(db: AsyncSession, controls: dict) -> None:
    val = json.dumps(controls, ensure_ascii=False)
    await db.execute(text("""
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES (:k, :v, NOW())
        ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()
    """), {"k": _CONTROLS_KEY, "v": val})
    await db.commit()


async def _load_blocked_companies(db: AsyncSession) -> list:
    try:
        result = await db.execute(
            text("SELECT value FROM platform_settings WHERE key = :k"),
            {"k": _BLOCKED_KEY}
        )
        row = result.scalar_one_or_none()
        if row:
            return json.loads(row)
    except Exception:
        pass
    return []


async def _save_blocked_companies(db: AsyncSession, ids: list) -> None:
    val = json.dumps(ids)
    await db.execute(text("""
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES (:k, :v, NOW())
        ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()
    """), {"k": _BLOCKED_KEY, "v": val})
    await db.commit()


async def _ensure_kyc_table(db: AsyncSession) -> None:
    """Cria tabela kyc_requests se não existir (migration inline)."""
    try:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS kyc_requests (
                id              SERIAL PRIMARY KEY,
                company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                status          VARCHAR(30) NOT NULL DEFAULT 'pending',
                submitted_at    TIMESTAMPTZ DEFAULT NOW(),
                reviewed_by     INTEGER REFERENCES users(id),
                reviewed_at     TIMESTAMPTZ,
                docs_urls       JSONB DEFAULT '[]',
                rejection_reason TEXT,
                notes           TEXT,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_kyc_company ON kyc_requests(company_id);
            CREATE INDEX IF NOT EXISTS ix_kyc_status  ON kyc_requests(status);
        """))
        await db.commit()
    except Exception as e:
        logger.debug(f"kyc_requests table: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/config
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_gateway_config(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Retorna configuração atual do gateway (tokens mascarados)."""
    config = await _load_gateway_config(db)

    def mask(v: str) -> str:
        if not v:
            return ""
        if len(v) <= 8:
            return "****"
        return v[:4] + "****" + v[-4:]

    mp = config.get("mercadopago", {})
    masked_mp = {
        "access_token":          mask(mp.get("access_token", "")),
        "public_key":            mask(mp.get("public_key", "")),
        "webhook_secret":        mask(mp.get("webhook_secret", "")),
        "sandbox_mode":          mp.get("sandbox_mode", False),
        "platform_fee_percent":  mp.get("platform_fee_percent", "0"),
        "auto_approve_pix":      mp.get("auto_approve_pix", True),
        "configured":            bool(mp.get("access_token")),
    }

    return {
        "active_provider": config.get("active_provider", "mercadopago"),
        "mercadopago":     masked_mp,
        "status": {
            "mp_configured": bool(mp.get("access_token")),
            "webhook_url": "https://smartmoon.online/api/mercadopago",
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/config
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/config")
async def save_gateway_config(
    body: dict = Body(...),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Salva/atualiza configurações do gateway de pagamento."""
    existing = await _load_gateway_config(db)

    def merge_keep_real(existing_val: str, new_val: str) -> str:
        if not new_val or "****" in new_val:
            return existing_val
        return new_val

    mp_existing = existing.get("mercadopago", {})
    mp_new      = body.get("mercadopago", {})

    merged_mp = {
        "access_token":         merge_keep_real(mp_existing.get("access_token", ""), mp_new.get("access_token", "")),
        "public_key":           merge_keep_real(mp_existing.get("public_key", ""), mp_new.get("public_key", "")),
        "webhook_secret":       merge_keep_real(mp_existing.get("webhook_secret", ""), mp_new.get("webhook_secret", "")),
        "sandbox_mode":         mp_new.get("sandbox_mode", mp_existing.get("sandbox_mode", False)),
        "platform_fee_percent": mp_new.get("platform_fee_percent", mp_existing.get("platform_fee_percent", "0")),
        "auto_approve_pix":     mp_new.get("auto_approve_pix", mp_existing.get("auto_approve_pix", True)),
    }

    config = {
        "active_provider": body.get("active_provider", existing.get("active_provider", "mercadopago")),
        "mercadopago":     merged_mp,
    }

    try:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS platform_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await db.commit()
    except Exception as e:
        logger.warning(f"platform_settings table check: {e}")

    await _save_gateway_config(db, config)
    _sync_env_from_config(merged_mp)

    logger.info(f"⚙️ Gateway config atualizada pelo admin {user.email}")
    return {"ok": True, "message": "Configurações salvas com sucesso"}


def _sync_env_from_config(mp_config: dict) -> None:
    import os
    if mp_config.get("access_token"):
        os.environ["MERCADOPAGO_ACCESS_TOKEN"] = mp_config["access_token"]
        try:
            settings.MERCADOPAGO_ACCESS_TOKEN = mp_config["access_token"]
        except Exception:
            pass
    if mp_config.get("webhook_secret"):
        os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = mp_config["webhook_secret"]


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/test
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/test")
async def test_gateway_connection(
    body: dict = Body(...),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Testa a conexão com o gateway de pagamento ativo."""
    provider = body.get("provider", "mercadopago")

    if provider == "mercadopago":
        config = await _load_gateway_config(db)
        mp = config.get("mercadopago", {})
        token = mp.get("access_token", "")

        if not token:
            return {"success": False, "message": "Access Token não configurado"}

        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.mercadopago.com/users/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    site_id = data.get("site_id", "—")
                    email   = data.get("email", "—")
                    nickname = data.get("nickname", "—")
                    logger.success(f"✅ MP test OK: site={site_id} | email={email}")
                    return {
                        "success": True,
                        "message": f"Conexão OK — Conta: {email} ({nickname}) | Mercado: {site_id}",
                        "status": {
                            "mp_configured": True,
                            "account_email": email,
                            "site_id": site_id,
                        }
                    }
                else:
                    err_data = resp.json() if resp.headers.get("content-type","").startswith("application/json") else {}
                    err = err_data.get("message", resp.text[:200])
                    return {"success": False, "message": f"Erro MP ({resp.status_code}): {err}"}
        except Exception as e:
            return {"success": False, "message": f"Erro de conexão: {str(e)}"}

    return {"success": False, "message": f"Provedor '{provider}' não suportado ainda"}


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def gateway_dashboard(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """
    Dashboard financeiro consolidado da plataforma.
    Usa SQL raw para evitar bug do SQLAlchemy com enum case (PAID vs paid).
    """
    from datetime import date

    today = date.today()
    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)

    try:
        # ── Depósitos do mês (cobranças pagas este mês)
        dep_result = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0)
            FROM payment_charges
            WHERE status = 'paid' AND paid_at >= :ms
        """), {"ms": month_start})
        monthly_deposits = float(dep_result.scalar_one() or 0)

        # ── Saques do mês (withdrawals completed)
        wd_result = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0)
            FROM withdrawal_requests
            WHERE status = 'completed' AND processed_at >= :ms
        """), {"ms": month_start})
        monthly_withdrawals = float(wd_result.scalar_one() or 0)

        # ── Saldo total da plataforma
        balance_result = await db.execute(text(
            "SELECT COALESCE(SUM(balance), 0) FROM wallets"
        ))
        total_balance = float(balance_result.scalar_one() or 0)

        # ── Total recebido ever
        total_received_result = await db.execute(text(
            "SELECT COALESCE(SUM(total_received), 0) FROM wallets"
        ))
        total_received = float(total_received_result.scalar_one() or 0)

        # ── Cobranças pendentes
        pending_result = await db.execute(text(
            "SELECT COUNT(*) FROM payment_charges WHERE status IN ('pending','sent','waiting_payment')"
        ))
        pending_charges = int(pending_result.scalar_one() or 0)

        # ── Saques pendentes
        pending_wd_result = await db.execute(text(
            "SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending'"
        ))
        pending_withdrawals = int(pending_wd_result.scalar_one() or 0)

        # ── Top 5 movimentadores (join)
        top_result = await db.execute(text("""
            SELECT w.company_id, c.name,
                   w.total_received, w.total_withdrawn, w.balance
            FROM wallets w
            LEFT JOIN companies c ON c.id = w.company_id
            ORDER BY w.total_received DESC
            LIMIT 5
        """))
        top_movers = [
            {
                "company_id":      r[0],
                "company_name":    r[1] or f"Empresa #{r[0]}",
                "total_received":  float(r[2] or 0),
                "total_withdrawn": float(r[3] or 0),
                "balance":         float(r[4] or 0),
            }
            for r in top_result.all()
        ]

        # ── Extrato ao vivo — últimas 50 transações
        txs_result = await db.execute(text("""
            SELECT wt.id, wt.company_id, c.name,
                   wt.type::text, wt.amount, wt.balance_after,
                   wt.description, wt.source, wt.created_at
            FROM wallet_transactions wt
            LEFT JOIN companies c ON c.id = wt.company_id
            ORDER BY wt.created_at DESC
            LIMIT 50
        """))
        live_ledger = [
            {
                "id":            r[0],
                "company_id":    r[1],
                "company_name":  r[2] or f"#{r[1]}",
                "type":          r[3],
                "amount":        float(r[4] or 0),
                "balance_after": float(r[5] or 0),
                "description":   r[6],
                "source":        r[7],
                "created_at":    r[8].isoformat() if r[8] else None,
            }
            for r in txs_result.all()
        ]

        return {
            "monthly": {
                "deposits":    monthly_deposits,
                "withdrawals": monthly_withdrawals,
                "net":         monthly_deposits - monthly_withdrawals,
            },
            "totals": {
                "balance":             total_balance,
                "total_received":      total_received,
                "pending_charges":     pending_charges,
                "pending_withdrawals": pending_withdrawals,
            },
            "top_movers":  top_movers,
            "live_ledger": live_ledger,
        }

    except Exception as e:
        logger.error(f"gateway_dashboard error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao carregar dashboard: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/kyc
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/kyc")
async def list_kyc_requests(
    db:     AsyncSession = Depends(get_db),
    user    = Depends(require_superadmin),
    status: Optional[str] = None,
    page:   int = 1,
    limit:  int = 50,
):
    """Lista solicitações de KYC das empresas clientes."""
    await _ensure_kyc_table(db)

    try:
        from app.models import Company
        offset = (page - 1) * limit

        where_clause = "WHERE 1=1"
        params: dict = {"limit": limit, "offset": offset}
        if status:
            where_clause += " AND k.status = :status"
            params["status"] = status

        result = await db.execute(text(f"""
            SELECT k.id, k.company_id, c.name AS company_name,
                   k.status, k.submitted_at, k.reviewed_at,
                   k.rejection_reason, k.notes, k.docs_urls
            FROM kyc_requests k
            JOIN companies c ON c.id = k.company_id
            {where_clause}
            ORDER BY k.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = result.mappings().all()

        count_result = await db.execute(text(f"""
            SELECT COUNT(*) FROM kyc_requests k {where_clause}
        """), {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_result.scalar_one()

        return {
            "total": total,
            "page":  page,
            "items": [
                {
                    "id":              r["id"],
                    "company_id":      r["company_id"],
                    "company_name":    r["company_name"],
                    "status":          r["status"],
                    "submitted_at":    r["submitted_at"].isoformat() if r["submitted_at"] else None,
                    "reviewed_at":     r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                    "rejection_reason": r["rejection_reason"],
                    "notes":           r["notes"],
                    "docs_urls":       r["docs_urls"] or [],
                }
                for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"list_kyc_requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/kyc/{kyc_id}/approve
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/kyc/{kyc_id}/approve")
async def approve_kyc(
    kyc_id: int,
    db:     AsyncSession = Depends(get_db),
    user    = Depends(require_superadmin),
):
    """Aprova uma solicitação KYC."""
    await _ensure_kyc_table(db)
    now = datetime.now(timezone.utc)
    result = await db.execute(text("""
        UPDATE kyc_requests
        SET status = 'approved', reviewed_by = :uid, reviewed_at = :now, updated_at = :now
        WHERE id = :id
        RETURNING id, company_id, status
    """), {"id": kyc_id, "uid": user.id, "now": now})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="KYC não encontrado")
    await db.commit()
    logger.info(f"✅ KYC #{kyc_id} aprovado por {user.email}")
    return {"ok": True, "kyc_id": kyc_id, "status": "approved"}


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/kyc/{kyc_id}/reject
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/kyc/{kyc_id}/reject")
async def reject_kyc(
    kyc_id: int,
    body:   dict = Body(default={}),
    db:     AsyncSession = Depends(get_db),
    user    = Depends(require_superadmin),
):
    """Reprova uma solicitação KYC com motivo opcional."""
    await _ensure_kyc_table(db)
    now = datetime.now(timezone.utc)
    reason = body.get("reason", "")
    result = await db.execute(text("""
        UPDATE kyc_requests
        SET status = 'rejected', reviewed_by = :uid, reviewed_at = :now,
            rejection_reason = :reason, updated_at = :now
        WHERE id = :id
        RETURNING id
    """), {"id": kyc_id, "uid": user.id, "now": now, "reason": reason})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="KYC não encontrado")
    await db.commit()
    logger.info(f"❌ KYC #{kyc_id} reprovado por {user.email}: {reason}")
    return {"ok": True, "kyc_id": kyc_id, "status": "rejected"}


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/controls
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/controls")
async def get_controls(
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Retorna os flags de controle operacional do gateway."""
    controls  = await _load_controls(db)
    blocked   = await _load_blocked_companies(db)

    # Enriquecer blocked list com company names
    blocked_enriched = []
    if blocked:
        from app.models import Company
        for company_id in blocked:
            c = await db.execute(select(Company.name).where(Company.id == company_id))
            name = c.scalar_one_or_none() or f"Empresa #{company_id}"
            blocked_enriched.append({"company_id": company_id, "name": name})

    available_providers = [
        {"id": "mercadopago", "name": "Mercado Pago", "active": True,  "available": True},
        {"id": "pagbank",     "name": "PagBank",       "active": False, "available": False},
        {"id": "stripe",      "name": "Stripe",         "active": False, "available": False},
        {"id": "asaas",       "name": "Asaas",          "active": False, "available": False},
    ]

    return {
        "auto_withdrawal_enabled": controls.get("auto_withdrawal_enabled", True),
        "deposits_enabled":        controls.get("deposits_enabled", True),
        "active_provider":         controls.get("active_provider", "mercadopago"),
        "blocked_companies":       blocked_enriched,
        "available_providers":     available_providers,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/controls
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/controls")
async def save_controls(
    body: dict = Body(...),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """Salva flags de controle operacional (saque auto, depósitos, provedor ativo)."""
    controls = await _load_controls(db)

    if "auto_withdrawal_enabled" in body:
        controls["auto_withdrawal_enabled"] = bool(body["auto_withdrawal_enabled"])
    if "deposits_enabled" in body:
        controls["deposits_enabled"] = bool(body["deposits_enabled"])
    if "active_provider" in body:
        controls["active_provider"] = str(body["active_provider"])

    await _save_controls(db, controls)
    logger.info(f"⚙️ Controles gateway atualizados por {user.email}: {controls}")
    return {"ok": True, "controls": controls}


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/controls/block-withdrawal
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/controls/block-withdrawal")
async def toggle_withdrawal_block(
    body: dict = Body(...),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """
    Bloqueia ou desbloqueia o saque de uma empresa específica.
    Body: { "company_id": int, "blocked": bool }
    """
    company_id = body.get("company_id")
    blocked    = body.get("blocked", True)

    if not company_id:
        raise HTTPException(status_code=400, detail="company_id obrigatório")

    blocked_list = await _load_blocked_companies(db)

    if blocked and company_id not in blocked_list:
        blocked_list.append(company_id)
    elif not blocked and company_id in blocked_list:
        blocked_list.remove(company_id)

    await _save_blocked_companies(db, blocked_list)
    action = "bloqueado" if blocked else "desbloqueado"
    logger.info(f"🔒 Saque empresa #{company_id} {action} por {user.email}")
    return {
        "ok": True,
        "company_id": company_id,
        "blocked": blocked,
        "message": f"Saque da empresa #{company_id} {action} com sucesso.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/gateway/charge-test
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/charge-test")
async def test_charge(
    body: dict = Body(...),
    db:   AsyncSession = Depends(get_db),
    user  = Depends(require_superadmin),
):
    """
    Cria uma cobrança PIX de teste e envia via email e/ou WhatsApp.
    Body: { company_id, amount, description, client_name, client_email, client_phone, send_via }
    send_via: 'email' | 'whatsapp' | 'both'
    """
    company_id   = body.get("company_id")
    amount       = body.get("amount", 1.00)
    description  = body.get("description", "Cobrança de Teste Smart Moon")
    client_name  = body.get("client_name", "Cliente Teste")
    client_email = body.get("client_email")
    client_phone = body.get("client_phone")
    send_via     = body.get("send_via", "none")   # email | whatsapp | both | none

    if not company_id:
        raise HTTPException(status_code=400, detail="company_id obrigatório")

    try:
        from decimal import Decimal
        from app.payments.services.charge_service import ChargeService
        from app.payments.services.notification_service import notify_charge_created
        from app.payments.schemas import ChargeCreate

        charge_data = ChargeCreate(
            amount       = Decimal(str(amount)),
            description  = description,
            client_name  = client_name,
            client_email = client_email or "teste@nexus.ia",
        )

        charge = await ChargeService.create_charge(
            db                 = db,
            company_id         = company_id,
            data               = charge_data,
            created_by_user_id = user.id,
        )

        results: dict = {"charge_created": True, "charge_id": charge.id}

        # Enviar notificação via email e/ou WhatsApp
        if send_via in ("email", "whatsapp", "both"):
            try:
                await notify_charge_created(
                    client_name    = client_name,
                    client_phone   = client_phone if send_via in ("whatsapp", "both") else None,
                    client_email   = client_email if send_via in ("email", "both") else None,
                    amount         = Decimal(str(amount)),
                    description    = description,
                    pix_copy_paste = charge.pix_copy_paste_code or "",
                )
                if send_via in ("email", "both"):
                    results["email_sent"] = bool(client_email)
                if send_via in ("whatsapp", "both"):
                    results["whatsapp_sent"] = bool(client_phone)
            except Exception as e:
                results["notification_error"] = str(e)

        return {
            **results,
            "pix_copy_paste": charge.pix_copy_paste_code or "",
            "pix_qr_code":    charge.pix_qr_code or "",
            "payment_link":   charge.payment_link or "",
            "amount":         float(charge.amount),
        }

    except Exception as e:
        logger.error(f"charge-test error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar cobrança de teste: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/webhooks
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/webhooks")
async def list_webhook_events(
    db:     AsyncSession  = Depends(get_db),
    user    = Depends(require_superadmin),
    limit:  int           = 50,
    status: Optional[str] = None,
):
    """Lista os últimos eventos de webhook do Mercado Pago para debug e auditoria."""
    try:
        from app.payments.models import PaymentWebhookEvent

        query = (
            select(PaymentWebhookEvent)
            .order_by(PaymentWebhookEvent.created_at.desc())
            .limit(min(limit, 200))
        )

        if status == "processed":
            query = query.where(PaymentWebhookEvent.processed == True)
        elif status == "pending":
            query = query.where(PaymentWebhookEvent.processed == False)
        elif status == "error":
            query = query.where(
                PaymentWebhookEvent.processed == False,
                PaymentWebhookEvent.processing_error.isnot(None),
            )

        result = await db.execute(query)
        events = result.scalars().all()

        return {
            "total": len(events),
            "events": [
                {
                    "id":                e.id,
                    "provider":          e.provider,
                    "provider_event_id": e.provider_event_id,
                    "event_type":        e.event_type,
                    "charge_id":         e.charge_id,
                    "processed":         e.processed,
                    "processing_error":  e.processing_error,
                    "received_at":       e.created_at.isoformat() if e.created_at else None,
                    "processed_at":      e.processed_at.isoformat() if e.processed_at else None,
                }
                for e in events
            ],
        }
    except Exception as e:
        logger.warning(f"list_webhook_events error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao consultar webhooks: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/gateway/wallets
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/wallets")
async def list_wallets(
    db:    AsyncSession = Depends(get_db),
    user   = Depends(require_superadmin),
    page:  int = 1,
    limit: int = 50,
    q:     Optional[str] = None,
):
    """Lista saldos de todas as carteiras com company name (paginado + busca)."""
    try:
        from app.payments.models import Wallet
        from app.models import Company

        offset = (page - 1) * limit

        # Join com Company para ter o nome
        query = (
            select(
                Wallet.id,
                Wallet.company_id,
                Wallet.balance,
                Wallet.total_received,
                Wallet.total_withdrawn,
                Wallet.currency,
                Company.name.label("company_name"),
            )
            .join(Company, Company.id == Wallet.company_id)
            .order_by(Wallet.balance.desc())
            .offset(offset)
            .limit(limit)
        )

        if q:
            query = query.where(Company.name.ilike(f"%{q}%"))

        result = await db.execute(query)
        rows = result.mappings().all()

        total_q = select(func.count(Wallet.id))
        if q:
            total_q = (
                select(func.count(Wallet.id))
                .join(Company, Company.id == Wallet.company_id)
                .where(Company.name.ilike(f"%{q}%"))
            )
        total = (await db.execute(total_q)).scalar_one()

        return {
            "total": total,
            "page":  page,
            "wallets": [
                {
                    "id":              r["id"],
                    "company_id":      r["company_id"],
                    "company_name":    r["company_name"],
                    "balance":         float(r["balance"]),
                    "total_received":  float(r["total_received"]),
                    "total_withdrawn": float(r["total_withdrawn"]),
                    "currency":        r["currency"],
                }
                for r in rows
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar wallets: {str(e)}")
