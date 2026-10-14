"""
Smart Moon — SuperAdmin: Marketing Pro Management Routes
GET/PATCH /admin/marketing/clients
GET/PATCH /admin/marketing/clients/{id}/modules
GET       /admin/marketing/brand-kits
GET       /admin/marketing/studio-usage
GET       /admin/marketing/dashboard
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel

from app.db.session import get_db
from app.core.dependencies import require_superadmin
from app.models.marketing import BrandKit, CompanyMarketingModules, StudioUsage

router = APIRouter(prefix="/admin/marketing", tags=["admin-marketing"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModulePatch(BaseModel):
    has_brand_kit:      Optional[bool] = None
    has_studio:         Optional[bool] = None
    has_traffic_pro:    Optional[bool] = None
    has_ig_campaigns:   Optional[bool] = None
    studio_limit:       Optional[int] = None
    meta_accounts_limit:Optional[int] = None
    notes:              Optional[str] = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def marketing_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """KPIs do módulo Marketing Pro para o superadmin."""

    total_q = await db.execute(
        select(func.count()).select_from(CompanyMarketingModules)
    )
    total = total_q.scalar() or 0

    brand_q = await db.execute(
        select(func.count()).select_from(CompanyMarketingModules)
        .where(CompanyMarketingModules.has_brand_kit == True)
    )
    studio_q = await db.execute(
        select(func.count()).select_from(CompanyMarketingModules)
        .where(CompanyMarketingModules.has_studio == True)
    )
    traffic_q = await db.execute(
        select(func.count()).select_from(CompanyMarketingModules)
        .where(CompanyMarketingModules.has_traffic_pro == True)
    )
    ig_q = await db.execute(
        select(func.count()).select_from(CompanyMarketingModules)
        .where(CompanyMarketingModules.has_ig_campaigns == True)
    )

    # Total de gerações no mês atual
    month = datetime.now().strftime("%Y-%m")
    gens_q = await db.execute(
        select(func.sum(StudioUsage.generations_used))
        .where(StudioUsage.month == month)
    )
    gens = gens_q.scalar() or 0

    brand_kits_q = await db.execute(select(func.count()).select_from(BrandKit))

    return {
        "companies_with_marketing": total,
        "has_brand_kit": brand_q.scalar() or 0,
        "has_studio": studio_q.scalar() or 0,
        "has_traffic_pro": traffic_q.scalar() or 0,
        "has_ig_campaigns": ig_q.scalar() or 0,
        "brand_kits_registered": brand_kits_q.scalar() or 0,
        "studio_generations_this_month": gens,
        "current_month": month,
    }


# ── Listar clientes com módulos ───────────────────────────────────────────────

@router.get("/clients")
async def list_marketing_clients(
    module: str = Query(default="", description="Filtro: brand_kit|studio|traffic_pro|ig_campaigns"),
    search: str = Query(default=""),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista todas as empresas com seus módulos Marketing Pro."""

    sql = """
        SELECT
            c.id AS company_id, c.name AS company_name, c.plan,
            m.id AS module_id,
            COALESCE(m.has_brand_kit, FALSE)    AS has_brand_kit,
            COALESCE(m.has_studio, FALSE)        AS has_studio,
            COALESCE(m.has_traffic_pro, FALSE)   AS has_traffic_pro,
            COALESCE(m.has_ig_campaigns, FALSE)  AS has_ig_campaigns,
            COALESCE(m.studio_limit, 50)         AS studio_limit,
            m.notes,
            m.updated_at,
            COALESCE(su.generations_used, 0)     AS studio_used_this_month,
            (SELECT COUNT(*) FROM brand_kits bk WHERE bk.company_id = c.id) AS has_brand_kit_data
        FROM companies c
        LEFT JOIN company_marketing_modules m ON m.company_id = c.id
        LEFT JOIN studio_usage su ON su.company_id = c.id AND su.month = :month
        WHERE 1=1
    """
    params: dict = {"month": datetime.now().strftime("%Y-%m"), "limit": limit, "offset": offset}

    if search:
        sql += " AND c.name ILIKE :search"
        params["search"] = f"%{search}%"

    if module == "brand_kit":
        sql += " AND m.has_brand_kit = TRUE"
    elif module == "studio":
        sql += " AND m.has_studio = TRUE"
    elif module == "traffic_pro":
        sql += " AND m.has_traffic_pro = TRUE"
    elif module == "ig_campaigns":
        sql += " AND m.has_ig_campaigns = TRUE"

    sql += " ORDER BY c.name LIMIT :limit OFFSET :offset"

    result = await db.execute(text(sql), params)
    rows = result.fetchall()

    return [
        {
            "company_id": r[0], "company_name": r[1], "plan": r[2],
            "module_id": r[3],
            "has_brand_kit": r[4], "has_studio": r[5],
            "has_traffic_pro": r[6], "has_ig_campaigns": r[7],
            "studio_limit": r[8], "notes": r[9],
            "updated_at": r[10].isoformat() if r[10] else None,
            "studio_used_this_month": r[11],
            "has_brand_kit_data": bool(r[12]),
        }
        for r in rows
    ]


