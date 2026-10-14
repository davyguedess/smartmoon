"""
Trained Agent Handler — loads a saved AgentProfile and uses its
persona (system_prompt, model, provider, memory_rules, skills) to respond.

Key features:
- Groq Function Calling (tool use) for Duarte Estética API
- Injects agent identity into system prompt (never exposes LLM brand)
- On the FIRST message of a conversation, generates an auto-introduction
- 15-minute cooldown on introductions (not per-message)
- Saves both user and assistant messages to AgentMemory
- Falls back to Smart Moon — Lua Inteligente if no agent is configured
- Sanitizes responses to never leak internal IDs, function calls, or technical data
"""
import os
import json
import re
import httpx
from datetime import datetime, timezone
from loguru import logger
from sqlalchemy import select

from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings
from app.models import AgentMemory, AgentProfile


# ── Brand name when no agent is configured ─────────────────────────────────
PLATFORM_NAME = "Smart Moon — Lua Inteligente"
PLATFORM_ASSISTANT = "Lua"
DEFAULT_SYSTEM_PROMPT = (
    f"Você é {PLATFORM_ASSISTANT}, assistente virtual da {PLATFORM_NAME}. "
    "Responda sempre em Português de forma clara, objetiva e prestativa."
)

# ── Booking API config ───────────────────────────────────────────────────────
# These are the LEGACY DEFAULTS (Duarte Estética). Multi-tenant: when a company
# has an ExternalApiBinding for slug 'duarte_booking', _resolve_booking_api()
# returns that company's own base_url + key instead. The defaults are kept only
# as a fallback so the original Duarte tenant keeps working with zero config.
_DEFAULT_BOOKING_BASE = os.getenv("DUARTE_API_BASE", "https://esteticaduarte.com/booking/api_bookings")
_DEFAULT_BOOKING_KEY = os.getenv("DUARTE_API_KEY", "")
_DEFAULT_BOOKING_HEADERS = {"X-API-Key": _DEFAULT_BOOKING_KEY, "Content-Type": "application/json"}

# Slug of the ExternalApiConfig that defines the booking API (see seed_duarte_api.sql)
BOOKING_API_SLUG = "duarte_booking"


async def _resolve_booking_api(db, company_id) -> tuple:
    """Resolve the booking API base URL + auth headers for a company.

    Looks up an active ExternalApiBinding → ExternalApiConfig (slug=BOOKING_API_SLUG)
    for the company and uses its base_url + (api_key_override or default_api_key).
    Falls back to the legacy Duarte defaults when no binding exists, so existing
    deployments keep working and new tenants only need a binding row — no code change.
    """
    if not db or not company_id:
        return _DEFAULT_BOOKING_BASE, dict(_DEFAULT_BOOKING_HEADERS)
    try:
        from app.models.external_api import ExternalApiConfig, ExternalApiBinding
        row = await db.execute(
            select(ExternalApiConfig, ExternalApiBinding)
            .join(ExternalApiBinding, ExternalApiBinding.api_config_id == ExternalApiConfig.id)
            .where(
                ExternalApiBinding.company_id == company_id,
                ExternalApiConfig.slug == BOOKING_API_SLUG,
                ExternalApiBinding.is_active == True,
                ExternalApiConfig.is_active == True,
            )
        )
        match = row.first()
        if match:
            config, binding = match
            base = (config.base_url or _DEFAULT_BOOKING_BASE).rstrip("/")
            key = binding.api_key_override or config.default_api_key or _DEFAULT_BOOKING_KEY
            header_name = config.auth_header_name or "X-API-Key"
            headers = {header_name: key, "Content-Type": "application/json"}
            return base, headers
    except Exception as e:
        logger.warning(f"_resolve_booking_api fallback (company={company_id}): {e}")
    return _DEFAULT_BOOKING_BASE, dict(_DEFAULT_BOOKING_HEADERS)

# ── Groq Tool Definitions for Duarte API (buscar_servicos removido — catálogo no prompt) ───
DUARTE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_datas_disponiveis",
            "description": (
                "Busca TODAS as datas e horários disponíveis para um serviço nos próximos 7 dias. "
                "Use esta ferramenta IMEDIATAMENTE quando o cliente escolher um serviço. "
                "Retorna apenas os dias que possuem vagas, com os horários de cada dia."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "service_id": {
                        "type": "integer",
                        "description": "ID do serviço conforme catálogo interno",
                    },
                },
                "required": ["service_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_horarios",
            "description": "Busca horários disponíveis para um serviço em uma data ESPECÍFICA. Use apenas se o cliente pedir uma data diferente das já mostradas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_id": {
                        "type": "integer",
                        "description": "ID do serviço",
                    },
                    "date": {
                        "type": "string",
                        "description": "Data no formato YYYY-MM-DD",
                    },
                },
                "required": ["service_id", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "criar_agendamento",
            "description": (
                "Cria um agendamento confirmado para o cliente. "
                "NÃO pergunte forma de pagamento. O agendamento é confirmado direto. "
                "Use SOMENTE após o cliente confirmar serviço, data, horário e dados pessoais."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "service_id": {
                        "type": "integer",
                        "description": "ID do serviço",
                    },
                    "date": {
                        "type": "string",
                        "description": "Data escolhida no formato YYYY-MM-DD (ex: 2026-05-14)",
                    },
                    "time": {
                        "type": "string",
                        "description": "Horário escolhido no formato HH:MM (ex: 09:00)",
                    },
                    "nome": {
                        "type": "string",
                        "description": "Nome completo do cliente",
                    },
                    "telefone": {
                        "type": "string",
                        "description": "Telefone do cliente com DDD (ex: 5585999999999)",
                    },
                    "email": {
                        "type": "string",
                        "description": "E-mail do cliente",
                    },
                },
                "required": ["service_id", "date", "time", "nome", "telefone", "email"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_agendamento",
            "description": "Consulta agendamentos existentes de um cliente pelo telefone ou nome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "telefone": {
                        "type": "string",
                        "description": "Telefone do cliente com DDD",
                    },
                    "nome": {
                        "type": "string",
                        "description": "Nome do cliente (alternativo ao telefone)",
                    },
                    "email": {
                        "type": "string",
                        "description": "E-mail do cliente",
                    },
                    "cpf": {
                        "type": "string",
                        "description": "CPF do cliente",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancelar_agendamento",
            "description": "Cancela um agendamento pelo booking_id e booking_token.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "integer",
                        "description": "ID do agendamento",
                    },
                    "booking_token": {
                        "type": "string",
                        "description": "Token de segurança do agendamento",
                    },
                },
                "required": ["booking_id", "booking_token"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gerar_fatura",
            "description": (
                "Gera e retorna a fatura em PDF de um agendamento. "
                "Use quando o cliente pedir comprovante, recibo, fatura ou nota do agendamento. "
                "Retorna o link para download do PDF."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "integer",
                        "description": "ID do agendamento para gerar a fatura",
                    },
                },
                "required": ["booking_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gerar_pix_agendamento",
            "description": (
                "Gera um código PIX para pagamento de um agendamento existente. "
                "Use APENAS quando o cliente perguntar como pagar e escolher PIX. "
                "Precisa do booking_id do agendamento."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "integer",
                        "description": "ID do agendamento para gerar o PIX",
                    },
                },
                "required": ["booking_id"],
            },
        },
    },
]


