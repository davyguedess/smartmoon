"""
AI Chat Node Handler — Smart Moon
===================================
Lida com respostas conversacionais via Groq / Gemini / Ollama.
Ordem de preferência: Groq (< 1s) → Gemini → Ollama local.
Suporta:
  - Modo texto (padrão)
  - Modo áudio (ativado/desativado pelo usuário via WhatsApp)
  - Divisão automática em múltiplos áudios se > ~1 minuto de fala
  - Indicador de "digitando" para Telegram e Z-API typing para WhatsApp
"""
import json
import os
import uuid
import httpx
from typing import Optional
from datetime import datetime, timezone
from loguru import logger
from sqlalchemy import select

from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings
from app.models import AgentMemory, Integration

# ── Audio helpers ────────────────────────────────────────────────────────────
from app.services.wa_audio_manager import detect_audio_request, set_audio_mode, get_audio_mode
from app.services.audio_splitter import split_text_for_audio

# ── TTS & Z-API ──────────────────────────────────────────────────────────────
from app.services.zapi_client import ZAPIClient


class AIChatHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        # 1. Extract context
        message = self.context.get("message") or input_payload.get("message", "")
        conversation_id = self.context.get("conversation_id") or input_payload.get("conversation_id")
        company_id = self.context.get("company_id")
        db = self.context.get("_db")
        wa_id = self.context.get("wa_id") or input_payload.get("wa_id")

        if not message or not conversation_id:
            logger.warning("AIChatHandler: Missing message or conversation_id")
            return {"ai_response": "Desculpe, não entendi a mensagem."}

        # 2. Configuration
        model = self.config.get("model") or settings.GROQ_MODEL
        base_prompt = (
            self.config.get("system_prompt")
            or "Você é Lua, assistente virtual da Smart Moon — Lua Inteligente. "
               "Responda sempre em Português de forma clara e útil."
        )
        agent_id = self.config.get("agent_id") or input_payload.get("agent_id")

        # Sempre injetar instrução de capacidade de áudio para o LLM não negar
        audio_instruction = (
            "\n\nIMPORTANTE: Você tem a capacidade de enviar mensagens de VOZ (áudio) diretamente no WhatsApp. "
            "Quando o usuário pedir um áudio, responda normalmente COM O CONTEÚDO solicitado e mencione brevemente "
            "que vai enviar em áudio também. NÃO diga que não pode gerar áudio — o sistema cuida disso automaticamente. "
            "Se o usuário quiser parar os áudios, avisar que voltará apenas ao texto."
        )
        system_prompt = base_prompt + audio_instruction

        # 3. Retrieve conversation history (last 10 messages)
        history_messages = []
        if db:
            try:
                result = await db.execute(
                    select(AgentMemory)
                    .where(AgentMemory.session_id == str(conversation_id))
                    .where(AgentMemory.memory_type == "message")
                    .order_by(AgentMemory.created_at.desc())
                    .limit(10)
                )
                history = result.scalars().all()
                for h in reversed(history):
                    history_messages.append({"role": h.role, "content": h.content})
            except Exception as hist_err:
                logger.error(f"Failed to load history: {hist_err}")

        # 4. Build LLM prompt
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history_messages)
        if not history_messages or history_messages[-1]["content"] != message:
            messages.append({"role": "user", "content": message})

        # 5. Typing indicator for Telegram
        chat_id = self.context.get("chat_id") or input_payload.get("chat_id")
        if chat_id:
            await self._send_telegram_typing(chat_id, db, company_id)

        # 6. Call LLM  (Groq → Gemini → Ollama)
        ai_response = "Tive um problema ao processar sua resposta."
        # Provider explícito no nó > env default > auto
        provider = self.config.get("provider") or self.node.get("subtype") or settings.AI_DEFAULT_PROVIDER or "groq"
        if provider in ("ollama", "local"):
            provider = "ollama"

        logger.debug(f"AIChatHandler: using provider={provider} model={model}")
        tokens_used = 0  # approximate — AIChatHandler doesn't get exact token counts
        try:
            if provider == "groq":
                ai_response = await self._call_groq(messages)
            elif provider == "gemini":
                ai_response = await self._call_gemini(model, messages)
            elif provider == "ollama":
                ai_response = await self._call_ollama(model, messages)
            else:
                # auto — tenta Groq > Gemini > Ollama
                if settings.GROQ_API_KEY:
                    ai_response = await self._call_groq(messages)
                elif settings.GEMINI_API_KEY:
                    ai_response = await self._call_gemini(model, messages)
                else:
                    ai_response = await self._call_ollama(model, messages)
            # Approximate token usage for billing (will be refined when using AIClient directly)
            tokens_used = max(len(" ".join(m.get("content","") for m in messages)) // 4, 10)
        except Exception as primary_err:
            logger.warning(f"Primary LLM failed ({provider}): {primary_err}, trying fallback...")
            try:
                if provider == "groq" and settings.GEMINI_API_KEY:
                    ai_response = await self._call_gemini(model, messages)
                elif provider in ("groq", "gemini"):
                    ai_response = await self._call_ollama(settings.OLLAMA_MODEL, messages)
                    provider = "ollama"
                else:
                    raise primary_err
            except Exception as fallback_err:
                logger.error(f"All LLM providers failed: {fallback_err}")

        # 6b. Debitar NEXUS tokens se estiver usando platform key (não Ollama)
        if db and company_id and provider != "ollama" and tokens_used > 0:
            try:
                from app.engine.handlers.key_resolver import resolve_api_key
                from app.core.config import settings as _s
                _env_key_map = {
                    "groq": _s.GROQ_API_KEY,
                    "gemini": _s.GEMINI_API_KEY,
                    "openai": _s.OPENAI_API_KEY,
                    "claude": getattr(_s, "ANTHROPIC_API_KEY", ""),
                }
                user_key = await resolve_api_key(provider, company_id, db, "")
                if not user_key:  # sem chave própria → usou platform key
                    from app.services.ai_token_service import debit_tokens, cost_for_call
                    nexus_cost = cost_for_call(provider, model, tokens_used, tokens_used // 2)
                    if nexus_cost > 0:
                        await debit_tokens(
                            db=db,
                            company_id=company_id,
                            amount=nexus_cost,
                            provider=provider,
                            description=f"Flow AI ({provider}/{model}) — ~{tokens_used} tokens",
                        )
                        logger.debug(f"💎 Flow NEXUS debit: {nexus_cost} | {provider} | empresa {company_id}")
            except Exception as _de:
                logger.debug(f"NEXUS token debit in flow (non-critical): {_de}")

        # 7. Save AI response to memory
        if db and company_id:
            try:
                db.add(AgentMemory(
                    company_id=company_id,
                    session_id=str(conversation_id),
                    agent_id=agent_id,
                    role="assistant",
                    content=ai_response,
                    memory_type="message",
                    created_at=datetime.now(timezone.utc),
                ))
            except Exception as mem_err:
                logger.warning(f"Failed to save AI memory: {mem_err}")

        # 8. WhatsApp audio mode logic
        if wa_id and conversation_id:
            await self._handle_whatsapp_audio(
                message=message,
                ai_response=ai_response,
                wa_id=wa_id,
                conversation_id=str(conversation_id),
                company_id=company_id,
                db=db,
            )

        return {"ai_response": ai_response, "message": ai_response}

    # ── WhatsApp Audio Pipeline ──────────────────────────────────────────────

    async def _handle_whatsapp_audio(
        self,
        message: str,
        ai_response: str,
        wa_id: str,
        conversation_id: str,
        company_id,
        db,
    ) -> None:
        """
        Detecta se o usuário quer áudio, gerencia o estado e envia áudios.
        - Ativa/desativa modo áudio via Redis
        - Divide resposta em chunks de ~1 min e envia cada um como áudio separado
        """
        try:
            redis = await self._get_redis()
        except Exception as re:
            logger.warning(f"AIChatHandler: Redis unavailable, skipping audio mode: {re}")
            return

        # Detectar intenção de áudio na mensagem do usuário
        intent = detect_audio_request(message)

        if intent is False:
            # Usuário quer DESATIVAR áudio
            await set_audio_mode(redis, conversation_id, False)
            await redis.aclose()
            logger.info(f"🔇 Audio mode OFF for {conversation_id}")
            # Já foi enviado como texto pelo send_whatsapp_handler — nada mais a fazer
            return

        if intent is True:
            # Usuário quer ATIVAR áudio
            await set_audio_mode(redis, conversation_id, True)
            logger.info(f"🔊 Audio mode ON for {conversation_id}")

        # Verificar se modo áudio está ativo
        audio_active = await get_audio_mode(redis, conversation_id)
        await redis.aclose()

        if not audio_active:
            return  # Modo texto normal — não enviar áudio

        # Carregar credenciais Z-API
        zapi_creds = await self._get_zapi_creds(db, company_id)
        if not zapi_creds:
            logger.warning("AIChatHandler: Z-API creds not found, cannot send audio")
            return

        instance_id = zapi_creds["instance_id"]
        instance_token = zapi_creds["instance_token"]
        client_token = zapi_creds["client_token"]
        phone = "".join(c for c in str(wa_id) if c.isdigit())

        # Dividir resposta em chunks de ~1 minuto
        chunks = split_text_for_audio(ai_response)
        logger.info(f"🎙️ Sending {len(chunks)} audio chunk(s) to {phone}")

        for i, chunk in enumerate(chunks):
            try:
                audio_url = await self._generate_audio_and_get_url(chunk)
                if not audio_url:
                    logger.warning(f"Audio chunk {i+1} generation failed, skipping")
                    continue

                await ZAPIClient.send_audio(
                    instance_id=instance_id,
                    token=instance_token,
                    client_token=client_token,
                    phone=phone,
                    audio_url=audio_url,
                )
                logger.info(f"✅ Audio chunk {i+1}/{len(chunks)} sent to {phone}")

                # Pequena pausa entre áudios para não sobrecarregar
                if len(chunks) > 1 and i < len(chunks) - 1:
                    import asyncio
                    await asyncio.sleep(1.5)

            except Exception as audio_err:
                logger.error(f"Audio chunk {i+1} send failed: {audio_err}")

    async def _generate_audio_and_get_url(self, text: str) -> Optional[str]:
        """
        Gera áudio via Kokoro TTS e retorna uma URL pública acessível.
        Salva em /tmp/nexus_audio/ e serve via endpoint /audio/<filename>.
        """
        try:
            from app.services.tts_service import tts_service

            result = await tts_service.synthesize(
                text=text,
                fmt="mp3",
                voice="af_bella",  # Voz padrão — pode ser configurável por agente
            )
            file_path = result.get("file_path")
            if not file_path or not os.path.exists(file_path):
                return None

            # Montar URL pública — o API serve os arquivos em /audio/<filename>
            filename = os.path.basename(file_path)
            public_base = getattr(settings, "PUBLIC_API_URL", f"http://{settings.HOST}:{settings.PORT}")
            # Remove trailing slash
            public_base = public_base.rstrip("/")
            audio_url = f"{public_base}/audio/{filename}"
            logger.debug(f"🎵 Audio file generated: {file_path} → {audio_url}")
            return audio_url

        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            return None

    async def _get_redis(self):
        """Get async Redis client."""
        import redis.asyncio as aioredis
        return aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=False,
        )

    async def _get_zapi_creds(self, db, company_id) -> Optional[dict]:
        """Load Z-API credentials from DB integrations table."""
        if not db or not company_id:
            return None
        try:
            from sqlalchemy import text as sql_text
            result = await db.execute(
                sql_text("""
                    SELECT config_json FROM integrations
                    WHERE company_id = :cid AND provider = 'zapi'
                    ORDER BY id DESC LIMIT 1
                """),
                {"cid": company_id}
            )
            row = result.fetchone()
            if row and row[0]:
                cfg = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                if cfg.get("instance_id") and cfg.get("instance_token"):
                    return cfg
        except Exception as e:
            logger.error(f"Z-API creds load failed: {e}")
        return None

    # ── Telegram Typing ──────────────────────────────────────────────────────

    async def _send_telegram_typing(self, chat_id, db, company_id) -> None:
        try:
            bot_token = settings.TELEGRAM_BOT_TOKEN
            if db and company_id:
                res_int = await db.execute(
                    select(Integration).where(
                        Integration.company_id == company_id,
                        Integration.provider == "telegram",
                        Integration.status == "connected",
                    ).order_by(Integration.id.desc()).limit(1)
                )
                integration = res_int.scalars().first()
                if integration and integration.config_json:
                    cfg = integration.config_json if isinstance(integration.config_json, dict) else json.loads(integration.config_json)
                    bot_token = cfg.get("bot_token") or bot_token

            if bot_token:
                async with httpx.AsyncClient(timeout=5) as tc:
                    await tc.post(
                        f"https://api.telegram.org/bot{bot_token}/sendChatAction",
                        json={"chat_id": chat_id, "action": "typing"},
                    )
        except Exception as e:
            logger.debug(f"Telegram typing indicator error (non-critical): {e}")

    # ── LLM Providers ────────────────────────────────────────────────────────

    async def _call_groq(self, messages: list) -> str:
        """Groq Cloud — OpenAI-compatible API. Latência < 1s."""
        api_key = settings.GROQ_API_KEY
        if not api_key:
            raise ValueError("GROQ_API_KEY not configured")
        model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "max_tokens": 2048, "temperature": 0.7},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_ollama(self, model: str, messages: list) -> str:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def _call_gemini(self, model: str, messages: list) -> str:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")

        gemini_model = model if model.startswith("gemini") else "gemini-2.0-flash"
        system_instruction = None
        gemini_contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                gemini_contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        payload = {
            "contents": gemini_contents,
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
