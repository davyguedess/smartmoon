"""
AuditRepository — Data Access Layer for AuditLog and WebhookEvent
=================================================================
Canonical location: app/db/repositories/audit_repository.py

Uso:
    repo = AuditRepository(db)
    logs = await repo.list_recent(company_id=None, limit=100)
"""
from typing import Optional, List
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, WebhookEvent


class AuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── AuditLog ──────────────────────────────────────────────────────────────

    async def list_by_company(
        self,
        company_id: int,
        *,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        q = select(AuditLog).where(AuditLog.company_id == company_id)
        if action:
            q = q.where(AuditLog.action == action)
        q = q.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_recent(
        self,
        *,
        company_id: Optional[int] = None,
        user_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        """Admin: list audit logs, optionally filtered by company or user."""
        q = select(AuditLog)
        if company_id:
            q = q.where(AuditLog.company_id == company_id)
        if user_id:
            q = q.where(AuditLog.user_id == user_id)
        q = q.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def count_by_company(self, company_id: int) -> int:
        result = await self.db.execute(
            select(func.count(AuditLog.id)).where(AuditLog.company_id == company_id)
        )
        return result.scalar_one() or 0

    async def create(
        self,
        company_id: int,
        user_id: Optional[int],
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            company_id=company_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            metadata=metadata or {},
            ip_address=ip_address,
        )
        self.db.add(log)
        await self.db.flush()
        return log

    # ── WebhookEvent ──────────────────────────────────────────────────────────

    async def list_webhook_events(
        self,
        company_id: int,
        *,
        source: Optional[str] = None,
        limit: int = 50,
    ) -> List[WebhookEvent]:
        q = select(WebhookEvent).where(WebhookEvent.company_id == company_id)
        if source:
            q = q.where(WebhookEvent.source == source)
        q = q.order_by(desc(WebhookEvent.received_at)).limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_webhook_event(self, event_id: int) -> Optional[WebhookEvent]:
        result = await self.db.execute(
            select(WebhookEvent).where(WebhookEvent.id == event_id)
        )
        return result.scalar_one_or_none()