# ── Duarte API executor ──────────────────────────────────────────────────────

async def _execute_duarte_tool(
    name: str, args: dict, api_base: str = None, headers: dict = None
) -> str:
    """Execute a booking API tool call and return result as JSON string.

    api_base/headers are resolved per-company by _resolve_booking_api(); they
    default to the legacy Duarte endpoint so direct callers keep working.
    """
    api_base = (api_base or _DEFAULT_BOOKING_BASE).rstrip("/")
    headers = headers or _DEFAULT_BOOKING_HEADERS
    try:
        async with httpx.AsyncClient(timeout=15) as client:

            if name == "buscar_servicos":
                resp = await client.get(f"{api_base}/services", headers=headers)
                data = resp.json()
                services = data.get("services", [])[:8]  # limit 8 (fewer tokens)
                result = [
                    {
                        "service_id": s["service_id"],
                        "nome": s["nome"],
                        "preco": s.get("preco", 0),
                        "categoria": s.get("categoria", ""),
                    }
                    for s in services
                ]
                logger.info(f"🔧 buscar_servicos → {len(result)} serviços")
                return json.dumps({"servicos": result, "total": data.get("total", len(result))})

            elif name == "buscar_datas_disponiveis":
                # Single API call — the Duarte API returns ALL dates at once
                from datetime import timedelta as td
                from collections import defaultdict
                service_id = args.get("service_id")
                now_brt = datetime.now(timezone(td(hours=-3)))
                today_str = now_brt.strftime("%Y-%m-%d")
                current_time_str = now_brt.strftime("%H:%M")
                day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

                resp = await client.get(
                    f"{api_base}/available_slots/{service_id}",
                    headers=headers,
                )
                data = resp.json()
                all_slots = data.get("slots", [])

                # Group slots by their actual date
                by_date = defaultdict(list)
                for s in all_slots:
                    by_date[s["data"]].append(s)

                # Sort dates and filter
                dias_com_vaga = []
                for date_str in sorted(by_date.keys()):
                    if date_str < today_str:
                        continue  # skip past dates
                    if len(dias_com_vaga) >= 3:
                        break

                    slots = by_date[date_str]
                    # For today: filter out times that already passed
                    if date_str == today_str:
                        slots = [s for s in slots if s.get("inicio", "00:00") > current_time_str]
                    if not slots:
                        continue

                    # Calculate label
                    from datetime import date as dt_date
                    parts = date_str.split("-")
                    slot_date = dt_date(int(parts[0]), int(parts[1]), int(parts[2]))
                    today_date = now_brt.date()
                    diff_days = (slot_date - today_date).days
                    if diff_days == 0:
                        label = "Hoje"
                    elif diff_days == 1:
                        label = "Amanhã"
                    else:
                        label = day_names[slot_date.weekday()]

                    horarios = [
                        {"horario": s["inicio"], "availability_id": s["availability_id"]}
                        for s in slots[:6]
                    ]
                    dias_com_vaga.append({
                        "dia": f"{label}, {slot_date.strftime('%d/%m')}",
                        "data": date_str,
                        "horarios": horarios,
                    })

                logger.info(f"🔧 buscar_datas_disponiveis service={service_id} → {len(dias_com_vaga)} dias com vagas (total slots: {len(all_slots)})")
                if not dias_com_vaga:
                    return json.dumps({"mensagem": "Nenhum horário disponível nos próximos dias para este serviço."})
                return json.dumps({"dias_disponiveis": dias_com_vaga, "nota": "Mostre estas datas e pergunte se o cliente prefere outra data."})

            elif name == "buscar_horarios":
                service_id = args.get("service_id")
                date = args.get("date")
                resp = await client.get(
                    f"{api_base}/available_slots/{service_id}",
                    headers=headers,
                )
                data = resp.json()
                # Filter by requested date client-side (API returns all slots for service)
                all_slots = data.get("slots", [])
                if date:
                    all_slots = [s for s in all_slots if s.get("data") == date]
                slots = all_slots[:6]
                result = [
                    {
                        "availability_id": s["availability_id"],
                        "data": s["data"],
                        "inicio": s["inicio"],
                        "profissional": s.get("profissional", "").split()[0],
                    }
                    for s in slots
                ]
                logger.info(f"🔧 buscar_horarios service={service_id} date={date} → {len(result)} slots")
                return json.dumps({"horarios": result})

            elif name == "criar_agendamento":
                # Resolve availability_id from date+time by querying the API
                service_id = args["service_id"]
                target_date = args.get("date", "")
                target_time = args.get("time", "")
                nome = args["nome"]
                telefone = args["telefone"]
                email = args["email"]

                # Fetch real slots and find the matching one
                slots_resp = await client.get(
                    f"{api_base}/available_slots/{service_id}",
                    headers=headers,
                )
                slots_data = slots_resp.json()
                all_slots = slots_data.get("slots", [])

                # Find slot matching date + time
                availability_id = None
                for s in all_slots:
                    if s["data"] == target_date and s["inicio"] == target_time:
                        availability_id = s["availability_id"]
                        break

                if not availability_id:
                    logger.warning(f"🔧 criar_agendamento: no slot found for date={target_date} time={target_time} service={service_id}")
                    return json.dumps({"error": f"Horário {target_time} em {target_date} não está mais disponível. Tente outro horário."})

                logger.info(f"🔧 criar_agendamento: resolved availability_id={availability_id} for {target_date} {target_time}")

                payload = {
                    "service_id": service_id,
                    "availability_id": availability_id,
                    "nome": nome,
                    "telefone": telefone,
                    "email": email,
                    "metodo_pagamento": "dinheiro",  # Always confirm booking (no PIX at creation)
                }
                resp = await client.post(
                    f"{api_base}/create",
                    headers=headers,
                    json=payload,
                )
                data = resp.json()
                logger.info(f"🔧 criar_agendamento → booking_id={data.get('booking_id')} success={data.get('success')}")
                return json.dumps(data)

            elif name == "consultar_agendamento":
                params = {}
                if args.get("telefone"):
                    params["telefone"] = args["telefone"]
                if args.get("nome"):
                    params["nome"] = args["nome"]
                if args.get("email"):
                    params["email"] = args["email"]
                if args.get("cpf"):
                    params["cpf"] = args["cpf"]
                resp = await client.get(
                    f"{api_base}/lookup",
                    headers=headers,
                    params=params,
                )
                data = resp.json()
                logger.info(f"🔧 consultar_agendamento → {data}")
                return json.dumps(data)

            elif name == "cancelar_agendamento":
                booking_id = args.get("booking_id")
                motivo = args.get("motivo", "")
                resp = await client.post(
                    f"{api_base}/cancel/{booking_id}",
                    headers=headers,
                    json={"motivo": motivo} if motivo else {},
                )
                data = resp.json()
                logger.info(f"🔧 cancelar_agendamento booking_id={booking_id} → {data}")
                return json.dumps(data)

            elif name == "gerar_fatura":
                booking_id = args.get("booking_id")
                resp = await client.get(
                    f"{api_base}/invoice/{booking_id}",
                    headers=headers,
                )
                content_type = resp.headers.get("content-type", "")
                if "application/pdf" in content_type and resp.status_code == 200:
                    # Save PDF to storage and return URL
                    import os
                    storage_dir = "/app/storage/invoices"
                    os.makedirs(storage_dir, exist_ok=True)
                    filename = f"fatura_{booking_id}.pdf"
                    filepath = os.path.join(storage_dir, filename)
                    with open(filepath, "wb") as f:
                        f.write(resp.content)
                    # Build public URL
                    from app.core.config import settings
                    public_url = f"{settings.PUBLIC_API_URL}/storage/invoices/{filename}"
                    logger.info(f"🔧 gerar_fatura booking={booking_id} → {filepath} ({len(resp.content)} bytes)")
                    return json.dumps({
                        "success": True,
                        "message": f"Fatura gerada com sucesso",
                        "pdf_url": public_url,
                        "filename": filename,
                        "size_kb": round(len(resp.content) / 1024, 1),
                    })
                else:
                    # Error response (JSON)
                    try:
                        data = resp.json()
                    except Exception:
                        data = {"error": resp.text[:200]}
                    logger.warning(f"🔧 gerar_fatura booking={booking_id} → error: {data}")
                    return json.dumps(data)

            elif name == "gerar_pix_agendamento":
                booking_id = args.get("booking_id")
                resp = await client.post(
                    f"{api_base}/gerar_pix/{booking_id}",
                    headers=headers,
                )
                data = resp.json()
                logger.info(f"🔧 gerar_pix_agendamento booking_id={booking_id} → {data}")
                return json.dumps(data)

            else:
                return json.dumps({"error": f"Tool '{name}' not found"})

    except Exception as e:
        logger.error(f"_execute_duarte_tool [{name}] failed: {e}")
        return json.dumps({"error": str(e)})


