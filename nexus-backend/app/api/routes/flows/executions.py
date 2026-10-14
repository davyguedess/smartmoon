from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.db.repositories.execution_repository import ExecutionRepository
from app.core.dependencies import get_current_user
from app.core.exceptions import ExecutionNotFound
from app.schemas.execution import ExecutionOut, ExecutionListItem

router = APIRouter(prefix="/executions", tags=["Executions"])


@router.get("", response_model=List[ExecutionListItem])
async def list_executions(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    repo = ExecutionRepository(db)
    return await repo.list_by_company(user.company_id, limit=limit)


@router.get("/{exec_id}", response_model=ExecutionOut)
async def get_execution(exec_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = ExecutionRepository(db)
    execution = await repo.get_by_id(exec_id)
    if not execution or execution.company_id != user.company_id:
        raise ExecutionNotFound(exec_id)
    return execution


@router.get("/{exec_id}/logs", response_model=ExecutionOut)
async def get_execution_logs(exec_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Returns execution with all steps as logs."""
    repo = ExecutionRepository(db)
    execution = await repo.get_by_id(exec_id)
    if not execution or execution.company_id != user.company_id:
        raise ExecutionNotFound(exec_id)
    return execution


@router.post("/{exec_id}/cancel")
async def cancel_execution(exec_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = ExecutionRepository(db)
    execution = await repo.get_by_id(exec_id)
    if not execution or execution.company_id != user.company_id:
        raise ExecutionNotFound(exec_id)
    if execution.status not in ("queued", "running", "waiting"):
        raise HTTPException(status_code=400, detail=f"Execução não pode ser cancelada — status atual: {execution.status}")
    await repo.update_status(execution, "canceled")
    return {"message": "Execução cancelada"}
