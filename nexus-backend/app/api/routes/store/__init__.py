"""
Smart Moon Store — User-facing marketplace for Skills and Agents.

Routes:
  GET  /store/skills              → List skills available for user's plan
  GET  /store/agents              → List agents available for plan
  POST /store/skills/{id}/install → Install skill (debits credits if needed)
  POST /store/agents/{id}/install → Install agent (debits credits if needed)
  GET  /store/my-skills           → Company's installed skills
  GET  /store/my-agents           → Company's installed agents
  DELETE /store/skills/{id}       → Uninstall skill
  DELETE /store/agents/{id}       → Uninstall agent
  GET  /store/credits             → Current credit balance + history
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.db.repositories.plan_repository import PlanRepository

router = APIRouter(prefix="/store", tags=["Store"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_json(val):
    """Safely parse JSONB field that might come as string or list."""
    if val is None:
        return []
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return []


def _row_to_skill(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "description": row.get("description") or "",
        "icon": row.get("icon") or "🔧",
        "category": row.get("category") or "Geral",
        "price_credits": row.get("price_credits") or 0,
        "is_exclusive": row.get("is_exclusive") or False,
        "tags": _parse_json(row.get("tags")),
        "allowed_plans": _parse_json(row.get("plan_access")),
        "install_count": 0,
        "installed": bool(row.get("installed", False)),
        "installed_at": row["installed_at"].isoformat() if row.get("installed_at") else None,
    }


def _row_to_agent(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "description": row.get("description") or "",
        "icon": row.get("icon") or "🤖",
        "category": row.get("category") or "Geral",
        "agent_type": row.get("agent_type") or "general",
        "model": row.get("model") or "gpt-4o-mini",
        "provider": row.get("provider") or "openai",
        "price_credits": row.get("price_credits") or 0,
        "is_exclusive": row.get("is_exclusive") or False,
        "tags": _parse_json(row.get("tags")),
        "allowed_plans": _parse_json(row.get("plan_access")),
        "install_count": 0,
        "installed": bool(row.get("installed", False)),
        "installed_at": row["installed_at"].isoformat() if row.get("installed_at") else None,
    }


# ═══════════════════════════════════════════
# SKILLS
# ═══════════════════════════════════════════

@router.get("/skills")
async def list_store_skills(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all active platform skills with installation status for the user's company."""
    try:
        filters = ["ps.is_active = true"]
        params: dict = {"company_id": user.company_id}

        # Exclusivity filter: show public + company-exclusive
        filters.append(
            "(ps.is_exclusive = false OR ps.exclusive_company_id = :company_id)"
        )

        if category:
            filters.append("ps.category = :category")
            params["category"] = category

        if search:
            filters.append("(ps.name ILIKE :search OR ps.description ILIKE :search)")
            params["search"] = f"%{search}%"

        where_clause = " AND ".join(filters)

        result = await db.execute(text(f"""
            SELECT ps.*,
                   (si.id IS NOT NULL) AS installed,
                   si.installed_at
            FROM platform_skills ps
            LEFT JOIN skill_installs si ON si.skill_id = ps.id
                AND si.company_id = :company_id AND si.is_active = true
            WHERE {where_clause}
            ORDER BY ps.created_at DESC
        """), params)

        rows = result.mappings().all()
        skills = [_row_to_skill(dict(r)) for r in rows]

        # Get plan info to mark which skills are accessible
        repo = PlanRepository(db)
        plan_data = await repo.get_plan_for_company(user.company_id)
        plan_slug = plan_data.get("plan", "free")

        for skill in skills:
            allowed = skill.get("allowed_plans", [])
            skill["plan_accessible"] = (
                not allowed  # empty = available to all
                or plan_slug in allowed
                or "free" in allowed
            )

        return {
            "skills": skills,
            "total": len(skills),
            "current_plan": plan_slug,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar skills: {e}")


@router.get("/my-skills")
async def list_my_skills(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List skills installed by the current company."""
    try:
        result = await db.execute(text("""
            SELECT ps.*, si.usage_count, si.installed_at, si.id AS install_id
            FROM skill_installs si
            JOIN platform_skills ps ON ps.id = si.skill_id
            WHERE si.company_id = :company_id AND si.is_active = true
            ORDER BY si.installed_at DESC
        """), {"company_id": user.company_id})

        rows = result.mappings().all()
        skills = [_row_to_skill({**dict(r), "installed": True}) for r in rows]
        return {"skills": skills, "total": len(skills)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/skills/{skill_id}/install")
async def install_skill(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Install a platform skill. Debits credits if price > 0."""
    try:
        # 1. Get skill
        sk = await db.execute(
            text("SELECT * FROM platform_skills WHERE id = :id AND is_active = true"),
            {"id": skill_id}
        )
        skill = sk.mappings().first()
        if not skill:
            raise HTTPException(status_code=404, detail="Skill não encontrada")

        # 2. Check exclusivity
        if skill["is_exclusive"] and skill["exclusive_company_id"] != user.company_id:
            raise HTTPException(status_code=403, detail="Skill exclusiva — não disponível para sua conta")

        # 3. Check already installed
        existing = await db.execute(text("""
            SELECT id FROM skill_installs
            WHERE company_id = :cid AND skill_id = :sid AND is_active = true
        """), {"cid": user.company_id, "sid": skill_id})
        if existing.fetchone():
            raise HTTPException(status_code=409, detail="Skill já instalada")

        price = int(skill["price_credits"] or 0)
        repo = PlanRepository(db)

        # 4. Check credits if paid
        if price > 0:
            balance = await repo.get_credit_balance(user.company_id)
            if balance < price:
                raise HTTPException(
                    status_code=402,
                    detail=f"Créditos insuficientes: você tem {balance} cr., a skill custa {price} cr."
                )

        # 5. Debit credits (inside transaction)
        if price > 0:
            await repo.debit_credits(
                company_id=user.company_id,
                amount=price,
                description=f"Instalação da skill: {skill['name']}",
                reference_id=str(skill_id),
                reference_type="skill_install",
                performed_by=user.id,
            )

        # 6. Register installation
        await db.execute(text("""
            INSERT INTO skill_installs (company_id, skill_id, user_id)
            VALUES (:cid, :sid, :uid)
            ON CONFLICT (company_id, skill_id) DO UPDATE SET is_active = true
        """), {
            "cid": user.company_id, "sid": skill_id,
            "uid": user.id,
        })



        await db.commit()

        return {
            "ok": True,
            "skill": skill["name"],
            "slug": skill["slug"],
            "credits_spent": price,
            "message": f"Skill '{skill['name']}' instalada com sucesso!",
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao instalar skill: {e}")


@router.delete("/skills/{skill_id}")
async def uninstall_skill(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Uninstall a skill from the company."""
    try:
        result = await db.execute(text("""
            UPDATE skill_installs SET is_active = false
            WHERE company_id = :cid AND skill_id = :sid AND is_active = true
            RETURNING id
        """), {"cid": user.company_id, "sid": skill_id})

        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Skill não instalada")

        await db.commit()
        return {"ok": True, "message": "Skill desinstalada com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# AGENTS
# ═══════════════════════════════════════════

@router.get("/agents")
async def list_store_agents(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all active platform agents with installation status."""
    try:
        filters = ["pa.is_active = true"]
        params: dict = {"company_id": user.company_id}

        filters.append(
            "(pa.is_exclusive = false OR pa.exclusive_company_id = :company_id)"
        )

        if category:
            filters.append("pa.category = :category")
            params["category"] = category

        if search:
            filters.append("(pa.name ILIKE :search OR pa.description ILIKE :search)")
            params["search"] = f"%{search}%"

        where_clause = " AND ".join(filters)

        result = await db.execute(text(f"""
            SELECT pa.*,
                   (ai.id IS NOT NULL) AS installed,
                   ai.installed_at
            FROM platform_agents pa
            LEFT JOIN agent_installs ai ON ai.platform_agent_id = pa.id
                AND ai.company_id = :company_id AND ai.is_active = true
            WHERE {where_clause}
            ORDER BY pa.created_at DESC
        """), params)

        rows = result.mappings().all()
        agents = [_row_to_agent(dict(r)) for r in rows]

        repo = PlanRepository(db)
        plan_data = await repo.get_plan_for_company(user.company_id)
        plan_slug = plan_data.get("plan", "free")

        for agent in agents:
            allowed = agent.get("allowed_plans", [])
            agent["plan_accessible"] = not allowed or plan_slug in allowed

        return {
            "agents": agents,
            "total": len(agents),
            "current_plan": plan_slug,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar agentes: {e}")


@router.get("/my-agents")
async def list_my_agents(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List agents installed by the current company."""
    try:
        result = await db.execute(text("""
            SELECT pa.*, ai.installed_at, ai.id AS install_id
            FROM agent_installs ai
            JOIN platform_agents pa ON pa.id = ai.platform_agent_id
            WHERE ai.company_id = :company_id AND ai.is_active = true
            ORDER BY ai.installed_at DESC
        """), {"company_id": user.company_id})

        rows = result.mappings().all()
        agents = [_row_to_agent({**dict(r), "installed": True}) for r in rows]
        return {"agents": agents, "total": len(agents)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


@router.post("/agents/{agent_id}/install")
async def install_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Install a platform agent. Debits credits if price > 0."""
    try:
        ag = await db.execute(
            text("SELECT * FROM platform_agents WHERE id = :id AND is_active = true"),
            {"id": agent_id}
        )
        agent = ag.mappings().first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        if agent["is_exclusive"] and agent["exclusive_company_id"] != user.company_id:
            raise HTTPException(status_code=403, detail="Agente exclusivo — não disponível para sua conta")

        existing = await db.execute(text("""
            SELECT id FROM agent_installs
            WHERE company_id = :cid AND platform_agent_id = :aid AND is_active = true
        """), {"cid": user.company_id, "aid": agent_id})
        if existing.fetchone():
            raise HTTPException(status_code=409, detail="Agente já instalado")

        price = int(agent["price_credits"] or 0)
        repo = PlanRepository(db)

        if price > 0:
            balance = await repo.get_credit_balance(user.company_id)
            if balance < price:
                raise HTTPException(
                    status_code=402,
                    detail=f"Créditos insuficientes: você tem {balance} cr., o agente custa {price} cr."
                )
            await repo.debit_credits(
                company_id=user.company_id,
                amount=price,
                description=f"Instalação do agente: {agent['name']}",
                reference_id=str(agent_id),
                reference_type="agent_install",
                performed_by=user.id,
            )

        # Snapshot the agent config at install time
        import json
        config_snap = json.dumps({
            "name": agent["name"],
            "system_prompt": agent["system_prompt"],
            "model": agent["model"],
            "provider": agent["provider"],
            "temperature": agent["temperature"],
        })

        await db.execute(text("""
            INSERT INTO agent_installs (company_id, platform_agent_id, user_id)
            VALUES (:cid, :aid, :uid)
            ON CONFLICT (company_id, platform_agent_id) DO UPDATE SET is_active = true
        """), {
            "cid": user.company_id, "aid": agent_id,
            "uid": user.id,
        })



        await db.commit()

        return {
            "ok": True,
            "agent": agent["name"],
            "slug": agent["slug"],
            "credits_spent": price,
            "message": f"Agente '{agent['name']}' instalado com sucesso!",
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao instalar agente: {e}")


@router.delete("/agents/{agent_id}")
async def uninstall_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Uninstall an agent from the company."""
    try:
        result = await db.execute(text("""
            UPDATE agent_installs SET is_active = false
            WHERE company_id = :cid AND agent_id = :aid AND is_active = true
            RETURNING id
        """), {"cid": user.company_id, "aid": agent_id})

        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Agente não instalado")

        await db.commit()
        return {"ok": True, "message": "Agente desinstalado com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {e}")


# ═══════════════════════════════════════════
# CREDITS
# ═══════════════════════════════════════════

@router.get("/credits")
async def get_my_credits(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return current credit balance and transaction history."""
    try:
        repo = PlanRepository(db)
        balance = await repo.get_credit_balance(user.company_id)

        offset = (page - 1) * limit
        tx_result = await db.execute(text("""
            SELECT id, amount, balance_after, transaction_type, description,
                   reference_type, created_at
            FROM credit_transactions
            WHERE company_id = :cid
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {"cid": user.company_id, "limit": limit, "offset": offset})

        count_r = await db.execute(text(
            "SELECT COUNT(*) FROM credit_transactions WHERE company_id = :cid"
        ), {"cid": user.company_id})
        total = count_r.scalar() or 0

        transactions = []
        for row in tx_result.mappings().all():
            r = dict(row)
            r["created_at"] = r["created_at"].isoformat() if r.get("created_at") else None
            transactions.append(r)

        # Plan monthly grant
        plan_data = await repo.get_plan_for_company(user.company_id)
        monthly_grant = plan_data.get("limits", {}).get("credits_per_month", 0)

        return {
            "balance": balance,
            "monthly_grant": monthly_grant,
            "transactions": transactions,
            "total": total,
            "page": page,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar créditos: {e}")
