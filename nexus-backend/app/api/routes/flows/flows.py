import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.db.repositories.flow_repository import FlowRepository
from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import FlowNotFound
from app.schemas.flow import FlowCreate, FlowUpdate, FlowOut, FlowListItem
from app.services.audit_service import audit

router = APIRouter(prefix="/flows", tags=["Flows"])


@router.get("", response_model=List[FlowListItem])
async def list_flows(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    from sqlalchemy import func
    from app.models import Execution
    repo = FlowRepository(db)
    flows = await repo.list_by_company(user.company_id)

    # Count executions per flow in a single query
    flow_ids = [f.id for f in flows]
    exec_counts: dict[int, int] = {}
    if flow_ids:
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT flow_id, COUNT(*) as cnt FROM executions WHERE flow_id = ANY(:ids) GROUP BY flow_id"),
            {"ids": flow_ids}
        )
        exec_counts = {row.flow_id: row.cnt for row in result}

    items = []
    for f in flows:
        nodes = 0
        if f.definition_json and isinstance(f.definition_json, dict):
            nodes = len(f.definition_json.get("nodes", []))
        items.append(FlowListItem(
            id=f.id,
            name=f.name,
            status=f.status,
            version=f.version,
            updated_at=f.updated_at,
            total_executions=exec_counts.get(f.id, 0),
            nodes_count=nodes,
        ))
    return items


@router.post("", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def create_flow(body: FlowCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = FlowRepository(db)
    flow = await repo.create(
        company_id=user.company_id,
        created_by=user.id,
        name=body.name,
        description=body.description,
        definition=body.definition_json,
    )
    await audit(db, user, "flow.created", "flow", flow.id, {"name": body.name})
    return flow


@router.get("/{flow_id}", response_model=FlowOut)
async def get_flow(flow_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = FlowRepository(db)
    flow = await repo.get_by_id(flow_id)
    if not flow or flow.company_id != user.company_id:
        raise FlowNotFound(flow_id)
    return flow


@router.put("/{flow_id}", response_model=FlowOut)
async def update_flow(flow_id: int, body: FlowUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = FlowRepository(db)
    flow = await repo.get_by_id(flow_id)
    if not flow or flow.company_id != user.company_id:
        raise FlowNotFound(flow_id)
    data = body.model_dump(exclude_none=True)
    updated = await repo.update(flow, data)
    await audit(db, user, "flow.updated", "flow", flow_id, {"fields": list(data.keys())})
    return updated


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(flow_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    repo = FlowRepository(db)
    flow = await repo.get_by_id(flow_id)
    if not flow or flow.company_id != user.company_id:
        raise FlowNotFound(flow_id)
    await audit(db, user, "flow.deleted", "flow", flow_id, {"name": flow.name})
    await repo.delete(flow)


@router.post("/{flow_id}/publish")
async def publish_flow(flow_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    """Publish a flow — creates an immutable snapshot of the current definition."""
    repo = FlowRepository(db)
    flow = await repo.get_by_id(flow_id)
    if not flow or flow.company_id != user.company_id:
        raise FlowNotFound(flow_id)

    # Immutable snapshot: freeze the current definition_json at publish time
    snapshot = {
        "definition": flow.definition_json,
        "name": flow.name,
        "description": flow.description,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "published_by": user.id,
        "version": (flow.version_int or 0) + 1,
    }

    update_data = {
        "status": "published",
        "published_snapshot_json": snapshot,
        "published_at": datetime.now(timezone.utc),
        "published_by": user.id,
        "version_int": (flow.version_int or 0) + 1,
    }
    await repo.update(flow, update_data)
    await audit(db, user, "flow.published", "flow", flow_id, {"version": snapshot["version"]})

    return {
        "message": f"Fluxo '{flow.name}' publicado com sucesso (v{snapshot['version']})",
        "version": snapshot["version"],
    }


@router.post("/{flow_id}/test")
async def test_flow(flow_id: int, payload: dict = {}, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    from app.workers.tasks import execute_flow_task
    from app.db.repositories.execution_repository import ExecutionRepository

    repo_flow = FlowRepository(db)
    flow = await repo_flow.get_by_id(flow_id)
    if not flow or flow.company_id != user.company_id:
        raise FlowNotFound(flow_id)

    repo_exec = ExecutionRepository(db)
    execution = await repo_exec.create(
        flow_id=flow_id,
        company_id=user.company_id,
        trigger_type="manual_test",
        input_payload=payload,
    )
    await db.commit()

    # Enqueue to Celery
    execute_flow_task.delay(execution.id)

    await audit(db, user, "execution.started", "execution", execution.id, {
        "flow_id": flow_id, "trigger": "manual_test"
    })

    return {"execution_id": execution.id, "status": "queued", "message": "Execução de teste iniciada"}
