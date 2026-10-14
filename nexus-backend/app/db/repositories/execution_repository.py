from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Execution, ExecutionStep


class ExecutionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, exec_id: int) -> Optional[Execution]:
        result = await self.db.execute(
            select(Execution)
            .options(selectinload(Execution.steps))
            .where(Execution.id == exec_id)
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: int, limit: int = 50) -> List[Execution]:
        result = await self.db.execute(
            select(Execution)
            .where(Execution.company_id == company_id)
            .order_by(Execution.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def create(self, flow_id: int, company_id: int, trigger_type: str, input_payload: dict) -> Execution:
        execution = Execution(
            flow_id=flow_id,
            company_id=company_id,
            trigger_type=trigger_type,
            input_payload=input_payload,
            status="queued",
        )
        self.db.add(execution)
        await self.db.flush()
        return execution

    async def update_status(self, execution: Execution, status: str, **kwargs) -> Execution:
        execution.status = status
        for key, value in kwargs.items():
            setattr(execution, key, value)
        if status in ("success", "failed", "canceled"):
            execution.finished_at = datetime.now(timezone.utc)
        await self.db.flush()
        return execution

    async def add_step(self, execution_id: int, node_id: str, node_type: str,
                       status: str, input_data: dict, output_data: dict,
                       error: dict = None, duration_ms: int = None) -> ExecutionStep:
        step = ExecutionStep(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            status=status,
            input_json=input_data,
            output_json=output_data,
            error_json=error,
            duration_ms=duration_ms,
            finished_at=datetime.now(timezone.utc),
        )
        self.db.add(step)
        await self.db.flush()
        return step

    async def find_waiting_by_event(self, event_name: str) -> List[Execution]:
        """Find executions in 'waiting' status that are waiting for a specific event."""
        result = await self.db.execute(
            select(Execution).where(
                Execution.status == "waiting",
                Execution.context_json["waiting_for"].astext == event_name,
            )
        )
        return result.scalars().all()
