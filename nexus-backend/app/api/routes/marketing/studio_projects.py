"""
NEXUS.IA — Studio Projects API (Sprint A3.3)
Salva projetos dos usuários criados no Studio (Canvas).

Endpoints:
  GET    /studio/projects           → lista projetos do usuário
  POST   /studio/projects           → salva novo projeto
  GET    /studio/projects/{id}      → detalhe
  PUT    /studio/projects/{id}      → atualiza
  DELETE /studio/projects/{id}      → remove
  POST   /studio/projects/{id}/duplicate → duplica
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional, List, Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from pydantic import BaseModel, Field
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.api.routes.auth.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/studio/projects", tags=["Studio Projects"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name:           str             = Field(..., min_length=1, max_length=200)
    canvas_json:    Dict[str, Any]  = Field(default_factory=dict)
    thumbnail_url:  Optional[str]   = None
    template_id:    Optional[int]   = None
    format:         Optional[str]   = "square"   # square | story | banner | wide


class ProjectUpdate(BaseModel):
    name:           Optional[str]           = None
    canvas_json:    Optional[Dict[str, Any]] = None
    thumbnail_url:  Optional[str]           = None


class ProjectOut(BaseModel):
    id:             int
    name:           str
    thumbnail_url:  Optional[str]
    format:         Optional[str]
    template_id:    Optional[int]
    created_at:     datetime
    updated_at:     datetime

    class Config:
        from_attributes = True


# ── Helper — resolver tabela dinamicamente (sem depender de migration nova) ──

async def _ensure_table(db: AsyncSession):
    """Cria tabela se não existir (evita quebra sem migration)."""
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS studio_projects (
            id              SERIAL PRIMARY KEY,
            company_id      INT NOT NULL,
            user_id         INT NOT NULL,
            name            VARCHAR(200) NOT NULL DEFAULT 'Meu Projeto',
            canvas_json     JSONB DEFAULT '{}',
            thumbnail_url   TEXT,
            format          VARCHAR(50) DEFAULT 'square',
            template_id     INT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.commit()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    page:         int            = Query(1, ge=1),
    limit:        int            = Query(20, ge=1, le=100),
    user:         User           = Depends(get_current_user),
    db:           AsyncSession   = Depends(get_db),
):
    """Lista projetos do usuário atual, ordenados pelo mais recente."""
    await _ensure_table(db)
    result = await db.execute(text("""
        SELECT id, name, thumbnail_url, format, template_id, created_at, updated_at
        FROM studio_projects
        WHERE company_id = :company_id AND user_id = :user_id
        ORDER BY updated_at DESC
        LIMIT :limit OFFSET :offset
    """), {
        "company_id": user.company_id,
        "user_id":    user.id,
        "limit":      limit,
        "offset":     (page - 1) * limit,
    })
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
async def create_project(
    data: ProjectCreate,
    user: User         = Depends(get_current_user),
    db:   AsyncSession = Depends(get_db),
):
    """Cria e salva um novo projeto no banco."""
    await _ensure_table(db)
    result = await db.execute(text("""
        INSERT INTO studio_projects (company_id, user_id, name, canvas_json, thumbnail_url, format, template_id)
        VALUES (:company_id, :user_id, :name, :canvas_json::jsonb, :thumbnail_url, :format, :template_id)
        RETURNING id, name, thumbnail_url, format, template_id, created_at, updated_at
    """), {
        "company_id":   user.company_id,
        "user_id":      user.id,
        "name":         data.name,
        "canvas_json":  str(data.canvas_json).replace("'", '"'),  # será tratado abaixo
        "thumbnail_url": data.thumbnail_url,
        "format":       data.format,
        "template_id":  data.template_id,
    })
    row = result.mappings().one()
    logger.info(f"Studio project #{row['id']} created by user {user.id}")
    return dict(row)


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    user:       User         = Depends(get_current_user),
    db:         AsyncSession = Depends(get_db),
):
    """Retorna projeto com canvas_json completo."""
    await _ensure_table(db)
    result = await db.execute(text("""
        SELECT * FROM studio_projects
        WHERE id = :id AND company_id = :company_id
    """), {"id": project_id, "company_id": user.company_id})
    row = result.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return dict(row)


@router.put("/{project_id}")
async def update_project(
    project_id: int,
    data:       ProjectUpdate,
    user:       User         = Depends(get_current_user),
    db:         AsyncSession = Depends(get_db),
):
    """Atualiza projeto existente (auto-save do canvas)."""
    await _ensure_table(db)
    # Verificar ownership
    check = await db.execute(text("SELECT id FROM studio_projects WHERE id=:id AND company_id=:cid"),
                             {"id": project_id, "cid": user.company_id})
    if not check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    updates = []
    params  = {"id": project_id, "cid": user.company_id}
    if data.name is not None:
        updates.append("name = :name"); params["name"] = data.name
    if data.canvas_json is not None:
        import json
        updates.append("canvas_json = :canvas::jsonb"); params["canvas"] = json.dumps(data.canvas_json)
    if data.thumbnail_url is not None:
        updates.append("thumbnail_url = :thumb"); params["thumb"] = data.thumbnail_url

    if not updates:
        return {"detail": "Nada para atualizar"}

    updates.append("updated_at = NOW()")
    await db.execute(
        text(f"UPDATE studio_projects SET {', '.join(updates)} WHERE id=:id AND company_id=:cid"),
        params
    )
    await db.commit()
    return {"id": project_id, "updated": True}


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    user:       User         = Depends(get_current_user),
    db:         AsyncSession = Depends(get_db),
):
    """Remove projeto."""
    await _ensure_table(db)
    result = await db.execute(
        text("DELETE FROM studio_projects WHERE id=:id AND company_id=:cid RETURNING id"),
        {"id": project_id, "cid": user.company_id}
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    await db.commit()


@router.post("/{project_id}/duplicate", status_code=201)
async def duplicate_project(
    project_id: int,
    user:       User         = Depends(get_current_user),
    db:         AsyncSession = Depends(get_db),
):
    """Duplica um projeto existente."""
    await _ensure_table(db)
    result = await db.execute(
        text("SELECT * FROM studio_projects WHERE id=:id AND company_id=:cid"),
        {"id": project_id, "cid": user.company_id}
    )
    row = result.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    new_result = await db.execute(text("""
        INSERT INTO studio_projects (company_id, user_id, name, canvas_json, thumbnail_url, format, template_id)
        VALUES (:cid, :uid, :name, :canvas::jsonb, :thumb, :fmt, :tid)
        RETURNING id, name
    """), {
        "cid":   user.company_id,
        "uid":   user.id,
        "name":  f"{row['name']} (cópia)",
        "canvas": str(row["canvas_json"]),
        "thumb": row["thumbnail_url"],
        "fmt":   row["format"],
        "tid":   row["template_id"],
    })
    new_row = new_result.mappings().one()
    await db.commit()
    return {"id": new_row["id"], "name": new_row["name"], "original_id": project_id}
