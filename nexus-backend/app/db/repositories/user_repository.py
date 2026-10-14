"""
UserRepository — Data Access Layer for User, Company, UserProfile
=================================================================
Canonical location: app/db/repositories/user_repository.py

Merges the original implementation (auth/deps usage) with
the extended version (admin queries, pagination, company ops).

Uso:
    repo = UserRepository(db)
    user = await repo.get_by_email("foo@bar.com")
"""
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Company, UserProfile
from app.core.security import hash_password


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Lookups ───────────────────────────────────────────────────────────────

    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    # ── Company-scoped queries ─────────────────────────────────────────────────

    async def list_by_company(
        self,
        company_id: int,
        *,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> List[User]:
        q = select(User).where(User.company_id == company_id)
        if active_only:
            q = q.where(User.is_active == True)
        q = q.order_by(User.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def count_by_company(self, company_id: int) -> int:
        result = await self.db.execute(
            select(func.count(User.id)).where(User.company_id == company_id)
        )
        return result.scalar_one() or 0

    # ── Admin-only global queries ──────────────────────────────────────────────

    async def list_all(self, *, limit: int = 100, offset: int = 0) -> List[User]:
        """Admin only — lists all users in the system."""
        result = await self.db.execute(
            select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def count_all(self) -> int:
        result = await self.db.execute(select(func.count(User.id)))
        return result.scalar_one() or 0

    async def count_active(self) -> int:
        result = await self.db.execute(
            select(func.count(User.id)).where(User.is_active == True)
        )
        return result.scalar_one() or 0

    # ── Mutations ─────────────────────────────────────────────────────────────

    async def create(
        self, name: str, email: str, password: str, company_id: int, role: str = "operator"
    ) -> User:
        user = User(
            name=name,
            email=email.lower().strip(),
            password_hash=hash_password(password),
            company_id=company_id,
            role=role,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def set_active(self, user_id: int, active: bool) -> Optional[User]:
        user = await self.get_by_id(user_id)
        if user:
            user.is_active = active
            await self.db.flush()
        return user

    # ── Company ───────────────────────────────────────────────────────────────

    async def get_company(self, company_id: int) -> Optional[Company]:
        result = await self.db.execute(
            select(Company).where(Company.id == company_id)
        )
        return result.scalar_one_or_none()

    async def list_companies(self, *, limit: int = 100, offset: int = 0) -> List[Company]:
        result = await self.db.execute(
            select(Company).order_by(Company.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def count_companies(self) -> int:
        result = await self.db.execute(select(func.count(Company.id)))
        return result.scalar_one() or 0

    # ── Profile ───────────────────────────────────────────────────────────────

    async def get_profile(self, user_id: int) -> Optional[UserProfile]:
        result = await self.db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()
