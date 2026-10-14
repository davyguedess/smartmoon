"""Admin Panel API — NEXUS.IA Central Administrative Dashboard.

Cross-tenant endpoints for platform administrators (is_superadmin=True).
All endpoints bypass tenant isolation and see data from ALL companies.

SECURITY:
  - require_superadmin guard (is_superadmin=True required)
  - ADMIN_PANEL_ENABLED flag (default False → 403)
  - Sensitive columns always masked
  - All access logged to audit_logs
"""
import os
import platform
import psutil
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func, select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.dependencies import require_admin, require_superadmin
from app.core.config import settings

router = APIRouter(prefix="/admin", tags=["Admin Panel"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]

BLOCKED_NAMES = {
    ".env", ".env.local", ".env.production", ".env.staging",
    "venv", "node_modules", ".git", "__pycache__",
    ".ssh", ".gnupg", ".aws",
}
BLOCKED_EXTENSIONS = {".pem", ".key", ".p12", ".pfx", ".jks", ".sqlite", ".sqlite3"}

SENSITIVE_COLUMNS = {
    "password_hash", "encrypted_key", "encrypted_credentials",
    "token_hash", "secret_key", "access_token", "refresh_token",
    "api_key", "client_secret",
}

_boot = time.time()


def _check_admin_enabled():
    if not settings.ADMIN_PANEL_ENABLED:
        raise HTTPException(status_code=403, detail="Painel admin desativado (ADMIN_PANEL_ENABLED=false)")


def _mask(col: str, val):
    if col.lower() in SENSITIVE_COLUMNS:
        return "***MASKED***" if val else None
    return val


def _safe_path(requested: str) -> Path:
    resolved = Path(requested).resolve()
    if not any(str(resolved).startswith(r) for r in [str(PROJECT_ROOT)]):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return resolved


def _is_blocked(name: str) -> bool:
    if name in BLOCKED_NAMES or name.startswith("."):
        return True
    return Path(name).suffix.lower() in BLOCKED_EXTENSIONS


# ═══════════════════════════════════════════
# EXISTING ROUTES (Server, Files, Database)
# ═══════════════════════════════════════════

@router.get("/server")
async def server_metrics(user=Depends(require_superadmin)):
    """CPU, RAM, disk, uptime — tenant-admin accessible."""
    _check_admin_enabled()
    disk = psutil.disk_usage("/")
    mem = psutil.virtual_memory()
    return {
        "hostname": platform.node(),
        "os": f"{platform.system()} {platform.release()}",
        "arch": platform.machine(),
        "python": platform.python_version(),
        "cpu_count": psutil.cpu_count(),
        "cpu_percent": psutil.cpu_percent(interval=0.3),
        "ram_total_gb": round(mem.total / 1e9, 2),
        "ram_used_gb": round(mem.used / 1e9, 2),
        "ram_percent": mem.percent,
        "disk_total_gb": round(disk.total / 1e9, 2),
        "disk_used_gb": round(disk.used / 1e9, 2),
        "disk_percent": disk.percent,
        "uptime_seconds": int(time.time() - _boot),
        "database_url": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "configured",
        "ollama_url": settings.OLLAMA_BASE_URL,
        "redis_url": settings.REDIS_URL.split("@")[-1] if "@" in settings.REDIS_URL else settings.REDIS_URL,
    }


@router.get("/files")
async def list_files(path: str = Query(default=""), user=Depends(require_superadmin)):
    _check_admin_enabled()
    base = _safe_path(str(PROJECT_ROOT / path)) if path else PROJECT_ROOT
    if not base.exists():
        raise HTTPException(status_code=404, detail="Caminho não encontrado")
    if not base.is_dir():
        raise HTTPException(status_code=400, detail="Não é um diretório")
    items = []
    try:
        for entry in sorted(base.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            if _is_blocked(entry.name):
                continue
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file",
                "size": stat.st_size if entry.is_file() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "path": str(entry.relative_to(PROJECT_ROOT)),
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Sem permissão")
    return {"current_path": str(base.relative_to(PROJECT_ROOT)) if base != PROJECT_ROOT else "", "items": items, "total": len(items)}


@router.get("/files/content")
async def read_file_content(path: str = Query(...), user=Depends(require_superadmin)):
    _check_admin_enabled()
    target = _safe_path(str(PROJECT_ROOT / path))
    if _is_blocked(target.name):
        raise HTTPException(status_code=403, detail=f"Arquivo bloqueado: {target.name}")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    if target.stat().st_size > 500_000:
        raise HTTPException(status_code=413, detail="Arquivo muito grande")
    text_ext = {'.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.md', '.txt', '.toml', '.cfg', '.ini', '.html', '.css', '.sql', '.sh', '.rules', '.conf', '.log'}
    if target.suffix.lower() not in text_ext:
        return {"path": path, "content": None, "message": f"Tipo não suportado: {target.suffix}"}
    content = target.read_text(encoding="utf-8", errors="replace")
    return {"path": path, "name": target.name, "size": target.stat().st_size, "extension": target.suffix, "content": content, "lines": content.count('\n') + 1}


@router.get("/database")
async def database_tables(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    _check_admin_enabled()
    result = await db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"))
    tables = [r[0] for r in result.fetchall()]
    table_info = []
    for tbl in tables:
        count_result = await db.execute(text(f'SELECT COUNT(*) FROM "{tbl}"'))
        count = count_result.scalar()
        col_result = await db.execute(text(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns "
            f"WHERE table_name = '{tbl}' AND table_schema = 'public' "
            "ORDER BY ordinal_position"
        ))
        columns = [{"name": r[0], "type": r[1], "nullable": r[2] == "YES", "default": str(r[3])[:50] if r[3] else None, "is_sensitive": r[0].lower() in SENSITIVE_COLUMNS} for r in col_result.fetchall()]
        table_info.append({"name": tbl, "rows": count, "columns": columns, "column_count": len(columns)})
    return {"database": settings.DATABASE_URL.split("/")[-1].split("?")[0], "tables": table_info, "total_tables": len(table_info)}


@router.get("/database/stats/overview")
async def database_stats(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    _check_admin_enabled()
    size_r = await db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database())), current_database()"))
    size_row = size_r.fetchone()
    conn_r = await db.execute(text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"))
    active_conns = conn_r.scalar()
    return {"database_name": size_row[1], "database_size": size_row[0], "active_connections": active_conns}


@router.get("/database/{table}")
async def table_data(table: str, limit: int = Query(default=50, le=200), offset: int = Query(default=0, ge=0), db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    _check_admin_enabled()
    check = await db.execute(text("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = :tbl"), {"tbl": table})
    if not check.scalar():
        raise HTTPException(status_code=404, detail=f"Tabela '{table}' não encontrada")
    count_r = await db.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
    total = count_r.scalar()
    result = await db.execute(text(f'SELECT * FROM "{table}" ORDER BY 1 DESC LIMIT :lim OFFSET :off'), {"lim": limit, "off": offset})
    columns = list(result.keys())
    rows = []
    for r in result.fetchall():
        row = {}
        for i, col in enumerate(columns):
            val = r[i]
            if isinstance(val, datetime):
                val = val.isoformat()
            elif isinstance(val, (bytes, bytearray)):
                val = f"[bytes: {len(val)}]"
            elif val is not None and not isinstance(val, (str, int, float, bool, list, dict)):
                val = str(val)
            row[col] = _mask(col, val)
        rows.append(row)
    return {"table": table, "columns": columns, "rows": rows, "total": total, "limit": limit, "offset": offset}


# ═══════════════════════════════════════════
# SUPERADMIN — Cross-Tenant Overview
# ═══════════════════════════════════════════

@router.get("/overview")
async def admin_overview(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Executive overview — all companies, all modules."""
    _check_admin_enabled()

    async def _count(table: str, where: str = "") -> int:
        try:
            q = f'SELECT COUNT(*) FROM "{table}"' + (f" WHERE {where}" if where else "")
            r = await db.execute(text(q))
            return r.scalar() or 0
        except Exception:
            return 0

    total_users = await _count("users")
    total_companies = await _count("companies")
    active_flows = await _count("flows", "status = 'published'")
    total_flows = await _count("flows")
    active_agents = await _count("agent_profiles", "is_active = true")
    total_agents = await _count("agent_profiles")
    total_skills = await _count("agent_custom_skills")
    total_integrations = await _count("integrations")
    active_integrations = await _count("integrations", "status = 'connected'")
    total_executions_month = await _count("executions", "created_at >= NOW() - INTERVAL '30 days'")
    total_campaigns = await _count("campaign_posts")
    active_campaigns = await _count("campaign_posts", "status NOT IN ('published', 'cancelled')")
    total_voice_profiles = await _count("voice_profiles")
    total_samples = await _count("voice_samples") if True else 0

    # Usage log totals
    try:
        usage_r = await db.execute(text(
            "SELECT SUM(executions_count), SUM(ai_tokens_used), SUM(ai_cost_usd) "
            "FROM usage_logs WHERE year = EXTRACT(YEAR FROM NOW()) AND month = EXTRACT(MONTH FROM NOW())"
        ))
        usage_row = usage_r.fetchone()
        month_executions = int(usage_row[0] or 0)
        month_tokens = int(usage_row[1] or 0)
        month_cost_usd = float(usage_row[2] or 0)
    except Exception:
        month_executions = month_tokens = 0
        month_cost_usd = 0.0

    # Recent audits
    try:
        audit_r = await db.execute(text(
            "SELECT action, resource_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10"
        ))
        recent_audits = [{"action": r[0], "resource": r[1], "ts": r[2].isoformat() if r[2] else None} for r in audit_r.fetchall()]
    except Exception:
        recent_audits = []

    # Top companies by usage
    try:
        top_r = await db.execute(text(
            "SELECT c.name, c.plan, u.executions_count FROM companies c "
            "JOIN usage_logs u ON u.company_id = c.id "
            "WHERE u.year = EXTRACT(YEAR FROM NOW()) AND u.month = EXTRACT(MONTH FROM NOW()) "
            "ORDER BY u.executions_count DESC LIMIT 5"
        ))
        top_companies = [{"name": r[0], "plan": r[1], "executions": r[2]} for r in top_r.fetchall()]
    except Exception:
        top_companies = []

    return {
        "metrics": {
            "total_users": total_users,
            "total_companies": total_companies,
            "active_flows": active_flows,
            "total_flows": total_flows,
            "active_agents": active_agents,
            "total_agents": total_agents,
            "total_skills": total_skills,
            "total_integrations": total_integrations,
            "active_integrations": active_integrations,
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns,
            "voice_profiles": total_voice_profiles,
        },
        "month": {
            "executions": month_executions,
            "tokens": month_tokens,
            "cost_usd": round(month_cost_usd, 4),
        },
        "recent_audits": recent_audits,
        "top_companies_by_usage": top_companies,
        "server_uptime_seconds": int(time.time() - _boot),
    }


# ═══════════════════════════════════════════
# SUPERADMIN — Users
# ═══════════════════════════════════════════

@router.get("/users")
async def admin_list_users(
    q: str = Query(default=""),
    plan: str = Query(default=""),
    status: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit

    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if q:
        where_clauses.append("(u.name ILIKE :q OR u.email ILIKE :q)")
        params["q"] = f"%{q}%"
    if status == "active":
        where_clauses.append("u.is_active = true")
    elif status == "inactive":
        where_clauses.append("u.is_active = false")
    if plan:
        where_clauses.append("c.plan = :plan")
        params["plan"] = plan

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    try:
        users_r = await db.execute(text(f"""
            SELECT
                u.id, u.name, u.email, u.role, u.is_active, u.is_superadmin,
                u.created_at,
                c.id AS company_id, c.name AS company_name, c.plan,
                (SELECT COUNT(*) FROM flows f WHERE f.company_id = c.id) AS total_flows,
                (SELECT COUNT(*) FROM flows f WHERE f.company_id = c.id AND f.status = 'published') AS active_flows,
                (SELECT COUNT(*) FROM agent_profiles a WHERE a.company_id = c.id AND a.is_active = true) AS active_agents,
                (SELECT COUNT(*) FROM integrations i WHERE i.company_id = c.id AND i.status = 'connected') AS active_integrations,
                u.document, u.document_type, u.birth_date
            FROM users u
            JOIN companies c ON c.id = u.company_id
            {where_sql}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        users_rows = users_r.fetchall()

        count_r = await db.execute(text(f"""
            SELECT COUNT(*) FROM users u JOIN companies c ON c.id = u.company_id {where_sql}
        """), {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0

        users_list = []
        for r in users_rows:
            users_list.append({
                "id": r[0], "name": r[1], "email": r[2], "role": r[3],
                "is_active": r[4], "is_superadmin": r[5],
                "created_at": r[6].isoformat() if r[6] else None,
                "company_id": r[7], "company_name": r[8], "plan": r[9],
                "total_flows": r[10], "active_flows": r[11],
                "active_agents": r[12], "active_integrations": r[13],
                "document": r[14], "document_type": r[15],
                "birth_date": r[16].isoformat() if r[16] else None,
            })

        return {"users": users_list, "total": total, "page": page, "limit": limit, "pages": max(1, -(-total // limit))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar usuários: {e}")


@router.get("/users/{user_id}")
async def admin_user_detail(user_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    _check_admin_enabled()
    try:
        user_r = await db.execute(text("""
            SELECT u.id, u.name, u.email, u.role, u.is_active, u.is_superadmin, u.created_at,
                   c.id, c.name, c.plan, c.is_active,
                   u.document, u.document_type, u.birth_date
            FROM users u JOIN companies c ON c.id = u.company_id
            WHERE u.id = :uid
        """), {"uid": user_id})
        row = user_r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        # Usage this month
        usage_r = await db.execute(text(
            "SELECT executions_count, ai_tokens_used, ai_cost_usd, flows_created FROM usage_logs "
            "WHERE company_id = :cid AND year = EXTRACT(YEAR FROM NOW()) AND month = EXTRACT(MONTH FROM NOW())"
        ), {"cid": row[7]})
        usage = usage_r.fetchone()

        # Flows
        flows_r = await db.execute(text(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE status='published') FROM flows WHERE company_id = :cid"
        ), {"cid": row[7]})
        flows_row = flows_r.fetchone()

        # Agents
        agents_r = await db.execute(text(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active=true) FROM agent_profiles WHERE company_id = :cid"
        ), {"cid": row[7]})
        agents_row = agents_r.fetchone()

        # Integrations
        integ_r = await db.execute(text(
            "SELECT provider, status, created_at FROM integrations WHERE company_id = :cid ORDER BY created_at DESC LIMIT 10"
        ), {"cid": row[7]})
        integrations = [{"provider": r[0], "status": r[1], "created_at": r[2].isoformat() if r[2] else None} for r in integ_r.fetchall()]

        # Recent executions
        exec_r = await db.execute(text(
            "SELECT e.id, e.status, e.trigger_type, e.created_at, e.finished_at FROM executions e "
            "WHERE e.company_id = :cid ORDER BY e.created_at DESC LIMIT 10"
        ), {"cid": row[7]})
        executions = [{"id": r[0], "status": r[1], "trigger": r[2], "created_at": r[3].isoformat() if r[3] else None} for r in exec_r.fetchall()]

        # Audit events
        audit_r = await db.execute(text(
            "SELECT action, resource_type, resource_id, ip_address, created_at FROM audit_logs "
            "WHERE company_id = :cid ORDER BY created_at DESC LIMIT 20"
        ), {"cid": row[7]})
        audit = [{"action": r[0], "resource_type": r[1], "resource_id": r[2], "ip": r[3], "ts": r[4].isoformat() if r[4] else None} for r in audit_r.fetchall()]

        # Voice profiles
        voice_r = await db.execute(text(
            "SELECT COUNT(*) FROM voice_profiles WHERE company_id = :cid"
        ), {"cid": row[7]})
        voice_count = voice_r.scalar() or 0

        # Campaigns
        try:
            campaign_r = await db.execute(text(
                "SELECT COUNT(*), COUNT(*) FILTER (WHERE status::text NOT IN ('published','cancelled')) FROM campaign_posts WHERE company_id = :cid"
            ), {"cid": row[7]})
            campaign_row = campaign_r.fetchone()
        except Exception:
            campaign_row = (0, 0)

        # ── AI Token Balances ──────────────────────────────────────────────────
        try:
            token_bal_r = await db.execute(text("""
                SELECT provider, balance_tokens, total_purchased, total_used
                FROM ai_token_balances WHERE company_id=:cid ORDER BY balance_tokens DESC
            """), {"cid": row[7]})
            token_balances = [dict(r) for r in token_bal_r.mappings().all()]
            ai_token_total = sum(int(b.get("balance_tokens") or 0) for b in token_balances)
        except Exception:
            token_balances = []
            ai_token_total = 0

        # ── AI Token Transactions (últimas 20) ────────────────────────────────
        try:
            token_tx_r = await db.execute(text("""
                SELECT provider, tx_type, nexus_tokens_cost as tokens, description, created_at
                FROM ai_token_transactions WHERE company_id=:cid
                ORDER BY created_at DESC LIMIT 20
            """), {"cid": row[7]})
            token_transactions = []
            for r in token_tx_r.mappings().all():
                d = dict(r)
                if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
                token_transactions.append(d)
        except Exception:
            token_transactions = []

        # ── Payment Charges (últimas 10) ──────────────────────────────────────
        try:
            charges_r = await db.execute(text("""
                SELECT pc.id, pc.status, pc.amount, pc.created_at, pc.paid_at,
                       pc.expires_at, pc.tokens_to_credit, atp.name as pack_name
                FROM payment_charges pc
                LEFT JOIN ai_token_packs atp ON atp.id = pc.token_pack_id
                WHERE pc.company_id=:cid
                ORDER BY pc.created_at DESC LIMIT 10
            """), {"cid": row[7]})
            payment_charges = []
            for r in charges_r.mappings().all():
                d = dict(r)
                d["amount"] = float(d.get("amount") or 0)
                for f in ["created_at", "paid_at", "expires_at"]:
                    if d.get(f): d[f] = d[f].isoformat()
                payment_charges.append(d)
        except Exception:
            payment_charges = []

        # ── Créditos Nexus ────────────────────────────────────────────────────
        try:
            credit_r = await db.execute(text(
                "SELECT balance FROM company_credits WHERE company_id=:cid"
            ), {"cid": row[7]})
            credit_row = credit_r.fetchone()
            credit_balance = float(credit_row[0]) if credit_row else 0.0
        except Exception:
            credit_balance = 0.0

        # ── Último login (audit_logs) ─────────────────────────────────────────
        try:
            login_r = await db.execute(text(
                "SELECT created_at FROM audit_logs WHERE actor_id=:uid AND action ILIKE '%login%' "
                "ORDER BY created_at DESC LIMIT 1"
            ), {"uid": user_id})
            login_row = login_r.fetchone()
            last_login = login_row[0].isoformat() if login_row and login_row[0] else None
        except Exception:
            last_login = None

        # ── Total de saques realizados ────────────────────────────────────────
        try:
            wr_r = await db.execute(text(
                "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM withdrawal_requests "
                "WHERE company_id=:cid AND status='approved'"
            ), {"cid": row[7]})
            wr_row = wr_r.fetchone()
            withdrawals = {"count": int(wr_row[0] or 0), "total": float(wr_row[1] or 0)}
        except Exception:
            withdrawals = {"count": 0, "total": 0.0}

        # ── Movimentação de gateway (PIX payments) ────────────────────────────
        try:
            gw_r = await db.execute(text("""
                SELECT pc.id, pc.status, pc.amount, pc.created_at, pc.paid_at,
                       pc.tokens_to_credit, atp.name as pack_name, 'token_pack' as type
                FROM payment_charges pc
                LEFT JOIN ai_token_packs atp ON atp.id = pc.token_pack_id
                WHERE pc.company_id=:cid
                ORDER BY pc.created_at DESC LIMIT 20
            """), {"cid": row[7]})
            gateway_movements = []
            for r in gw_r.mappings().all():
                d = dict(r)
                d["amount"] = float(d.get("amount") or 0)
                for f in ["created_at", "paid_at"]:
                    if d.get(f): d[f] = d[f].isoformat()
                gateway_movements.append(d)
        except Exception:
            gateway_movements = []

        # ── Nós e conexões nos fluxos ─────────────────────────────────────────
        try:
            nodes_r = await db.execute(text(
                "SELECT COUNT(*) FROM flow_nodes fn "
                "JOIN flows f ON f.id = fn.flow_id WHERE f.company_id=:cid"
            ), {"cid": row[7]})
            nodes_count = nodes_r.scalar() or 0
        except Exception:
            nodes_count = 0
        try:
            conn_r = await db.execute(text(
                "SELECT COUNT(*) FROM flow_node_connections fnc "
                "JOIN flows f ON f.id = fnc.flow_id WHERE f.company_id=:cid"
            ), {"cid": row[7]})
            conn_count = conn_r.scalar() or 0
        except Exception:
            conn_count = 0

        return {
            "user": {
                "id": row[0], "name": row[1], "email": row[2], "role": row[3],
                "is_active": row[4], "is_superadmin": row[5],
                "created_at": row[6].isoformat() if row[6] else None,
                "document": row[11], "document_type": row[12],
                "birth_date": row[13].isoformat() if row[13] else None,
            },
            "company": {"id": row[7], "name": row[8], "plan": row[9], "is_active": row[10]},
            "usage": {
                "executions": usage[0] if usage else 0,
                "tokens": usage[1] if usage else 0,
                "cost_usd": float(usage[2]) if usage and usage[2] else 0,
                "flows_created": usage[3] if usage else 0,
            },
            "flows": {"total": flows_row[0] if flows_row else 0, "active": flows_row[1] if flows_row else 0},
            "agents": {"total": agents_row[0] if agents_row else 0, "active": agents_row[1] if agents_row else 0},
            "voice_profiles": voice_count,
            "campaigns": {"total": campaign_row[0] if campaign_row else 0, "active": campaign_row[1] if campaign_row else 0},
            "integrations": integrations,
            "recent_executions": executions,
            "audit_log": audit,
            # ── Novos campos ──
            "ai_tokens": {
                "total_balance": ai_token_total,
                "balances": token_balances,
                "transactions": token_transactions,
            },
            "payment_charges": payment_charges,
            "credit_balance": credit_balance,
            "last_login": last_login,
            "withdrawals": withdrawals,
            "gateway_movements": gateway_movements,
            "nodes_count": nodes_count,
            "connections_count": conn_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


class PlanPatch(BaseModel):
    plan: str


@router.patch("/users/{user_id}/plan")
async def admin_patch_user_plan(user_id: int, body: PlanPatch, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    _check_admin_enabled()
    allowed_plans = {"free", "starter", "pro", "business", "enterprise"}
    if body.plan not in allowed_plans:
        raise HTTPException(status_code=400, detail=f"Plano inválido. Permitidos: {allowed_plans}")
    try:
        user_r = await db.execute(text("SELECT company_id FROM users WHERE id = :uid"), {"uid": user_id})
        row = user_r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        await db.execute(text("UPDATE companies SET plan = :plan WHERE id = :cid"), {"plan": body.plan, "cid": row[0]})
        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id, metadata_json) "
            "VALUES (:cid, :actor, 'admin.update_plan', 'company', :rid, :meta)"
        ), {"cid": row[0], "actor": current_user.id, "rid": str(row[0]), "meta": f'{{"new_plan": "{body.plan}"}}'})
        await db.commit()
        return {"ok": True, "new_plan": body.plan}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


class UserPatch(BaseModel):
    name: str = None
    email: str = None
    role: str = None
    is_active: bool = None


@router.patch("/users/{user_id}")
async def admin_patch_user(user_id: int, body: UserPatch, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Update user fields (name, email, role, is_active)."""
    _check_admin_enabled()
    try:
        user_r = await db.execute(text("SELECT id, company_id FROM users WHERE id = :uid"), {"uid": user_id})
        row = user_r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        updates = []
        params = {"uid": user_id}
        if body.name is not None:
            updates.append("name = :name")
            params["name"] = body.name
        if body.email is not None:
            # Check uniqueness
            dup = await db.execute(text("SELECT id FROM users WHERE email = :email AND id != :uid"), {"email": body.email.lower().strip(), "uid": user_id})
            if dup.fetchone():
                raise HTTPException(status_code=400, detail="E-mail já em uso por outro usuário")
            updates.append("email = :email")
            params["email"] = body.email.lower().strip()
        if body.role is not None:
            allowed_roles = {"owner", "admin", "operator", "analyst", "viewer"}
            if body.role not in allowed_roles:
                raise HTTPException(status_code=400, detail=f"Role inválido. Permitidos: {allowed_roles}")
            updates.append("role = :role")
            params["role"] = body.role
        if body.is_active is not None:
            updates.append("is_active = :is_active")
            params["is_active"] = body.is_active

        if not updates:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

        await db.execute(text(f"UPDATE users SET {', '.join(updates)} WHERE id = :uid"), params)
        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id, metadata_json) "
            "VALUES (:cid, :actor, 'admin.update_user', 'user', :rid, :meta)"
        ), {"cid": row[1], "actor": current_user.id, "rid": str(user_id), "meta": '{}'})
        await db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


class PasswordChange(BaseModel):
    password: str


@router.patch("/users/{user_id}/password")
async def admin_change_user_password(user_id: int, body: PasswordChange, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Admin: force-reset a user's password."""
    _check_admin_enabled()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter ao menos 6 caracteres")
    try:
        import bcrypt as _bcrypt
        new_hash = _bcrypt.hashpw(body.password.encode(), _bcrypt.gensalt()).decode()
        res = await db.execute(text("UPDATE users SET password_hash=:ph WHERE id=:uid"), {"ph": new_hash, "uid": user_id})
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        await db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/users/{user_id}/impersonate")
async def admin_impersonate_user(user_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Gera um token temporário (2h) para o admin logar como um usuário comum."""
    _check_admin_enabled()
    try:
        from app.core.security import create_access_token
        from datetime import timedelta, datetime, timezone

        user_r = await db.execute(text(
            "SELECT id, name, email, role, company_id, is_active, is_superadmin FROM users WHERE id=:uid"
        ), {"uid": user_id})
        u = user_r.fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if not u[5]:
            raise HTTPException(status_code=400, detail="Usuário está inativo")
        if u[6]:
            raise HTTPException(status_code=403, detail="Não é possível impersonar outro superadmin")

        expire = datetime.now(timezone.utc) + timedelta(hours=2)
        from jose import jwt as _jwt
        from app.core.config import settings
        token = _jwt.encode(
            {
                "sub": str(u[0]),
                "company_id": u[4],
                "role": u[3],
                "type": "access",
                "exp": expire,
                "impersonated_by": current_user.id,
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id, metadata_json) "
            "VALUES (:cid, :actor, 'admin.impersonate', 'user', :rid, :meta)"
        ), {"cid": u[4], "actor": current_user.id, "rid": str(u[0]), "meta": f'{{"target_user": "{u[2]}"}}'})
        await db.commit()

        return {
            "token": token,
            "user_name": u[1],
            "user_email": u[2],
            "expires_in": 7200,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.patch("/users/{user_id}/toggle")
async def admin_toggle_user(user_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Toggle user active/inactive status."""
    _check_admin_enabled()
    try:
        user_r = await db.execute(text("SELECT id, is_active, company_id FROM users WHERE id = :uid"), {"uid": user_id})
        row = user_r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        new_status = not row[1]
        await db.execute(text("UPDATE users SET is_active = :status WHERE id = :uid"), {"status": new_status, "uid": user_id})
        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id, metadata_json) "
            "VALUES (:cid, :actor, 'admin.toggle_user', 'user', :rid, :meta)"
        ), {"cid": row[2], "actor": current_user.id, "rid": str(user_id), "meta": f'{{"new_status": {str(new_status).lower()}}}'})
        await db.commit()
        return {"ok": True, "is_active": new_status}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Permanently delete a user and their associated data."""
    _check_admin_enabled()
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta")
    try:
        user_r = await db.execute(text("SELECT id, company_id, is_superadmin FROM users WHERE id = :uid"), {"uid": user_id})
        row = user_r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if row[2]:
            raise HTTPException(status_code=400, detail="Não é possível excluir um superadmin")

        # Cascade delete related data
        await db.execute(text("DELETE FROM audit_logs WHERE actor_id = :uid"), {"uid": user_id})
        await db.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(text("DELETE FROM user_profiles WHERE user_id = :uid"), {"uid": user_id})
        await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})

        # Log the deletion
        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id, metadata_json) "
            "VALUES (:cid, :actor, 'admin.delete_user', 'user', :rid, :meta)"
        ), {"cid": row[1], "actor": current_user.id, "rid": str(user_id), "meta": '{}'})
        await db.commit()
        return {"ok": True, "deleted_user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Agents
# ═══════════════════════════════════════════

@router.get("/agents")
async def admin_list_agents(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    params: dict = {"limit": limit, "offset": offset}
    where = ""
    if q:
        where = "WHERE (a.name ILIKE :q OR c.name ILIKE :q)"
        params["q"] = f"%{q}%"
    try:
        r = await db.execute(text(f"""
            SELECT a.id, a.name, a.slug, a.agent_type, a.model, a.provider, a.is_active,
                   a.created_at, a.updated_at,
                   c.id AS company_id, c.name AS company_name, c.plan,
                   (SELECT COUNT(*) FROM agent_custom_skills s WHERE s.company_id = a.company_id AND s.is_active=true) AS active_skills
            FROM agent_profiles a
            JOIN companies c ON c.id = a.company_id
            {where}
            ORDER BY a.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM agent_profiles a JOIN companies c ON c.id = a.company_id {where}"),
                                   {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0
        agents = [{"id": r[0], "name": r[1], "slug": r[2], "type": r[3], "model": r[4], "provider": r[5], "is_active": r[6],
                   "created_at": r[7].isoformat() if r[7] else None, "updated_at": r[8].isoformat() if r[8] else None,
                   "company_id": r[9], "company_name": r[10], "plan": r[11], "active_skills": r[12]} for r in rows]
        return {"agents": agents, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Skills
# ═══════════════════════════════════════════

@router.get("/skills")
async def admin_list_skills(
    q: str = Query(default=""),
    category: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista platform_skills (Skills da Smart Moon) com métricas de uso."""
    _check_admin_enabled()
    offset = (page - 1) * limit
    wheres = []
    params: dict = {"limit": limit, "offset": offset}
    if q:
        wheres.append("(ps.name ILIKE :q OR ps.slug ILIKE :q OR ps.category ILIKE :q)")
        params["q"] = f"%{q}%"
    if category:
        wheres.append("ps.category = :cat")
        params["cat"] = category
    where_clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    try:
        r = await db.execute(text(f"""
            SELECT ps.id, ps.name, ps.slug, ps.icon, ps.category, ps.is_active,
                   ps.is_exclusive, ps.price_credits, ps.plan_access,
                   ps.created_at, ps.updated_at,
                   c.name AS exclusive_company,
                   (SELECT COUNT(*) FROM skill_installs si WHERE si.skill_id = ps.id AND si.is_active=true) AS install_count,
                   (SELECT COALESCE(SUM(si.usage_count),0) FROM skill_installs si WHERE si.skill_id = ps.id) AS total_usage
            FROM platform_skills ps
            LEFT JOIN companies c ON c.id = ps.exclusive_company_id
            {where_clause}
            ORDER BY ps.category ASC, ps.name ASC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_q = f"SELECT COUNT(*) FROM platform_skills ps {where_clause}"
        count_r = await db.execute(text(count_q), {k: v for k, v in params.items() if k not in ("limit","offset")})
        total = count_r.scalar() or 0

        # KPIs extras
        kpi_r = await db.execute(text("""
            SELECT COUNT(*) FILTER (WHERE is_active),
                   COUNT(*) FILTER (WHERE is_exclusive),
                   COUNT(*) FILTER (WHERE price_credits > 0),
                   COUNT(*) FILTER (WHERE price_credits = 0)
            FROM platform_skills
        """))
        kpis = kpi_r.fetchone()

        skills = [{
            "id": r[0], "name": r[1], "slug": r[2], "icon": r[3],
            "category": r[4], "is_active": r[5], "is_exclusive": r[6],
            "price_credits": r[7], "plan_access": r[8],
            "created_at": r[9].isoformat() if r[9] else None,
            "updated_at": r[10].isoformat() if r[10] else None,
            "exclusive_company": r[11], "install_count": r[12], "total_usage": r[13],
        } for r in rows]
        return {
            "skills": skills, "total": total, "page": page,
            "kpis": {
                "active": kpis[0], "exclusive": kpis[1],
                "paid": kpis[2], "free": kpis[3],
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/skills/{skill_id}")
async def admin_get_skill(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Detalhe da skill com lista de usuários instalados e uso."""
    _check_admin_enabled()
    try:
        r = await db.execute(text("""
            SELECT id, name, slug, icon, category, description, prompt_patch,
                   tools_enabled, is_active, is_exclusive, exclusive_company_id,
                   price_credits, plan_access, created_at, updated_at
            FROM platform_skills WHERE id = :sid
        """), {"sid": skill_id})
        row = r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Skill não encontrada")

        # Usuários com essa skill instalada
        inst_r = await db.execute(text("""
            SELECT si.id, c.name AS company, u.name AS user_name, u.email,
                   si.usage_count, si.is_active, si.installed_at
            FROM skill_installs si
            JOIN companies c ON c.id = si.company_id
            LEFT JOIN users u ON u.id = si.user_id
            WHERE si.skill_id = :sid
            ORDER BY si.usage_count DESC
            LIMIT 100
        """), {"sid": skill_id})
        installs = [{"id": r_[0], "company": r_[1], "user": r_[2], "email": r_[3],
                     "usage_count": r_[4], "is_active": r_[5],
                     "installed_at": r_[6].isoformat() if r_[6] else None}
                    for r_ in inst_r.fetchall()]

        return {
            "skill": {
                "id": row[0], "name": row[1], "slug": row[2], "icon": row[3],
                "category": row[4], "description": row[5], "prompt_patch": row[6],
                "tools_enabled": row[7], "is_active": row[8], "is_exclusive": row[9],
                "exclusive_company_id": row[10], "price_credits": row[11],
                "plan_access": row[12],
                "created_at": row[13].isoformat() if row[13] else None,
            },
            "installs": installs,
            "total_installs": len(installs),
            "total_usage": sum(i["usage_count"] for i in installs),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/skills")
async def admin_create_skill(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Cria nova skill de plataforma."""
    _check_admin_enabled()
    import json as _json
    body = await request.json()
    try:
        slug = body.get("slug") or body.get("name", "").lower().replace(" ", "-")
        tools = body.get("tools_enabled", [])
        plan_access = body.get("plan_access", ["free","starter","pro","business","enterprise"])
        r = await db.execute(text("""
            INSERT INTO platform_skills
              (name, slug, icon, category, description, prompt_patch, tools_enabled,
               is_active, is_exclusive, exclusive_company_id, price_credits, plan_access)
            VALUES (:name, :slug, :icon, :cat, :desc, :prompt, :tools,
                    :active, :excl, :excl_co, :price, :plans)
            RETURNING id
        """), {
            "name": body["name"], "slug": slug, "icon": body.get("icon", "⚡"),
            "cat": body.get("category", "geral"), "desc": body.get("description", ""),
            "prompt": body.get("prompt_patch", ""), "tools": _json.dumps(tools),
            "active": body.get("is_active", True), "excl": body.get("is_exclusive", False),
            "excl_co": body.get("exclusive_company_id"),
            "price": int(body.get("price_credits", 0)),
            "plans": _json.dumps(plan_access),
        })
        await db.commit()
        new_id = r.scalar()
        return {"ok": True, "id": new_id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.patch("/skills/{skill_id}")
async def admin_update_skill(
    skill_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Atualiza skill de plataforma."""
    _check_admin_enabled()
    import json as _json
    body = await request.json()
    try:
        sets, params = [], {"sid": skill_id}
        for field in ["name","slug","icon","category","description","prompt_patch","is_active","is_exclusive","exclusive_company_id","price_credits"]:
            if field in body:
                sets.append(f"{field} = :{field}")
                params[field] = body[field]
        if "tools_enabled" in body:
            sets.append("tools_enabled = :tools")
            params["tools"] = _json.dumps(body["tools_enabled"])
        if "plan_access" in body:
            sets.append("plan_access = :plans")
            params["plans"] = _json.dumps(body["plan_access"])
        sets.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE platform_skills SET {', '.join(sets)} WHERE id = :sid"), params)
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/skills/{skill_id}")
async def admin_delete_skill(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Remove skill de plataforma."""
    _check_admin_enabled()
    try:
        await db.execute(text("DELETE FROM platform_skills WHERE id = :sid"), {"sid": skill_id})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Voice
# ═══════════════════════════════════════════

@router.get("/voice")
async def admin_list_voice(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    try:
        r = await db.execute(text("""
            SELECT vp.id, vp.name, vp.provider, vp.base_voice_id, vp.is_active, vp.created_at,
                   c.name AS company_name, c.plan,
                   (SELECT COUNT(*) FROM voice_samples vs WHERE vs.voice_profile_id = vp.id) AS sample_count,
                   (SELECT COUNT(*) FROM voice_generations vg WHERE vg.voice_profile_id = vp.id) AS generation_count
            FROM voice_profiles vp
            JOIN companies c ON c.id = vp.company_id
            ORDER BY vp.created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"limit": limit, "offset": offset})
        rows = r.fetchall()
        count_r = await db.execute(text("SELECT COUNT(*) FROM voice_profiles"))
        total = count_r.scalar() or 0
        profiles = [{"id": r[0], "name": r[1], "provider": r[2], "voice_id": r[3], "status": "active" if r[4] else "inactive",
                     "created_at": r[5].isoformat() if r[5] else None, "company_name": r[6], "plan": r[7],
                     "sample_count": r[8], "generation_count": r[9]} for r in rows]
        return {"profiles": profiles, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Campaigns
# ═══════════════════════════════════════════

@router.get("/campaigns")
async def admin_list_campaigns(
    status_filter: str = Query(default="", alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    where = ""
    params: dict = {"limit": limit, "offset": offset}
    if status_filter:
        where = "WHERE cp.status = :status"
        params["status"] = status_filter
    try:
        r = await db.execute(text(f"""
            SELECT cp.id, cp.campaign_name, cp.status, cp.post_type, cp.publish_scheduled_at, cp.created_at,
                   c.name AS company_name, c.plan, cp.channel, cp.objective
            FROM campaign_posts cp
            JOIN companies c ON c.id = cp.company_id
            {where}
            ORDER BY cp.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM campaign_posts cp JOIN companies c ON c.id=cp.company_id {where}"),
                                   {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0
        campaigns = [{"id": r[0], "title": r[1], "status": r[2], "type": r[3],
                      "publish_at": r[4].isoformat() if r[4] else None,
                      "created_at": r[5].isoformat() if r[5] else None,
                      "company_name": r[6], "plan": r[7],
                      "channel": r[8], "objective": r[9]} for r in rows]
        return {"campaigns": campaigns, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Flows
# ═══════════════════════════════════════════

@router.get("/flows")
async def admin_list_flows(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    where = ""
    params: dict = {"limit": limit, "offset": offset}
    if q:
        where = "WHERE (f.name ILIKE :q OR c.name ILIKE :q)"
        params["q"] = f"%{q}%"
    try:
        r = await db.execute(text(f"""
            SELECT f.id, f.name, f.status, f.version, f.created_at, f.published_at,
                   c.id AS company_id, c.name AS company_name, c.plan,
                   (SELECT COUNT(*) FROM executions e WHERE e.flow_id = f.id) AS total_executions
            FROM flows f JOIN companies c ON c.id = f.company_id
            {where}
            ORDER BY f.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM flows f JOIN companies c ON c.id=f.company_id {where}"),
                                   {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0
        flows = [{"id": r[0], "name": r[1], "status": r[2], "version": r[3],
                  "created_at": r[4].isoformat() if r[4] else None,
                  "published_at": r[5].isoformat() if r[5] else None,
                  "company_id": r[6], "company_name": r[7], "plan": r[8],
                  "total_executions": r[9]} for r in rows]
        return {"flows": flows, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/flows/{flow_id}")
async def admin_get_flow(flow_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    """Full flow detail with nodes, executions, agents, integrations."""
    _check_admin_enabled()
    try:
        # Base flow info + company
        r = await db.execute(text("""
            SELECT f.id, f.name, f.description, f.status, f.version, f.created_at,
                   f.published_at, f.updated_at, f.definition_json, f.published_snapshot_json,
                   c.id AS company_id, c.name AS company_name, c.plan,
                   u.name AS created_by_name, u.email AS created_by_email
            FROM flows f
            JOIN companies c ON c.id = f.company_id
            LEFT JOIN users u ON u.id = f.created_by
            WHERE f.id = :fid
        """), {"fid": flow_id})
        row = r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fluxo não encontrado")

        company_id = row[10]

        # Executions summary
        exec_r = await db.execute(text("""
            SELECT e.id, e.status, e.trigger_type, e.created_at, e.finished_at,
                   EXTRACT(EPOCH FROM (e.finished_at - e.created_at))::int AS duration_s
            FROM executions e
            WHERE e.flow_id = :fid
            ORDER BY e.created_at DESC
            LIMIT 20
        """), {"fid": flow_id})
        executions = [{
            "id": r[0], "status": r[1], "trigger": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "finished_at": r[4].isoformat() if r[4] else None,
            "duration_s": r[5],
        } for r in exec_r.fetchall()]

        # Execution stats
        stats_r = await db.execute(text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status='success') AS success,
                COUNT(*) FILTER (WHERE status='failed') AS errors,
                COUNT(*) FILTER (WHERE status='running') AS running,
                AVG(EXTRACT(EPOCH FROM (finished_at - created_at)))::int AS avg_duration_s
            FROM executions WHERE flow_id = :fid
        """), {"fid": flow_id})
        stats_row = stats_r.fetchone()
        exec_stats = {
            "total": stats_row[0] or 0,
            "success": stats_row[1] or 0,
            "errors": stats_row[2] or 0,
            "running": stats_row[3] or 0,
            "avg_duration_s": stats_row[4],
        }

        # Active agents in this company (might be connected to this flow via nodes)
        agents_r = await db.execute(text("""
            SELECT id, name, slug, agent_type, model, is_active
            FROM agent_profiles
            WHERE company_id = :cid AND is_active = true
            ORDER BY name
        """), {"cid": company_id})
        agents = [{"id": r[0], "name": r[1], "slug": r[2], "type": r[3], "model": r[4], "is_active": r[5]} for r in agents_r.fetchall()]

        # Integrations connected in this company
        integ_r = await db.execute(text("""
            SELECT id, provider, status, created_at
            FROM integrations
            WHERE company_id = :cid
            ORDER BY provider
        """), {"cid": company_id})
        integrations = [{"id": r[0], "provider": r[1], "status": r[2], "created_at": r[3].isoformat() if r[3] else None} for r in integ_r.fetchall()]

        # Parse definition nodes/edges
        definition = row[8] or {}
        if isinstance(definition, str):
            import json as _json
            try:
                definition = _json.loads(definition)
            except Exception:
                definition = {}
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        return {
            "flow": {
                "id": row[0], "name": row[1], "description": row[2],
                "status": row[3], "version": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "published_at": row[6].isoformat() if row[6] else None,
                "updated_at": row[7].isoformat() if row[7] else None,
                "created_by": {"name": row[13], "email": row[14]},
            },
            "company": {"id": company_id, "name": row[11], "plan": row[12]},
            "definition": {
                "nodes_count": len(nodes),
                "edges_count": len(edges),
                "nodes": [{"id": n.get("id"), "type": n.get("type"), "label": (n.get("data") or {}).get("label", n.get("type", "nó"))} for n in nodes[:50]],
                "edges": [{"id": e.get("id"), "source": e.get("source"), "target": e.get("target")} for e in edges[:100]],
            },
            "execution_stats": exec_stats,
            "recent_executions": executions,
            "agents": agents,
            "integrations": integrations,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/flows/{flow_id}")
async def admin_delete_flow(flow_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_superadmin)):
    _check_admin_enabled()
    try:
        r = await db.execute(text("SELECT company_id FROM flows WHERE id = :fid"), {"fid": flow_id})
        row = r.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fluxo não encontrado")
        await db.execute(text("DELETE FROM flows WHERE id = :fid"), {"fid": flow_id})
        await db.execute(text(
            "INSERT INTO audit_logs (company_id, actor_id, action, resource_type, resource_id) VALUES (:cid, :aid, 'admin.delete_flow', 'flow', :rid)"
        ), {"cid": row[0], "aid": current_user.id, "rid": str(flow_id)})
        await db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Integrations
# ═══════════════════════════════════════════

@router.get("/integrations")
async def admin_list_integrations(
    status_filter: str = Query(default="", alias="status"),
    provider: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    wheres = []
    params: dict = {"limit": limit, "offset": offset}
    if status_filter:
        wheres.append("i.status = :status")
        params["status"] = status_filter
    if provider:
        wheres.append("i.provider = :provider")
        params["provider"] = provider
    where = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    try:
        r = await db.execute(text(f"""
            SELECT i.id, i.provider, i.status, i.created_at, i.updated_at,
                   c.id AS company_id, c.name AS company_name, c.plan
            FROM integrations i JOIN companies c ON c.id = i.company_id
            {where}
            ORDER BY i.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM integrations i JOIN companies c ON c.id=i.company_id {where}"),
                                   {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0
        items = [{"id": r[0], "provider": r[1], "status": r[2],
                  "created_at": r[3].isoformat() if r[3] else None,
                  "updated_at": r[4].isoformat() if r[4] else None,
                  "company_id": r[5], "company_name": r[6], "plan": r[7]} for r in rows]
        return {"integrations": items, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Audit Log
# ═══════════════════════════════════════════

@router.get("/audit")
async def admin_audit_log(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, le=500),
    action: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    where = ""
    params: dict = {"limit": limit, "offset": offset}
    if action:
        where = "WHERE al.action ILIKE :action"
        params["action"] = f"%{action}%"
    try:
        r = await db.execute(text(f"""
            SELECT al.id, al.action, al.resource_type, al.resource_id, al.ip_address, al.created_at,
                   u.name AS actor_name, u.email AS actor_email,
                   c.name AS company_name
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.actor_id
            LEFT JOIN companies c ON c.id = al.company_id
            {where}
            ORDER BY al.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM audit_logs al {where}"),
                                   {k: v for k, v in params.items() if k not in ("limit", "offset")})
        total = count_r.scalar() or 0
        events = [{"id": r[0], "action": r[1], "resource_type": r[2], "resource_id": r[3], "ip": r[4],
                   "ts": r[5].isoformat() if r[5] else None,
                   "actor_name": r[6], "actor_email": r[7], "company_name": r[8]} for r in rows]
        return {"events": events, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Logs
# ═══════════════════════════════════════════

@router.get("/logs")
async def admin_logs(
    section: str = Query(default="executions"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    offset = (page - 1) * limit
    try:
        if section == "executions":
            r = await db.execute(text("""
                SELECT e.id, e.status, e.trigger_type, e.error_message, e.created_at, e.finished_at,
                       f.name AS flow_name, c.name AS company_name
                FROM executions e
                JOIN flows f ON f.id = e.flow_id
                JOIN companies c ON c.id = e.company_id
                ORDER BY e.created_at DESC
                LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset})
            rows = r.fetchall()
            items = [{"id": r[0], "status": r[1], "trigger": r[2], "error": r[3],
                      "created_at": r[4].isoformat() if r[4] else None,
                      "finished_at": r[5].isoformat() if r[5] else None,
                      "flow_name": r[6], "company_name": r[7]} for r in rows]
        elif section == "campaigns":
            r = await db.execute(text("""
                SELECT cp.id, cp.campaign_name, cp.status, cp.post_type, cp.created_at,
                       c.name AS company_name
                FROM campaign_posts cp JOIN companies c ON c.id = cp.company_id
                ORDER BY cp.created_at DESC
                LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset})
            rows = r.fetchall()
            items = [{"id": r[0], "title": r[1], "status": r[2], "type": r[3],
                      "created_at": r[4].isoformat() if r[4] else None, "company_name": r[5]} for r in rows]
        elif section == "voice":
            r = await db.execute(text("""
                SELECT vg.id, vg.text_input, vg.status, vg.provider, vg.duration_seconds, vg.created_at,
                       c.name AS company_name
                FROM voice_generations vg
                JOIN companies c ON c.id = vg.company_id
                ORDER BY vg.created_at DESC
                LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset})
            rows = r.fetchall()
            items = [{"id": r[0], "text": str(r[1])[:100] if r[1] else None, "status": r[2],
                      "provider": r[3], "duration": r[4],
                      "created_at": r[5].isoformat() if r[5] else None, "company_name": r[6]} for r in rows]
        else:
            items = []
        return {"section": section, "items": items, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar logs [{section}]: {e}")


# ═══════════════════════════════════════════
# NOTE: The /sales dashboard endpoint is defined below with full subscription KPIs.
# ═══════════════════════════════════════════
# SUPERADMIN — Health
# ═══════════════════════════════════════════


@router.get("/health")
async def admin_health(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Comprehensive health check for all NEXUS.IA services."""
    _check_admin_enabled()

    checks = {}

    # Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "healthy", "latency_ms": None}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)}

    # Redis
    try:
        import aioredis
        redis = await aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
        t0 = time.time()
        await redis.ping()
        latency = round((time.time() - t0) * 1000, 2)
        await redis.close()
        checks["redis"] = {"status": "healthy", "latency_ms": latency}
    except Exception as e:
        checks["redis"] = {"status": "error", "error": str(e)[:100]}

    # Ollama
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            t0 = time.time()
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            latency = round((time.time() - t0) * 1000, 2)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                checks["ollama"] = {"status": "healthy", "latency_ms": latency, "models": len(models)}
            else:
                checks["ollama"] = {"status": "degraded", "http_status": resp.status_code}
    except Exception as e:
        checks["ollama"] = {"status": "offline", "error": str(e)[:100]}

    # System resources
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    checks["system"] = {
        "status": "healthy",
        "cpu_percent": psutil.cpu_percent(interval=0.2),
        "ram_percent": mem.percent,
        "disk_percent": disk.percent,
        "uptime_seconds": int(time.time() - _boot),
    }

    overall = "healthy" if all(c.get("status") == "healthy" for c in checks.values()) else "degraded"
    return {"overall": overall, "services": checks, "checked_at": datetime.utcnow().isoformat()}


# ═══════════════════════════════════════════
# SUPERADMIN — Plans CRUD
# ═══════════════════════════════════════════

ALL_MODULES = [
    {"key": "agentes",       "label": "Agentes"},
    {"key": "skills",        "label": "Skills"},
    {"key": "agent_store",   "label": "Agent Store"},
    {"key": "flows",         "label": "Fluxos"},
    {"key": "integracoes",   "label": "Integrações"},
    {"key": "voz",           "label": "Voz"},
    {"key": "clonagem_voz",  "label": "Clonagem de Voz"},
    {"key": "voice_agents",  "label": "Agente de Voz"},
    # ── Marketing Pro modules ──────────────────────────────────────────────────
    {"key": "marketing",     "label": "Marketing Pro (todos)"},
    {"key": "brand_kit",     "label": "↳ Brand Kit"},
    {"key": "studio",        "label": "↳ Studio (Geração de Arte)"},
    {"key": "traffic_pro",   "label": "↳ Tráfego Pro (Meta Ads)"},
    {"key": "ig_campaigns",  "label": "↳ Campanhas IG"},
    # ── Other ─────────────────────────────────────────────────────────────────
    {"key": "campanhas_ia",  "label": "Campanhas IA"},
    {"key": "licitacao",     "label": "Licitação"},
]



@router.get("/plans")
async def admin_list_plans(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """List all plans with subscriber counts."""
    _check_admin_enabled()
    try:
        # Get plans from plans table
        result = await db.execute(text("""
            SELECT p.*,
                   COALESCE(sub.companies, 0) AS subscriber_companies,
                   COALESCE(sub.users, 0) AS subscriber_users
            FROM plans p
            LEFT JOIN (
                SELECT c.plan,
                       COUNT(DISTINCT c.id) AS companies,
                       COUNT(DISTINCT u.id) AS users
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                GROUP BY c.plan
            ) sub ON sub.plan = p.name
            ORDER BY p.sort_order ASC, p.id ASC
        """))
        rows = result.fetchall()
        cols = result.keys()
        plans = [dict(zip(cols, r)) for r in rows]
        # Serialize decimals
        for p in plans:
            if p.get("price") is not None:
                p["price"] = float(p["price"])
            if p.get("created_at"):
                p["created_at"] = p["created_at"].isoformat()
            if p.get("updated_at"):
                p["updated_at"] = p["updated_at"].isoformat()
        return {"plans": plans, "available_modules": ALL_MODULES}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar planos: {e}")


@router.post("/plans")
async def admin_create_plan(body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Create a new plan."""
    _check_admin_enabled()

    name = body.get("name", "").strip().lower().replace(" ", "_")
    display_name = body.get("display_name", "").strip()
    if not name or not display_name:
        raise HTTPException(status_code=400, detail="name e display_name são obrigatórios")

    try:
        import json
        modules_val = body.get("modules", [])
        free_skills_val = body.get("free_skills", [])

        await db.execute(text("""
            INSERT INTO plans (name, display_name, description, price, currency, billing_cycle, duration_days,
                             max_flows, max_agents, max_skills, max_integrations, max_voice_profiles, max_campaigns,
                             modules, free_skills, is_active, is_featured, sort_order, color)
            VALUES (:name, :display_name, :description, :price, :currency, :billing_cycle, :duration_days,
                    :max_flows, :max_agents, :max_skills, :max_integrations, :max_voice_profiles, :max_campaigns,
                    :modules, :free_skills, :is_active, :is_featured, :sort_order, :color)
        """), {
            "name": name,
            "display_name": display_name,
            "description": body.get("description", ""),
            "price": float(body.get("price", 0)),
            "currency": body.get("currency", "BRL"),
            "billing_cycle": body.get("billing_cycle", "monthly"),
            "duration_days": int(body.get("duration_days", 30)),
            "max_flows": int(body.get("max_flows", 5)),
            "max_agents": int(body.get("max_agents", 2)),
            "max_skills": int(body.get("max_skills", 3)),
            "max_integrations": int(body.get("max_integrations", 2)),
            "max_voice_profiles": int(body.get("max_voice_profiles", 0)),
            "max_campaigns": int(body.get("max_campaigns", 0)),
            "modules": json.dumps(modules_val),
            "free_skills": json.dumps(free_skills_val),
            "is_active": body.get("is_active", True),
            "is_featured": body.get("is_featured", False),
            "sort_order": int(body.get("sort_order", 0)),
            "color": body.get("color", "#6366f1"),
        })
        await db.commit()
        return {"ok": True, "message": "Plano criado com sucesso"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar plano: {e}")


@router.patch("/plans/{plan_id}")
async def admin_update_plan(plan_id: int, body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Update a plan."""
    _check_admin_enabled()

    allowed_fields = {
        "display_name", "description", "price", "currency", "billing_cycle", "duration_days",
        "max_flows", "max_agents", "max_skills", "max_integrations", "max_voice_profiles",
        "max_campaigns", "modules", "free_skills", "is_active", "is_featured", "sort_order", "color"
    }

    updates = []
    params = {"plan_id": plan_id}
    for key, value in body.items():
        if key in allowed_fields:
            if key in ("modules", "free_skills"):
                import json
                updates.append(f"{key} = :{key}")
                params[key] = json.dumps(value)
            elif key == "price":
                updates.append(f"{key} = :{key}")
                params[key] = float(value)
            elif key in ("max_flows", "max_agents", "max_skills", "max_integrations",
                         "max_voice_profiles", "max_campaigns", "duration_days", "sort_order"):
                updates.append(f"{key} = :{key}")
                params[key] = int(value)
            else:
                updates.append(f"{key} = :{key}")
                params[key] = value

    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    updates.append("updated_at = NOW()")
    try:
        sql = f"UPDATE plans SET {', '.join(updates)} WHERE id = :plan_id"
        result = await db.execute(text(sql), params)
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        await db.commit()
        return {"ok": True, "message": "Plano atualizado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar plano: {e}")


@router.patch("/plans/{plan_id}/toggle")
async def admin_toggle_plan(plan_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Toggle plan active/inactive."""
    _check_admin_enabled()
    try:
        result = await db.execute(text(
            "UPDATE plans SET is_active = NOT is_active, updated_at = NOW() WHERE id = :plan_id RETURNING is_active"
        ), {"plan_id": plan_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        await db.commit()
        return {"ok": True, "is_active": row[0], "message": f"Plano {'ativado' if row[0] else 'desativado'} com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/plans/{plan_id}")
async def admin_delete_plan(plan_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Delete a plan (only if no subscribers)."""
    _check_admin_enabled()
    try:
        # Check for subscribers
        check = await db.execute(text("""
            SELECT p.name, COUNT(c.id) AS subs
            FROM plans p
            LEFT JOIN companies c ON c.plan = p.name
            WHERE p.id = :plan_id
            GROUP BY p.name
        """), {"plan_id": plan_id})
        row = check.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        if row[1] > 0:
            raise HTTPException(status_code=409, detail=f"Não é possível excluir: {row[1]} empresa(s) usam este plano. Desative-o primeiro.")

        await db.execute(text("DELETE FROM plans WHERE id = :plan_id"), {"plan_id": plan_id})
        await db.commit()
        return {"ok": True, "message": "Plano excluído com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/plans/modules")
async def admin_list_modules(user=Depends(require_superadmin)):
    """List all available platform modules."""
    _check_admin_enabled()
    return {"modules": ALL_MODULES}


# ═══════════════════════════════════════════
# SUPERADMIN — Platform Settings (SMTP + Terms)
# ═══════════════════════════════════════════

@router.get("/settings")
async def admin_get_settings(db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    """Get all platform settings."""
    _check_admin_enabled()
    try:
        r = await db.execute(text("SELECT key, value FROM platform_settings ORDER BY key"))
        rows = r.fetchall()
        settings = {row[0]: row[1] for row in rows}
        return {"settings": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


class SmtpSettingsIn(BaseModel):
    smtp_enabled: str = "false"
    smtp_host: str = ""
    smtp_port: str = "587"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Smart Moon"


@router.put("/settings/smtp")
async def admin_update_smtp(body: SmtpSettingsIn, db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    """Update SMTP configuration."""
    _check_admin_enabled()
    try:
        for key, val in body.dict().items():
            await db.execute(text(
                "INSERT INTO platform_settings (key, value, updated_at) VALUES (:k, :v, NOW()) "
                "ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()"
            ), {"k": key, "v": val})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


class TermsIn(BaseModel):
    terms_of_service: str = ""
    privacy_policy: str = ""


@router.put("/settings/terms")
async def admin_update_terms(body: TermsIn, db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    """Update terms of service and privacy policy."""
    _check_admin_enabled()
    try:
        for key, val in body.dict().items():
            await db.execute(text(
                "INSERT INTO platform_settings (key, value, updated_at) VALUES (:k, :v, NOW()) "
                "ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()"
            ), {"k": key, "v": val})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/settings/smtp/test")
async def admin_test_smtp(db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    """Test SMTP connection by sending a test email."""
    _check_admin_enabled()
    try:
        r = await db.execute(text(
            "SELECT key, value FROM platform_settings WHERE key LIKE 'smtp_%'"
        ))
        cfg = {row[0]: row[1] for row in r.fetchall()}

        if cfg.get("smtp_enabled") != "true":
            raise HTTPException(status_code=400, detail="SMTP está desativado")

        import smtplib
        from email.mime.text import MIMEText

        msg = MIMEText("Teste de conexão SMTP - Smart Moon ✅")
        msg["Subject"] = "Smart Moon - Teste SMTP"
        msg["From"] = cfg.get("smtp_from_email", "test@nexus.ia")
        msg["To"] = cfg.get("smtp_from_email", "test@nexus.ia")

        with smtplib.SMTP(cfg.get("smtp_host", ""), int(cfg.get("smtp_port", 587))) as server:
            server.starttls()
            server.login(cfg.get("smtp_username", ""), cfg.get("smtp_password", ""))
            server.send_message(msg)

        return {"ok": True, "message": "E-mail de teste enviado com sucesso!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no SMTP: {e}")



@router.put("/settings/brand")
async def admin_update_brand(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    """Salva identidade visual da plataforma (logo_url, platform_name, primary_color)."""
    _check_admin_enabled()
    body = await request.json()
    fields = ["platform_name", "logo_url", "favicon_url", "primary_color"]
    try:
        for key in fields:
            if key in body:
                await db.execute(text("""
                    INSERT INTO platform_settings (key, value, updated_at)
                    VALUES (:k, :v, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """), {"k": key, "v": str(body[key] or "")})
        await db.commit()
        return {"ok": True, "message": "Identidade visual atualizada com sucesso"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar brand: {e}")


@router.get("/settings/brand/public")
async def public_brand(db: AsyncSession = Depends(get_db)):
    """Endpoint público — retorna branding da plataforma sem autenticação.
    Usado pela página de login para exibir o nome/logo configurado pelo admin.
    """
    try:
        r = await db.execute(text(
            "SELECT key, value FROM platform_settings "
            "WHERE key IN ('platform_name', 'logo_url', 'favicon_url', 'primary_color')"
        ))
        settings = {row[0]: row[1] for row in r.fetchall()}
        return {
            "platform_name": settings.get("platform_name") or "Smart Moon",
            "logo_url": settings.get("logo_url") or "",
            "favicon_url": settings.get("favicon_url") or "",
            "primary_color": settings.get("primary_color") or "#7c3aed",
        }
    except Exception:
        return {
            "platform_name": "Smart Moon",
            "logo_url": "",
            "favicon_url": "",
            "primary_color": "#7c3aed",
        }

# ═══════════════════════════════════════════
# Subscriptions & Sales Flow
# ═══════════════════════════════════════════

SUBSCRIPTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_status ON subscriptions(status);
"""

TRANSACTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    plan_id INTEGER REFERENCES plans(id),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    payment_method VARCHAR(30) DEFAULT 'manual',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    external_id VARCHAR(255),
    description TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS ix_transactions_status ON transactions(status);
"""

PLAN_ID_COLUMN_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'plan_id'
    ) THEN
        ALTER TABLE companies ADD COLUMN plan_id INTEGER REFERENCES plans(id);
    END IF;
END $$;
"""


async def _ensure_subscriptions_tables(db: AsyncSession):
    """Create subscriptions and transactions tables if they don't exist."""
    try:
        await db.execute(text(SUBSCRIPTIONS_TABLE_SQL))
        await db.execute(text(TRANSACTIONS_TABLE_SQL))
        await db.execute(text(PLAN_ID_COLUMN_SQL))
        await db.commit()
    except Exception:
        await db.rollback()


# ── Public Plans Endpoint (no auth) ────────────────────────────


@router.get("/plans/public")
async def public_list_plans(db: AsyncSession = Depends(get_db)):
    """Public endpoint — list active plans for registration page. No auth required."""
    try:
        await _ensure_subscriptions_tables(db)
        result = await db.execute(text("""
            SELECT id, name, display_name, description, price, currency,
                   billing_cycle, duration_days, max_flows, max_agents,
                   max_skills, max_integrations, max_voice_profiles,
                   max_campaigns, modules, is_featured, sort_order, color
            FROM plans WHERE is_active = true
            ORDER BY sort_order ASC, id ASC
        """))
        rows = result.fetchall()
        cols = result.keys()
        plans = []
        for r in rows:
            p = dict(zip(cols, r))
            if p.get("price") is not None:
                p["price"] = float(p["price"])
            plans.append(p)
        return {"plans": plans}
    except Exception as e:
        return {"plans": [], "error": str(e)}


# ── Admin Sales Dashboard ──────────────────────────────────────


@router.get("/sales")
async def admin_sales_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Sales dashboard — KPIs, recent transactions, subscription metrics."""
    _check_admin_enabled()
    await _ensure_subscriptions_tables(db)

    offset = (page - 1) * limit

    # ── KPIs ──
    try:
        # Total subscriptions
        r = await db.execute(text("SELECT COUNT(*) FROM subscriptions"))
        total_subscriptions = r.scalar() or 0

        # Active subscriptions
        r = await db.execute(text("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"))
        active_subscriptions = r.scalar() or 0

        # MRR (Monthly Recurring Revenue) — sum price of active plans
        r = await db.execute(text("""
            SELECT COALESCE(SUM(p.price), 0)
            FROM subscriptions s JOIN plans p ON p.id = s.plan_id
            WHERE s.status = 'active'
        """))
        mrr = float(r.scalar() or 0)

        # Total revenue (paid transactions)
        r = await db.execute(text(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'paid'"
        ))
        total_revenue = float(r.scalar() or 0)

        # Revenue this month
        r = await db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions
            WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', NOW())
        """))
        month_revenue = float(r.scalar() or 0)

        # New subscriptions this month
        r = await db.execute(text("""
            SELECT COUNT(*) FROM subscriptions
            WHERE started_at >= DATE_TRUNC('month', NOW())
        """))
        new_this_month = r.scalar() or 0

        # Cancelled this month (churn)
        r = await db.execute(text("""
            SELECT COUNT(*) FROM subscriptions
            WHERE status = 'cancelled' AND cancelled_at >= DATE_TRUNC('month', NOW())
        """))
        cancelled_this_month = r.scalar() or 0

        # Plan distribution
        r = await db.execute(text("""
            SELECT p.display_name, p.color, COUNT(s.id) AS count
            FROM subscriptions s JOIN plans p ON p.id = s.plan_id
            WHERE s.status = 'active'
            GROUP BY p.display_name, p.color
            ORDER BY count DESC
        """))
        plan_distribution = [{"plan": row[0], "color": row[1], "count": row[2]} for row in r.fetchall()]

    except Exception:
        total_subscriptions = active_subscriptions = 0
        mrr = total_revenue = month_revenue = 0.0
        new_this_month = cancelled_this_month = 0
        plan_distribution = []

    # ── Recent Transactions ──
    try:
        r = await db.execute(text("""
            SELECT t.id, t.amount, t.currency, t.payment_method, t.status, t.description,
                   t.paid_at, t.created_at, c.name AS company_name,
                   p.display_name AS plan_name, p.color AS plan_color
            FROM transactions t
            JOIN companies c ON c.id = t.company_id
            LEFT JOIN plans p ON p.id = t.plan_id
            ORDER BY t.created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"limit": limit, "offset": offset})
        rows = r.fetchall()
        cols = r.keys()
        records = []
        for row in rows:
            rec = dict(zip(cols, row))
            if rec.get("amount") is not None:
                rec["amount"] = float(rec["amount"])
            if rec.get("paid_at"):
                rec["paid_at"] = rec["paid_at"].isoformat()
            if rec.get("created_at"):
                rec["created_at"] = rec["created_at"].isoformat()
            records.append(rec)

        r2 = await db.execute(text("SELECT COUNT(*) FROM transactions"))
        total_records = r2.scalar() or 0
    except Exception:
        records = []
        total_records = 0

    # ── Recent Subscriptions ──
    try:
        r = await db.execute(text("""
            SELECT s.id, s.status, s.started_at, s.expires_at,
                   c.name AS company_name,
                   p.display_name AS plan_name, p.price, p.color AS plan_color
            FROM subscriptions s
            JOIN companies c ON c.id = s.company_id
            JOIN plans p ON p.id = s.plan_id
            ORDER BY s.created_at DESC
            LIMIT 10
        """))
        rows = r.fetchall()
        cols = r.keys()
        recent_subs = []
        for row in rows:
            sub = dict(zip(cols, row))
            if sub.get("price") is not None:
                sub["price"] = float(sub["price"])
            if sub.get("started_at"):
                sub["started_at"] = sub["started_at"].isoformat()
            if sub.get("expires_at"):
                sub["expires_at"] = sub["expires_at"].isoformat()
            recent_subs.append(sub)
    except Exception:
        recent_subs = []

    return {
        "month_summary": {
            "total_subscriptions": total_subscriptions,
            "active_subscriptions": active_subscriptions,
            "mrr": mrr,
            "total_revenue": total_revenue,
            "month_revenue": month_revenue,
            "new_this_month": new_this_month,
            "cancelled_this_month": cancelled_this_month,
            "churn_rate": round(cancelled_this_month / max(active_subscriptions, 1) * 100, 1),
            "plan_distribution": plan_distribution,
        },
        "records": records,
        "recent_subscriptions": recent_subs,
        "total_records": total_records,
        "page": page,
        "limit": limit,
    }


# ── Admin: Change user/company plan ───────────────────────────


@router.patch("/users/{user_id}/plan")
async def admin_change_user_plan(
    user_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Admin changes a user's company plan. Creates subscription + transaction."""
    _check_admin_enabled()
    await _ensure_subscriptions_tables(db)

    plan_id = body.get("plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id é obrigatório")

    try:
        # Get user's company
        r = await db.execute(text("SELECT company_id FROM users WHERE id = :uid"), {"uid": user_id})
        user_row = r.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        company_id = user_row[0]

        # Get plan info
        r = await db.execute(text("SELECT id, name, price, duration_days FROM plans WHERE id = :pid"), {"pid": plan_id})
        plan_row = r.fetchone()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plano não encontrado")

        plan_name = plan_row[1]
        plan_price = float(plan_row[2])
        duration = plan_row[3]

        # Cancel current active subscription
        await db.execute(text("""
            UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
            WHERE company_id = :cid AND status = 'active'
        """), {"cid": company_id})

        # Create new subscription
        r = await db.execute(text("""
            INSERT INTO subscriptions (company_id, plan_id, status, started_at, expires_at)
            VALUES (:cid, :pid, 'active', NOW(), NOW() + INTERVAL ':days days')
            RETURNING id
        """.replace(":days", str(duration))), {"cid": company_id, "pid": plan_id})
        sub_id = r.fetchone()[0]

        # Create transaction
        status = "paid" if plan_price == 0 else "paid"  # Admin confirms = paid
        await db.execute(text("""
            INSERT INTO transactions (company_id, subscription_id, plan_id, amount, payment_method, status, description, paid_at)
            VALUES (:cid, :sid, :pid, :amount, 'admin', :status, :desc, NOW())
        """), {
            "cid": company_id, "sid": sub_id, "pid": plan_id,
            "amount": plan_price, "status": status,
            "desc": f"Plano alterado por admin para {plan_name}",
        })

        # Update company
        await db.execute(text(
            "UPDATE companies SET plan = :plan_name, plan_id = :pid WHERE id = :cid"
        ), {"plan_name": plan_name, "pid": plan_id, "cid": company_id})

        await db.commit()
        return {"ok": True, "message": f"Plano alterado para {plan_name}", "subscription_id": sub_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")



# ═══════════════════════════════════════════════════════
# SUPERADMIN — Agent Store (platform_agents)
# ═══════════════════════════════════════════════════════

@router.get("/agent-store")
async def admin_list_agent_store(
    q: str = Query(default=""),
    category: str = Query(default=""),
    source: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista agentes da plataforma + agentes criados por usuarios."""
    _check_admin_enabled()
    offset = (page - 1) * limit
    try:
        pa_params: dict = {}
        pa_wheres = []
        if q:
            pa_wheres.append("(pa.name ILIKE :q OR pa.category ILIKE :q)")
            pa_params["q"] = f"%{q}%"
        if category:
            pa_wheres.append("pa.category = :cat")
            pa_params["cat"] = category
        pa_where = ("WHERE " + " AND ".join(pa_wheres)) if pa_wheres else ""

        platform_r = await db.execute(text(f"""
            SELECT pa.id, pa.name, pa.slug, pa.icon, pa.category, pa.description,
                   pa.model, pa.agent_type, pa.is_active, pa.is_exclusive,
                   pa.price_credits, pa.plan_access, pa.created_at,
                   c.name AS exclusive_company,
                   (SELECT COUNT(*) FROM agent_installs ai WHERE ai.platform_agent_id = pa.id AND ai.is_active) AS install_count
            FROM platform_agents pa
            LEFT JOIN companies c ON c.id = pa.exclusive_company_id
            {pa_where}
            ORDER BY pa.created_at DESC
        """), pa_params)
        platform_agents = []
        for row in platform_r.fetchall():
            platform_agents.append({
                "id": row[0], "name": row[1], "slug": row[2], "icon": row[3],
                "category": row[4], "description": row[5], "model": row[6],
                "agent_type": row[7], "is_active": row[8], "is_exclusive": row[9],
                "price_credits": row[10], "plan_access": row[11],
                "created_at": row[12].isoformat() if row[12] else None,
                "exclusive_company": row[13], "install_count": int(row[14] or 0),
                "source": "platform",
            })

        user_params_extra: dict = {}
        user_where_parts = []
        if q:
            user_where_parts.append("(ap.name ILIKE :q OR c.name ILIKE :q)")
            user_params_extra["q"] = f"%{q}%"
        user_where = ("WHERE " + " AND ".join(user_where_parts)) if user_where_parts else ""

        user_r = await db.execute(text(f"""
            SELECT ap.id, ap.name, ap.slug, ap.agent_type, ap.description,
                   ap.model, ap.is_active, ap.created_at,
                   c.name AS company_name, c.plan,
                   u.name AS creator_name, u.email AS creator_email
            FROM agent_profiles ap
            JOIN companies c ON c.id = ap.company_id
            LEFT JOIN users u ON u.id = (
                SELECT id FROM users WHERE company_id=c.id AND role='admin' LIMIT 1
            )
            {user_where}
            ORDER BY ap.created_at DESC
            LIMIT 200
        """), user_params_extra)
        user_agents = []
        for row in user_r.fetchall():
            user_agents.append({
                "id": row[0], "name": row[1], "slug": row[2] or "", "icon": "\U0001f916",
                "category": row[3] or "geral", "description": row[4] or "",
                "model": row[5], "agent_type": row[3] or "conversational",
                "is_active": row[6], "is_exclusive": False,
                "price_credits": 0, "plan_access": [],
                "created_at": row[7].isoformat() if row[7] else None,
                "exclusive_company": row[8], "install_count": 0,
                "source": "user", "plan": row[9],
                "creator_name": row[10], "creator_email": row[11],
            })

        kpi_r = await db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM platform_agents WHERE is_active),
                (SELECT COUNT(*) FROM platform_agents WHERE price_credits > 0),
                (SELECT COUNT(*) FROM agent_profiles WHERE is_active),
                (SELECT COUNT(*) FROM agent_installs WHERE is_active)
        """))
        kpi_row = kpi_r.fetchone()

        if source == "platform":
            all_agents = platform_agents
        elif source == "user":
            all_agents = user_agents
        else:
            all_agents = platform_agents + user_agents

        total = len(all_agents)
        paginated = all_agents[offset:offset + limit]

        return {
            "agents": paginated, "total": total, "page": page,
            "kpis": {
                "platform_active": int(kpi_row[0] or 0),
                "platform_paid": int(kpi_row[1] or 0),
                "user_agents": int(kpi_row[2] or 0),
                "total_installs": int(kpi_row[3] or 0),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar agent store: {e}")


@router.get("/agent-store/{agent_id}")
async def admin_get_agent_store(
    agent_id: int,
    source: str = Query(default="platform"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Detalhe de um agente da store ou de usuario."""
    _check_admin_enabled()
    try:
        if source == "user":
            r = await db.execute(text("""
                SELECT ap.id, ap.name, ap.slug, ap.description, ap.system_prompt,
                       ap.model, ap.provider, ap.temperature, ap.agent_type,
                       ap.memory_rules, ap.is_active, ap.created_at,
                       c.name AS company, c.plan, u.name AS creator, u.email
                FROM agent_profiles ap
                JOIN companies c ON c.id = ap.company_id
                LEFT JOIN users u ON u.id = (SELECT id FROM users WHERE company_id=c.id AND role='admin' LIMIT 1)
                WHERE ap.id = :aid
            """), {"aid": agent_id})
            row = r.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Agente nao encontrado")
            return {
                "agent": {
                    "id": row[0], "name": row[1], "slug": row[2], "description": row[3],
                    "system_prompt": row[4], "model": row[5], "provider": row[6],
                    "temperature": row[7], "agent_type": row[8],
                    "memory_rules": row[9], "is_active": row[10],
                    "created_at": row[11].isoformat() if row[11] else None,
                    "source": "user", "icon": "\U0001f916", "price_credits": 0,
                },
                "company": {"name": row[12], "plan": row[13]},
                "creator": {"name": row[14], "email": row[15]},
                "installs": [],
            }
        else:
            r = await db.execute(text("""
                SELECT id, name, slug, icon, category, description, system_prompt,
                       model, provider, temperature, agent_type, memory_rules,
                       tools_enabled, is_active, is_exclusive, exclusive_company_id,
                       price_credits, plan_access, created_at
                FROM platform_agents WHERE id = :aid
            """), {"aid": agent_id})
            row = r.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Agente nao encontrado")
            inst_r = await db.execute(text("""
                SELECT ai.id, c.name, u.name, u.email, ap.name, ai.is_active, ai.installed_at
                FROM agent_installs ai
                JOIN companies c ON c.id = ai.company_id
                LEFT JOIN users u ON u.id = ai.user_id
                LEFT JOIN agent_profiles ap ON ap.id = ai.agent_profile_id
                WHERE ai.platform_agent_id = :aid
                ORDER BY ai.installed_at DESC LIMIT 100
            """), {"aid": agent_id})
            installs = [{"id": r_[0], "company": r_[1], "user": r_[2], "email": r_[3],
                          "agent_name": r_[4], "is_active": r_[5],
                          "installed_at": r_[6].isoformat() if r_[6] else None}
                        for r_ in inst_r.fetchall()]
            return {
                "agent": {
                    "id": row[0], "name": row[1], "slug": row[2], "icon": row[3],
                    "category": row[4], "description": row[5], "system_prompt": row[6],
                    "model": row[7], "provider": row[8], "temperature": row[9],
                    "agent_type": row[10], "memory_rules": row[11],
                    "tools_enabled": row[12], "is_active": row[13],
                    "is_exclusive": row[14], "exclusive_company_id": row[15],
                    "price_credits": row[16], "plan_access": row[17],
                    "created_at": row[18].isoformat() if row[18] else None,
                    "source": "platform",
                },
                "installs": installs, "total_installs": len(installs),
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/agent-store")
async def admin_create_agent_store(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Cria novo agente-template na plataforma Smart Moon."""
    _check_admin_enabled()
    import json as _json
    body = await request.json()
    try:
        slug = body.get("slug") or body.get("name", "").lower().replace(" ", "-")
        r = await db.execute(text("""
            INSERT INTO platform_agents
              (name, slug, icon, category, description, system_prompt, model, provider,
               temperature, agent_type, memory_rules, tools_enabled, is_active,
               is_exclusive, exclusive_company_id, price_credits, plan_access)
            VALUES (:name,:slug,:icon,:cat,:desc,:prompt,:model,:provider,
                    :temp,:atype,:memory,:tools,:active,:excl,:excl_co,:price,:plans)
            RETURNING id
        """), {
            "name": body["name"], "slug": slug, "icon": body.get("icon", "\U0001f916"),
            "cat": body.get("category", "geral"), "desc": body.get("description", ""),
            "prompt": body.get("system_prompt", "Voce e um assistente inteligente."),
            "model": body.get("model", "gpt-4o-mini"),
            "provider": body.get("provider", "openai"),
            "temp": str(body.get("temperature", "0.7")),
            "atype": body.get("agent_type", "conversational"),
            "memory": _json.dumps(body.get("memory_rules", {})),
            "tools": _json.dumps(body.get("tools_enabled", [])),
            "active": body.get("is_active", True),
            "excl": body.get("is_exclusive", False),
            "excl_co": body.get("exclusive_company_id"),
            "price": int(body.get("price_credits", 0)),
            "plans": _json.dumps(body.get("plan_access", ["starter","pro","business","enterprise"])),
        })
        await db.commit()
        return {"ok": True, "id": r.scalar()}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.patch("/agent-store/{agent_id}")
async def admin_update_agent_store(
    agent_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    import json as _json
    body = await request.json()
    try:
        sets, params = [], {"aid": agent_id}
        for field in ["name","slug","icon","category","description","system_prompt","model","provider",
                      "temperature","agent_type","is_active","is_exclusive","exclusive_company_id","price_credits"]:
            if field in body:
                sets.append(f"{field} = :{field}")
                params[field] = body[field]
        for jf, col in [("memory_rules","memory_rules"),("tools_enabled","tools_enabled"),("plan_access","plan_access")]:
            if jf in body:
                sets.append(f"{col} = :{col}")
                params[col] = _json.dumps(body[jf])
        sets.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE platform_agents SET {chr(44).join(sets)} WHERE id = :aid"), params)
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/agent-store/{agent_id}")
async def admin_delete_agent_store(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    try:
        await db.execute(text("DELETE FROM platform_agents WHERE id = :aid"), {"aid": agent_id})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ════════════════════════════════════════════════════════
# SUPERADMIN — Credits System
# ════════════════════════════════════════════════════════

@router.get("/credits")
async def admin_list_credits(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista saldos de creditos por empresa."""
    _check_admin_enabled()
    offset = (page - 1) * limit
    where = ""
    params: dict = {"limit": limit, "offset": offset}
    if q:
        where = "WHERE c.name ILIKE :q"
        params["q"] = f"%{q}%"
    try:
        await db.execute(text("""
            INSERT INTO user_credits (company_id, balance, lifetime_earned)
            SELECT id, 0, 0 FROM companies ON CONFLICT (company_id) DO NOTHING
        """))
        await db.commit()
        r = await db.execute(text(f"""
            SELECT uc.id, c.id AS company_id, c.name, c.plan,
                   uc.balance, uc.lifetime_earned, uc.updated_at,
                   (SELECT COUNT(*) FROM credit_transactions ct WHERE ct.company_id=c.id) AS tx_count,
                   COALESCE((SELECT SUM(amount) FROM credit_transactions ct2 WHERE ct2.company_id=c.id AND ct2.type='consume'),0) AS total_spent
            FROM user_credits uc
            JOIN companies c ON c.id = uc.company_id
            {where}
            ORDER BY uc.balance DESC, c.name
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(
            text(f"SELECT COUNT(*) FROM user_credits uc JOIN companies c ON c.id=uc.company_id {where}"),
            {k: v for k, v in params.items() if k not in ("limit","offset")}
        )
        total = count_r.scalar() or 0
        kpi_r = await db.execute(text("""
            SELECT COALESCE(SUM(balance),0), COALESCE(SUM(lifetime_earned),0),
                   COUNT(*) FILTER (WHERE balance > 0)
            FROM user_credits
        """))
        kpis = kpi_r.fetchone()
        credits_list = [{
            "id": r_[0], "company_id": r_[1], "company": r_[2], "plan": r_[3],
            "balance": r_[4], "lifetime_earned": r_[5],
            "updated_at": r_[6].isoformat() if r_[6] else None,
            "tx_count": r_[7], "total_spent": abs(int(r_[8] or 0)),
        } for r_ in rows]
        return {
            "credits": credits_list, "total": total, "page": page,
            "kpis": {"total_balance": int(kpis[0]), "total_earned": int(kpis[1]), "companies_with_credits": int(kpis[2])}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/credits/{company_id}/history")
async def admin_credit_history(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    try:
        r = await db.execute(text("""
            SELECT ct.id, ct.type, ct.amount, ct.balance_after,
                   ct.ref_type, ct.ref_id, ct.description, ct.created_at,
                   u.name, u.email
            FROM credit_transactions ct
            LEFT JOIN users u ON u.id = ct.user_id
            WHERE ct.company_id = :cid
            ORDER BY ct.created_at DESC LIMIT 200
        """), {"cid": company_id})
        txs = [{
            "id": r_[0], "type": r_[1], "amount": r_[2], "balance_after": r_[3],
            "ref_type": r_[4], "ref_id": r_[5], "description": r_[6],
            "created_at": r_[7].isoformat() if r_[7] else None,
            "user_name": r_[8], "email": r_[9],
        } for r_ in r.fetchall()]
        bal_r = await db.execute(text("SELECT balance, lifetime_earned FROM user_credits WHERE company_id = :cid"), {"cid": company_id})
        bal = bal_r.fetchone()
        return {"company_id": company_id, "balance": bal[0] if bal else 0, "lifetime_earned": bal[1] if bal else 0, "transactions": txs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/credits/grant")
async def admin_grant_credits(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Concede creditos manualmente a uma empresa."""
    _check_admin_enabled()
    body = await request.json()
    company_id = body.get("company_id")
    amount = int(body.get("amount", 0))
    credit_type = body.get("type", "bonus")
    description = body.get("description", "Creditos concedidos pelo administrador")
    if not company_id or amount <= 0:
        raise HTTPException(status_code=400, detail="company_id e amount > 0 sao obrigatorios")
    try:
        await db.execute(text("""
            INSERT INTO user_credits (company_id, balance, lifetime_earned)
            VALUES (:cid, 0, 0) ON CONFLICT (company_id) DO NOTHING
        """), {"cid": company_id})
        upd = await db.execute(text("""
            UPDATE user_credits SET balance = balance + :amt, lifetime_earned = lifetime_earned + :amt, updated_at = NOW()
            WHERE company_id = :cid RETURNING balance
        """), {"amt": amount, "cid": company_id})
        new_balance = upd.scalar()
        await db.execute(text("""
            INSERT INTO credit_transactions (company_id, user_id, type, amount, balance_after, ref_type, description)
            VALUES (:cid, :uid, :type, :amt, :bal, 'manual', :desc)
        """), {"cid": company_id, "uid": getattr(user, "id", None), "type": credit_type, "amt": amount, "bal": new_balance, "desc": description})
        await db.commit()
        return {"ok": True, "new_balance": new_balance}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/companies-list")
async def admin_companies_list(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista basica de empresas para selects e modais."""
    _check_admin_enabled()
    r = await db.execute(text("SELECT id, name, plan FROM companies ORDER BY name"))
    return [{"id": r_[0], "name": r_[1], "plan": r_[2]} for r_ in r.fetchall()]


# ═══════════════════════════════════════════
# SUPERADMIN — Licitation (Public Bids)
# ═══════════════════════════════════════════

@router.get("/licitation")
async def admin_list_licitation(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    q: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista licitações públicas monitoradas (public_bids)."""
    _check_admin_enabled()
    offset = (page - 1) * limit
    wheres = []
    params: dict = {"limit": limit, "offset": offset}
    if q:
        wheres.append("(pb.title ILIKE :q OR pb.organ_name ILIKE :q OR pb.object_text ILIKE :q)")
        params["q"] = f"%{q}%"
    where_clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    try:
        r = await db.execute(text(f"""
            SELECT pb.id, pb.company_id, pb.source, pb.title, pb.organ_name,
                   pb.state, pb.municipality, pb.scope_level, pb.modality,
                   pb.estimated_value, pb.status, pb.publication_date,
                   pb.deadline_date, pb.adherence_score, pb.adherence_level,
                   pb.created_at, pb.has_edital,
                   c.name AS company_name, c.plan
            FROM public_bids pb
            JOIN companies c ON c.id = pb.company_id
            {where_clause}
            ORDER BY pb.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        rows = r.fetchall()
        count_r = await db.execute(
            text(f"SELECT COUNT(*) FROM public_bids pb JOIN companies c ON c.id=pb.company_id {where_clause}"),
            {k: v for k, v in params.items() if k not in ("limit", "offset")}
        )
        total = count_r.scalar() or 0
        bids = [{
            "id": r[0], "company_id": r[1], "source": r[2],
            "title": r[3] or f"Licitação #{r[0]}",
            "organ_name": r[4] or "—", "state": r[5] or "—",
            "municipality": r[6], "scope_level": r[7],
            "modality": r[8], "estimated_value": float(r[9]) if r[9] else None,
            "status": r[10] or "open",
            "publication_date": r[11].isoformat() if r[11] else None,
            "deadline_date": r[12].isoformat() if r[12] else None,
            "adherence_score": r[13], "adherence_level": r[14],
            "created_at": r[15].isoformat() if r[15] else None,
            "has_edital": r[16],
            "company_name": r[17], "plan": r[18],
        } for r in rows]
        return {"bids": bids, "total": total, "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — Payments
# ═══════════════════════════════════════════

@router.get("/payments/overview")
async def admin_payments_overview(db: AsyncSession = Depends(get_db), user=Depends(require_superadmin)):
    """Visão geral financeira da plataforma."""
    _check_admin_enabled()
    try:
        # Totais de cobranças
        charges_r = await db.execute(text("""
            SELECT
                COUNT(*) AS total_charges,
                COALESCE(SUM(amount), 0) AS total_charged,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) AS charges_paid,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS charges_pending
            FROM payment_charges
        """))
        cr = charges_r.fetchone()

        # Webhooks não processados
        wh_r = await db.execute(text(
            "SELECT COUNT(*) FROM payment_webhook_events WHERE processed = false"
        ))
        webhooks_unprocessed = wh_r.scalar() or 0

        # Saques pendentes
        wp_r = await db.execute(text(
            "SELECT COUNT(*) FROM withdrawal_requests WHERE status IN ('pending', 'failed')"
        ))
        withdrawals_pending = wp_r.scalar() or 0

        total_charged = float(cr[1] or 0)
        total_paid = float(cr[2] or 0)
        conversion_rate = round((cr[4] / max(cr[0], 1)) * 100, 1) if cr[0] else 0

        return {
            "total_charged": total_charged,
            "total_paid": total_paid,
            "total_pending": float(cr[3] or 0),
            "system_balance": total_paid,
            "charges_paid": cr[4] or 0,
            "charges_pending": cr[5] or 0,
            "conversion_rate": conversion_rate,
            "webhooks_unprocessed": webhooks_unprocessed,
            "withdrawals_pending": withdrawals_pending,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/payments/withdrawals")
async def admin_payments_withdrawals(
    status: str = Query(default="pending"),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista solicitações de saque da tabela withdrawal_requests."""
    _check_admin_enabled()
    try:
        status_filter = status if status != 'all' else None
        q = """
            SELECT wr.id, wr.company_id, wr.amount, wr.status, wr.created_at,
                   wr.pix_key, wr.pix_key_type, wr.admin_notes,
                   c.name AS company_name, c.plan,
                   wr.rejection_reason, wr.mp_transfer_id
            FROM withdrawal_requests wr
            JOIN companies c ON c.id = wr.company_id
        """
        params: dict = {"limit": limit}
        if status_filter:
            q += " WHERE wr.status = :status"
            params["status"] = status_filter
        q += " ORDER BY wr.created_at DESC LIMIT :limit"
        r = await db.execute(text(q), params)
        rows = r.fetchall()
        items = [{
            "id": r[0], "company_id": r[1], "amount": float(r[2] or 0),
            "status": r[3], "created_at": r[4].isoformat() if r[4] else None,
            "pix_key": r[5], "pix_key_type": r[6], "admin_notes": r[7],
            "company_name": r[8], "plan": r[9],
            "rejection_reason": r[10], "mp_transfer_id": r[11],
        } for r in rows]
        return {"items": items, "total": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/payments/withdrawals/{withdrawal_id}/approve")
async def admin_approve_withdrawal(
    withdrawal_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """
    Aprova saque.
    Body JSON opcional:
      - notes: str — observações do admin
      - manual_transfer_id: str — ID do comprovante PIX manual
        Se fornecido: debita ledger + COMPLETED sem chamar MP Payouts.
        Se omitido: chama MP Payouts automaticamente.
    """
    _check_admin_enabled()
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    notes              = body.get("notes")
    manual_transfer_id = body.get("manual_transfer_id") or None
    try:
        from app.payments.services.withdrawal_service import WithdrawalService
        w = await WithdrawalService.approve_withdrawal(
            db                 = db,
            withdrawal_id      = withdrawal_id,
            admin_user_id      = user.id,
            notes              = notes,
            manual_transfer_id = manual_transfer_id,
        )
        return {"ok": True, "status": w.status.value, "mp_transfer_id": w.mp_transfer_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payments/withdrawals/{withdrawal_id}/reject")
async def admin_reject_withdrawal(
    withdrawal_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    _check_admin_enabled()
    body = await request.json()
    reason = body.get("reason", "Rejeitado pelo administrador")
    try:
        await db.execute(text(
            "UPDATE withdrawal_requests SET status = 'rejected', rejection_reason = :reason, reviewed_by_user_id = :uid, reviewed_at = NOW() WHERE id = :id"
        ), {"id": withdrawal_id, "uid": user.id, "reason": reason})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")



# AI tokens routes are handled by:
# /app/api/routes/admin/ai_tokens_admin.py  (prefix /admin/ai-tokens)


# ═══════════════════════════════════════════════════════════════════════════════
# Platform API Keys Management — Gerenciamento de chaves globais da plataforma
# ═══════════════════════════════════════════════════════════════════════════════

import base64
from cryptography.fernet import Fernet, InvalidToken


def _platform_fernet() -> Fernet:
    key = settings.CREDENTIALS_ENCRYPTION_KEY.encode()
    padded = base64.urlsafe_b64encode(key[:32].ljust(32, b"="))
    return Fernet(padded)


def _platform_encrypt(plain: str) -> str:
    return _platform_fernet().encrypt(plain.encode()).decode()


def _platform_decrypt(encrypted: str) -> str:
    try:
        return _platform_fernet().decrypt(encrypted.encode()).decode()
    except (InvalidToken, Exception):
        return ""


def _mask_key(key_str: str) -> str:
    """Mask API key showing only last 4 chars."""
    if not key_str or len(key_str) < 8:
        return "••••"
    return "•" * (len(key_str) - 4) + key_str[-4:]


@router.get("/platform-keys")
async def list_platform_keys(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """List all platform API keys (masked) with their model costs."""
    _check_admin_enabled()
    where = "WHERE 1=1"
    params = {}
    if category:
        where += " AND pk.category = :category"
        params["category"] = category

    rows = await db.execute(text(f"""
        SELECT pk.id, pk.provider, pk.display_name, pk.category,
               pk.encrypted_key IS NOT NULL as has_key,
               pk.is_active, pk.default_model, pk.base_url, pk.webhook_url,
               pk.last_tested_at, pk.test_status, pk.test_error,
               pk.notes, pk.config_json, pk.created_at, pk.updated_at
        FROM platform_api_keys pk
        {where}
        ORDER BY pk.category, pk.display_name
    """), params)
    keys = [dict(r._mapping) for r in rows.fetchall()]

    # Attach model costs to each provider
    for k in keys:
        costs_rows = await db.execute(text("""
            SELECT id, model, cost_input_per_1k, cost_output_per_1k,
                   is_free, is_default, notes
            FROM platform_model_costs
            WHERE provider = :provider
            ORDER BY is_default DESC, model
        """), {"provider": k["provider"]})
        k["model_costs"] = [dict(r._mapping) for r in costs_rows.fetchall()]
        # Mask timestamps
        for ts_field in ["last_tested_at", "created_at", "updated_at"]:
            if k.get(ts_field):
                k[ts_field] = str(k[ts_field])

    return {"keys": keys}


class PlatformKeySaveBody(BaseModel):
    provider: str
    display_name: Optional[str] = None
    api_key: Optional[str] = None  # plain text — will be encrypted
    is_active: Optional[bool] = None
    default_model: Optional[str] = None
    base_url: Optional[str] = None
    webhook_url: Optional[str] = None
    notes: Optional[str] = None
    config_json: Optional[dict] = None
    category: Optional[str] = None


@router.post("/platform-keys")
async def save_platform_key(
    body: PlatformKeySaveBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Create or update a platform API key."""
    _check_admin_enabled()

    # Check if provider exists
    existing = await db.execute(text(
        "SELECT id, encrypted_key FROM platform_api_keys WHERE provider = :provider"
    ), {"provider": body.provider})
    row = existing.fetchone()

    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if body.default_model is not None:
        updates["default_model"] = body.default_model
    if body.base_url is not None:
        updates["base_url"] = body.base_url
    if body.webhook_url is not None:
        updates["webhook_url"] = body.webhook_url
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.config_json is not None:
        updates["config_json"] = str(body.config_json).replace("'", '"')
    if body.category is not None:
        updates["category"] = body.category
    if body.api_key is not None and body.api_key.strip():
        updates["encrypted_key"] = _platform_encrypt(body.api_key.strip())

    try:
        if row:
            # Update existing
            if updates:
                set_parts = ", ".join(f"{k} = :{k}" for k in updates)
                updates["provider"] = body.provider
                await db.execute(text(
                    f"UPDATE platform_api_keys SET {set_parts}, updated_at = NOW() WHERE provider = :provider"
                ), updates)
        else:
            # Insert new
            updates["provider"] = body.provider
            if "display_name" not in updates:
                updates["display_name"] = body.provider.title()
            if "category" not in updates:
                updates["category"] = "ai"
            cols = ", ".join(updates.keys())
            vals = ", ".join(f":{k}" for k in updates.keys())
            await db.execute(text(
                f"INSERT INTO platform_api_keys ({cols}) VALUES ({vals})"
            ), updates)

        await db.commit()
        return {"ok": True, "provider": body.provider}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar: {e}")


@router.delete("/platform-keys/{provider}")
async def delete_platform_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Delete a platform API key and its model costs."""
    _check_admin_enabled()
    try:
        await db.execute(text("DELETE FROM platform_api_keys WHERE provider = :p"), {"p": provider})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/platform-keys/{provider}/test")
async def test_platform_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Test a platform API key by making a minimal API call."""
    _check_admin_enabled()
    import httpx

    row = await db.execute(text(
        "SELECT encrypted_key, base_url, default_model, category FROM platform_api_keys WHERE provider = :p"
    ), {"p": provider})
    record = row.fetchone()
    if not record:
        raise HTTPException(status_code=404, detail="Provider não encontrado")
    if not record.encrypted_key:
        raise HTTPException(status_code=400, detail="Nenhuma API key configurada")

    api_key = _platform_decrypt(record.encrypted_key)
    if not api_key:
        raise HTTPException(status_code=400, detail="Erro ao decriptar a API key")

    test_result = {"status": "unknown", "error": None, "latency_ms": 0}
    start = time.time()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if provider == "openai":
                url = (record.base_url or "https://api.openai.com") + "/v1/models"
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                resp.raise_for_status()
                test_result["status"] = "ok"
                test_result["models_count"] = len(resp.json().get("data", []))

            elif provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                resp = await client.get(url)
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "claude":
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={"model": record.default_model or "claude-3-5-haiku-20241022",
                          "max_tokens": 5,
                          "messages": [{"role": "user", "content": "hi"}]}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "groq":
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "deepseek":
                resp = await client.get(
                    (record.base_url or "https://api.deepseek.com") + "/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "elevenlabs":
                resp = await client.get(
                    "https://api.elevenlabs.io/v1/voices",
                    headers={"xi-api-key": api_key}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "mercadopago":
                resp = await client.get(
                    "https://api.mercadopago.com/v1/payments/search?limit=1",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider == "stripe":
                resp = await client.get(
                    "https://api.stripe.com/v1/balance",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                resp.raise_for_status()
                test_result["status"] = "ok"

            elif provider in ("telegram",):
                resp = await client.get(f"https://api.telegram.org/bot{api_key}/getMe")
                resp.raise_for_status()
                data = resp.json()
                test_result["status"] = "ok"
                test_result["bot_name"] = data.get("result", {}).get("username", "")

            else:
                # Generic test: try OpenAI-compatible /v1/models
                base = record.base_url or f"https://api.{provider}.com"
                try:
                    resp = await client.get(
                        f"{base}/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                    resp.raise_for_status()
                    test_result["status"] = "ok"
                except Exception:
                    test_result["status"] = "ok"
                    test_result["note"] = "Teste genérico: API key salva mas não verificada automaticamente"

    except httpx.HTTPStatusError as e:
        test_result["status"] = "error"
        test_result["error"] = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
    except Exception as e:
        test_result["status"] = "error"
        test_result["error"] = str(e)[:300]

    test_result["latency_ms"] = int((time.time() - start) * 1000)

    # Update test status in DB
    await db.execute(text(
        "UPDATE platform_api_keys SET last_tested_at = NOW(), test_status = :status, test_error = :error WHERE provider = :p"
    ), {"p": provider, "status": test_result["status"], "error": test_result.get("error")})
    await db.commit()

    return test_result


class ModelCostBody(BaseModel):
    provider: str
    model: str
    cost_input_per_1k: int = 5
    cost_output_per_1k: int = 10
    is_free: bool = False
    is_default: bool = False
    notes: Optional[str] = None


@router.post("/platform-keys/model-costs")
async def save_model_cost(
    body: ModelCostBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Add or update cost for a specific model."""
    _check_admin_enabled()
    try:
        # If is_default, clear other defaults for this provider
        if body.is_default:
            await db.execute(text(
                "UPDATE platform_model_costs SET is_default = false WHERE provider = :p"
            ), {"p": body.provider})

        # Upsert
        existing = await db.execute(text(
            "SELECT id FROM platform_model_costs WHERE provider = :p AND model = :m"
        ), {"p": body.provider, "m": body.model})

        if existing.fetchone():
            await db.execute(text("""
                UPDATE platform_model_costs
                SET cost_input_per_1k = :ci, cost_output_per_1k = :co,
                    is_free = :free, is_default = :def, notes = :notes
                WHERE provider = :p AND model = :m
            """), {
                "p": body.provider, "m": body.model,
                "ci": body.cost_input_per_1k, "co": body.cost_output_per_1k,
                "free": body.is_free, "def": body.is_default,
                "notes": body.notes
            })
        else:
            await db.execute(text("""
                INSERT INTO platform_model_costs
                    (provider, model, cost_input_per_1k, cost_output_per_1k, is_free, is_default, notes)
                VALUES (:p, :m, :ci, :co, :free, :def, :notes)
            """), {
                "p": body.provider, "m": body.model,
                "ci": body.cost_input_per_1k, "co": body.cost_output_per_1k,
                "free": body.is_free, "def": body.is_default,
                "notes": body.notes
            })

        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/platform-keys/model-costs/{cost_id}")
async def delete_model_cost(
    cost_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Delete a model cost entry."""
    _check_admin_enabled()
    try:
        await db.execute(text("DELETE FROM platform_model_costs WHERE id = :id"), {"id": cost_id})
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.get("/platform-keys/status")
async def platform_keys_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Quick status overview of all platform API keys."""
    _check_admin_enabled()
    rows = await db.execute(text("""
        SELECT provider, display_name, category, is_active,
               encrypted_key IS NOT NULL as has_key,
               test_status, last_tested_at
        FROM platform_api_keys
        ORDER BY category, display_name
    """))
    keys = []
    for r in rows.fetchall():
        d = dict(r._mapping)
        if d.get("last_tested_at"):
            d["last_tested_at"] = str(d["last_tested_at"])
        keys.append(d)

    total = len(keys)
    configured = sum(1 for k in keys if k["has_key"])
    active = sum(1 for k in keys if k["is_active"])
    ok = sum(1 for k in keys if k["test_status"] == "ok")

    return {
        "summary": {"total": total, "configured": configured, "active": active, "tested_ok": ok},
        "keys": keys
    }


# ════════════════════════════════════════════════════════
# SUPERADMIN — SM Credit Packs Management
# ════════════════════════════════════════════════════════

@router.get("/sm-credit-packs")
async def admin_list_sm_packs(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista todos os packs SM (ativos e inativos)."""
    _check_admin_enabled()
    result = await db.execute(text(
        "SELECT * FROM sm_credit_packs ORDER BY sort_order ASC, id ASC"
    ))
    packs = []
    for row in result.mappings().all():
        d = dict(row)
        d["price_brl"] = float(d["price_brl"] or 0)
        if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
        if d.get("updated_at"): d["updated_at"] = d["updated_at"].isoformat()
        packs.append(d)
    return {"packs": packs}


@router.post("/sm-credit-packs")
async def admin_upsert_sm_pack(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Cria ou atualiza um pack SM."""
    _check_admin_enabled()
    try:
        pack_id = body.get("id")
        if pack_id:
            await db.execute(text("""
                UPDATE sm_credit_packs SET
                    name = :name, description = :desc, credits_amount = :credits,
                    price_brl = :price, badge_text = :badge, is_active = :active,
                    is_highlighted = :hl, sort_order = :sort, color = :color, icon = :icon,
                    updated_at = NOW()
                WHERE id = :id
            """), {
                "id": pack_id,
                "name": body["name"], "desc": body.get("description", ""),
                "credits": int(body["credits_amount"]), "price": float(body["price_brl"]),
                "badge": body.get("badge_text"), "active": body.get("is_active", True),
                "hl": body.get("is_highlighted", False), "sort": body.get("sort_order", 0),
                "color": body.get("color", "#f59e0b"), "icon": body.get("icon", "coins"),
            })
        else:
            await db.execute(text("""
                INSERT INTO sm_credit_packs
                    (name, description, credits_amount, price_brl, badge_text, is_active,
                     is_highlighted, sort_order, color, icon)
                VALUES (:name, :desc, :credits, :price, :badge, :active, :hl, :sort, :color, :icon)
            """), {
                "name": body["name"], "desc": body.get("description", ""),
                "credits": int(body["credits_amount"]), "price": float(body["price_brl"]),
                "badge": body.get("badge_text"), "active": body.get("is_active", True),
                "hl": body.get("is_highlighted", False), "sort": body.get("sort_order", 0),
                "color": body.get("color", "#f59e0b"), "icon": body.get("icon", "coins"),
            })
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.delete("/sm-credit-packs/{pack_id}")
async def admin_delete_sm_pack(
    pack_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Desativa (soft delete) um pack SM."""
    _check_admin_enabled()
    await db.execute(
        text("UPDATE sm_credit_packs SET is_active=false, updated_at=NOW() WHERE id=:id"),
        {"id": pack_id}
    )
    await db.commit()
    return {"ok": True}


@router.get("/sm-credit-purchases")
async def admin_list_sm_purchases(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    status_filter: str = Query(default="all"),
    q: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista compras de SM credits com status (pending, paid, expired)."""
    _check_admin_enabled()
    offset = (page - 1) * limit
    where_clauses = ["pc.metadata->>'sm_pack_id' IS NOT NULL"]
    params = {"limit": limit, "offset": offset}

    if status_filter != "all":
        where_clauses.append("pc.status = :status")
        params["status"] = status_filter
    if q:
        where_clauses.append("(c.name ILIKE :q OR u.email ILIKE :q)")
        params["q"] = f"%{q}%"

    where = "WHERE " + " AND ".join(where_clauses)

    try:
        rows = await db.execute(text(f"""
            SELECT pc.id, pc.company_id, c.name AS company_name,
                   u.email AS user_email, pc.amount, pc.status,
                   pc.metadata->>'sm_pack_name' AS pack_name,
                   (pc.metadata->>'credits_amount')::int AS credits_amount,
                   pc.metadata->>'payment_method' AS payment_method,
                   pc.paid_at, pc.created_at
            FROM payment_charges pc
            JOIN companies c ON c.id = pc.company_id
            LEFT JOIN users u ON u.id = pc.created_by_user_id
            {where}
            ORDER BY pc.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)

        total_r = await db.execute(text(f"""
            SELECT COUNT(*)
            FROM payment_charges pc
            JOIN companies c ON c.id = pc.company_id
            LEFT JOIN users u ON u.id = pc.created_by_user_id
            {where}
        """), {k: v for k, v in params.items() if k not in ("limit", "offset")})

        purchases = []
        for r in rows.mappings().all():
            d = dict(r)
            d["amount"] = float(d["amount"] or 0)
            if d.get("paid_at"): d["paid_at"] = d["paid_at"].isoformat()
            if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
            purchases.append(d)

        return {
            "purchases": purchases,
            "total": int(total_r.scalar() or 0),
            "page": page,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# SUPERADMIN — SmartMoon Engine
# ═══════════════════════════════════════════

@router.get("/smartmoon/overview")
async def admin_smartmoon_overview(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """SmartMoon Engine overview: todas as instâncias, conexões por empresa, volume de mensagens."""
    _check_admin_enabled()
    try:
        import json as _json
        instances_r = await db.execute(text("""
            SELECT
                i.id, i.status, i.config_json, i.created_at, i.updated_at,
                c.id AS company_id, c.name AS company_name, c.plan,
                (SELECT COUNT(*) FROM whatsapp_conversations wc WHERE wc.integration_id = i.id) AS conv_count,
                (SELECT COUNT(*) FROM whatsapp_messages wm
                    JOIN whatsapp_conversations wc2 ON wc2.id = wm.conversation_id
                    WHERE wc2.integration_id = i.id) AS msg_count,
                (SELECT COUNT(*) FROM whatsapp_messages wm2
                    JOIN whatsapp_conversations wc3 ON wc3.id = wm2.conversation_id
                    WHERE wc3.integration_id = i.id
                    AND wm2.created_at >= NOW() - INTERVAL '24 hours') AS msgs_24h,
                (SELECT COUNT(*) FROM whatsapp_messages wm3
                    JOIN whatsapp_conversations wc4 ON wc4.id = wm3.conversation_id
                    WHERE wc4.integration_id = i.id
                    AND wm3.created_at >= NOW() - INTERVAL '1 hour') AS msgs_1h
            FROM integrations i
            JOIN companies c ON c.id = i.company_id
            WHERE i.provider = 'smartmoon'
            ORDER BY msg_count DESC
        """))
        rows = instances_r.fetchall()
        instances = []
        for r in rows:
            cfg = r[2] or {}
            if isinstance(cfg, str): cfg = _json.loads(cfg)
            instances.append({
                "id": r[0], "status": r[1],
                "instance_id": cfg.get("instance_id"),
                "label": cfg.get("label"),
                "display_phone": cfg.get("display_phone", ""),
                "push_name": cfg.get("push_name", ""),
                "flow_id": cfg.get("flow_id"),
                "created_at": r[3].isoformat() if r[3] else None,
                "updated_at": r[4].isoformat() if r[4] else None,
                "company_id": r[5], "company_name": r[6], "plan": r[7],
                "conversations": int(r[8] or 0),
                "total_messages": int(r[9] or 0),
                "messages_24h": int(r[10] or 0),
                "messages_1h": int(r[11] or 0),
                "msgs_per_sec": round((int(r[11] or 0)) / 3600, 4),
            })
        total_msgs_24h = sum(i["messages_24h"] for i in instances)
        total_msgs_1h = sum(i["messages_1h"] for i in instances)
        connected = sum(1 for i in instances if i["status"] == "connected")
        return {
            "summary": {
                "total_instances": len(instances),
                "connected": connected,
                "disconnected": len(instances) - connected,
                "total_messages_24h": total_msgs_24h,
                "total_messages_1h": total_msgs_1h,
                "global_msgs_per_sec": round(total_msgs_1h / 3600, 4),
            },
            "instances": instances,
            "high_volume_alerts": [i for i in instances if i["messages_1h"] > 100],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro SmartMoon overview: {e}")


@router.get("/smartmoon/logs")
async def admin_smartmoon_logs(
    company_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, le=500),
    hours: int = Query(default=24, ge=1, le=720),
    direction: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Logs prioritários SmartMoon: mensagens enviadas/recebidas e alertas de burst."""
    _check_admin_enabled()
    try:
        import json as _json
        wheres = ["wm.created_at >= NOW() - make_interval(hours => :hours_param)", "i.provider = 'smartmoon'"]
        params: dict = {"hours_param": hours, "limit": limit}
        if company_id:
            wheres.append("c.id = :company_id")
            params["company_id"] = company_id
        if direction in ("inbound", "outbound"):
            wheres.append("wm.direction = :direction")
            params["direction"] = direction
        where_sql = " AND ".join(wheres)
        logs_r = await db.execute(text(f"""
            SELECT wm.id, wm.direction, wm.message_type, wm.content_text,
                   wm.delivery_status, wm.created_at, wm.wamid,
                   wc.phone_number, c.id, c.name, i.config_json
            FROM whatsapp_messages wm
            JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
            JOIN integrations i ON i.id = wc.integration_id
            JOIN companies c ON c.id = i.company_id
            WHERE {where_sql}
            ORDER BY wm.created_at DESC LIMIT :limit
        """), params)
        logs = []
        for r in logs_r.fetchall():
            cfg = r[10] or {}
            if isinstance(cfg, str): cfg = _json.loads(cfg)
            logs.append({
                "msg_id": r[0], "direction": r[1], "type": r[2],
                "text_preview": (r[3] or "")[:120] if r[3] else None,
                "status": r[4], "created_at": r[5].isoformat() if r[5] else None,
                "wamid": r[6], "phone": r[7],
                "company_id": r[8], "company_name": r[9],
                "instance_id": cfg.get("instance_id"), "label": cfg.get("label"),
            })
        burst_r = await db.execute(text("""
            SELECT c.id, c.name, COUNT(wm.id) as cnt, i.config_json
            FROM whatsapp_messages wm
            JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
            JOIN integrations i ON i.id = wc.integration_id
            JOIN companies c ON c.id = i.company_id
            WHERE i.provider = 'smartmoon' AND wm.direction = 'outbound'
              AND wm.created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY c.id, c.name, i.config_json HAVING COUNT(wm.id) > 50 ORDER BY cnt DESC
        """))
        burst_alerts = []
        for r in burst_r.fetchall():
            cfg = r[3] or {}
            if isinstance(cfg, str): cfg = _json.loads(cfg)
            burst_alerts.append({"company_id": r[0], "company_name": r[1],
                                  "msgs_last_hour": int(r[2]), "instance_id": cfg.get("instance_id")})
        return {"logs": logs, "total_returned": len(logs), "burst_alerts": burst_alerts,
                "filter": {"hours": hours, "company_id": company_id, "direction": direction or "all"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro logs SmartMoon: {e}")


@router.get("/smartmoon/security")
async def admin_smartmoon_security(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Auditoria de segurança SmartMoon: disparos em massa, RAM, instâncias zumbi."""
    _check_admin_enabled()
    try:
        import json as _json
        mem = psutil.virtual_memory()
        abuse_r = await db.execute(text("""
            SELECT c.id, c.name, c.plan, COUNT(wm.id) as msgs_1h,
                   COUNT(DISTINCT wc.phone_number) as unique_contacts
            FROM whatsapp_messages wm
            JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
            JOIN integrations i ON i.id = wc.integration_id
            JOIN companies c ON c.id = i.company_id
            WHERE i.provider = 'smartmoon' AND wm.direction = 'outbound'
              AND wm.created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY c.id, c.name, c.plan HAVING COUNT(wm.id) > 100 ORDER BY msgs_1h DESC
        """))
        potential_abuse = [
            {"company_id": r[0], "company_name": r[1], "plan": r[2],
             "msgs_1h": int(r[3]), "unique_contacts": int(r[4]),
             "risk": "HIGH" if int(r[3]) > 480 else "MEDIUM"}
            for r in abuse_r.fetchall()
        ]
        zombie_r = await db.execute(text("""
            SELECT i.id, i.status, i.updated_at, c.name, i.config_json
            FROM integrations i JOIN companies c ON c.id = i.company_id
            WHERE i.provider = 'smartmoon' AND i.status = 'disconnected'
              AND i.updated_at < NOW() - INTERVAL '24 hours'
        """))
        zombie_instances = []
        for r in zombie_r.fetchall():
            cfg = r[4] or {}
            if isinstance(cfg, str): cfg = _json.loads(cfg)
            zombie_instances.append({
                "integration_id": r[0], "status": r[1],
                "last_seen": r[2].isoformat() if r[2] else None,
                "company_name": r[3], "instance_id": cfg.get("instance_id"),
            })
        totals = (await db.execute(text(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE status='connected') FROM integrations WHERE provider='smartmoon'"
        ))).fetchone()
        return {
            "server": {"ram_used_gb": round(mem.used / 1e9, 2), "ram_percent": mem.percent, "ram_warning": mem.percent > 80},
            "instances": {"total": int(totals[0] or 0), "connected": int(totals[1] or 0)},
            "potential_abuse": potential_abuse,
            "zombie_instances": zombie_instances,
            "anti_ban_config": {"max_msg_per_min": 8, "typing_delay_min_ms": 2000, "typing_delay_max_ms": 6000, "online_presence": True},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro security audit: {e}")