# ── Módulos de uma empresa ────────────────────────────────────────────────────

@router.get("/clients/{company_id}/modules")
async def get_company_modules(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(
        select(CompanyMarketingModules).where(CompanyMarketingModules.company_id == company_id)
    )
    mods = result.scalar_one_or_none()
    if not mods:
        return {
            "company_id": company_id, "has_brand_kit": False,
            "has_studio": False, "has_traffic_pro": False,
            "has_ig_campaigns": False, "studio_limit": 50,
            "meta_accounts_limit": 1, "notes": None,
        }
    return {
        "company_id": mods.company_id,
        "has_brand_kit": mods.has_brand_kit,
        "has_studio": mods.has_studio,
        "has_traffic_pro": mods.has_traffic_pro,
        "has_ig_campaigns": mods.has_ig_campaigns,
        "studio_limit": mods.studio_limit,
        "meta_accounts_limit": mods.meta_accounts_limit,
        "notes": mods.notes,
        "updated_at": mods.updated_at.isoformat() if mods.updated_at else None,
    }


@router.patch("/clients/{company_id}/modules")
async def update_company_modules(
    company_id: int,
    body: ModulePatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Ativa/desativa módulos Marketing Pro para uma empresa."""
    result = await db.execute(
        select(CompanyMarketingModules).where(CompanyMarketingModules.company_id == company_id)
    )
    mods = result.scalar_one_or_none()

    if not mods:
        mods = CompanyMarketingModules(company_id=company_id, activated_by=user.id)
        db.add(mods)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(mods, field, value)

    mods.activated_by = user.id
    await db.commit()
    await db.refresh(mods)

    return {
        "ok": True,
        "company_id": company_id,
        "has_brand_kit": mods.has_brand_kit,
        "has_studio": mods.has_studio,
        "has_traffic_pro": mods.has_traffic_pro,
        "has_ig_campaigns": mods.has_ig_campaigns,
        "studio_limit": mods.studio_limit,
    }


# ── Brand Kits cadastrados ────────────────────────────────────────────────────

@router.get("/brand-kits")
async def list_brand_kits(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    sql = """
        SELECT
            bk.id, bk.company_id, c.name AS company_name,
            bk.brand_name, bk.product, bk.niche,
            bk.logo_url, bk.color_primary, bk.font_primary,
            bk.updated_at
        FROM brand_kits bk
        JOIN companies c ON c.id = bk.company_id
        ORDER BY bk.updated_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(sql), {"limit": limit, "offset": offset})
    rows = result.fetchall()
    return [
        {
            "id": r[0], "company_id": r[1], "company_name": r[2],
            "brand_name": r[3], "product": r[4], "niche": r[5],
            "logo_url": r[6], "color_primary": r[7], "font_primary": r[8],
            "updated_at": r[9].isoformat() if r[9] else None,
        }
        for r in rows
    ]


# ── Uso Studio ────────────────────────────────────────────────────────────────

@router.get("/studio-usage")
async def studio_usage_report(
    month: str = Query(default="", description="Formato: YYYY-MM. Default: mês atual"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    if not month:
        month = datetime.now().strftime("%Y-%m")

    sql = """
        SELECT
            su.company_id, c.name AS company_name,
            su.generations_used, su.generations_limit,
            ROUND((su.generations_used::numeric / NULLIF(su.generations_limit, 0)) * 100, 1) AS pct_used
        FROM studio_usage su
        JOIN companies c ON c.id = su.company_id
        WHERE su.month = :month
        ORDER BY su.generations_used DESC
    """
    result = await db.execute(text(sql), {"month": month})
    rows = result.fetchall()

    total_gens = sum(r[2] for r in rows)

    return {
        "month": month,
        "total_generations": total_gens,
        "companies": [
            {
                "company_id": r[0], "company_name": r[1],
                "used": r[2], "limit": r[3],
                "pct_used": float(r[4]) if r[4] else 0,
            }
            for r in rows
        ],
    }
