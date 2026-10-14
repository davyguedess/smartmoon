"""
NEXUS.IA — /agent/knowledge routes
Knowledge base category management and partitioning.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import re

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models import KnowledgeCategory
from app.services.audit_service import audit

router = APIRouter(prefix="/knowledge", tags=["Agent Knowledge"])

# ── Schemas ───────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "📚"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon: str

    class Config:
        from_attributes = True

# ── Endpoints ─────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    """List all knowledge categories for the current company."""
    result = await db.execute(
        select(KnowledgeCategory)
        .where(KnowledgeCategory.company_id == user.company_id)
        .order_by(KnowledgeCategory.name)
    )
    return result.scalars().all()

@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryIn,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_admin)
):
    """Create a new knowledge category for partitioning RAG data."""
    # Generate slug
    slug = re.sub(r"[^a-z0-9\-]", "", body.name.lower().replace(" ", "-"))
    
    # Check if slug exists for company
    existing = await db.execute(
        select(KnowledgeCategory).where(
            KnowledgeCategory.company_id == user.company_id,
            KnowledgeCategory.slug == slug
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Categoria com slug '{slug}' já existe.")

    category = KnowledgeCategory(
        company_id=user.company_id,
        name=body.name,
        slug=slug,
        description=body.description,
        icon=body.icon or "📚"
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    await audit(db, user, "knowledge.category_created", "knowledge_category", category.id, {"name": category.name})
    return category

@router.get("/categories/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    result = await db.execute(
        select(KnowledgeCategory).where(
            KnowledgeCategory.id == category_id,
            KnowledgeCategory.company_id == user.company_id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    return category

@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_admin)
):
    result = await db.execute(
        select(KnowledgeCategory).where(
            KnowledgeCategory.id == category_id,
            KnowledgeCategory.company_id == user.company_id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    
    data = body.model_dump(exclude_none=True)
    if "name" in data:
        data["slug"] = re.sub(r"[^a-z0-9\-]", "", data["name"].lower().replace(" ", "-"))
    
    for k, v in data.items():
        setattr(category, k, v)
        
    await db.commit()
    await db.refresh(category)
    await audit(db, user, "knowledge.category_updated", "knowledge_category", category_id, {"updated_fields": list(data.keys())})
    return category

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_admin)
):
    result = await db.execute(
        select(KnowledgeCategory).where(
            KnowledgeCategory.id == category_id,
            KnowledgeCategory.company_id == user.company_id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    
    await audit(db, user, "knowledge.category_deleted", "knowledge_category", category_id, {"name": category.name})
    await db.delete(category)
    await db.commit()
    return None
