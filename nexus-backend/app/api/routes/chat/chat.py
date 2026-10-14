"""
NEXUS.IA — /chat routes (refactored)

Unified streaming endpoint using the AIClient abstraction.
Replaces 9 separate endpoints (707 lines) with 1 clean endpoint (~150 lines).

WHAT CHANGED:
  - All AI calls now go through AIClient — never raw httpx to providers
  - Cost tracking is automatic (AIClient → CostTracker → Redis + DB)
  - Quota check happens BEFORE any AI call
  - Memory context and persistence logic is unchanged
  - Voice synthesis (with_audio) is preserved as an optional post-step
  - /chat/complete for single-shot (used by flows/webhooks)

REMOVED:
  - /chat/ollama          → use /chat/stream?provider=ollama
  - /chat/ollama/stream   → use /chat/stream?provider=ollama
  - /chat/openai          → use /chat/stream?provider=openai
  - /chat/openai/stream   → use /chat/stream?provider=openai
  - /chat/gemini          → use /chat/stream?provider=gemini
  - /chat/gemini/stream   → use /chat/stream?provider=gemini
  - /chat/groq            → use /chat/stream?provider=groq
  - /chat/groq/stream     → use /chat/stream?provider=groq
  - /chat/claude/stream   → use /chat/stream?provider=claude
"""

import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models import AgentMemory
from app.services import billing_service, memory_service
from app.services.ai_client import AIClient, get_ai_client
from app.services.prompt_builder import get_prompt_builder

router = APIRouter(prefix="/chat", tags=["Chat"])


# ── Request models ─────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class UnifiedChatRequest(BaseModel):
    provider: str   # "openai" | "gemini" | "claude" | "groq" | "ollama"
    model: str
    messages: List[ChatMessage]
    system_prompt: Optional[str] = "Você é Lua, assistente virtual da Smart Moon — Lua Inteligente. Responda sempre em Português de forma clara e útil."
    session_id: Optional[str] = None
    agent_id: Optional[int] = None
    with_audio: Optional[bool] = False


# Backwards-compat alias (some frontend calls may still use the old field name)
class LegacyChatRequest(UnifiedChatRequest):
    provider: str = "ollama"


# ── SSE helpers ────────────────────────────────────────────────────────

def _sse(token: str) -> str:
    return f"data: {json.dumps({'token': token})}\n\n"

_SSE_DONE = "data: [DONE]\n\n"

def _sse_error(msg: str) -> str:
    return f"data: {json.dumps({'error': msg})}\n\n"

_STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# ── Memory helpers (unchanged from original) ────────────────────────────

async def _load_memory_context(
    db: AsyncSession,
    company_id: int,
    session_id: str,
    agent_id: Optional[int],
    max_tokens: int = 4000,
) -> List[dict]:
    """Load context from AgentMemory for this session."""
    try:
        return await memory_service.build_context(
            db, company_id, session_id,
            agent_id=agent_id, max_tokens=max_tokens,
        )
    except Exception as e:
        logger.warning(f"Memory context load failed (non-blocking): {e}")
        return []


async def _save_memory_turn(
    db: AsyncSession,
    company_id: int,
    user_id: int,
    session_id: str,
    agent_id: Optional[int],
    model: str,
    provider: str,
    user_message: str,
    assistant_reply: str,
) -> None:
    """Persist user + assistant turn in AgentMemory, then run governance."""
    try:
        db.add(AgentMemory(
            company_id=company_id, user_id=user_id, agent_id=agent_id,
            session_id=session_id, role="user", content=user_message,
            model=model, provider=provider, memory_type="message",
            memory_scope="session_only",
            token_count=memory_service._estimate_tokens(user_message),
        ))
        db.add(AgentMemory(
            company_id=company_id, user_id=user_id, agent_id=agent_id,
            session_id=session_id, role="assistant", content=assistant_reply,
            model=model, provider=provider, memory_type="message",
            memory_scope="session_only",
            token_count=memory_service._estimate_tokens(assistant_reply),
        ))
        await db.commit()

        # Fire-and-forget governance
        asyncio.create_task(
            memory_service.maybe_summarize(db, company_id, session_id, agent_id)
        )
        if agent_id:
            asyncio.create_task(
                memory_service.extract_facts(db, company_id, session_id, user_message, agent_id)
            )
    except Exception as e:
        logger.warning(f"Memory save failed (non-blocking): {e}")


def _build_messages(
    system_prompt: str,
    memory_context: List[dict],
    request_messages: List[ChatMessage],
    model: str = "gpt-4o-mini",
) -> List[dict]:
    """Merge system prompt + memory context + new messages (token-aware)."""
    builder = get_prompt_builder(model)
    req_dicts = [{"role": m.role, "content": m.content} for m in request_messages]
    return builder.build(
        system_prompt=system_prompt,
        memory_context=memory_context,
        request_messages=req_dicts,
    )


async def _generate_voice_response(
    company_id: int, agent_id: Optional[int], text: str
) -> Optional[str]:
    """Generate TTS audio if agent has a voice profile."""
    if not agent_id:
        return None
    try:
        from app.services.tts_service import tts_service
        result = await tts_service.synthesize(
            text, agent_id=agent_id, company_id=company_id
        )
        return result.get("file_path")
    except Exception as e:
        logger.warning(f"Voice generation failed (non-blocking): {e}")
        return None


