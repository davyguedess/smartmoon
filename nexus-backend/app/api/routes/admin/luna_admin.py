"""
Rotas de Admin para gerenciamento da base de conhecimento da Luna.
Acessível apenas para superadmins.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel
from typing import Optional, List
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import require_superadmin
from app.core.config import settings
from app.models.luna_knowledge import LunaKnowledge
from app.services.voice_service import VoiceService
import os

router = APIRouter(prefix="/admin/luna", tags=["Admin - Luna"])


# ── Schemas ──────────────────────────────────────────────────────────────────
class KnowledgeCreate(BaseModel):
    category:   str
    question:   str
    answer:     str
    sort_order: int = 0
    is_active:  bool = True
    tour_config: Optional[dict] = None

class KnowledgeUpdate(BaseModel):
    category:   Optional[str]   = None
    question:   Optional[str]   = None
    answer:     Optional[str]   = None
    sort_order: Optional[int]   = None
    is_active:  Optional[bool]  = None
    tour_config: Optional[dict] = None


# ── CRUD Endpoints ────────────────────────────────────────────────────────────
@router.get("/knowledge")
async def list_knowledge(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Lista toda a base de conhecimento da Luna."""
    q = select(LunaKnowledge).order_by(LunaKnowledge.category, LunaKnowledge.sort_order)
    if category:
        q = q.where(LunaKnowledge.category == category)
    result = await db.execute(q)
    items = result.scalars().all()
    return [i.to_dict() for i in items]