class TrainedAgentHandler(BaseNodeHandler):
    """
    Executes a trained agent in a flow node.

    Required config:
        agent_id (int): ID of the AgentProfile to use.

    Optional config:
        fallback_message (str): Message if agent fails to respond.

    Context: expects standard flow context (message, conversation_id, company_id, _db).
    """

    async def execute(self, input_payload: dict) -> dict:
        # 1. Extract context
        message = self.context.get("message") or input_payload.get("message", "")
        conversation_id = self.context.get("conversation_id") or input_payload.get("conversation_id")
        company_id = self.context.get("company_id")
        db = self.context.get("_db")

        # 2. Load agent profile
        agent_id = self.config.get("agent_id") or input_payload.get("agent_id")
        if not agent_id:
            logger.warning("TrainedAgentHandler: No agent_id configured — using Smart Moon default")
            return await self._respond_as_platform(message, conversation_id, company_id, db)

        profile = None
        if db:
            try:
                result = await db.execute(
                    select(AgentProfile).where(
                        AgentProfile.id == int(agent_id),
                        AgentProfile.is_active == True,
                    )
                )
                profile = result.scalar_one_or_none()
            except Exception as e:
                logger.error(f"TrainedAgentHandler: failed to load profile {agent_id}: {e}")

        if not profile:
            logger.warning(f"TrainedAgentHandler: AgentProfile {agent_id} not found or inactive")
            return await self._respond_as_platform(message, conversation_id, company_id, db)

        # 3. Resolve model and system prompt
        model = profile.model or settings.OLLAMA_MODEL
        provider = profile.provider or "ollama"
        temperature = float(profile.temperature or 0.7)

        # 4. Build agent persona system prompt (async to allow DB calls)
        system_prompt = await self._build_agent_system_prompt(profile, db, conversation_id)

        # 5. Detect if intro is needed (intro cooldown) + load rich memory context
        INTRO_COOLDOWN_MINUTES = 15
        memory_context = []
        is_first_message = True
        last_ts = None
        customer_dossier = ""
        if db and conversation_id:
            # 5a. Lightweight last-assistant check for the intro cooldown
            try:
                last_a = await db.execute(
                    select(AgentMemory.created_at)
                    .where(AgentMemory.session_id == str(conversation_id))
                    .where(AgentMemory.memory_type == "message")
                    .where(AgentMemory.role == "assistant")
                    .order_by(AgentMemory.created_at.desc())
                    .limit(1)
                )
                last_ts = last_a.scalar()
                if last_ts:
                    age_minutes = (datetime.now(timezone.utc) - last_ts).total_seconds() / 60
                    is_first_message = age_minutes > INTRO_COOLDOWN_MINUTES
            except Exception as hist_err:
                logger.error(f"TrainedAgentHandler: intro detection failed: {hist_err}")

            # 5b. Rich memory: facts + summaries + knowledge RAG + recent messages
            #     (substitui o antigo history[:4] cru — agora o bot lembra fatos do
            #     cliente, resumos e base de conhecimento, não só as últimas 4 msgs)
            if company_id:
                try:
                    from app.services import memory_service
                    mem_budget = 8000
                    if profile.memory_rules:
                        mem_budget = int(profile.memory_rules.get("max_tokens_per_session", 8000))
                    memory_context = await memory_service.build_context(
                        db=db,
                        company_id=company_id,
                        session_id=str(conversation_id),
                        agent_id=profile.id,
                        max_tokens=mem_budget,
                    )
                except Exception as mem_err:
                    logger.error(f"TrainedAgentHandler: build_context failed: {mem_err}")

            # 5c. Customer dossier — quem é o cliente e se já é conhecido.
            #     Deixa o bot saudar pelo nome e reconhecer quem retorna (venda/atendimento).
            try:
                from app.models.whatsapp_models import WhatsAppConversation
                conv_res = await db.execute(
                    select(WhatsAppConversation).where(
                        WhatsAppConversation.id == int(conversation_id)
                    )
                )
                conv = conv_res.scalar_one_or_none()
                if conv:
                    nome = (conv.display_name or "").strip() or "cliente"
                    fone = conv.phone_number or conv.wa_id or ""
                    if last_ts is None:
                        situacao = "Primeiro contato — ainda não há histórico."
                    elif is_first_message:
                        situacao = "Cliente recorrente — está voltando após um intervalo. Cumprimente pelo nome e retome o contexto anterior."
                    else:
                        situacao = "Conversa em andamento."
                    customer_dossier = f"[CLIENTE] Nome: {nome} · Contato: {fone} · {situacao}"
            except Exception as dossier_err:
                logger.debug(f"TrainedAgentHandler: dossier skipped: {dossier_err}")

        # 6. Build LLM messages
        messages = [{"role": "system", "content": system_prompt}]
        if customer_dossier:
            messages.append({"role": "system", "content": customer_dossier})
        messages.extend(memory_context)
        if not memory_context or memory_context[-1].get("content") != message:
            messages.append({"role": "user", "content": message})

        # 7. If first message → inject intro instruction
        if is_first_message:
            intro_instruction = self._build_intro_instruction(profile)
            messages.insert(1, {"role": "system", "content": intro_instruction})

        # ── INTERCEPT FOR PROJECT TOOLS ──
        custom_tools = None
        if db:
            from app.models.project import Project
            from app.services.tool_registry import tool_registry
            p_res = await db.execute(select(Project).where(Project.agent_profile_id == profile.id))
            if p_res.scalar_one_or_none():
                custom_tools = [t.to_openai_function() for t in tool_registry._tools.values() if t.name.startswith("pm_")]

        # ── INTERCEPT FOR FINANCIAL TOOLS ──
        if getattr(profile, 'agent_type', None) == 'financial':
            try:
                import app.services.financial_tools  # noqa: F401 — ensure tools are registered
                from app.services.tool_registry import tool_registry as _fin_reg
                fin_tools = [t.to_openai_function() for t in _fin_reg._tools.values() if t.name.startswith("fin_")]
                if fin_tools:
                    custom_tools = (custom_tools or []) + fin_tools
                    logger.info(f"💰 Financial tools injected: {[t['function']['name'] for t in fin_tools]}")
            except Exception as fin_err:
                logger.warning(f"TrainedAgentHandler: financial tools injection failed: {fin_err}")

        # 8. Call LLM — Gemini é o provider principal para Duarte (function calling nativo)
        ai_response = self.config.get("fallback_message", "Tive um problema ao processar sua resposta.")

        try:
            if provider == "localai":
                ai_response = await self._call_localai_with_tools(model, messages, temperature)
            elif provider in ("ollama", "local"):
                ai_response = await self._call_ollama_with_tools(model, messages, temperature)
            elif provider == "gemini":
                try:
                    ai_response = await self._call_gemini_with_tools(model, messages, temperature, company_id, db, custom_tools=custom_tools)
                except Exception as gem_err:
                    logger.warning(f"Gemini tools failed: {gem_err} — retrying without tools")
                    try:
                        ai_response = await self._call_gemini(model, messages, temperature, company_id, db)
                    except Exception as gem_fallback_err:
                        logger.error(f"Gemini fallback also failed: {gem_fallback_err}")
                        ai_response = await self._call_ollama(settings.OLLAMA_MODEL, messages, temperature)
            elif provider == "openai":
                ai_response = await self._call_openai(model, messages, temperature, company_id, db)
            elif provider == "groq":
                try:
                    ai_response = await self._call_groq_with_tools(model, messages, temperature, company_id, db, custom_tools=custom_tools)
                except Exception as groq_err:
                    err_str = str(groq_err)
                    if "429" in err_str or "Too Many Requests" in err_str or "rate" in err_str.lower():
                        logger.warning("Groq rate-limited — falling back to Gemini")
                        try:
                            ai_response = await self._call_gemini_with_tools(model, messages, temperature, company_id, db, custom_tools=custom_tools)
                        except Exception:
                            ai_response = "Estou com alta demanda agora. Por favor, tente novamente em 1 minuto! 🙏"
                    else:
                        raise
            else:
                try:
                    ai_response = await self._call_gemini_with_tools(model, messages, temperature, company_id, db)
                except Exception:
                    ai_response = await self._call_ollama(model, messages, temperature)

        except Exception as e:
            logger.error(f"TrainedAgentHandler: LLM call failed: {e}")

        # 9. Persist to AgentMemory — save BOTH user and assistant messages
        if db and company_id:
            try:
                db.add(AgentMemory(
                    company_id=company_id,
                    session_id=str(conversation_id),
                    agent_id=profile.id,
                    role="user",
                    content=message,
                    model=model,
                    provider=provider,
                    memory_type="message",
                    created_at=datetime.now(timezone.utc),
                ))
                db.add(AgentMemory(
                    company_id=company_id,
                    session_id=str(conversation_id),
                    agent_id=profile.id,
                    role="assistant",
                    content=ai_response,
                    model=model,
                    provider=provider,
                    memory_type="message",
                    created_at=datetime.now(timezone.utc),
                ))
            except Exception as mem_err:
                logger.warning(f"TrainedAgentHandler: failed to save memory: {mem_err}")

            # 9b. Background memory governance (summarize + extract facts).
            #     Out-of-band via Celery — nunca atrasa a resposta do bot.
            try:
                from app.workers.tasks import memory_governance_task
                memory_governance_task.delay(
                    company_id=company_id,
                    session_id=str(conversation_id),
                    agent_id=profile.id,
                    user_message=message,
                )
            except Exception as gov_err:
                logger.warning(f"TrainedAgentHandler: failed to enqueue governance: {gov_err}")

        # Sanitize response — remove any leaked internal data
        ai_response = self._sanitize_response(ai_response, getattr(profile, 'agent_type', None))

        logger.info(f"TrainedAgentHandler: responded via agent '{profile.name}' (id={profile.id})")
        return {
            "ai_response": ai_response,
            "message": ai_response,
            "agent_name": profile.name,
            "agent_id": profile.id,
        }

    # ── Helper: Build system prompt with identity ────────────────────────────

    def _financial_meta_kwargs(self) -> dict:
        """Metadata de rastreio para as tools fin_* (sessão/telefone/tipo de entrada).

        As tools aceitam **kwargs; o LLM não gera esses campos, então eles só
        podem vir do contexto do flow.
        """
        ctx = self.context or {}
        conversation_id = ctx.get("conversation_id")
        return {
            "session_id": str(conversation_id) if conversation_id else None,
            "recorded_by_phone": ctx.get("wa_id"),
            "input_type": ctx.get("input_type") or "text",
            "raw_message": ctx.get("whisper_transcript") or ctx.get("message"),
            "agent_id": self.config.get("agent_id"),
        }

    async def _build_agent_system_prompt(self, profile: "AgentProfile", db=None, conversation_id=None) -> str:
        """Build system prompt that includes agent identity and installed skills."""
        
        # ── INTERCEPT FOR PROJECT MANAGER ──
        if db:
            from app.models.project import Project, ProjectTask, ProjectMember
            from app.models.whatsapp_models import WhatsAppConversation
            from app.services.project_prompt import build_project_system_prompt
            
            # Check if this agent is linked to a Project
            p_res = await db.execute(select(Project).where(Project.agent_profile_id == profile.id))
            project = p_res.scalar_one_or_none()
            
            if project:
                # Load tasks
                t_res = await db.execute(select(ProjectTask).where(ProjectTask.project_id == project.id).order_by(ProjectTask.step_number))
                tasks = t_res.scalars().all()
                
                # Load members
                m_res = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.is_active == True))
                members = m_res.scalars().all()
                
                # Get sender phone from conversation
                sender_phone = None
                if conversation_id:
                    c_res = await db.execute(select(WhatsAppConversation).where(WhatsAppConversation.id == conversation_id))
                    conv = c_res.scalar_one_or_none()
                    if conv and conv.wa_id:
                        # Convert to string to match member phone format
                        sender_phone = str(conv.wa_id).lstrip('+')

                # Build dynamic project prompt
                return build_project_system_prompt(project, tasks, members, sender_phone)

        # ── STANDARD AGENT PROMPT ──
        agent_name = profile.name
        description = profile.description or ""

        persona = (
            f"Você é {agent_name}, um assistente virtual inteligente. "
            f"Nunca mencione nem revele qual tecnologia de IA, modelo de linguagem ou plataforma você usa internamente. "
            f"Sempre se identifique apenas como {agent_name}. "
            f"\n\nREGRA ABSOLUTA — NUNCA faça nada disso na sua resposta ao cliente:"
            f"\n- NUNCA mencione IDs internos (service_id, availability_id, booking_id, etc)"
            f"\n- NUNCA escreva sintaxe de function call como <function=...> ou {{\"param\": value}}"
            f"\n- NUNCA mencione nomes de ferramentas (buscar_horarios, criar_agendamento, etc)"
            f"\n- NUNCA exponha dados técnicos, JSONs, ou códigos internos do sistema"
            f"\n- Use APENAS linguagem natural, amigável e humana com o cliente"
            f"\n- Refira-se aos serviços pelo NOME (ex: 'Limpeza de Pele'), nunca por ID"
        )

        if description:
            persona += f"\n\nSobre você: {description}"

        base_prompt = profile.system_prompt or ""
        if base_prompt:
            full_prompt = persona + "\n\n" + base_prompt
        else:
            full_prompt = persona + "\n\nResponda sempre em Português de forma clara, objetiva e prestativa."

        skills_patch = self._extract_skills_patch(profile)
        if skills_patch:
            full_prompt += "\n\n## Suas capacidades instaladas:\n" + skills_patch

        # ── Inject current date/time context so agent knows "today" ──────────
        from datetime import timedelta
        import locale
        now = datetime.now(timezone(timedelta(hours=-3)))  # BRT
        day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        today_name = day_names[now.weekday()]
        dates_info = []
        for i in range(4):
            d = now + timedelta(days=i)
            label = "HOJE" if i == 0 else ("AMANHÃ" if i == 1 else day_names[d.weekday()])
            dates_info.append(f"{label}: {d.strftime('%Y-%m-%d')} ({day_names[d.weekday()]}, {d.strftime('%d/%m')})")
        full_prompt += (
            f"\n\nCONTEXTO TEMPORAL:"
            f"\nAgora: {now.strftime('%d/%m/%Y %H:%M')} ({today_name})"
            f"\nPróximos dias: " + " | ".join(dates_info)
        )

        # ── Inject payment flow instructions (só p/ agentes de agendamento) ──
        # Agentes financeiros têm seu próprio fluxo no system_prompt do perfil;
        # as regras de agendamento/Pix confundiriam o modelo.
        if getattr(profile, 'agent_type', None) != 'financial':
            full_prompt += (
                "\n\n## FLUXO DE PAGAMENTO"
                "\nDurante o agendamento, NÃO pergunte forma de pagamento. Apenas agende."
                "\nO agendamento é confirmado automaticamente."
                "\n"
                "\nSE o cliente perguntar como pagar (ex: 'como pago?', 'aceita pix?', 'qual forma de pagamento?'):"
                "\n- Informe as opções: 💵 Dinheiro | 💳 Cartão | 🔵 PIX"
                "\n- Dinheiro e Cartão: pagamento no local, na hora do atendimento."
                "\n- PIX: use a ferramenta gerar_pix_agendamento com o booking_id para gerar o código."
                "\n  Envie o código Copia e Cola do PIX ao cliente."
                "\n- Se o cliente não tiver booking_id, consulte antes com consultar_agendamento."
            )

        return full_prompt

    @staticmethod
    def _sanitize_response(text: str, agent_type: str = None) -> str:
        """Strip any leaked internal data from the AI response before sending to the user.

        Os padrões agressivos de agendamento (apagar frases inteiras com *_id,
        "serviço N" etc.) não se aplicam a agentes financeiros — apagariam
        referências legítimas como "registro #12" ou frases com record_id.
        """
        if not text:
            return text
        # Remove function call syntax: <function=name>{...}</function>
        text = re.sub(r'<function=[^>]*>.*?</function>', '', text, flags=re.DOTALL)
        # Remove loose <function=...> tags without closing
        text = re.sub(r'<function=[^>]*>', '', text)
        if agent_type != 'financial':
            # Remove English-style IDs: "service_id: 89", "availability_id = 42"
            text = re.sub(r'\b(service_id|availability_id|booking_id|patient_id|doctor_id)\s*[:=]\s*\d+', '', text, flags=re.IGNORECASE)
            # Remove Portuguese-style ID mentions: "serviço_id é 89", "o serviço_id para..."
            text = re.sub(r'[Oo]?\s*servi[cç]o_id\s+(?:para\s+\w+\s+)?[eé]\s*\d+\.?', '', text, flags=re.IGNORECASE)
            # Remove "para o serviço 89", "do serviço 89", "serviço 89"
            text = re.sub(r'(?:para|do|no|o)\s+servi[cç]o\s+\d+', '', text, flags=re.IGNORECASE)
            # Remove standalone "serviço 89" pattern
            text = re.sub(r'\bservi[cç]o\s+\d+\b', '', text, flags=re.IGNORECASE)
            # Remove full sentences containing _id references (catches anything we missed)
            text = re.sub(r'[^.!?\n]*\b\w+_id\b[^.!?\n]*[.!?]?\s*', '', text, flags=re.IGNORECASE)
        # Remove raw JSON blocks that look like tool args
        text = re.sub(r'\{"(service_id|availability_id|date|booking_id|nome|telefone|email)"\s*:.*?\}', '', text, flags=re.DOTALL)
        # Remove tool function name mentions
        text = re.sub(r'\b(buscar_horarios|buscar_servicos|criar_agendamento|consultar_agendamento|cancelar_agendamento|gerar_fatura|fin_registrar_despesa|fin_consultar_registros|fin_resumo_periodo|fin_exportar_csv|fin_cancelar_registro|fin_atualizar_nota)\b', '', text, flags=re.IGNORECASE)
        # Clean up leftover whitespace artifacts
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'  +', ' ', text)
        text = re.sub(r'^\s*\n', '', text)
        return text.strip()

    def _extract_skills_patch(self, profile: "AgentProfile") -> str:
        cfg = profile.sales_config or {}
        if not cfg:
            return ""
        skills = cfg.get("installed_skills") or cfg.get("skills") or []
        if not skills:
            return ""
        patches = []
        for skill in skills:
            if isinstance(skill, dict):
                patch = skill.get("prompt_patch") or skill.get("description") or skill.get("name")
                if patch:
                    patches.append(f"- {patch}")
            elif isinstance(skill, str):
                patches.append(f"- {skill}")
        return "\n".join(patches)

    def _build_intro_instruction(self, profile: "AgentProfile") -> str:
        import random
        agent_name = profile.name

        # Varied style hints so each intro feels unique
        styles = [
            "Use um tom animado e acolhedor com emoji simpático.",
            "Seja breve e simpática, com tom leve e descontraído.",
            "Use um tom carinhoso e profissional, sem exageros.",
            "Seja calorosa e direta, com um toque de simpatia.",
            "Use tom gentil e natural, como quem já conhece a pessoa.",
            "Seja objetiva e amigável, com energia positiva.",
        ]
        style = random.choice(styles)

        return (
            f"INSTRUÇÃO ESPECIAL — PRIMEIRA MENSAGEM: "
            f"Apresente-se como {agent_name} de forma simples e natural. "
            f"Diga apenas seu nome e pergunte como pode ajudar. "
            f"NÃO liste funções, serviços, PIX, agendamentos ou capacidades. "
            f"NÃO use frases genéricas como 'Gerencio agendamentos, serviços e PIX'. "
            f"Apenas cumprimente, diga quem você é, e pergunte o que a pessoa precisa. "
            f"Crie uma saudação DIFERENTE a cada vez — nunca repita a mesma frase. "
            f"{style} "
            f"Máximo 2 frases curtas. Responda em Português."
        )

    # ── Fallback: respond as platform when no agent is set ──────────────────

    async def _respond_as_platform(self, message, conversation_id, company_id, db) -> dict:
        messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ]
        try:
            ai_response = await self._call_ollama(settings.OLLAMA_MODEL, messages, 0.7)
        except Exception as e:
            logger.error(f"TrainedAgentHandler platform fallback failed: {e}")
            ai_response = "Olá! Sou Lua, da Smart Moon. Como posso ajudar você?"

        return {
            "ai_response": ai_response,
            "message": ai_response,
            "agent_name": PLATFORM_ASSISTANT,
        }

    # ── LLM Provider: Groq with Function Calling ────────────────────────────

    async def _call_groq_with_tools(
        self, model: str, messages: list, temperature: float,
        company_id: int = None, db=None, custom_tools=None
    ) -> str:
        """
        Call Groq with Duarte API tools enabled.
        Runs an agentic loop: model may call tools multiple times before
        returning a final text response.
        """
        from app.engine.handlers.key_resolver import resolve_api_key
        api_key = await resolve_api_key("groq", company_id, db, getattr(settings, "GROQ_API_KEY", ""))
        if not api_key:
            raise ValueError("GROQ_API_KEY not configured")

        tools = custom_tools if custom_tools is not None else DUARTE_TOOLS
        booking_base, booking_headers = await _resolve_booking_api(db, company_id)
        current_messages = list(messages)
        MAX_TOOL_ROUNDS = 4  # supports: buscar_servicos → buscar_horarios → criar_agendamento → resposta
        tool_cache: dict = {}  # cache tool results to avoid duplicate calls

        async with httpx.AsyncClient(timeout=60) as client:
            for round_num in range(MAX_TOOL_ROUNDS):
                payload = {
                    "model": model,
                    "messages": current_messages,
                    "temperature": temperature,
                    "tools": tools,
                    "tool_choice": "auto",
                    "parallel_tool_calls": False,  # força 1 tool por round (evita consumo duplo)
                    "max_tokens": 512,
                }

                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json=payload,
                )
                if resp.status_code >= 400:
                    err_body = resp.text[:500]
                    logger.error(f"Groq API error {resp.status_code} round={round_num+1}: {err_body}")
                    resp.raise_for_status()
                data = resp.json()
                choice = data["choices"][0]
                finish_reason = choice.get("finish_reason")
                assistant_msg = choice["message"]

                current_messages.append(assistant_msg)

                if finish_reason == "tool_calls":
                    tool_calls = assistant_msg.get("tool_calls", [])
                    logger.info(f"🤖 Groq requested {len(tool_calls)} tool call(s) — round {round_num + 1}")

                    for tc in tool_calls:
                        tool_name = tc["function"]["name"]
                        try:
                            tool_args = json.loads(tc["function"]["arguments"])
                        except Exception:
                            tool_args = {}

                        cache_key = f"{tool_name}:{json.dumps(tool_args, sort_keys=True)}"
                        if cache_key in tool_cache:
                            tool_result = tool_cache[cache_key]
                            logger.info(f"  🗄️  Cache hit: {tool_name}")
                        else:
                            logger.info(f"  ⚙️  Calling tool: {tool_name}({tool_args})")
                            
                            if tool_name.startswith("pm_") or tool_name.startswith("fin_"):
                                from app.services.tool_registry import tool_registry
                                tool_def = tool_registry.get(tool_name)
                                exec_args = tool_args
                                if tool_name.startswith("fin_"):
                                    # Metadata só na execução — não vaza p/ cache_key nem histórico
                                    exec_args = {**self._financial_meta_kwargs(), **tool_args}
                                tool_result = await tool_def.handler(company_id=company_id, **exec_args)
                                if not isinstance(tool_result, str):
                                    tool_result = json.dumps(tool_result)
                            else:
                                tool_result = await _execute_duarte_tool(
                                    tool_name, tool_args, booking_base, booking_headers
                                )

                            tool_cache[cache_key] = tool_result
                            logger.info(f"  ✅ {tool_result[:150]}")

                        current_messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": tool_result,
                        })

                    continue

                else:
                    content = assistant_msg.get("content", "")
                    logger.info(f"✅ Groq final response after {round_num + 1} round(s)")
                    return content

            # ── Max rounds: forçar resposta final (client ainda aberto aqui!) ──
            logger.warning("Groq: max rounds reached — forcing final text response")
            current_messages.append({
                "role": "system",
                "content": "Responda ao cliente agora com as informações que você já tem. Não chame mais ferramentas."
            })
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": current_messages,
                      "temperature": temperature, "max_tokens": 400},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"].get(
                "content", "Não consegui completar a operação. Tente novamente."
            )

    # ── LLM Provider: OpenAI ─────────────────────────────────────────────────

    async def _call_openai(self, model: str, messages: list, temperature: float,
                           company_id: int = None, db=None) -> str:
        from app.engine.handlers.key_resolver import resolve_api_key
        api_key = await resolve_api_key("openai", company_id, db, getattr(settings, "OPENAI_API_KEY", ""))
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "temperature": temperature},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── LLM Provider: Groq (simple, no tools) ────────────────────────────────

    async def _call_groq(self, model: str, messages: list, temperature: float,
                         company_id: int = None, db=None) -> str:
        """Simple Groq call without tools — kept as fallback."""
        from app.engine.handlers.key_resolver import resolve_api_key
        api_key = await resolve_api_key("groq", company_id, db, getattr(settings, "GROQ_API_KEY", ""))
        if not api_key:
            raise ValueError("GROQ_API_KEY not configured")
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "temperature": temperature},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── LLM Provider: Gemini with Function Calling ─────────────────────────────

    async def _call_gemini_with_tools(
        self, model: str, messages: list, temperature: float,
        company_id: int = None, db=None, custom_tools=None
    ) -> str:
        """Call Gemini with Duarte API tools (native function calling)."""
        from app.engine.handlers.key_resolver import resolve_api_key
        api_key = await resolve_api_key("gemini", company_id, db, getattr(settings, "GEMINI_API_KEY", ""))
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured for this company")

        gemini_model = model if model.startswith("gemini") else "gemini-2.5-flash"

        # Convert OpenAI-format tools to Gemini format
        tools_to_use = custom_tools if custom_tools is not None else DUARTE_TOOLS
        booking_base, booking_headers = await _resolve_booking_api(db, company_id)
        gemini_tools = []
        for tool in tools_to_use:
            func = tool["function"]
            gemini_tools.append({
                "name": func["name"],
                "description": func["description"],
                "parameters": func["parameters"],
            })

        # Build system instruction from system messages
        system_instruction = None
        gemini_contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = (system_instruction or "") + "\n" + msg["content"]
            elif msg["role"] == "tool":
                gemini_contents.append({
                    "role": "user",
                    "parts": [{"text": f"[Resultado da ferramenta]: {msg['content']}"}]
                })
            else:
                role = "user" if msg["role"] == "user" else "model"
                gemini_contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })

        # Merge consecutive same-role turns (Gemini requirement)
        merged = []
        for turn in gemini_contents:
            if merged and merged[-1]["role"] == turn["role"]:
                merged[-1]["parts"][0]["text"] += "\n" + turn["parts"][0]["text"]
            else:
                merged.append(turn)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        MAX_TOOL_ROUNDS = 4

        async with httpx.AsyncClient(timeout=60) as client:
            for round_num in range(MAX_TOOL_ROUNDS):
                payload = {
                    "contents": merged,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 2048,
                    },
                    "tools": [{"functionDeclarations": gemini_tools}],
                }
                if system_instruction:
                    payload["systemInstruction"] = {
                        "parts": [{"text": system_instruction.strip()}]
                    }

                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()

                candidate = data["candidates"][0]
                parts = candidate.get("content", {}).get("parts", [])

                # Check for function call
                function_call = None
                text_response = None
                for part in parts:
                    if "functionCall" in part:
                        function_call = part["functionCall"]
                    if "text" in part:
                        text_response = part["text"]

                if function_call:
                    tool_name = function_call["name"]
                    tool_args = function_call.get("args", {})
                    logger.info(f"🤖 Gemini requested tool: {tool_name}({tool_args}) — round {round_num + 1}")

                    if tool_name.startswith("pm_") or tool_name.startswith("fin_"):
                        from app.services.tool_registry import tool_registry
                        tool_def = tool_registry.get(tool_name)
                        exec_args = tool_args
                        if tool_name.startswith("fin_"):
                            # Metadata só na execução — não ecoar no histórico do modelo
                            exec_args = {**self._financial_meta_kwargs(), **tool_args}
                        tool_result = await tool_def.handler(company_id=company_id, **exec_args)
                        if not isinstance(tool_result, str):
                            tool_result = json.dumps(tool_result)
                    else:
                        tool_result = await _execute_duarte_tool(
                            tool_name, tool_args, booking_base, booking_headers
                        )

                    logger.info(f"🔧 Tool result preview: {tool_result[:200]}")

                    # Append model's function call + tool result to conversation
                    merged.append({
                        "role": "model",
                        "parts": [{"functionCall": {"name": tool_name, "args": tool_args}}]
                    })
                    merged.append({
                        "role": "user",
                        "parts": [{"functionResponse": {
                            "name": tool_name,
                            "response": {"result": tool_result}
                        }}]
                    })
                    continue  # next round

                if text_response:
                    return text_response

                # Fallback: try to extract any text
                if parts:
                    return parts[0].get("text", "Desculpe, tive um problema. Pode repetir?")

            return "Desculpe, tive dificuldade em processar. Pode tentar de novo?"

    # ── LLM Provider: Gemini (simple, no tools) ───────────────────────────────

    async def _call_gemini(self, model: str, messages: list, temperature: float,
                           company_id: int = None, db=None) -> str:
        from app.engine.handlers.key_resolver import resolve_api_key
        api_key = await resolve_api_key("gemini", company_id, db, getattr(settings, "GEMINI_API_KEY", ""))
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured for this company")
        gemini_model = model if model.startswith("gemini") else "gemini-2.5-flash"
        system_instruction = None
        gemini_contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = (system_instruction or "") + "\n" + msg["content"]
            elif msg["role"] == "tool":
                gemini_contents.append({"role": "user", "parts": [{"text": f"[Resultado]: {msg['content']}"}]})
            else:
                role = "user" if msg["role"] == "user" else "model"
                gemini_contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        merged = []
        for turn in gemini_contents:
            if merged and merged[-1]["role"] == turn["role"]:
                merged[-1]["parts"][0]["text"] += "\n" + turn["parts"][0]["text"]
            else:
                merged.append(turn)
        payload = {"contents": merged, "generationConfig": {"temperature": temperature, "maxOutputTokens": 2048}}
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction.strip()}]}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    # ── LLM Provider: Ollama (local) ─────────────────────────────────────────

    async def _call_ollama(self, model: str, messages: list, temperature: float) -> str:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False,
                      "options": {"temperature": temperature}},
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    # ── LLM Provider: LocalAI (Docker, OpenAI-compatible) ─────────────────────

    async def _call_localai_with_tools(self, model: str, messages: list, temperature: float) -> str:
        """
        LocalAI tool-calling loop via OpenAI-compatible /v1/chat/completions.
        Uses Llama-3.2-3B-Instruct-GGUF (Q4_K_M) — zero cost, zero rate limits.
        Same tool format as Groq → reutiliza DUARTE_TOOLS sem mudanças.
        """
        base_url = settings.LOCALAI_BASE_URL  # http://nexus_localai:8080/v1
        current_messages = list(messages)
        MAX_TOOL_ROUNDS = 4
        tool_cache: dict = {}

        async with httpx.AsyncClient(timeout=120) as client:
            for round_num in range(MAX_TOOL_ROUNDS):
                payload = {
                    "model": model,
                    "messages": current_messages,
                    "tools": DUARTE_TOOLS,
                    "tool_choice": "auto",
                    "parallel_tool_calls": False,
                    "temperature": temperature,
                    "max_tokens": 512,
                }

                resp = await client.post(
                    f"{base_url}/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code >= 400:
                    logger.error(f"LocalAI error {resp.status_code}: {resp.text[:300]}")
                    resp.raise_for_status()

                data = resp.json()
                choice = data["choices"][0]
                msg = choice["message"]
                finish_reason = choice.get("finish_reason", "stop")
                tool_calls = msg.get("tool_calls") or []

                # Add assistant message to history
                assistant_msg: dict = {"role": "assistant", "content": msg.get("content") or ""}
                if tool_calls:
                    assistant_msg["tool_calls"] = tool_calls
                current_messages.append(assistant_msg)

                if tool_calls or finish_reason == "tool_calls":
                    logger.info(f"🤖 LocalAI tool call — round {round_num + 1}")
                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        tool_name = fn.get("name", "")
                        try:
                            tool_args = json.loads(fn.get("arguments", "{}"))
                        except Exception:
                            tool_args = {}
                        tool_call_id = tc.get("id", f"call_{round_num}")

                        cache_key = f"{tool_name}:{json.dumps(tool_args, sort_keys=True)}"
                        if cache_key in tool_cache:
                            tool_result = tool_cache[cache_key]
                            logger.info(f"  🗄️  Cache hit: {tool_name}")
                        else:
                            logger.info(f"  ⚙️  Tool: {tool_name}({tool_args})")
                            tool_result = await _execute_duarte_tool(tool_name, tool_args)
                            tool_cache[cache_key] = tool_result
                            logger.info(f"  ✅ {tool_result[:120]}")

                        current_messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": tool_result,
                        })
                    continue

                else:
                    content = msg.get("content", "")
                    logger.info(f"✅ LocalAI final response after {round_num + 1} round(s)")
                    return content

            # Max rounds — forçar resposta final
            logger.warning("LocalAI: max rounds — forcing final response")
            current_messages.append({
                "role": "user",
                "content": "Responda ao cliente agora com as informações que você já tem.",
            })
            resp = await client.post(
                f"{base_url}/chat/completions",
                json={"model": model, "messages": current_messages,
                      "temperature": temperature, "max_tokens": 256},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"].get("content", "Tente novamente em instantes.")
