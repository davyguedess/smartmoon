"""
Agent Status API — Monitor and control agent online/offline state.
PROTEGIDO: Todas as rotas requerem autenticação e filtram por company_id.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from app.db.session import AsyncSessionLocal
from app.models import AgentProfile, Integration
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/agents", tags=["Agent Status"])


class StatusUpdate(BaseModel):
    status: str  # online, offline, busy, maintenance


class ConnectAgent(BaseModel):
    integration_id: int


@router.get("/status")
async def list_agent_statuses(user=Depends(get_current_user)):
    """List agents with current status — filtrado por company_id do user."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AgentProfile).where(AgentProfile.company_id == user.company_id)
        )
        agents = result.scalars().all()

    items = []
    for agent in agents:
        meta = agent.metadata_json or {}
        if isinstance(meta, str):
            meta = json.loads(meta)

        items.append({
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "status": meta.get("status", "offline"),
            "connected_channel": meta.get("connected_channel"),
            "connected_integration_id": meta.get("connected_integration_id"),
            "last_activity_at": meta.get("last_activity_at"),
        })

    return items


@router.patch("/{agent_id}/status")
async def update_agent_status(agent_id: int, req: StatusUpdate, user=Depends(get_current_user)):
    """Update agent status (online/offline/busy/maintenance)."""
    valid = {"online", "offline", "busy", "maintenance"}
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AgentProfile).where(
                AgentProfile.id == agent_id,
                AgentProfile.company_id == user.company_id,
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        meta = agent.metadata_json or {}
        if isinstance(meta, str):
            meta = json.loads(meta)

        meta["status"] = req.status
        meta["last_activity_at"] = datetime.now(timezone.utc).isoformat()
        agent.metadata_json = meta

        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(agent, "metadata_json")
        await db.commit()

    return {"message": f"Agent '{agent.name}' status → {req.status}", "status": req.status}


@router.patch("/{agent_id}/connect")
async def connect_agent_to_channel(agent_id: int, req: ConnectAgent, user=Depends(get_current_user)):
    """Bind an agent to a specific channel integration."""
    async with AsyncSessionLocal() as db:
        agent_result = await db.execute(
            select(AgentProfile).where(
                AgentProfile.id == agent_id,
                AgentProfile.company_id == user.company_id,
            )
        )
        agent = agent_result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        intg_result = await db.execute(
            select(Integration).where(
                Integration.id == req.integration_id,
                Integration.company_id == user.company_id,
            )
        )
        intg = intg_result.scalar_one_or_none()
        if not intg:
            raise HTTPException(status_code=404, detail="Integration not found")

        meta = agent.metadata_json or {}
        if isinstance(meta, str):
            meta = json.loads(meta)

        meta["connected_channel"] = intg.provider
        meta["connected_integration_id"] = intg.id
        meta["status"] = "online"
        meta["last_activity_at"] = datetime.now(timezone.utc).isoformat()
        agent.metadata_json = meta

        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(agent, "metadata_json")
        await db.commit()

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    return {
        "message": f"Agent '{agent.name}' connected to {intg.provider}",
        "channel": intg.provider,
        "integration_id": intg.id,
        "label": cfg.get("label", intg.provider),
    }


@router.patch("/{agent_id}/disconnect")
async def disconnect_agent(agent_id: int, user=Depends(get_current_user)):
    """Unbind agent from channel and set offline."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AgentProfile).where(
                AgentProfile.id == agent_id,
                AgentProfile.company_id == user.company_id,
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        meta = agent.metadata_json or {}
        if isinstance(meta, str):
            meta = json.loads(meta)

        meta["connected_channel"] = None
        meta["connected_integration_id"] = None
        meta["status"] = "offline"
        meta["last_activity_at"] = datetime.now(timezone.utc).isoformat()
        agent.metadata_json = meta

        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(agent, "metadata_json")
        await db.commit()

    return {"message": f"Agent '{agent.name}' disconnected and set offline"}


@router.get("/{agent_id}/metrics")
async def agent_metrics(agent_id: int, user=Depends(get_current_user)):
    """Basic metrics for an agent — filtrado por company_id."""
    from app.models.whatsapp_models import WhatsAppMessage
    from app.models.telegram_models import TelegramMessage
    from sqlalchemy import func

    async with AsyncSessionLocal() as db:
        # Verify agent belongs to user's company
        agent = await db.scalar(
            select(AgentProfile).where(
                AgentProfile.id == agent_id,
                AgentProfile.company_id == user.company_id,
            )
        )
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        wa_count = await db.scalar(
            select(func.count(WhatsAppMessage.id)).where(
                WhatsAppMessage.agent_id == agent_id,
                WhatsAppMessage.direction == "outbound",
            )
        ) or 0

        tg_count = 0
        try:
            tg_count = await db.scalar(
                select(func.count(TelegramMessage.id)).where(
                    TelegramMessage.agent_id == agent_id,
                    TelegramMessage.direction == "outbound",
                )
            ) or 0
        except Exception:
            pass

        wa_tokens = await db.execute(
            select(
                func.coalesce(func.sum(WhatsAppMessage.tokens_input), 0),
                func.coalesce(func.sum(WhatsAppMessage.tokens_output), 0),
            ).where(WhatsAppMessage.agent_id == agent_id)
        )
        wa_tok = wa_tokens.fetchone()

    return {
        "agent_id": agent_id,
        "messages_sent": {
            "whatsapp": wa_count,
            "telegram": tg_count,
            "total": wa_count + tg_count,
        },
        "tokens": {
            "input": wa_tok[0] if wa_tok else 0,
            "output": wa_tok[1] if wa_tok else 0,
        },
    }
