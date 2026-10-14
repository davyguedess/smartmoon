"""
Celery Tasks — hardened async job runners with:
  - Exponential backoff retries
  - Soft/hard timeouts
  - Dead-letter queue for permanently failed tasks
  - Circuit breaker awareness
  - Structured logging with task context
"""
import asyncio
import json
from loguru import logger
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from app.workers.celery_app import celery_app


def run_async(coro):
    """Run an async coroutine from sync Celery task.

    Creates a fresh event loop per call to avoid 'Future attached to a
    different loop' errors that occur when Celery forks worker processes.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    except Exception as e:
        logger.error(f"Async execution error: {e}")
        raise
    finally:
        try:
            # Cancel any pending tasks
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        finally:
            loop.close()


# ── Dead-letter handler ──────────────────────────────

@celery_app.task(name="dead_letter_task")
def dead_letter_task(original_task: str, task_args: list, task_kwargs: dict, error: str):
    """Store permanently failed tasks for manual review."""
    logger.error(
        f"💀 DEAD LETTER | task={original_task} | args={task_args} | error={error}"
    )
    # In production: store in DB table or send alert
    run_async(_save_dead_letter(original_task, task_args, task_kwargs, error))


async def _save_dead_letter(task_name: str, args: list, kwargs: dict, error: str):
    """Persist dead-letter event to database."""
    try:
        from app.db.session import AsyncSessionLocal
        from app.models import AuditLog

        async with AsyncSessionLocal() as db:
            db.add(AuditLog(
                company_id=None,
                actor_id=None,
                action="task.dead_letter",
                resource_type="celery_task",
                resource_id=task_name,
                metadata_json={
                    "args": str(args)[:500],
                    "kwargs": str(kwargs)[:500],
                    "error": str(error)[:1000],
                },
            ))
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to save dead letter: {e}")


# ── Flow Execution Task ──────────────────────────────

@celery_app.task(
    name="execute_flow_task",
    bind=True,
    max_retries=3,
    soft_time_limit=300,    # 5 min soft
    time_limit=360,         # 6 min hard
    acks_late=True,
)
def execute_flow_task(self: Task, execution_id: int):
    """Execute a flow — with exponential backoff, timeout, and dead-letter on final failure."""
    logger.info(f"🔄 Worker picked up execution #{execution_id} (attempt {self.request.retries + 1}/{self.max_retries + 1})")
    try:
        run_async(_run_execution(execution_id, worker_id=self.request.hostname))
        logger.info(f"✅ Execution #{execution_id} completed")

    except SoftTimeLimitExceeded:
        logger.error(f"⏰ Execution #{execution_id} timed out (soft limit)")
        run_async(_mark_execution_failed(execution_id, "Timeout — soft time limit exceeded"))
        # Don't retry timeouts — they'll likely timeout again
        dead_letter_task.delay("execute_flow_task", [execution_id], {}, "SoftTimeLimitExceeded")

    except Exception as exc:
        retry_count = self.request.retries
        if retry_count < self.max_retries:
            # Exponential backoff: 10s, 40s, 90s
            countdown = 10 * (2 ** retry_count)
            logger.warning(f"🔁 Retrying execution #{execution_id} in {countdown}s (attempt {retry_count + 2})")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            # Final failure → dead-letter queue
            logger.error(f"💀 Execution #{execution_id} permanently failed: {exc}")
            run_async(_mark_execution_failed(execution_id, str(exc)))
            dead_letter_task.delay("execute_flow_task", [execution_id], {}, str(exc))


async def _run_execution(execution_id: int, worker_id: str = None):
    from app.db.session import AsyncSessionLocal
    from app.db.repositories.execution_repository import ExecutionRepository
    from app.db.repositories.flow_repository import FlowRepository
    from app.engine.executor import FlowExecutor

    async with AsyncSessionLocal() as db:
        exec_repo = ExecutionRepository(db)
        execution = await exec_repo.get_by_id(execution_id)
        if not execution:
            logger.error(f"Execution #{execution_id} not found")
            return

        # Update worker info and retry count
        if hasattr(execution, 'worker_id'):
            execution.worker_id = worker_id
        if hasattr(execution, 'retry_count'):
            execution.retry_count = (execution.retry_count or 0) + 1

        flow_repo = FlowRepository(db)
        flow = await flow_repo.get_by_id(execution.flow_id)
        if not flow:
            logger.error(f"Flow #{execution.flow_id} not found")
            return

        executor = FlowExecutor(db_session=db, execution=execution, flow=flow)
        await executor.run()
        await db.commit()


async def _mark_execution_failed(execution_id: int, error: str):
    """Mark an execution as failed in the database."""
    try:
        from app.db.session import AsyncSessionLocal
        from app.db.repositories.execution_repository import ExecutionRepository

        async with AsyncSessionLocal() as db:
            repo = ExecutionRepository(db)
            execution = await repo.get_by_id(execution_id)
            if execution:
                execution.status = "failed"
                execution.error_message = error[:2000]
                await db.commit()
    except Exception as e:
        logger.error(f"Failed to mark execution #{execution_id} as failed: {e}")


# ── Memory Governance Task ───────────────────────────

@celery_app.task(name="memory_governance_task")
def memory_governance_task(
    company_id: int,
    session_id: str,
    agent_id: int = None,
    user_message: str = "",
):
    """Background memory governance: summarize old turns + extract facts.

    Runs out-of-band so it never adds latency to the bot's reply. Uses its
    own DB session (the flow's session is already closed by the time this runs).
    """
    try:
        run_async(_run_memory_governance(company_id, session_id, agent_id, user_message))
    except Exception as e:
        logger.warning(f"memory_governance_task failed (non-blocking): {e}")


async def _run_memory_governance(
    company_id: int, session_id: str, agent_id: int, user_message: str
):
    from app.db.session import AsyncSessionLocal
    from app.services import memory_service

    async with AsyncSessionLocal() as db:
        try:
            await memory_service.maybe_summarize(db, company_id, session_id, agent_id)
        except Exception as e:
            logger.warning(f"maybe_summarize failed: {e}")
        if agent_id and user_message:
            try:
                await memory_service.extract_facts(
                    db, company_id, session_id, user_message, agent_id
                )
            except Exception as e:
                logger.warning(f"extract_facts failed: {e}")


# ── Channel Message Processing Task ──────────────────

@celery_app.task(name="process_channel_message_task")
def process_channel_message_task(
    conversation_id: int, text: str, channel: str,
    group_id: str = None, integration_id: int = None,
    media_path: str = None, msg_type: str = "text",
):
    """Handle inbound channel message after storing it."""
    logger.info(
        f"🔔 Processing channel message: conv_id={conversation_id}, "
        f"channel={channel}, group={group_id or 'DM'}, "
        f"type={msg_type}, text={text[:80]}"
    )

    # ── Group message → try to route to a Project Agent first ──
    if group_id and integration_id and channel == "whatsapp":
        handled = run_async(
            _trigger_project_agent(
                conversation_id, text, group_id, integration_id,
                media_path=media_path, msg_type=msg_type,
            )
        )
        if handled:
            return  # Project agent handled it — skip regular flow

    # ── Regular flow routing ──
    if channel == "telegram":
        run_async(_trigger_telegram_flow(conversation_id, text))
    elif channel == "whatsapp":
        run_async(
            _trigger_whatsapp_flow(
                conversation_id, text,
                media_path=media_path, msg_type=msg_type,
            )
        )


async def _transcribe_audio_gemini(audio_file_path: str) -> str:
    """Transcribe audio using Gemini 2.5 Flash multimodal.

    Reads the audio file from the shared Docker volume and sends it
    to Gemini as inline_data for transcription.
    """
    import base64
    import httpx
    from app.core.config import settings

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.error("GEMINI_API_KEY not set — cannot transcribe audio")
        return ""

    try:
        # Read audio file from shared volume
        with open(audio_file_path, "rb") as f:
            audio_bytes = f.read()

        if not audio_bytes:
            logger.warning(f"Audio file empty: {audio_file_path}")
            return ""

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Detect mime type
        mime = "audio/ogg"
        if audio_file_path.endswith(".mp3"):
            mime = "audio/mp3"
        elif audio_file_path.endswith(".mp4") or audio_file_path.endswith(".m4a"):
            mime = "audio/mp4"
        elif audio_file_path.endswith(".wav"):
            mime = "audio/wav"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime,
                                "data": audio_b64,
                            }
                        },
                        {
                            "text": "Transcreva este áudio de forma precisa em Português. Retorne APENAS o texto transcrito, sem formatação extra, sem explicações."
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
            },
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            logger.error(f"Gemini audio transcription failed: {resp.status_code} {resp.text[:200]}")
            return ""

        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                transcript = parts[0].get("text", "").strip()
                logger.success(f"🎙️ Gemini transcription: {transcript[:100]}...")
                return transcript

        return ""

    except FileNotFoundError:
        logger.error(f"Audio file not found: {audio_file_path}")
        return ""
    except Exception as e:
        logger.error(f"Gemini audio transcription error: {e}")
        return ""


async def _analyze_image_gemini(image_file_path: str, caption: str = "") -> str:
    """Analyze an inbound WhatsApp image using Gemini 2.5 Flash multimodal.

    Focado no caso financeiro: extrai dados de nota fiscal/cupom/comprovante;
    para qualquer outra imagem, devolve uma descrição breve. O texto retornado
    é injetado como mensagem para o agente do flow.
    """
    import base64
    import httpx
    from app.core.config import settings

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.error("GEMINI_API_KEY not set — cannot analyze image")
        return ""

    try:
        with open(image_file_path, "rb") as f:
            image_bytes = f.read()

        if not image_bytes:
            logger.warning(f"Image file empty: {image_file_path}")
            return ""

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        mime = "image/jpeg"
        lower = image_file_path.lower()
        if lower.endswith(".png"):
            mime = "image/png"
        elif lower.endswith(".webp"):
            mime = "image/webp"
        elif lower.endswith(".gif"):
            mime = "image/gif"

        prompt = (
            "Analise esta imagem enviada por um cliente via WhatsApp para um agente financeiro.\n"
            "SE for nota fiscal, cupom fiscal, recibo, comprovante de pagamento/Pix ou boleto, extraia em texto:\n"
            "- Estabelecimento/fornecedor (e CNPJ se visível)\n"
            "- Data e hora\n"
            "- Valor total (e valores relevantes)\n"
            "- Número da nota/cupom/transação, se visível\n"
            "- Forma de pagamento, se visível\n"
            "- Itens principais (resumido)\n"
            "SE NÃO for documento financeiro, descreva brevemente o que a imagem mostra (1-2 frases).\n"
            "Responda APENAS com os dados/descrição, sem preâmbulos."
        )
        if caption:
            prompt += f'\nLegenda enviada junto com a imagem: "{caption}"'

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"inline_data": {"mime_type": mime, "data": image_b64}},
                        {"text": prompt},
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024,
            },
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            logger.error(f"Gemini image analysis failed: {resp.status_code} {resp.text[:200]}")
            return ""

        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                analysis = parts[0].get("text", "").strip()
                logger.success(f"🖼️ Gemini image analysis: {analysis[:100]}...")
                return analysis

        return ""

    except FileNotFoundError:
        logger.error(f"Image file not found: {image_file_path}")
        return ""
    except Exception as e:
        logger.error(f"Gemini image analysis error: {e}")
        return ""


async def _maybe_send_audio_response(
    instance_id: str, group_id: str, text_response: str
) -> bool:
    """1-in-50 chance: generate TTS audio and send as voice note to the group.

    Returns True if audio was sent, False otherwise.
    """
    import random

    # 2% chance (1 in 50)
    if random.randint(1, 50) != 1:
        return False

    try:
        from app.services.tts_service import TTSService
        from app.services.smartmoon_client import SmartMoonClient

        tts = TTSService()
        # Truncate for TTS (avoid super long audio)
        tts_text = text_response[:500] if len(text_response) > 500 else text_response
        result = await tts.synthesize(tts_text)

        if result.get("status") != "ok":
            logger.warning(f"TTS failed for audio response: {result}")
            return False

        audio_path = result.get("audio_path", "")
        if not audio_path:
            return False

        # Send audio as voice note to the group
        await SmartMoonClient.send_audio(instance_id, group_id, audio_path, ptt=True)
        logger.info(f"🔊 PM-Agent sent audio response to group {group_id}")
        return True

    except Exception as e:
        logger.warning(f"Audio response failed (non-blocking): {e}")
        return False


async def _trigger_project_agent(
    conversation_id: int, user_text: str,
    group_id: str, integration_id: int,
    media_path: str = None, msg_type: str = "text",
) -> bool:
    """Route a WhatsApp group message to the trained agent linked to a Project.

    Supports audio messages by transcribing via Gemini before processing.
    1-in-50 responses are sent as voice notes via TTS.

    Returns True if a project agent was found and handled the message.
    Returns False to fall through to the regular flow engine.
    """
    import asyncpg
    from app.core.config import settings
    from loguru import logger

    conn = None
    try:
        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncio.wait_for(asyncpg.connect(db_url), timeout=10)

        # 1. Find project linked to this group + instance
        project = await conn.fetchrow(
            """SELECT p.id, p.name, p.company_id, p.agent_profile_id, p.agent_model,
                      p.agent_enabled, p.whatsapp_group_id
               FROM projects p
               WHERE p.whatsapp_instance_id = $1
                 AND p.whatsapp_group_id = $2
                 AND p.agent_enabled = true
               LIMIT 1""",
            integration_id, group_id,
        )

        if not project:
            logger.debug(
                f"No project agent for integration_id={integration_id} group={group_id}"
            )
            return False

        agent_profile_id = project["agent_profile_id"]
        company_id = project["company_id"]

        if not agent_profile_id:
            logger.warning(
                f"Project {project['id']} has agent_enabled but no agent_profile_id linked"
            )
            return False

        # ── AUDIO TRANSCRIPTION ──
        effective_text = user_text
        if msg_type == "audio" and media_path:
            logger.info(f"🎙️ Audio message received in group — transcribing via Gemini...")
            transcript = await _transcribe_audio_gemini(media_path)
            if transcript:
                effective_text = f"[Áudio transcrito]: {transcript}"
                logger.info(f"🎙️ Transcription OK: {transcript[:100]}")
            else:
                logger.warning("Audio transcription returned empty — skipping")
                return False
        elif not effective_text:
            return False

        logger.info(
            f"🤖 Routing group msg → Project '{project['name']}' "
            f"(agent_profile_id={agent_profile_id})"
        )

        # 2. Get SmartMoon instance_id (to send reply back to group)
        integration = await conn.fetchrow(
            "SELECT config_json FROM integrations WHERE id = $1",
            integration_id,
        )
        if not integration:
            return False

        cfg = integration["config_json"]
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        instance_id = cfg.get("instance_id")

        if not instance_id:
            logger.error("No instance_id in integration config")
            return False

        # 3. Call trained_agent_handler with the project context
        from app.db.session import AsyncSessionLocal
        from app.models import AgentProfile
        from sqlalchemy import select as sa_select

        async with AsyncSessionLocal() as db:
            profile_res = await db.execute(
                sa_select(AgentProfile).where(
                    AgentProfile.id == agent_profile_id,
                    AgentProfile.company_id == company_id,
                )
            )
            profile = profile_res.scalar_one_or_none()

            if not profile:
                logger.error(f"AgentProfile {agent_profile_id} not found")
                return False

            from app.engine.handlers.trained_agent_handler import TrainedAgentHandler

            # Build context and config for the handler
            handler_context = {
                "message": effective_text,
                "conversation_id": conversation_id,
                "company_id": company_id,
                "_db": db,
            }
            handler_config = {
                "agent_id": agent_profile_id,
            }
            handler = TrainedAgentHandler(
                node={"id": "project_agent", "type": "trained_agent"},
                context=handler_context,
                settings_ref=handler_config,
            )
            result = await handler.execute({"message": effective_text})

            # Commit memory so next call sees conversation history
            await db.commit()

        ai_response = result.get("ai_response") or result.get("message", "")

        if not ai_response:
            logger.warning("Project agent returned empty response")
            return False

        # 4. Send response BACK to the WhatsApp group
        from app.services.smartmoon_client import SmartMoonClient

        # Try audio response (2% chance — 1 in 50)
        audio_sent = await _maybe_send_audio_response(
            instance_id, group_id, ai_response
        )

        # Always send text (even if audio was sent — text serves as transcript)
        send_result = await SmartMoonClient.send_text(instance_id, group_id, ai_response)

        # 5. Persist outbound message to whatsapp_messages for full history
        try:
            await conn.execute(
                """INSERT INTO whatsapp_messages
                   (conversation_id, direction, sender_type, message_type,
                    content_text, content_json, wamid, delivery_status,
                    agent_id, model, provider, tokens_input, tokens_output)
                   VALUES ($1, 'outbound', 'agent', 'text',
                    $2, 'null', $3, 'sent',
                    $4, $5, 'gemini', 0, 0)""",
                conversation_id,
                ai_response,
                send_result.get("messageId") if isinstance(send_result, dict) else None,
                agent_profile_id,
                project.get("agent_model") or "gemini-2.5-flash",
            )
        except Exception as persist_err:
            logger.warning(f"Failed to persist outbound message: {persist_err}")

        logger.info(
            f"✅ Project agent replied to group {group_id} "
            f"({len(ai_response)} chars, audio={'yes' if audio_sent else 'no'})"
        )
        return True

    except asyncio.TimeoutError:
        logger.error(f"Project agent routing timed out for conv={conversation_id}")
        return False
    except Exception as e:
        logger.error(f"Project agent routing failed: {e}")
        return False
    finally:
        if conn:
            try:
                await conn.close()
            except Exception:
                pass



async def _trigger_telegram_flow(conversation_id: int, user_text: str):
    """Find active flow for telegram and create a formal Execution.
    
    The flow to run is stored in the Telegram integration's config_json as 'flow_id'.
    If no flow_id is configured, the bot silently ignores the message.
    """
    import asyncpg
    from app.core.config import settings
    from loguru import logger

    conn = None
    try:
        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncio.wait_for(asyncpg.connect(db_url), timeout=10)

        # 1. Get company and chat_id from conversation
        conv = await conn.fetchrow(
            "SELECT company_id, external_chat_id FROM telegram_conversations WHERE id = $1",
            conversation_id
        )
        if not conv:
            logger.error(f"Conversation {conversation_id} not found")
            return

        company_id = conv['company_id']
        chat_id = conv['external_chat_id']

        # 2. Find the Telegram integration and read the configured flow_id
        integration = await conn.fetchrow(
            """SELECT id, config_json FROM integrations
               WHERE company_id = $1 AND provider = 'telegram' AND status = 'connected'
               ORDER BY id DESC LIMIT 1""",
            company_id
        )

        if not integration:
            logger.warning(f"No connected Telegram integration for company {company_id}")
            return

        cfg = integration['config_json']
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        
        flow_id = cfg.get('flow_id') if cfg else None

        if not flow_id:
            logger.warning(
                f"Telegram integration for company {company_id} has no flow connected. "
                f"Go to Integrations → Telegram → Connect a Flow."
            )
            return

        # 3. Verify the flow exists and is published
        flow = await conn.fetchrow(
            "SELECT id, name, status FROM flows WHERE id = $1 AND company_id = $2",
            int(flow_id), company_id
        )

        if not flow:
            logger.error(f"Flow {flow_id} not found for company {company_id}")
            return

        if flow['status'] != 'published':
            logger.warning(f"Flow '{flow['name']}' (id={flow_id}) is not published yet — status={flow['status']}")
            return

        # 4. Create Formal Execution
        execution_id = await conn.fetchval(
            """INSERT INTO executions (flow_id, company_id, trigger_type, status, input_payload, created_at, updated_at)
               VALUES ($1, $2, 'telegram_trigger', 'queued', $3, NOW(), NOW())
               RETURNING id""",
            int(flow_id), company_id, json.dumps({
                "message": user_text,
                "chat_id": chat_id,
                "conversation_id": conversation_id,
                "channel": "telegram"
            })
        )

        logger.info(f"🚀 Created Execution #{execution_id} for flow '{flow['name']}' (id={flow_id})")

        # 5. Enqueue the execution task
        execute_flow_task.delay(execution_id)

    except asyncio.TimeoutError:
        logger.error(f"Telegram flow trigger timed out (DB connection) for conv={conversation_id}")
    except Exception as e:
        logger.error(f"Failed to trigger telegram flow: {e}")
    finally:
        if conn:
            try:
                await conn.close()
            except Exception:
                pass


async def _trigger_whatsapp_flow(
    conversation_id: int, user_text: str,
    media_path: str = None, msg_type: str = "text",
):
    """Find active flow for WhatsApp and create a formal Execution.

    The flow to run is stored in the WhatsApp integration's config_json as 'flow_id'.
    If no flow_id is configured, the message is silently ignored.
    Audio DMs are transcribed here (Gemini multimodal, same as the group path)
    so the flow always receives the message as text.
    """
    import asyncpg
    from app.core.config import settings
    from loguru import logger

    raw_transcript = None
    if msg_type == "audio" and media_path:
        raw_transcript = await _transcribe_audio_gemini(media_path)
        if raw_transcript:
            user_text = raw_transcript
        else:
            logger.error(
                f"Audio transcription failed for conv={conversation_id} "
                f"(path={media_path}) — asking user to repeat"
            )
            user_text = (
                "[Sistema: o áudio do cliente não pôde ser transcrito. "
                "Peça educadamente para repetir por texto ou reenviar o áudio.]"
            )
    elif msg_type == "image" and media_path:
        analysis = await _analyze_image_gemini(media_path, caption=user_text or "")
        if analysis:
            caption_part = f'Legenda do cliente: "{user_text}"\n' if user_text else ""
            user_text = (
                f"[O cliente enviou uma imagem]\n{caption_part}"
                f"Conteúdo extraído da imagem:\n{analysis}"
            )
        else:
            logger.error(
                f"Image analysis failed for conv={conversation_id} (path={media_path})"
            )
            user_text = user_text or (
                "[Sistema: o cliente enviou uma imagem que não pôde ser analisada. "
                "Avise e peça para reenviar ou informar os dados por texto.]"
            )

    conn = None
    try:
        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncio.wait_for(asyncpg.connect(db_url), timeout=10)

        # 1. Get company and wa_id from conversation
        conv = await conn.fetchrow(
            "SELECT company_id, wa_id, integration_id FROM whatsapp_conversations WHERE id = $1",
            conversation_id
        )
        if not conv:
            logger.error(f"WhatsApp Conversation {conversation_id} not found")
            return

        company_id = conv['company_id']
        wa_id = conv['wa_id']
        integration_id = conv['integration_id']

        # 2. Find the WhatsApp integration (Cloud or Z-API) and read the configured flow_id
        # NOTE: Don't filter by status — Z-API can be briefly 'disconnected' but still
        # functional. The integration_id from the conversation is sufficient to identify it.
        integration = await conn.fetchrow(
            """SELECT id, config_json, provider FROM integrations
               WHERE id = $1 AND provider IN ('whatsapp_cloud', 'zapi', 'smartmoon')""",
            integration_id
        )

        if not integration:
            logger.warning(f"No connected WhatsApp integration id={integration_id}")
            return

        provider = integration['provider']

        cfg = integration['config_json']
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        flow_id = cfg.get('flow_id') if cfg else None

        if not flow_id:
            logger.warning(
                f"WhatsApp integration for company {company_id} has no flow connected. "
                f"Go to Integrations → WhatsApp → Connect a Flow."
            )
            return

        # 3. Verify the flow exists and is published
        flow = await conn.fetchrow(
            "SELECT id, name, status FROM flows WHERE id = $1 AND company_id = $2",
            int(flow_id), company_id
        )

        if not flow:
            logger.error(f"Flow {flow_id} not found for company {company_id}")
            return

        if flow['status'] != 'published':
            logger.warning(f"Flow '{flow['name']}' (id={flow_id}) is not published yet — status={flow['status']}")
            return

        # 4. Create Formal Execution
        trigger_type_map = {
            'zapi': 'zapi_trigger',
            'whatsapp_cloud': 'whatsapp_trigger',
            'smartmoon': 'smartmoon_trigger',
        }
        trigger_type = trigger_type_map.get(provider, 'whatsapp_trigger')
        execution_id = await conn.fetchval(
            """INSERT INTO executions (flow_id, company_id, trigger_type, status, input_payload, created_at, updated_at)
               VALUES ($1, $2, $3, 'queued', $4, NOW(), NOW())
               RETURNING id""",
            int(flow_id), company_id, trigger_type, json.dumps({
                "message": user_text,
                "wa_id": wa_id,
                "conversation_id": conversation_id,
                "channel": "whatsapp",
                "whatsapp_provider": provider,          # meta or zapi
                "whatsapp_conversation_id": conversation_id,
                "company_id": company_id,
                "input_type": msg_type,
                "media_path": media_path,
                "whisper_transcript": raw_transcript,
            })
        )

        logger.info(f"🚀 Created WhatsApp Execution #{execution_id} for flow '{flow['name']}' (id={flow_id})")

        # 5. Enqueue the execution task
        execute_flow_task.delay(execution_id)

    except asyncio.TimeoutError:
        logger.error(f"WhatsApp flow trigger timed out (DB connection) for conv={conversation_id}")
    except Exception as e:
        logger.error(f"Failed to trigger whatsapp flow: {e}")
    finally:
        if conn:
            try:
                await conn.close()
            except Exception:
                pass


# ── Webhook Processing Task ──────────────────────────

@celery_app.task(
    name="process_webhook_task",
    bind=True,
    max_retries=2,
    soft_time_limit=60,     # 1 min soft
    time_limit=90,          # 1.5 min hard
)
def process_webhook_task(self: Task, provider: str, payload: dict):
    """Process webhook with retries and exponential backoff."""
    logger.info(f"🔗 Processing webhook: {provider} (attempt {self.request.retries + 1})")
    try:
        run_async(_process_webhook(provider, payload))
    except SoftTimeLimitExceeded:
        logger.error(f"⏰ Webhook {provider} timed out")
        dead_letter_task.delay("process_webhook_task", [provider], payload, "SoftTimeLimitExceeded")
    except Exception as exc:
        if self.request.retries < self.max_retries:
            countdown = 5 * (2 ** self.request.retries)
            logger.warning(f"🔁 Retrying webhook {provider} in {countdown}s")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            logger.error(f"💀 Webhook {provider} permanently failed: {exc}")
            dead_letter_task.delay("process_webhook_task", [provider], payload, str(exc))


async def _process_webhook(provider: str, payload: dict):
    from app.db.session import AsyncSessionLocal
    from app.db.repositories.execution_repository import ExecutionRepository

    event_map = {
        "mercadopago": "payment_confirmed",
        "meta": "campaign_event",
        "telegram": "telegram_message",
    }
    event_name = event_map.get(provider, f"{provider}_event")

    async with AsyncSessionLocal() as db:
        repo = ExecutionRepository(db)
        waiting = await repo.find_waiting_by_event(event_name)
        for execution in waiting:
            logger.info(f"▶ Resuming execution #{execution.id} after {event_name}")
            execution.context_json = {
                **(execution.context_json or {}),
                "webhook_payload": payload,
                "waiting_for": None,
            }
            execute_flow_task.delay(execution.id)
        await db.commit()


# ── Payment Webhook Processing Task ──────────────────────────
# Chamado pelo WebhookService quando MP envia notificação de pagamento.
# Com retry automático e idempotência garantida pelo handler.

@celery_app.task(
    name="process_payment_webhook_task",
    bind=True,
    max_retries=5,
    soft_time_limit=120,
    time_limit=180,
    acks_late=True,
)
def process_payment_webhook_task(self: Task, provider: str, payment_id: str, payload: dict):
    """
    Processa webhook de pagamento de forma assíncrona com retry.
    Retries com backoff exponencial: 30s, 60s, 120s, 240s, 480s
    Idempotência garantida pelo payment_webhook_events UNIQUE constraint.
    """
    logger.info(
        f"💳 Payment webhook task: provider={provider} | payment_id={payment_id} "
        f"(tentativa {self.request.retries + 1}/{self.max_retries + 1})"
    )
    try:
        run_async(_process_payment_webhook(provider, payment_id, payload))
        logger.success(f"✅ Payment webhook {payment_id} processado com sucesso")
    except SoftTimeLimitExceeded:
        logger.error(f"⏰ Payment webhook {payment_id} timeout")
        dead_letter_task.delay("process_payment_webhook_task", [provider, payment_id], payload, "SoftTimeLimitExceeded")
    except Exception as exc:
        if self.request.retries < self.max_retries:
            countdown = 30 * (2 ** self.request.retries)  # 30, 60, 120, 240, 480s
            logger.warning(f"🔁 Retry payment webhook {payment_id} em {countdown}s")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            logger.error(f"💀 Payment webhook {payment_id} falhou permanentemente: {exc}")
            dead_letter_task.delay("process_payment_webhook_task", [provider, payment_id], payload, str(exc))


async def _process_payment_webhook(provider: str, payment_id: str, payload: dict):
    """Delega para o handler específico do provider.

    IMPORTANTE: Importar todos os modelos ANTES de usar o ORM para garantir
    que todos os mappers SQLAlchemy (incluindo Company) estejam inicializados.
    O Celery worker usa um contexto de importação diferente do uvicorn.
    """
    # Forçar inicialização de TODOS os mappers (resolve 'Company not found')
    import app.models  # noqa: F401 — registra Company, User, etc.
    import app.payments.models  # noqa: F401 — registra PaymentCharge, PaymentClient, etc.

    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        if provider == "mercadopago":
            from app.payments.webhooks.mercadopago_handler import handle_mercadopago_webhook
            result = await handle_mercadopago_webhook(payment_id, payload, db)
            # BUG-19 FIX: NÃO fazer commit aqui — o handler já gerencia seu
            # próprio ciclo transacional (commit no caminho feliz, rollback no erro).
            # Commit duplicado pode causar InvalidRequestError se a sessão tiver
            # sofrido rollback interno e comprometer integridade dos dados.
            logger.info(f"Payment webhook result: {result}")
        else:
            logger.warning(f"Provider de pagamento desconhecido: {provider}")



# ── Emit Payment Event Task (para automações pós-pagamento) ──────────────────

@celery_app.task(name="emit_payment_event_task")
def emit_payment_event_task(event_name: str, data: dict):
    """
    Emite evento interno de pagamento para disparar automações no flow engine.
    Ex: payment.confirmed → retoma flows em estado wait_event
    """
    logger.info(f"📡 Evento de pagamento: {event_name} | data={data}")
    run_async(_emit_payment_event(event_name, data))


async def _emit_payment_event(event_name: str, data: dict):
    """Retoma execuções aguardando o evento de pagamento."""
    from app.db.session import AsyncSessionLocal
    from app.db.repositories.execution_repository import ExecutionRepository

    async with AsyncSessionLocal() as db:
        try:
            repo = ExecutionRepository(db)
            waiting = await repo.find_waiting_by_event(event_name)
            for execution in waiting:
                company_id = data.get("company_id")
                if company_id and execution.company_id != company_id:
                    continue  # evento é company-scoped
                logger.info(f"▶ Retomando execution #{execution.id} após {event_name}")
                execution.context_json = {
                    **(execution.context_json or {}),
                    "payment_event": event_name,
                    "payment_data": data,
                    "waiting_for": None,
                }
                execute_flow_task.delay(execution.id)
            await db.commit()
        except Exception as e:
            logger.error(f"emit_payment_event error: {e}")


# ── Memory Cleanup Task (Celery Beat) ────────────────

@celery_app.task(name="cleanup_expired_memories")
def cleanup_expired_memories_task():
    """Daily task: purge expired AgentMemory records for all active companies."""
    logger.info("🧹 Running daily memory cleanup...")
    run_async(_cleanup_all_companies())


async def _cleanup_all_companies():
    """Cleanup expired memories across all companies."""
    from app.db.session import AsyncSessionLocal
    from app.services.memory_service import cleanup_expired
    from app.models import Company
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Company.id).where(Company.is_active.is_(True)))
        company_ids = result.scalars().all()

    total = 0
    for company_id in company_ids:
        async with AsyncSessionLocal() as db:
            count = await cleanup_expired(db, company_id)
            total += count

    logger.info(f"🧹 Memory cleanup complete: {total} records purged across {len(company_ids)} companies")


# ── Auto Dream Task (Celery Beat — nightly) ──────────────

@celery_app.task(name="auto_dream_task", soft_time_limit=600, time_limit=720)
def auto_dream_task():
    """
    autoDream — nightly background insight generation.

    For each active company:
      1. Pulls recent conversation summaries
      2. Generates a "dream" insight using AIClient (Ollama fallback)
      3. Stores insight as a company_shared AgentMemory record

    Inspired by: Claude Code's agentic background task pattern.
    Runs daily at 03:00 UTC (configured in celery_app.py beat schedule).
    """
    logger.info("💭 autoDream: starting nightly insight generation...")
    run_async(_auto_dream_all_companies())


async def _auto_dream_all_companies():
    from app.db.session import AsyncSessionLocal
    from app.models import Company, AgentMemory
    from app.services.ai_client import get_ai_client
    from app.core.config import settings
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Company.id).where(Company.is_active.is_(True)))
        company_ids = result.scalars().all()

    ai_client = get_ai_client()
    total = 0
    for company_id in company_ids:
        async with AsyncSessionLocal() as db:
            try:
                # Pull recent summaries for this company
                result = await db.execute(
                    select(AgentMemory.content)
                    .where(
                        AgentMemory.company_id == company_id,
                        AgentMemory.memory_type == "summary",
                    )
                    .order_by(AgentMemory.created_at.desc())
                    .limit(10)
                )
                summaries = [row[0] for row in result.fetchall()]
                if not summaries:
                    continue

                context = "\n---\n".join(summaries)
                prompt = (
                    "Com base nos resumos de conversas a seguir, gere um insight estratégico "
                    "resumido para esta empresa, identificando padrões, oportunidades ou riscos:\n\n"
                    + context[:3000]
                )
                response = await ai_client.complete(
                    provider="ollama",
                    model=settings.OLLAMA_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    company_id=company_id,
                    max_tokens=512,
                )
                if response.content:
                    db.add(AgentMemory(
                        company_id=company_id,
                        role="system",
                        content=f"[autoDream] {response.content.strip()}",
                        memory_type="summary",
                        memory_scope="company_shared",
                        session_id=f"dream_{company_id}",
                    ))
                    await db.commit()
                    total += 1
            except Exception as e:
                logger.warning(f"autoDream failed for company {company_id}: {e}")

    logger.info(f"💭 autoDream complete: {total} insights generated")


# ── Daily Cost Report Task (Celery Beat — daily) ─────────

@celery_app.task(name="daily_cost_report")
def daily_cost_report_task():
    """
    Log per-company AI cost for the previous day.

    Reads from usage_logs.ai_cost_usd and logs a structured summary.
    In production: send to Slack / email / analytics pipeline.
    """
    logger.info("💰 Running daily AI cost report...")
    run_async(_generate_cost_report())


async def _generate_cost_report():
    from app.db.session import AsyncSessionLocal
    from app.models import Company, UsageLog
    from sqlalchemy import select, func
    from datetime import datetime, timezone, timedelta

    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                UsageLog.company_id,
                func.sum(UsageLog.ai_tokens_used).label("total_tokens"),
                func.sum(UsageLog.ai_cost_usd).label("total_cost"),
            )
            .where(
                UsageLog.year == yesterday.year,
                UsageLog.month == yesterday.month,
            )
            .group_by(UsageLog.company_id)
        )
        rows = result.fetchall()

    total_cost = sum(r.total_cost or 0 for r in rows)
    total_tokens = sum(r.total_tokens or 0 for r in rows)

    logger.info(
        f"💰 Daily Cost Report [{yesterday}]: "
        f"{len(rows)} companies | "
        f"{total_tokens:,} tokens | "
        f"${total_cost:.4f} USD"
    )
    for row in rows:
        logger.debug(
            f"  Company {row.company_id}: "
            f"{row.total_tokens or 0:,} tokens / "
            f"${row.total_cost or 0:.4f}"
        )



# ── Stale Charges Cleanup Task (Celery Beat — hourly) ────────────────────────

@celery_app.task(name="cleanup_stale_charges", soft_time_limit=120, time_limit=180)
def cleanup_stale_charges():
    """
    Hourly task: cancela cobranças PIX pendentes há mais de 48h.

    Motivos para cancelar:
    1. PENDING/GENERATING_PIX com >48h sem pagamento (PIX expira no MP em 30min)
    2. due_date vencido há mais de 1 dia

    Tenta cancelar no MercadoPago primeiro (ignora 404 — já expirou lá).
    Limita 200 cobranças por execução.
    """
    logger.info("🧹 Iniciando limpeza de stale charges...")
    run_async(_cleanup_stale_charges())


async def _cleanup_stale_charges():
    """Lógica assíncrona de limpeza de cobranças stale — usa raw SQL para evitar
    problemas de casting com PostgreSQL enum (charge_status_enum)."""
    import app.models           # noqa — garante mappers
    import app.payments.models  # noqa — garante mappers

    from app.db.session import AsyncSessionLocal
    from app.payments.providers.mercadopago_provider import MercadoPagoProvider
    from sqlalchemy import text
    from datetime import datetime, timezone, timedelta

    STALE_HOURS   = 48
    DUE_DATE_DAYS = 1
    BATCH_LIMIT   = 200

    cutoff_ts  = datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)
    cutoff_due = datetime.now(timezone.utc).date() - timedelta(days=DUE_DATE_DAYS)

    cancelled_count = 0
    error_count     = 0

    async with AsyncSessionLocal() as db:
        # BUG-30 FIX: query unificada com OR — evita gap onde cobranças entre
        # 24h-48h sem due_date não eram capturadas por nenhuma das duas queries.
        # Query anterior: query1 pegava >48h, query2 pegava vencidas mas >cutoff.
        # Gap: cobranças 24h<age<48h sem due_date não eram capturadas.
        result = await db.execute(text("""
            SELECT id, company_id, external_payment_id, amount, due_date, created_at
            FROM payment_charges
            WHERE status::text IN ('pending', 'waiting_payment', 'sent')
              AND (
                created_at < :cutoff_ts
                OR (due_date IS NOT NULL AND due_date < :cutoff_due)
              )
            ORDER BY created_at ASC
            LIMIT :limit
        """), {"cutoff_ts": cutoff_ts, "cutoff_due": cutoff_due, "limit": BATCH_LIMIT})
        all_rows = {r[0]: r for r in result.fetchall()}

        if not all_rows:
            logger.info("✅ Nenhuma stale charge encontrada.")
            return

        logger.info(f"🔍 {len(all_rows)} stale charges encontradas...")

        try:
            provider = await MercadoPagoProvider.get_instance(db=db)
        except Exception as e:
            logger.warning(f"⚠️ Provider MP indisponível: {e} — cancelando só no DB")
            provider = None

        now_utc = datetime.now(timezone.utc)
        for charge_id, row in all_rows.items():
            try:
                ext_payment_id = row[2]
                amount         = row[3]
                due_date       = row[4]
                company_id     = row[1]

                if provider and ext_payment_id:
                    try:
                        await provider.cancel_charge(str(ext_payment_id))
                    except Exception as mp_err:
                        msg = str(mp_err)
                        if "404" not in msg and "not found" not in msg.lower():
                            logger.warning(f"⚠️ MP cancel erro charge #{charge_id}: {msg}")

                await db.execute(text("""
                    UPDATE payment_charges
                    SET status = 'cancelled', cancelled_at = :now, updated_at = :now
                    WHERE id = :id
                """), {"id": charge_id, "now": now_utc})

                # BUG-26 FIX: commit por item — evita que uma falha de lock/timeout
                # do PostgreSQL aborte a transação inteira e descarte todo o batch.
                # Sem isso, um erro na charge #198 de 200 descartava as 197 anteriores.
                await db.commit()

                cancelled_count += 1
                reason = (
                    f"vencida (due_date={due_date})"
                    if (due_date and due_date < cutoff_due)
                    else f"pendente há >{STALE_HOURS}h"
                )
                logger.info(
                    f"❌ Charge #{charge_id} cancelada "
                    f"| empresa {company_id} | R${amount:.2f} | {reason}"
                )
            except Exception as e:
                error_count += 1
                logger.error(f"Erro ao cancelar stale charge #{charge_id}: {e}")
                # Rollback do item com falha para limpar estado da sessão
                try:
                    await db.rollback()
                except Exception:
                    pass

    logger.info(f"✅ Stale cleanup: {cancelled_count} canceladas | {error_count} erros")


# ── CRM Broadcast Dispatch Task ──────────────────────────────────────────────

@celery_app.task(
    name="dispatch_crm_broadcast",
    bind=True,
    max_retries=1,
    soft_time_limit=3600,   # 1 hour
    time_limit=3660,
)
def dispatch_crm_broadcast(self: Task, broadcast_id: int):
    """Dispatch CRM broadcast messages with anti-ban delays.

    Processes pending broadcast logs one-by-one, sending each message
    via SmartMoon Engine with a 3-8 second random delay between sends.
    """
    logger.info(f"📢 CRM Broadcast #{broadcast_id}: starting dispatch...")
    try:
        run_async(_dispatch_broadcast(broadcast_id))
    except SoftTimeLimitExceeded:
        logger.error(f"⏰ Broadcast #{broadcast_id} timed out")
        run_async(_mark_broadcast_status(broadcast_id, "paused"))
    except Exception as exc:
        logger.error(f"💀 Broadcast #{broadcast_id} failed: {exc}")
        run_async(_mark_broadcast_status(broadcast_id, "paused"))


async def _dispatch_broadcast(broadcast_id: int):
    """Send messages for a broadcast campaign with anti-ban delays."""
    import asyncio
    import random
    import httpx

    import app.models  # noqa: F401

    from app.db.session import AsyncSessionLocal
    from app.core.config import settings
    from app.models.crm_models import CRMBroadcast, CRMBroadcastLog, CRMContact
    from sqlalchemy import select, update

    async with AsyncSessionLocal() as db:
        # Get broadcast
        result = await db.execute(
            select(CRMBroadcast).where(CRMBroadcast.id == broadcast_id)
        )
        broadcast = result.scalar_one_or_none()
        if not broadcast:
            logger.error(f"Broadcast #{broadcast_id} not found")
            return

        if broadcast.status not in ("sending",):
            logger.info(f"Broadcast #{broadcast_id} status={broadcast.status}, aborting")
            return

        # Find the SmartMoon instance for this company
        from app.models import Integration
        int_result = await db.execute(
            select(Integration).where(
                Integration.company_id == broadcast.company_id,
                Integration.provider == "smartmoon_whatsapp",
                Integration.status == "connected",
            )
        )
        integration = int_result.scalar_one_or_none()
        instance_id = None
        if integration and integration.config_json:
            instance_id = integration.config_json.get("instance_id")

        if not instance_id:
            logger.error(f"No WhatsApp instance for company {broadcast.company_id}")
            await db.execute(
                update(CRMBroadcast)
                .where(CRMBroadcast.id == broadcast_id)
                .values(status="paused")
            )
            await db.commit()
            return

        # Get pending logs
        pending_logs = await db.execute(
            select(CRMBroadcastLog)
            .where(
                CRMBroadcastLog.broadcast_id == broadcast_id,
                CRMBroadcastLog.status == "pending",
            )
            .order_by(CRMBroadcastLog.id)
        )
        logs = pending_logs.scalars().all()

        engine_url = settings.SMARTMOON_ENGINE_URL
        sent = 0
        failed = 0

        for log_entry in logs:
            # Check if broadcast was paused
            bc_check = await db.execute(
                select(CRMBroadcast.status).where(CRMBroadcast.id == broadcast_id)
            )
            current_status = bc_check.scalar()
            if current_status != "sending":
                logger.info(f"Broadcast #{broadcast_id} paused/cancelled, stopping dispatch")
                break

            # Interpolate message
            message = broadcast.message_template
            # Try to get contact name for interpolation
            if log_entry.contact_id:
                contact_result = await db.execute(
                    select(CRMContact.name).where(CRMContact.id == log_entry.contact_id)
                )
                contact_name = contact_result.scalar() or ""
                message = message.replace("{{contact_name}}", contact_name)

            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{engine_url}/messages/send-text",
                        headers={"X-API-Key": settings.SMARTMOON_ENGINE_KEY},
                        json={
                            "instanceId": instance_id,
                            "phone": log_entry.phone,
                            "text": message,
                        },
                    )
                    resp.raise_for_status()

                log_entry.status = "sent"
                log_entry.sent_at = datetime.now(timezone.utc)
                sent += 1
            except Exception as e:
                log_entry.status = "failed"
                log_entry.error_message = str(e)[:500]
                failed += 1

            await db.commit()

            # Anti-ban delay: 3-8 seconds random
            delay = random.uniform(3, 8)
            await asyncio.sleep(delay)

        # Update broadcast counters
        from datetime import datetime, timezone
        await db.execute(
            update(CRMBroadcast)
            .where(CRMBroadcast.id == broadcast_id)
            .values(
                sent_count=CRMBroadcast.sent_count + sent,
                failed_count=CRMBroadcast.failed_count + failed,
            )
        )

        # Check if all done
        remaining = await db.execute(
            select(func.count()).select_from(CRMBroadcastLog).where(
                CRMBroadcastLog.broadcast_id == broadcast_id,
                CRMBroadcastLog.status == "pending",
            )
        )
        still_pending = remaining.scalar() or 0

        if still_pending == 0:
            await db.execute(
                update(CRMBroadcast)
                .where(CRMBroadcast.id == broadcast_id)
                .values(status="completed", completed_at=datetime.now(timezone.utc))
            )

        await db.commit()
        logger.success(f"📢 Broadcast #{broadcast_id}: sent={sent}, failed={failed}, pending={still_pending}")


async def _mark_broadcast_status(broadcast_id: int, status: str):
    """Helper to update broadcast status."""
    from app.db.session import AsyncSessionLocal
    from app.models.crm_models import CRMBroadcast
    from sqlalchemy import update

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(CRMBroadcast)
            .where(CRMBroadcast.id == broadcast_id)
            .values(status=status)
        )
        await db.commit()