@router.post("/knowledge")
async def create_knowledge(
    body: KnowledgeCreate,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Cria um novo item de conhecimento para a Luna."""
    item = LunaKnowledge(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info(f"🌙 Luna Knowledge criado: [{item.category}] {item.question[:60]}")
    return item.to_dict()


@router.put("/knowledge/{item_id}")
async def update_knowledge(
    item_id: int,
    body: KnowledgeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Atualiza um item de conhecimento."""
    result = await db.execute(select(LunaKnowledge).where(LunaKnowledge.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    
    # Resetar áudio se pergunta ou resposta mudou
    if body.question or body.answer:
        item.audio_ready = False
        item.audio_path = None
    
    await db.commit()
    await db.refresh(item)
    return item.to_dict()


@router.delete("/knowledge/{item_id}")
async def delete_knowledge(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Remove um item de conhecimento."""
    await db.execute(delete(LunaKnowledge).where(LunaKnowledge.id == item_id))
    await db.commit()
    return {"ok": True}


# ── Geração de Áudio ──────────────────────────────────────────────────────────
@router.post("/knowledge/{item_id}/generate-audio")
async def generate_audio(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """
    Pré-gera o áudio TTS para um item de conhecimento.
    O áudio é salvo no storage e o path é salvo no banco de dados.
    """
    result = await db.execute(select(LunaKnowledge).where(LunaKnowledge.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Texto para o TTS (combina pergunta + resposta para contexto)
    tts_text = item.answer  # Apenas a resposta é narrada
    old_audio_path = item.audio_path  # Guardar path antigo para deletar depois
    
    voice_service = VoiceService(db)
    audio_result = await voice_service.generate_voice(
        text=tts_text,
        company_id=0,   # company_id=0 = áudios globais da plataforma
        voice_name="pf_dora",  # Voz feminina PT-BR (Kokoro)
        speed=1.0,
    )
    
    if audio_result.get("status") == "success":
        # Deletar áudio antigo SOMENTE após novo gerar com sucesso
        if old_audio_path and old_audio_path != audio_result["audio_path"]:
            old_fp = os.path.join(settings.TTS_STORAGE_PATH, old_audio_path)
            if os.path.exists(old_fp):
                os.remove(old_fp)
                logger.info(f"🗑️ Áudio antigo removido: {old_audio_path}")
        
        item.audio_path  = audio_result["audio_path"]
        item.audio_ready = True
        await db.commit()
        logger.info(f"🎵 Áudio gerado para Luna Knowledge #{item_id}: {audio_result['audio_path']}")
        return {
            "ok": True,
            "audio_path": audio_result["audio_path"],
            "cached": audio_result.get("cached", False),
        }
    else:
        raise HTTPException(status_code=500, detail=audio_result.get("message", "Erro ao gerar áudio"))


@router.post("/knowledge/generate-all")
async def generate_all_audio(
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Pré-gera áudio para todos os itens que ainda não têm áudio."""
    result = await db.execute(
        select(LunaKnowledge).where(LunaKnowledge.is_active == True, LunaKnowledge.audio_ready == False)
    )
    items = result.scalars().all()
    
    generated = 0
    failed = 0
    voice_service = VoiceService(db)
    
    for item in items:
        try:
            old_audio_path = item.audio_path
            
            audio_result = await voice_service.generate_voice(
                text=item.answer,
                company_id=0,
                voice_name="pf_dora",
                speed=1.0,
            )
            if audio_result.get("status") == "success":
                # Deletar antigo só após sucesso
                if old_audio_path and old_audio_path != audio_result["audio_path"]:
                    old_fp = os.path.join(settings.TTS_STORAGE_PATH, old_audio_path)
                    if os.path.exists(old_fp):
                        os.remove(old_fp)
                
                item.audio_path  = audio_result["audio_path"]
                item.audio_ready = True
                generated += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Erro ao gerar áudio para item #{item.id}: {e}")
            failed += 1
    
    await db.commit()
    return {"generated": generated, "failed": failed, "total": len(items)}


# ── Endpoint público para o frontend buscar conhecimento ──────────────────────
@router.get("/knowledge/public")
async def get_public_knowledge(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retorna itens ativos da base de conhecimento para o frontend."""
    q = select(LunaKnowledge).where(LunaKnowledge.is_active == True).order_by(
        LunaKnowledge.category, LunaKnowledge.sort_order
    )
    if category:
        q = q.where(LunaKnowledge.category == category)
    result = await db.execute(q)
    items = result.scalars().all()
    return [i.to_dict() for i in items]


# ── Chat Logs — Para análise de dúvidas dos usuários ──────────────────────────
@router.get("/chat-logs")
async def get_chat_logs(
    hours: int = 72,
    user_id: Optional[int] = None,
    module: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """Lista os logs de conversa dos usuários com a Luna."""
    from sqlalchemy import text as sql_text
    
    conditions = ["created_at >= NOW() - INTERVAL '1 hour' * :hours"]
    params = {"hours": hours, "limit": limit}
    
    if user_id:
        conditions.append("user_id = :user_id")
        params["user_id"] = user_id
    if module:
        conditions.append("module = :module")
        params["module"] = module
    if search:
        conditions.append("(user_message ILIKE :search OR luna_response ILIKE :search)")
        params["search"] = f"%{search}%"
    
    where = " AND ".join(conditions)
    
    result = await db.execute(sql_text(f"""
        SELECT id, user_id, company_id, user_name, module, user_message, luna_response, created_at
        FROM luna_chat_logs
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """), params)
    rows = result.fetchall()
    
    # Stats
    stats_result = await db.execute(sql_text("""
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT module) as modules_used
        FROM luna_chat_logs
        WHERE created_at >= NOW() - INTERVAL '1 hour' * :hours
    """), {"hours": hours})
    stats = stats_result.fetchone()
    
    # Top perguntas repetidas
    top_result = await db.execute(sql_text("""
        SELECT user_message, COUNT(*) as cnt
        FROM luna_chat_logs
        WHERE created_at >= NOW() - INTERVAL '1 hour' * :hours
        GROUP BY user_message
        HAVING COUNT(*) >= 2
        ORDER BY cnt DESC
        LIMIT 10
    """), {"hours": hours})
    top_questions = [{"question": r.user_message, "count": r.cnt} for r in top_result.fetchall()]
    
    return {
        "logs": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "company_id": r.company_id,
                "user_name": r.user_name,
                "module": r.module,
                "user_message": r.user_message,
                "luna_response": r.luna_response,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "stats": {
            "total": stats.total if stats else 0,
            "unique_users": stats.unique_users if stats else 0,
            "modules_used": stats.modules_used if stats else 0,
        },
        "top_questions": top_questions,
    }


@router.post("/chat-logs/{log_id}/promote")
async def promote_to_faq(
    log_id: int,
    category: str = "geral",
    db: AsyncSession = Depends(get_db),
    _admin = Depends(require_superadmin),
):
    """
    Promove uma dúvida de usuário para a base de conhecimento da Luna.
    O admin seleciona um log e ele vira um item de FAQ editável.
    """
    from sqlalchemy import text as sql_text
    
    result = await db.execute(sql_text(
        "SELECT user_message, luna_response FROM luna_chat_logs WHERE id = :id"
    ), {"id": log_id})
    log = result.fetchone()
    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado")
    
    # Criar item de conhecimento a partir do log
    item = LunaKnowledge(
        category=category,
        question=log.user_message,
        answer=log.luna_response or "Resposta pendente de revisão.",
        is_active=False,  # Começa inativo — admin revisa antes de publicar
        sort_order=99,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    logger.info(f"🌙 Log #{log_id} promovido para FAQ: [{category}] {log.user_message[:60]}")
    return {"ok": True, "knowledge_id": item.id, "message": "Dúvida promovida! Revise e ative no painel de conhecimento."}
