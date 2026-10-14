"""
AgentRepository — Data Access Layer for AgentProfile and AgentCustomSkill
=========================================================================
Canonical location: app/db/repositories/agent_repository.py

Uso:
    repo = AgentRepository(db)
    agents = await repo.list_by_company(company_id)
"""
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentProfile, AgentCustomSkill


class AgentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── AgentProfile ──────────────────────────────────────────────────────────

    async def get_by_id(self, agent_id: int) -> Optional[AgentProfile]:
        result = await self.db.execute(
            select(AgentProfile).where(AgentProfile.id == agent_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, company_id: int, slug: str) -> Optional[AgentProfile]:
        result = await self.db.execute(
            select(AgentProfile).where(
                AgentProfile.company_id == company_id,
                AgentProfile.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_company(
        self, company_id: int, *, limit: int = 100, offset: int = 0
    ) -> List[AgentProfile]:
        result = await self.db.execute(
            select(AgentProfile)
            .where(AgentProfile.company_id == company_id)
            .order_by(AgentProfile.created_at.desc())
            .limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def list_all(self, *, limit: int = 100, offset: int = 0) -> List[AgentProfile]:
        """Admin only — all agents across all companies."""
        result = await self.db.execute(
            select(AgentProfile).order_by(AgentProfile.created_at.desc())
            .limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def count_by_company(self, company_id: int) -> int:
        result = await self.db.execute(
            select(func.count(AgentProfile.id)).where(AgentProfile.company_id == company_id)
        )
        return result.scalar_one() or 0

    async def count_all(self) -> int:
        result = await self.db.execute(select(func.count(AgentProfile.id)))
        return result.scalar_one() or 0

    async def create(self, **kwargs) -> AgentProfile:
        agent = AgentProfile(**kwargs)
        self.db.add(agent)
        await self.db.flush()
        return agent

    async def update(self, agent: AgentProfile, data: dict) -> AgentProfile:
        for key, value in data.items():
            setattr(agent, key, value)
        await self.db.flush()
        return agent

    async def delete(self, agent: AgentProfile) -> None:
        await self.db.delete(agent)

    # ── AgentCustomSkill ──────────────────────────────────────────────────────

    async def get_skill_by_id(self, skill_id: int) -> Optional[AgentCustomSkill]:
        result = await self.db.execute(
            select(AgentCustomSkill).where(AgentCustomSkill.id == skill_id)
        )
        return result.scalar_one_or_none()

    async def list_skills_by_company(self, company_id: int) -> List[AgentCustomSkill]:
        result = await self.db.execute(
            select(AgentCustomSkill)
            .where(AgentCustomSkill.company_id == company_id)
            .order_by(AgentCustomSkill.name)
        )
        return list(result.scalars().all())

    async def create_skill(self, **kwargs) -> AgentCustomSkill:
        skill = AgentCustomSkill(**kwargs)
        self.db.add(skill)
        await self.db.flush()
        return skill
