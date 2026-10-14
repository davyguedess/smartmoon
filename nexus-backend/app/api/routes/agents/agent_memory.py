"""
NEXUS.IA — /agent routes
Agent memory management + agent profile CRUD.
Supports: scoped memory, auto-summarization, fact extraction, context building.
Training studio, skill catalog and skill bindings.
"""
import httpx
from loguru import logger
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.config import settings
from app.models import AgentMemory, AgentProfile, AgentCustomSkill, Integration
from app.services import memory_service
from app.services.audit_service import audit
from app.data.skills_catalog import get_catalog, get_skill

router = APIRouter(prefix="/agent", tags=["Agent"])



# ── Schemas ───────────────────────────────────────────

class MemoryMessageIn(BaseModel):
    session_id: str
    role: str          # user | assistant | system
    content: str
    model: Optional[str] = None
    provider: Optional[str] = None
    flow_id: Optional[int] = None
    token_count: Optional[int] = None
    agent_id: Optional[int] = None
    memory_scope: Optional[str] = "session_only"


class AgentProfileIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = "llama3.2"
    provider: Optional[str] = "ollama"
    temperature: Optional[str] = "0.7"
    memory_rules: Optional[dict] = None
    agent_type: Optional[str] = "general"
    sales_config: Optional[dict] = None


class AgentProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    temperature: Optional[str] = None
    memory_rules: Optional[dict] = None
    is_active: Optional[bool] = None
    agent_type: Optional[str] = None
    sales_config: Optional[dict] = None


# ══════════════════════════════════════════════════════
# AGENT PROFILES
# ══════════════════════════════════════════════════════

