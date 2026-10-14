"""
NEXUS.IA — /ollama routes
Ollama status, context injection, and custom model creation.
This is the path toward replacing cloud AI agents with local models.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.config import settings
from app.models import AgentMemory, Flow
from app.utils.resilience import get_timeout
from app.utils.masks import mask_error

router = APIRouter(prefix="/ollama", tags=["Ollama"])

OLLAMA_URL = settings.OLLAMA_BASE_URL


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def ollama_status(user=Depends(get_current_user)):
    """Returns available models, loaded models, and version."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            tags_resp = await client.get(f"{OLLAMA_URL}/api/tags")
            ps_resp = await client.get(f"{OLLAMA_URL}/api/ps")
            version_resp = await client.get(f"{OLLAMA_URL}/api/version")

            models = tags_resp.json().get("models", []) if tags_resp.status_code == 200 else []
            loaded = ps_resp.json().get("models", []) if ps_resp.status_code == 200 else []
            version = version_resp.json().get("version", "unknown") if version_resp.status_code == 200 else "unknown"

        return {
            "online": True,
            "version": version,
            "models_available": len(models),
            "models": [{"name": m["name"], "size_gb": round(m.get("size", 0) / 1e9, 2)} for m in models],
            "loaded_models": [
                {
                    "name": m.get("name"),
                    "size_vram": m.get("size_vram", 0),
                    "expires_at": m.get("expires_at"),
                }
                for m in loaded
            ],
        }
    except Exception as e:
        return {"online": False, "error": str(e)}


# ── Chat with DB memory ───────────────────────────────────────────────────────

class OllamaChatIn(BaseModel):
    session_id: str
    message: str
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    max_history: int = 20


@router.post("/chat")
async def ollama_chat_with_memory(
    body: OllamaChatIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Chat with Ollama using persistent DB memory — agent gets smarter over time."""
    model = body.model or settings.OLLAMA_MODEL

    # Load conversation history
    result = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.company_id == user.company_id,
            AgentMemory.session_id == body.session_id,
        )
        .order_by(AgentMemory.created_at.desc())
        .limit(body.max_history)
    )
    history = list(reversed(result.scalars().all()))

    # Build dynamic system prompt with company context
    system = body.system_prompt or (
        f"Você é o agente inteligente da Smart Moon para a empresa ID {user.company_id}. "
        "Você tem acesso ao histórico completo de conversas e contexto dos fluxos. "
        "Responda sempre em Português de forma objetiva e profissional."
    )

    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": body.message})

    # Save user message to memory
    user_msg = AgentMemory(
        company_id=user.company_id,
        user_id=user.id,
        session_id=body.session_id,
        role="user",
        content=body.message,
        model=model,
        provider="ollama",
    )
    db.add(user_msg)

    # Call Ollama
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False, "keep_alive": -1},
            )
            resp.raise_for_status()
            reply = resp.json().get("message", {}).get("content", "")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama indisponível: {mask_error(e)}")

    # Save assistant reply to memory
    ai_msg = AgentMemory(
        company_id=user.company_id,
        user_id=None,
        session_id=body.session_id,
        role="assistant",
        content=reply,
        model=model,
        provider="ollama",
    )
    db.add(ai_msg)
    await db.commit()

    return {
        "reply": reply,
        "model": model,
        "session_id": body.session_id,
        "history_used": len(history),
    }


# ── Inject company context into agent system prompt ──────────────────────────

@router.get("/context/{session_id}")
async def get_agent_context(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns the current system context the agent would use for this company."""
    # Summarize active flows
    flows_result = await db.execute(
        select(Flow).where(
            Flow.company_id == user.company_id,
            Flow.status == "published",
        ).limit(20)
    )
    flows = flows_result.scalars().all()

    # Count memory messages
    mem_result = await db.execute(
        select(AgentMemory).where(
            AgentMemory.company_id == user.company_id,
            AgentMemory.session_id == session_id,
        )
    )
    history = mem_result.scalars().all()

    return {
        "company_id": user.company_id,
        "session_id": session_id,
        "active_flows": [{"id": f.id, "name": f.name} for f in flows],
        "memory_messages": len(history),
        "training_ready": len(history) >= 10,
        "estimated_tokens": sum(len(m.content.split()) * 1.3 for m in history),
    }


# ── Create custom Ollama model from conversation data ────────────────────────

class CreateModelIn(BaseModel):
    model_config = {"protected_namespaces": ()}   # allow model_ prefix fields

    base_model: str = "llama3.2"
    model_name: str
    system_prompt: str
    session_ids: Optional[List[str]] = None


@router.post("/create-model")
async def create_custom_model(
    body: CreateModelIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    """Creates a custom Ollama model via Modelfile with company-specific system prompt."""
    modelfile = f"""FROM {body.base_model}
SYSTEM \"\"\"{body.system_prompt}\"\"\"
PARAMETER temperature 0.7
PARAMETER top_k 40
PARAMETER top_p 0.9
"""

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/create",
                json={"name": body.model_name, "modelfile": modelfile, "stream": False},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Ollama create failed: {resp.text}")

        return {
            "model_name": body.model_name,
            "base": body.base_model,
            "message": f"Modelo '{body.model_name}' criado com sucesso no Ollama",
            "next_step": f"Use 'ollama run {body.model_name}' para testar, ou selecione no Chat.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
