from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Flow


class FlowRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, flow_id: int) -> Optional[Flow]:
        result = await self.db.execute(select(Flow).where(Flow.id == flow_id))
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: int) -> List[Flow]:
        result = await self.db.execute(
            select(Flow)
            .where(Flow.company_id == company_id)
            .order_by(Flow.updated_at.desc())
        )
        return result.scalars().all()

    async def create(self, company_id: int, created_by: int, name: str, definition: dict, description: str = "") -> Flow:
        flow = Flow(
            company_id=company_id,
            created_by=created_by,
            name=name,
            description=description,
            definition_json=definition,
        )
        self.db.add(flow)
        await self.db.flush()
        return flow

    async def update(self, flow: Flow, data: dict) -> Flow:
        for key, value in data.items():
            setattr(flow, key, value)
        await self.db.flush()
        return flow

    async def delete(self, flow: Flow) -> None:
        await self.db.delete(flow)