# ── Primary endpoint: unified stream ──────────────────────────────────

@router.post("/stream")

async def unified_stream(
    request: Request,
    req: UnifiedChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    ai_client: AIClient = Depends(get_ai_client),
):
    """
    🔥 Main streaming endpoint for ALL AI providers.

    Replaces: /chat/ollama/stream, /chat/openai/stream, /chat/gemini/stream,
              /chat/groq/stream, /chat/claude/stream

    Flow:
      1. Quota check (billing_service)
      2. Load memory context (memory_service)
      3. Stream via AIClient (cost tracked automatically)
      4. Save memory turn (fire-and-forget governance)
      5. Optional: TTS voice synthesis
    """
    # 1. Quota gate
    allowed, reason = await billing_service.check_can_execute(user.company_id, db)
    if not allowed:
        raise HTTPException(status_code=429, detail=reason)

    # Validate provider early — returns 422 instead of 500
    from app.services.ai_client import AIClient as _AIClientClass
    if req.provider not in _AIClientClass.SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown provider '{req.provider}'. Supported: {list(_AIClientClass.SUPPORTED_PROVIDERS)}"
        )

    # 2. Memory context
    memory_context = []
    if req.session_id:
        memory_context = await _load_memory_context(
            db, user.company_id, req.session_id, req.agent_id
        )

    messages = _build_messages(
        req.system_prompt or "Você é Lua, assistente virtual da Smart Moon — Lua Inteligente. Responda sempre em Português de forma clara e útil.",
        memory_context,
        req.messages,
        model=req.model,
    )
    user_message = req.messages[-1].content if req.messages else ""

    async def generate():
        full_reply = ""
        try:
            async for chunk in ai_client.stream(
                provider=req.provider,
                model=req.model,
                messages=messages,
                company_id=user.company_id,
                user_id=user.id,
                session_id=req.session_id,
                db=db,
            ):
                if chunk.token:
                    full_reply += chunk.token
                    yield _sse(chunk.token)

        except Exception as exc:
            logger.error(f"Stream error [{req.provider}/{req.model}]: {exc}")
            yield _sse_error(f"Erro ao processar resposta: {exc}")
            yield _SSE_DONE
            return

        # 4. Persist memory
        if req.session_id and full_reply:
            await _save_memory_turn(
                db, user.company_id, user.id,
                req.session_id, req.agent_id,
                req.model, req.provider,
                user_message, full_reply,
            )

        # 5. Optional voice
        if req.with_audio and full_reply:
            audio_path = await _generate_voice_response(
                user.company_id, req.agent_id, full_reply
            )
            if audio_path:
                yield f"data: {json.dumps({'audio_url': f'/api/voice/v2/audio?path={audio_path}'})}\n\n"

        yield _SSE_DONE

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )


# ── Single-shot completion (for flows, webhooks, internal tasks) ────────

@router.post("/complete")

async def unified_complete(
    request: Request,
    req: UnifiedChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    ai_client: AIClient = Depends(get_ai_client),
):
    """
    Non-streaming completion endpoint.
    Used by: flow executor, webhook handlers, fact extraction.
    """
    allowed, reason = await billing_service.check_can_execute(user.company_id, db)
    if not allowed:
        raise HTTPException(status_code=429, detail=reason)

    # Validate provider early — returns 422 instead of 500
    from app.services.ai_client import AIClient as _AIClientClass
    if req.provider not in _AIClientClass.SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown provider '{req.provider}'. Supported: {list(_AIClientClass.SUPPORTED_PROVIDERS)}"
        )

    memory_context = []
    if req.session_id:
        memory_context = await _load_memory_context(
            db, user.company_id, req.session_id, req.agent_id
        )

    messages = _build_messages(
        req.system_prompt or "Você é Lua, assistente virtual da Smart Moon — Lua Inteligente. Responda sempre em Português de forma clara e útil.",
        memory_context,
        req.messages,
    )

    response = await ai_client.complete(
        provider=req.provider,
        model=req.model,
        messages=messages,
        company_id=user.company_id,
        user_id=user.id,
        db=db,
    )

    if req.session_id and response.content:
        user_message = req.messages[-1].content if req.messages else ""
        await _save_memory_turn(
            db, user.company_id, user.id,
            req.session_id, req.agent_id,
            req.model, req.provider,
            user_message, response.content,
        )

    return {
        "content": response.content,
        "model": response.model,
        "provider": response.provider,
        "tokens_in": response.tokens_in,
        "tokens_out": response.tokens_out,
        "finish_reason": response.finish_reason,
    }


# ── Backwards compatibility stubs ──────────────────────────────────────
# These redirect old frontend calls to the unified endpoint.
# Remove after frontend is fully migrated to /chat/stream.

@router.post("/ollama/stream")
async def _compat_ollama_stream(
    req: LegacyChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    ai_client: AIClient = Depends(get_ai_client),
):
    """[DEPRECATED] Use POST /chat/stream with provider='ollama'."""
    req.provider = "ollama"
    return await unified_stream(req, db, user, ai_client)


@router.post("/ollama")
async def _compat_ollama(
    req: LegacyChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    ai_client: AIClient = Depends(get_ai_client),
):
    """[DEPRECATED] Use POST /chat/complete with provider='ollama'."""
    req.provider = "ollama"
    return await unified_complete(req, db, user, ai_client)
