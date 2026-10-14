from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional
import os

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.services.luna_tutorial_service import LunaTutorialService
from pydantic import BaseModel
from loguru import logger

router = APIRouter(prefix="/luna", tags=["Luna IA"])


# ── Servir áudios pré-gerados da Luna ─────────────────────────────────────────
@router.get("/audio/{audio_path:path}")
async def get_luna_audio(audio_path: str):
    """Serve áudio TTS pré-gerado da Luna (público — áudios da base de conhecimento)."""
    safe_path = audio_path.replace("..", "").strip("/")
    full_path = os.path.join(settings.TTS_STORAGE_PATH, safe_path)
    
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Áudio não encontrado")
    
    media_type = "audio/wav" if full_path.endswith(".wav") else "audio/mpeg"
    return FileResponse(full_path, media_type=media_type, headers={
        "Cache-Control": "no-cache, no-store, must-revalidate",
    })

@router.get("/tutorial/{module_key}")
async def get_luna_tutorial(
    module_key: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retorna o tutorial completo de um módulo para a Luna explicar."""
    service = LunaTutorialService(db)
    result = await service.get_module_explanation(module_key, current_user.company_id)
    
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    
    return result

@router.get("/faq")
async def get_luna_faq(
    category: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna as dúvidas frequentes da base de conhecimento (luna_knowledge).
    Não hardcoded — dinâmico e gerenciável pelo admin.
    """
    try:
        if category:
            result = await db.execute(text(
                "SELECT id, category, question, answer, audio_path, audio_ready, tour_config "
                "FROM luna_knowledge WHERE is_active = true AND category = :cat "
                "ORDER BY sort_order"
            ), {"cat": category})
        else:
            result = await db.execute(text(
                "SELECT id, category, question, answer, audio_path, audio_ready, tour_config "
                "FROM luna_knowledge WHERE is_active = true "
                "ORDER BY category, sort_order"
            ))
        rows = result.fetchall()
        return [
            {
                "id": r.id,
                "category": r.category,
                "question": r.question,
                "answer": r.answer,
                "audio_path": r.audio_path,
                "audio_ready": r.audio_ready,
                "tour_config": r.tour_config,
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Erro ao buscar FAQ: {e}")
        from app.core.luna_data.tutorial_data import search_faq
        return search_faq(None)


# ── Histórico de chat do usuário (persistente) ────────────────────────────────
@router.get("/chat/history")
async def get_chat_history(
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna o histórico de chat da Luna para o usuário logado."""
    try:
        result = await db.execute(text(
            "SELECT id, module, user_message, luna_response, created_at "
            "FROM luna_chat_logs WHERE user_id = :uid "
            "ORDER BY created_at DESC LIMIT :lim"
        ), {"uid": current_user.id, "lim": limit})
        rows = result.fetchall()
        return {
            "messages": [
                {
                    "id": r.id,
                    "module": r.module,
                    "user_message": r.user_message,
                    "luna_response": r.luna_response,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in reversed(rows)  # oldest first
            ]
        }
    except Exception as e:
        logger.warning(f"Erro ao buscar histórico Luna: {e}")
        return {"messages": []}


class LunaChatRequest(BaseModel):
    message: str
    module: Optional[str] = None
    context: Optional[dict] = None

@router.post("/chat")
async def luna_chat_assistant(
    req: LunaChatRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Chat com a Luna — assistente inteligente que conhece TODA a plataforma.
    Histórico é salvo no banco e carregado automaticamente.
    """
    
    # Buscar conhecimento relevante da base para injetar no prompt (RAG)
    kb_context = ""
    try:
        search_term = f"%{req.message.lower()[:50]}%"
        kb_result = await db.execute(text(
            "SELECT question, answer FROM luna_knowledge "
            "WHERE is_active = true "
            "AND (category = :cat OR LOWER(question) LIKE :q OR LOWER(answer) LIKE :q) "
            "ORDER BY CASE WHEN category = :cat THEN 0 ELSE 1 END, sort_order "
            "LIMIT 8"
        ), {"cat": req.module or "dashboard", "q": search_term})
        kb_items = kb_result.fetchall()
        if kb_items:
            kb_context = "\n\n📚 BASE DE CONHECIMENTO (use estas informações para responder com precisão):\n"
            for item in kb_items:
                kb_context += f"\nP: {item.question}\nR: {item.answer}\n"
    except Exception as kb_err:
        logger.warning(f"KB context load error: {kb_err}")
    
    # Buscar últimas 5 mensagens do histórico para dar contexto conversacional
    chat_history_msgs = []
    try:
        hist_result = await db.execute(text(
            "SELECT user_message, luna_response FROM luna_chat_logs "
            "WHERE user_id = :uid ORDER BY created_at DESC LIMIT 5"
        ), {"uid": current_user.id})
        hist_rows = hist_result.fetchall()
        for r in reversed(hist_rows):
            chat_history_msgs.append({"role": "user", "content": r.user_message})
            if r.luna_response:
                chat_history_msgs.append({"role": "assistant", "content": r.luna_response})
    except Exception:
        pass
    
    # ── SYSTEM PROMPT COMPLETO DA LUNA ──────────────────────────────────────
    LUNA_PROMPT = f"""Você é a Luna, assistente inteligente oficial da plataforma Smart Moon.
Você conhece CADA detalhe de TODOS os módulos e funcionalidades da plataforma.
O usuário atual é: {current_user.name} (empresa ID {current_user.company_id}).
Ele está no módulo: {req.module or 'não especificado'}.

═══ REGRAS DE COMPORTAMENTO ═══
1. Responda SEMPRE em Português do Brasil, de forma clara, objetiva e amigável.
2. Máximo 3-4 parágrafos por resposta. Seja direta.
3. Quando possível, indique o CAMINHO na plataforma (ex: "Vá em Menu > Integrações > WhatsApp").
4. Use emojis com moderação para tornar agradável (🚀 💡 ✅ etc).
5. Se o usuário perguntar algo fora da plataforma, redirecione gentilmente:
   "Sou especialista na Smart Moon! Posso te ajudar com qualquer funcionalidade. O que precisa?"
6. Se não souber a resposta, diga: "Para essa dúvida específica, recomendo falar com nosso suporte."
7. USE A BASE DE CONHECIMENTO abaixo como fonte PRIORITÁRIA.

═══ MÓDULOS COMPLETOS DA PLATAFORMA ═══

📊 DASHBOARD
- Visão geral com métricas em tempo real: saldo, receita, cobranças
- Carteira digital com saldo disponível, recebidos e pendentes
- Ações rápidas: PIX Rápido, Cobrar, Sacar, Créditos SM, Gateway
- Cards de execuções, fluxos publicados, integrações ativas
- Gráfico de receita dos últimos 30 dias
- Caminho: Menu lateral > Dashboard

💬 CHAT IA
- Converse com modelos de IA: OpenAI GPT-4o, Google Gemini, Anthropic Claude, Groq, DeepSeek
- Cada empresa pode usar SUA PRÓPRIA API Key ou tokens SM da plataforma
- Sessões de conversa salvas com histórico completo
- Suporte a streaming em tempo real
- Troca de modelo a qualquer momento
- Voz desativável/ativável para respostas em áudio
- Caminho: Menu lateral > Chat IA

🔄 FLUXOS (Flow Builder)
- Editor visual drag-and-drop para criar automações
- Tipos de nós disponíveis: Trigger (WhatsApp, Telegram, Webhook, Agendado, Manual), Condição, IA (OpenAI, Gemini, Claude), Enviar WhatsApp, Enviar Email, Criar PIX, Delay, HTTP Request, Planilha
- Cada nó é configurável com campos específicos
- Execuções em tempo real com logs detalhados
- Fluxos podem ser vinculados a instâncias WhatsApp ou bots Telegram
- Caminho: Menu lateral > Fluxos

🤖 AGENTES IA
- Crie agentes personalizados com nome, personalidade e instruções
- Cada agente pode usar um modelo diferente (GPT-4, Gemini, Claude)
- Base de conhecimento própria por agente (arquivos, textos, URLs)
- Agentes podem ser vinculados a fluxos para responder automaticamente
- Memória de longo prazo por conversa
- Caminho: Menu lateral > Agentes IA

📱 INTEGRAÇÕES
- WhatsApp SmartMoon: motor próprio anti-ban, sem taxas por número, QR Code
- Telegram Bot: múltiplos bots, cada um com fluxo independente
- Google OAuth2: Gmail, Contacts, Calendar, Sheets (por empresa, isolado)
- Provedores de IA: OpenAI, Gemini, Claude, Groq (API Keys por empresa)
- ElevenLabs TTS: respostas em áudio com vozes realistas
- Whisper STT: transcrição de áudios recebidos
- Meta Ads: automação de campanhas Facebook/Instagram
- Google Drive, Notion, S3/R2, Pinecone, Redis
- Caminho: Menu lateral > Integrações

💰 PAGAMENTOS & FINANCEIRO
- Gateway de pagamento PIX integrado (EfiPay / MercadoPago)
- Criar cobranças PIX com QR Code automático
- Saques para conta bancária
- Extrato completo de transações
- Webhook de confirmação de pagamento
- Limite de crédito por empresa configurável pelo admin
- Caminho: Menu lateral > Dashboard (ações rápidas) ou Financeiro

🏛️ LICITAÇÕES (Radar)
- Busca inteligente de licitações públicas brasileiras (PNCP)
- Filtro por nicho, valor, estado, modalidade
- Alertas automáticos para novas licitações
- Download de editais em PDF
- IA analisa editais e extrai informações relevantes
- Caminho: Menu lateral > Licitações > Radar/Busca/Alertas/Nichos

🎨 MARKETING & STUDIO
- Studio: editor visual de posts para redes sociais
- Brand Kit: cores, fontes e identidade visual da marca
- Campanhas IG: publicação automatizada no Instagram
- Biblioteca de templates prontos
- Geração de legendas por IA
- Caminho: Menu lateral > Studio / Brand Kit / Campanhas IG

🎙️ VOZ
- Clonagem de voz com upload de amostras
- Text-to-Speech com vozes premium
- Voice Agents: agentes que respondem por áudio
- Múltiplos idiomas suportados
- Caminho: Menu lateral > Voz

💎 CRÉDITOS SM & IA STORE
- SM Tokens: moeda interna para funcionalidades premium
- IA Store: marketplace de modelos com preços por 1K tokens
- Compra de pacotes de tokens
- Cada modelo tem custo diferente em SM tokens
- Empresas com própria API Key usam sem gastar tokens
- Caminho: Menu lateral > Créditos / Store

⚙️ CONFIGURAÇÕES & PERFIL
- Perfil: nome, email, avatar, senha
- 2FA: autenticação em dois fatores via app autenticador
- Plano: visualização do plano atual e limites
- Caminho: Avatar no canto inferior esquerdo

🔐 SEGURANÇA
- Cada empresa tem credenciais 100% isoladas
- OAuth tokens salvos no banco por company_id
- API Keys criptografadas
- Rate limiting por rota
- Logs de auditoria de segurança
- 2FA opcional para todos os usuários

{kb_context}"""
    
    # Construir mensagens com histórico
    messages = chat_history_msgs.copy()
    messages.append({"role": "user", "content": req.message})
    
    response = None
    
    # 1. Tentar resposta via IA
    try:
        from app.services.ai_client import get_ai_client
        ai_client = get_ai_client()
        result = await ai_client.complete(
            provider="gemini",
            model="gemini-2.0-flash",
            messages=messages,
            system_prompt=LUNA_PROMPT,
            company_id=current_user.company_id,
            user_id=current_user.id,
            db=db,
            max_tokens=600,
        )
        response = result.content
    except Exception as e:
        logger.warning(f"Luna IA indisponível ({e}), usando base de conhecimento...")
    
    # 2. Fallback: buscar na base de conhecimento
    if not response:
        try:
            search_term = f"%{req.message.lower()}%"
            kb_result = await db.execute(text(
                "SELECT question, answer FROM luna_knowledge "
                "WHERE is_active = true "
                "AND (LOWER(question) LIKE :q OR LOWER(answer) LIKE :q) "
                "ORDER BY sort_order LIMIT 1"
            ), {"q": search_term})
            match = kb_result.fetchone()
            if match:
                response = f"📚 {match.answer}"
            else:
                if req.module:
                    cat_result = await db.execute(text(
                        "SELECT question, answer FROM luna_knowledge "
                        "WHERE is_active = true AND category = :cat "
                        "ORDER BY sort_order LIMIT 3"
                    ), {"cat": req.module})
                    items = cat_result.fetchall()
                    if items:
                        response = (
                            f"Olá {current_user.name}! 🌙 Encontrei informações sobre este módulo:\n\n"
                            + "\n\n".join([f"💡 **{i.question}**\n{i.answer}" for i in items])
                        )
        except Exception as e2:
            logger.warning(f"KB fallback error: {e2}")
    
    # 3. Fallback final
    if not response:
        response = (
            f"Olá {current_user.name}! 👋 Estou com dificuldade de conexão com minha IA agora, "
            "mas posso te ajudar pelos tutoriais! Clique em um dos módulos abaixo ou nas dúvidas "
            "frequentes para aprender sobre cada funcionalidade. 🌙"
        )
    
    # Salvar no banco (histórico persistente)
    try:
        await db.execute(text(
            "INSERT INTO luna_chat_logs (user_id, company_id, user_name, module, user_message, luna_response) "
            "VALUES (:uid, :cid, :uname, :module, :msg, :resp)"
        ), {
            "uid": current_user.id,
            "cid": current_user.company_id,
            "uname": current_user.name,
            "module": req.module,
            "msg": req.message,
            "resp": response,
        })
        await db.commit()
    except Exception as e:
        logger.warning(f"Erro ao logar chat Luna: {e}")
    
    return {"response": response}
