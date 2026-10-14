from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger
import json

from app.models.telegram_models import TelegramConversation, TelegramMessage, TelegramConversationState, TelegramTopic
from app.services.memory_service import _llm_summarize, _llm_extract_facts

async def process_conversation_intelligence(db: AsyncSession, conversation_id: int):
    """
    Generate summary, extract facts and classify topics for a telegram conversation.
    """
    # 1. Load conversation and messages
    result = await db.execute(
        select(TelegramConversation).where(TelegramConversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        logger.error(f"Conversation {conversation_id} not found for intelligence processing")
        return None

    msg_result = await db.execute(
        select(TelegramMessage)
        .where(TelegramMessage.conversation_id == conversation_id)
        .order_by(TelegramMessage.created_at.asc())
    )
    messages = msg_result.scalars().all()
    
    if not messages:
        return None

    # Build conversation text
    conversation_text = "\n".join([
        f"{'Usuário' if m.direction == 'inbound' else 'IA'}: {m.content_text or ''}" 
        for m in messages
    ])

    # 2. Get or create state
    state_result = await db.execute(
        select(TelegramConversationState).where(TelegramConversationState.conversation_id == conversation_id)
    )
    state = state_result.scalar_one_or_none()
    
    if not state:
        state = TelegramConversationState(conversation_id=conversation_id)
        db.add(state)

    # 3. Process with LLM (Ollama)
    try:
        # Generate Summary
        summary = await _llm_summarize(conversation_text)
        if summary:
            state.summary = summary

        # Extract Facts
        facts = await _llm_extract_facts(conversation_text)
        if facts:
            state.facts_extracted = facts
            
        # 4. Classify Topic (Simple approach for now)
        # We could add a specific LLM call for topic classification
        if messages:
            state.main_topic = "Atendimento Geral" # Placeholder
            
        await db.commit()
        logger.info(f"✨ Intelligence processed for conversation {conversation_id}")
        return state
        
    except Exception as e:
        logger.error(f"Failed to process intelligence for conversation {conversation_id}: {e}")
        return None

async def classify_topic_llm(text: str) -> str:
    """
    Specifically classify the main topic using LLM.
    """
    # This could be implemented using a similar pattern to _llm_summarize
    return "Suporte Técnico" # Placeholder