@router.get("/profiles")
async def list_profiles(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(
        select(AgentProfile)
        .where(AgentProfile.company_id == user.company_id)
        .order_by(AgentProfile.name)
    )
    profiles = result.scalars().all()
    return [
        {
            "id": p.id, "name": p.name, "slug": p.slug,
            "description": p.description, "model": p.model,
            "provider": p.provider, "is_active": p.is_active,
            "agent_type": getattr(p, 'agent_type', 'general') or 'general',
            "memory_rules": p.memory_rules,
            "sales_config": getattr(p, 'sales_config', None),
            "system_prompt": p.system_prompt,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in profiles
    ]


@router.post("/profiles", status_code=status.HTTP_201_CREATED)
async def create_profile(body: AgentProfileIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    profile = AgentProfile(
        company_id=user.company_id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        system_prompt=body.system_prompt,
        model=body.model,
        provider=body.provider,
        temperature=body.temperature,
        agent_type=body.agent_type or "general",
        sales_config=body.sales_config,
        memory_rules=body.memory_rules or {
            "retention_days": 90,
            "max_tokens_per_session": 8000,
            "auto_summarize_after": 20,
            "fact_extraction_enabled": True,
            "allowed_scopes": ["session_only", "user_private", "company_shared"],
        },
    )
    db.add(profile)
    await db.commit()
    await audit(db, user, "agent.profile_created", "agent_profile", profile.id, {"name": body.name})
    return {"id": profile.id, "message": f"Agente '{body.name}' criado"}


@router.put("/profiles/{profile_id}")
async def update_profile(
    profile_id: int,
    body: AgentProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    data = body.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(profile, key, value)
    await db.commit()
    await audit(db, user, "agent.profile_updated", "agent_profile", profile_id, {"fields": list(data.keys())})
    return {"message": f"Agente '{profile.name}' atualizado"}


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(profile_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")
    await audit(db, user, "agent.profile_deleted", "agent_profile", profile_id, {"name": profile.name})
    await db.delete(profile)
    await db.commit()


# ══════════════════════════════════════════════════════
# MEMORY MANAGEMENT
# ══════════════════════════════════════════════════════

@router.post("/memory")
async def add_memory(body: MemoryMessageIn, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Add a message to agent memory, optionally trigger fact extraction."""
    msg = AgentMemory(
        company_id=user.company_id,
        user_id=user.id,
        agent_id=body.agent_id,
        session_id=body.session_id,
        role=body.role,
        content=body.content,
        model=body.model,
        provider=body.provider,
        flow_id=body.flow_id,
        token_count=body.token_count or memory_service._estimate_tokens(body.content),
        memory_scope=body.memory_scope or "session_only",
        memory_type="message",
    )
    db.add(msg)
    await db.commit()

    # Auto fact extraction (non-blocking)
    try:
        if body.role == "user" and body.agent_id:
            await memory_service.extract_facts(
                db, user.company_id, body.session_id, body.content, body.agent_id
            )
    except Exception:
        pass  # Non-blocking

    # Auto summarization check
    try:
        await memory_service.maybe_summarize(
            db, user.company_id, body.session_id, body.agent_id
        )
    except Exception:
        pass

    return {"id": msg.id, "message": "Memória salva"}


@router.get("/memory/context/{session_id}")
async def get_context(
    session_id: str,
    agent_id: Optional[int] = None,
    max_tokens: int = Query(8000, le=16000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Build optimized context window for a session (facts → summaries → messages)."""
    context = await memory_service.build_context(
        db, user.company_id, session_id,
        agent_id=agent_id, user_id=user.id, max_tokens=max_tokens,
    )
    return {"session_id": session_id, "messages": context, "count": len(context)}


@router.get("/memory/{session_id}")
async def get_memory(
    session_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.company_id == user.company_id,
            AgentMemory.session_id == session_id,
        )
        .order_by(AgentMemory.created_at)
        .limit(limit)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id, "role": m.role, "content": m.content,
            "model": m.model, "provider": m.provider,
            "memory_type": m.memory_type, "memory_scope": m.memory_scope,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.get("/memory")
async def list_sessions(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns distinct session IDs with last message time + count."""
    result = await db.execute(
        select(
            AgentMemory.session_id,
            func.count(AgentMemory.id).label("message_count"),
            func.max(AgentMemory.created_at).label("last_activity"),
        )
        .where(AgentMemory.company_id == user.company_id)
        .group_by(AgentMemory.session_id)
        .order_by(func.max(AgentMemory.created_at).desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "session_id": r.session_id,
            "message_count": r.message_count,
            "last_activity": r.last_activity.isoformat() if r.last_activity else None,
        }
        for r in rows
    ]


@router.delete("/memory/{session_id}")
async def clear_session(session_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await db.execute(
        delete(AgentMemory).where(
            AgentMemory.company_id == user.company_id,
            AgentMemory.session_id == session_id,
        )
    )
    await db.commit()
    await audit(db, user, "agent.memory_cleared", "session", session_id)
    return {"message": f"Memória da sessão '{session_id}' limpa"}


@router.post("/memory/cleanup")
async def cleanup_expired_memories(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    """Admin endpoint to cleanup expired memories for the company."""
    count = await memory_service.cleanup_expired(db, user.company_id)
    return {"message": f"{count} memórias expiradas removidas"}


@router.get("/memory/{session_id}/export")
async def export_memory_jsonl(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Exports conversation as JSONL format compatible with Ollama/Llama fine-tuning."""
    result = await db.execute(
        select(AgentMemory)
        .where(
            AgentMemory.company_id == user.company_id,
            AgentMemory.session_id == session_id,
            AgentMemory.memory_type == "message",
        )
        .order_by(AgentMemory.created_at)
    )
    messages = result.scalars().all()

    pairs = []
    for i, m in enumerate(messages):
        if m.role == "user" and i + 1 < len(messages) and messages[i + 1].role == "assistant":
            pairs.append({"prompt": m.content, "response": messages[i + 1].content})

    return {
        "session_id": session_id,
        "total_pairs": len(pairs),
        "training_data": pairs,
        "format": "Use este JSON para criar um Modelfile Ollama customizado via POST /ollama/create-model",
    }


# ══════════════════════════════════════════════════════
# TRAINING STUDIO — POST /agent/profiles/{id}/train-chat
# ══════════════════════════════════════════════════════

class TrainChatMessage(BaseModel):
    role: str
    content: str

class TrainChatIn(BaseModel):
    messages: List[TrainChatMessage]

@router.post("/profiles/{profile_id}/train-chat")
async def train_chat(
    profile_id: int,
    body: TrainChatIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Send a message to the agent and get a response. Auto-saves to memory."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    # Build message list for Ollama
    ollama_messages = []
    if profile.system_prompt:
        ollama_messages.append({"role": "system", "content": profile.system_prompt})
    for m in body.messages:
        ollama_messages.append({"role": m.role, "content": m.content})

    # Call Ollama
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": profile.model or settings.OLLAMA_MODEL,
                    "stream": False,
                    "messages": ollama_messages,
                    "options": {"temperature": float(profile.temperature or 0.7)},
                },
            )
            resp.raise_for_status()
            assistant_content = resp.json()["message"]["content"]
    except Exception as e:
        raise HTTPException(502, f"Erro ao chamar LLM: {e}")

    # Save last user message + assistant response in memory
    session_id = f"train_{profile_id}_{user.id}"
    last_user = next((m for m in reversed(body.messages) if m.role == "user"), None)
    if last_user:
        db.add(AgentMemory(
            company_id=user.company_id, user_id=user.id, agent_id=profile_id,
            session_id=session_id, role="user", content=last_user.content,
            model=profile.model, provider=profile.provider, memory_type="message",
        ))
    db.add(AgentMemory(
        company_id=user.company_id, user_id=user.id, agent_id=profile_id,
        session_id=session_id, role="assistant", content=assistant_content,
        model=profile.model, provider=profile.provider, memory_type="message",
    ))
    await db.commit()

    return {"response": assistant_content, "session_id": session_id}


# ══════════════════════════════════════════════════════
# SKILL CATALOG — GET /agent/skills/catalog
# ══════════════════════════════════════════════════════

@router.get("/skills/catalog")
async def skill_catalog(user=Depends(get_current_user)):
    """Returns the full skill catalog."""
    return get_catalog()


# ══════════════════════════════════════════════════════
# SKILL BINDINGS — /agent/profiles/{id}/skills
# ══════════════════════════════════════════════════════

class SkillInstallIn(BaseModel):
    skill_id: str
    config_json: Optional[dict] = None

class SkillPatchIn(BaseModel):
    is_active: Optional[bool] = None
    config_json: Optional[dict] = None


@router.get("/profiles/{profile_id}/skills")
async def list_skills(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns skills installed on this agent (stored in memory_rules JSONB)."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    rules = profile.memory_rules or {}
    installed = rules.get("installed_skills", [])
    # Enrich with catalog metadata
    enriched = []
    for s in installed:
        meta = get_skill(s["skill_id"]) or {}
        enriched.append({
            **s,
            "name": meta.get("name", s["skill_id"]),
            "icon": meta.get("icon", "🔧"),
            "category": meta.get("category", "—"),
            "description": meta.get("description", ""),
        })
    return enriched


@router.post("/profiles/{profile_id}/skills", status_code=status.HTTP_201_CREATED)
async def install_skill(
    profile_id: int,
    body: SkillInstallIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Install a skill on this agent (stored in memory_rules JSONB)."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    skill_meta = get_skill(body.skill_id)
    if not skill_meta:
        raise HTTPException(400, f"Skill '{body.skill_id}' não encontrada no catálogo")

    rules = dict(profile.memory_rules or {})
    installed = list(rules.get("installed_skills", []))

    # Check duplicate
    if any(s["skill_id"] == body.skill_id for s in installed):
        raise HTTPException(409, "Skill já instalada neste agente")

    installed.append({
        "skill_id": body.skill_id,
        "is_active": True,
        "config_json": body.config_json or {},
        "installed_at": datetime.utcnow().isoformat(),
    })
    rules["installed_skills"] = installed
    profile.memory_rules = rules

    # Apply prompt_patch if present
    if skill_meta.get("prompt_patch") and profile.system_prompt:
        profile.system_prompt = profile.system_prompt.rstrip() + "\n\n" + skill_meta["prompt_patch"]

    await db.commit()
    await audit(db, user, "agent.skill_installed", "agent_profile", profile_id, {"skill_id": body.skill_id})
    return {"message": f"Skill '{skill_meta['name']}' instalada com sucesso"}


@router.patch("/profiles/{profile_id}/skills/{skill_id}")
async def toggle_skill(
    profile_id: int,
    skill_id: str,
    body: SkillPatchIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    rules = dict(profile.memory_rules or {})
    installed = list(rules.get("installed_skills", []))
    for s in installed:
        if s["skill_id"] == skill_id:
            if body.is_active is not None:
                s["is_active"] = body.is_active
            if body.config_json is not None:
                s["config_json"] = body.config_json
            break
    else:
        raise HTTPException(404, f"Skill '{skill_id}' não instalada")

    rules["installed_skills"] = installed
    profile.memory_rules = rules
    await db.commit()
    return {"message": "Skill atualizada"}


@router.delete("/profiles/{profile_id}/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_skill(
    profile_id: int,
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    rules = dict(profile.memory_rules or {})
    before = len(rules.get("installed_skills", []))
    rules["installed_skills"] = [s for s in rules.get("installed_skills", []) if s["skill_id"] != skill_id]
    if len(rules["installed_skills"]) == before:
        raise HTTPException(404, f"Skill '{skill_id}' não encontrada")

    profile.memory_rules = rules
    await db.commit()
    await audit(db, user, "agent.skill_removed", "agent_profile", profile_id, {"skill_id": skill_id})


# ══════════════════════════════════════════════════════
# TELEGRAM BOTS PER AGENT — /agent/profiles/{id}/telegram
# ══════════════════════════════════════════════════════

class TelegramBotIn(BaseModel):
    bot_token: str
    label: Optional[str] = None   # friendly name, e.g. "Atendimento"


@router.get("/profiles/{profile_id}/telegram")
async def list_agent_telegram_bots(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List Telegram bots linked to this agent (via Integration table)."""
    result = await db.execute(
        select(Integration).where(
            Integration.company_id == user.company_id,
            Integration.provider == "telegram",
            Integration.config_json["agent_id"].astext == str(profile_id),
        )
    )
    integrations = result.scalars().all()
    return [
        {
            "id": i.id,
            "label": (i.config_json or {}).get("label", "Bot Telegram"),
            "bot_token_preview": ((i.config_json or {}).get("bot_token", "")[:10] + "…"),
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in integrations
    ]


@router.post("/profiles/{profile_id}/telegram", status_code=201)
async def link_telegram_bot(
    profile_id: int,
    body: TelegramBotIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Link a Telegram bot to this agent via its bot token."""
    import httpx as _httpx
    # Validate token via Telegram getMe
    bot_info = {}
    try:
        async with _httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://api.telegram.org/bot{body.bot_token}/getMe")
            r.raise_for_status()
            bot_info = r.json().get("result", {})
    except Exception as e:
        raise HTTPException(400, f"Token Telegram inválido: {e}")

    # Create integration entry
    integration = Integration(
        company_id=user.company_id,
        provider="telegram",
        status="connected",
        config_json={
            "bot_token": body.bot_token,
            "agent_id": profile_id,
            "label": body.label or bot_info.get("username", "Telegram Bot"),
            "username": bot_info.get("username"),
            "bot_id": bot_info.get("id"),
        },
    )
    db.add(integration)
    await db.commit()

    # Auto-register Telegram webhook if WEBHOOK_BASE_URL is set
    try:
        _base = getattr(settings, "WEBHOOK_BASE_URL", None) or ""
        if _base:
            _wh_url = f"{_base.rstrip('/')}/webhook/telegram/receive"
            async with _httpx.AsyncClient(timeout=5) as _wh_client:
                await _wh_client.post(
                    f"https://api.telegram.org/bot{body.bot_token}/setWebhook",
                    json={"url": _wh_url},
                )
    except Exception as _wh_err:
        logger.warning(f"Auto-webhook registration failed (non-critical): {_wh_err}")

    await audit(db, user, "agent.telegram_bot_linked", "agent_profile", profile_id,
                {"bot_username": bot_info.get("username")})
    return {
        "message": f"Bot @{bot_info.get('username')} vinculado com sucesso",
        "bot_username": bot_info.get("username"),
        "bot_name": bot_info.get("first_name"),
        "integration_id": integration.id,
    }


@router.post("/profiles/{profile_id}/telegram/test")
async def test_telegram_token(
    profile_id: int,
    body: TelegramBotIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Test a Telegram bot token — returns bot info if valid."""
    import httpx as _httpx
    try:
        async with _httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://api.telegram.org/bot{body.bot_token}/getMe")
            r.raise_for_status()
            result = r.json().get("result", {})
            return {
                "ok": True,
                "username": result.get("username"),
                "first_name": result.get("first_name"),
                "bot_id": result.get("id"),
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.delete("/profiles/{profile_id}/telegram/{integration_id}", status_code=204)
async def unlink_telegram_bot(
    profile_id: int,
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Remove a Telegram bot linked to this agent."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.company_id == user.company_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integração não encontrada")
    await db.delete(integration)
    await db.commit()


# ══════════════════════════════════════════════════════
# CUSTOM SKILLS CRUD — /agent/skills/custom
# ══════════════════════════════════════════════════════

class CustomSkillIn(BaseModel):
    name: str
    icon: Optional[str] = "🔧"
    category: Optional[str] = "Custom"
    description: Optional[str] = None
    prompt_patch: Optional[str] = None


class CustomSkillUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    prompt_patch: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/skills/custom")
async def list_custom_skills(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all custom skills for the current company."""
    result = await db.execute(
        select(AgentCustomSkill)
        .where(AgentCustomSkill.company_id == user.company_id)
        .order_by(AgentCustomSkill.created_at.desc())
    )
    skills = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "slug": s.slug,
            "icon": s.icon,
            "category": s.category,
            "description": s.description,
            "prompt_patch": s.prompt_patch,
            "is_active": s.is_active,
            "is_custom": True,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in skills
    ]


@router.post("/skills/custom", status_code=201)
async def create_custom_skill(
    body: CustomSkillIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    """Create a new custom skill for this company."""
    import re
    slug = re.sub(r"[^a-z0-9\-]", "", body.name.lower().replace(" ", "-"))
    skill = AgentCustomSkill(
        company_id=user.company_id,
        name=body.name,
        slug=f"custom_{slug}",
        icon=body.icon or "🔧",
        category=body.category or "Custom",
        description=body.description,
        prompt_patch=body.prompt_patch,
    )
    db.add(skill)
    await db.commit()
    await audit(db, user, "agent.custom_skill_created", "agent_custom_skill", skill.id, {"name": body.name})
    return {"id": skill.id, "slug": skill.slug, "message": f"Skill '{body.name}' criada"}


@router.put("/skills/custom/{skill_id}")
async def update_custom_skill(
    skill_id: int,
    body: CustomSkillUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    result = await db.execute(
        select(AgentCustomSkill).where(
            AgentCustomSkill.id == skill_id,
            AgentCustomSkill.company_id == user.company_id,
        )
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill não encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(skill, k, v)
    await db.commit()
    return {"message": "Skill atualizada"}


@router.delete("/skills/custom/{skill_id}", status_code=204)
async def delete_custom_skill(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    result = await db.execute(
        select(AgentCustomSkill).where(
            AgentCustomSkill.id == skill_id,
            AgentCustomSkill.company_id == user.company_id,
        )
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill não encontrada")
    await db.delete(skill)
    await db.commit()


# ══════════════════════════════════════════════════════
# SALES AGENT CONFIG — /agent/profiles/{id}/sales-config
# ══════════════════════════════════════════════════════

class SalesConfigIn(BaseModel):
    identity: Optional[dict] = None
    products: Optional[list] = None
    team: Optional[list] = None
    behavior_rules: Optional[dict] = None
    faqs: Optional[list] = None
    business: Optional[dict] = None
    training_notes: Optional[str] = None


@router.get("/profiles/{profile_id}/sales-config")
async def get_sales_config(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get the structured sales configuration for an agent."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")
    return {
        "agent_id": profile.id,
        "agent_name": profile.name,
        "agent_type": getattr(profile, 'agent_type', 'general'),
        "sales_config": getattr(profile, 'sales_config', None) or {},
        "system_prompt": profile.system_prompt,
    }


@router.put("/profiles/{profile_id}/sales-config")
async def save_sales_config(
    profile_id: int,
    body: SalesConfigIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Save the structured sales configuration and auto-generate system prompt."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    config = body.dict(exclude_none=False)
    profile.sales_config = config
    profile.agent_type = "sales"

    # Auto-generate system prompt from config
    prompt = _build_sales_prompt(config, profile.name)
    profile.system_prompt = prompt

    await db.commit()
    await audit(db, user, "agent.sales_config_saved", "agent_profile", profile_id, {"sections": list(config.keys())})
    return {
        "message": "Configuração de vendas salva e prompt gerado",
        "system_prompt": prompt,
    }


@router.post("/profiles/{profile_id}/build-prompt")
async def build_sales_prompt(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Rebuild the system prompt from the current sales_config."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    config = getattr(profile, 'sales_config', None) or {}
    prompt = _build_sales_prompt(config, profile.name)
    profile.system_prompt = prompt
    await db.commit()
    return {"system_prompt": prompt}


@router.post("/profiles/{profile_id}/niche-intelligence")
async def niche_intelligence(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Use AI to generate niche insights, content ideas, and Instagram strategy
    based on the agent's sales_config business/niche information."""
    result = await db.execute(
        select(AgentProfile).where(
            AgentProfile.id == profile_id,
            AgentProfile.company_id == user.company_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Agente não encontrado")

    config = getattr(profile, 'sales_config', None) or {}
    business = config.get("business", {})
    identity = config.get("identity", {})
    products = config.get("products", [])

    niche = business.get("niche", "negócio geral")
    company_name = business.get("company_name", profile.name)
    social = business.get("social_media", {})
    ig_handle = social.get("instagram", "")

    product_list = ", ".join([p.get("name", "") for p in products[:10]]) if products else "não especificados"

    ai_prompt = f"""Você é um estrategista de marketing digital expert em Instagram e vendas.
Analise o seguinte negócio e gere insights estratégicos completos:

NEGÓCIO: {company_name}
NICHO: {niche}
PRODUTOS/SERVIÇOS: {product_list}
INSTAGRAM: {ig_handle or 'não informado'}
TOM DE VOZ: {identity.get('tone', 'profissional')}

Gere a resposta em JSON com esta estrutura exata:
{{
  "niche_analysis": "análise do nicho de mercado (2-3 parágrafos)",
  "target_audience": ["persona 1", "persona 2", "persona 3"],
  "content_pillars": [
    {{"pillar": "nome do pilar", "description": "descrição", "post_ideas": ["ideia1", "ideia2", "ideia3"]}}
  ],
  "hashtag_groups": [
    {{"group_name": "nome", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]}}
  ],
  "content_calendar": [
    {{"day": "Segunda", "type": "tipo de post", "idea": "ideia de conteúdo", "caption_example": "exemplo de legenda"}}
  ],
  "bio_suggestion": "sugestão de bio para Instagram",
  "competitors_strategy": "estratégias comuns dos concorrentes neste nicho",
  "sales_hooks": ["gancho de venda 1", "gancho de venda 2", "gancho de venda 3"]
}}

Responda APENAS com o JSON, sem texto adicional."""

    # Call LLM
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            # Try Gemini first if available
            gemini_key = getattr(settings, 'GEMINI_API_KEY', None)
            if gemini_key:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                    json={"contents": [{"parts": [{"text": ai_prompt}]}],
                          "generationConfig": {"temperature": 0.8, "maxOutputTokens": 4000}},
                )
                resp.raise_for_status()
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            else:
                # Fallback to Ollama
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": profile.model or settings.OLLAMA_MODEL,
                        "stream": False,
                        "messages": [{"role": "user", "content": ai_prompt}],
                        "options": {"temperature": 0.8},
                    },
                )
                resp.raise_for_status()
                text = resp.json()["message"]["content"]

        # Try to parse JSON from response
        import json as _json
        # Strip possible markdown code fences
        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        insights = _json.loads(clean)

        # Save insights in sales_config
        config["niche_insights"] = insights
        profile.sales_config = config
        await db.commit()

        return {"insights": insights, "saved": True}

    except _json.JSONDecodeError:
        return {"insights_raw": text, "saved": False, "note": "A IA retornou texto não-JSON. Insights salvos como texto."}
    except Exception as e:
        logger.error(f"Niche intelligence error: {e}")
        raise HTTPException(502, f"Erro ao consultar IA: {str(e)}")


def _build_sales_prompt(config: dict, agent_name: str) -> str:
    """Build a complete system prompt from structured sales config."""
    parts = []

    # Identity
    identity = config.get("identity", {})
    display = identity.get("display_name", agent_name)
    greeting = identity.get("greeting", "")
    tone_map = {
        "profissional": "Profissional e objetivo",
        "amigavel": "Amigável e acolhedor",
        "profissional_amigavel": "Profissional mas acolhedor",
        "formal": "Formal e respeitoso",
        "descontraido": "Descontraído e divertido",
    }
    tone = tone_map.get(identity.get("tone", ""), identity.get("tone", "Profissional"))
    lang = identity.get("language", "pt-BR")

    parts.append(f"Você é {display}, assistente virtual de vendas.")
    if greeting:
        parts.append(f"SAUDAÇÃO PADRÃO: \"{greeting}\"")
    parts.append(f"SEU TOM: {tone}. Idioma: {lang}.")

    # Business
    business = config.get("business", {})
    if business.get("company_name"):
        parts.append(f"\nEMPRESA: {business['company_name']}")
    if business.get("niche"):
        parts.append(f"NICHO: {business['niche']}")
    if business.get("website"):
        parts.append(f"SITE: {business['website']}")
    social = business.get("social_media", {})
    social_parts = []
    for plat, handle in social.items():
        if handle:
            social_parts.append(f"{plat.capitalize()}: {handle}")
    if social_parts:
        parts.append(f"REDES SOCIAIS: {' | '.join(social_parts)}")

    # Products
    products = config.get("products", [])
    if products:
        parts.append("\nPRODUTOS/SERVIÇOS QUE VOCÊ OFERECE:")
        for p in products:
            line = f"- {p.get('name', '?')}"
            if p.get("price"):
                line += f" (R$ {p['price']})"
            if p.get("description"):
                line += f" — {p['description']}"
            if p.get("link"):
                line += f" [Link: {p['link']}]"
            parts.append(line)

    # Team
    team = config.get("team", [])
    if team:
        parts.append("\nEQUIPE DE REFERÊNCIA:")
        for t in team:
            line = f"- {t.get('name', '?')} ({t.get('role', '?')})"
            if t.get("phone"):
                line += f" — Tel: {t['phone']}"
            if t.get("email"):
                line += f" — Email: {t['email']}"
            parts.append(line)

    # Behavior Rules
    rules = config.get("behavior_rules", {})
    allowed = rules.get("allowed", [])
    forbidden = rules.get("forbidden", [])
    escalation = rules.get("escalation_triggers", [])
    if allowed or forbidden or escalation:
        parts.append("\nREGRAS DE COMPORTAMENTO:")
        for a in allowed:
            parts.append(f"✅ {a}")
        for f in forbidden:
            parts.append(f"❌ NUNCA: {f}")
        for e in escalation:
            parts.append(f"⚠️ ESCALAR: {e}")

    # FAQs
    faqs = config.get("faqs", [])
    if faqs:
        parts.append("\nPERGUNTAS FREQUENTES:")
        for faq in faqs:
            parts.append(f"P: {faq.get('question', '?')}")
            parts.append(f"R: {faq.get('answer', '?')}")
            parts.append("")

    # Training notes
    notes = config.get("training_notes", "")
    if notes:
        parts.append(f"\nOBSERVAÇÕES ADICIONAIS:\n{notes}")

    return "\n".join(parts)
