import asyncio
from datetime import datetime, timezone, timedelta
from celery import shared_task
from loguru import logger
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.project import Project, ProjectTask, ProjectMember
from app.services.smartmoon_client import SmartMoonClient
from app.engine.handlers.key_resolver import resolve_api_key
from app.core.config import settings
import httpx

async def _generate_ai_message(project: Project, prompt_instruction: str, db) -> str:
    """Helper para gerar texto usando o LLM do projeto com o contexto atual."""
    from app.services.project_prompt import build_project_system_prompt
    
    # Busca tarefas e membros
    t_res = await db.execute(select(ProjectTask).where(ProjectTask.project_id == project.id))
    m_res = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project.id))
    tasks = t_res.scalars().all()
    members = m_res.scalars().all()
    
    # Monta o prompt do sistema
    sys_prompt = build_project_system_prompt(project, tasks, members, sender_phone="SYSTEM")
    
    # Provider
    api_key = await resolve_api_key("gemini", project.company_id, db, getattr(settings, "GEMINI_API_KEY", ""))
    if not api_key:
        return "Notificação automática de projeto (Falha na chave da IA)."
        
    model = project.agent_model or "gemini-2.5-flash"
    if not model.startswith("gemini"):
        model = "gemini-2.5-flash"
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt_instruction}]}],
        "systemInstruction": {"parts": [{"text": sys_prompt}]},
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 800}
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        return "Notificação de sistema (Falha de geração de texto)."

async def _process_project_cron(cron_type: str):
    logger.info(f"Iniciando cronjob de projeto: {cron_type}")
    async with AsyncSessionLocal() as db:
        # Busca projetos ativos com agente habilitado e grupo configurado
        p_res = await db.execute(
            select(Project).where(
                Project.status == "active",
                Project.agent_enabled == True,
                Project.whatsapp_group_id != None,
                Project.whatsapp_instance_id != None
            )
        )
        projects = p_res.scalars().all()
        
        for project in projects:
            try:
                msg = ""
                if cron_type == "morning":
                    msg = await _generate_ai_message(
                        project, 
                        "Gere uma mensagem curta de 'Bom dia' para a equipe no WhatsApp. "
                        "Liste de forma resumida as tarefas principais que precisam ser feitas HOJE ou que estão atrasadas. "
                        "Termine de forma motivacional. NUNCA invente tarefas que não estão na lista.",
                        db
                    )
                elif cron_type == "midday":
                    msg = await _generate_ai_message(
                        project,
                        "Gere um rápido 'Check de Meio-dia'. "
                        "Alerte se houver alguma tarefa pendente cujo prazo seja hoje. "
                        "Seja direto e marque os responsáveis se necessário.",
                        db
                    )
                elif cron_type == "evening":
                    msg = await _generate_ai_message(
                        project,
                        "Gere o 'Resumo do Dia' (17h). "
                        "Mencione o que foi concluído hoje (se houver), e quais pendências ficaram para amanhã. "
                        "Seja profissional e objetivo.",
                        db
                    )
                elif cron_type == "d-3":
                    # Checa tarefas que vencem em 3 dias
                    today = datetime.now(timezone.utc).date()
                    d3 = today + timedelta(days=3)
                    t_res = await db.execute(
                        select(ProjectTask).where(
                            ProjectTask.project_id == project.id,
                            ProjectTask.status.in_(["pending", "in_progress"]),
                            ProjectTask.due_date == d3
                        )
                    )
                    d3_tasks = t_res.scalars().all()
                    if not d3_tasks:
                        continue # Nada a alertar
                    msg = await _generate_ai_message(
                        project,
                        f"Temos {len(d3_tasks)} tarefa(s) que vencem em exatos 3 dias. "
                        "Gere um alerta proativo avisando a equipe e cobrando o andamento.",
                        db
                    )
                elif cron_type == "overdue":
                    today = datetime.now(timezone.utc).date()
                    t_res = await db.execute(
                        select(ProjectTask).where(
                            ProjectTask.project_id == project.id,
                            ProjectTask.status.in_(["pending", "in_progress"]),
                            ProjectTask.due_date < today
                        )
                    )
                    overdue_tasks = t_res.scalars().all()
                    if not overdue_tasks:
                        continue
                    msg = await _generate_ai_message(
                        project,
                        f"Temos {len(overdue_tasks)} tarefa(s) ATRASADAS. "
                        "Gere um alerta firme de cobrança marcando os responsáveis.",
                        db
                    )

                if msg:
                    logger.info(f"Enviando cronjob {cron_type} para projeto {project.id}")
                    await SmartMoonClient.send_text(
                        instance_id=project.whatsapp_instance_id,
                        phone=project.whatsapp_group_id,
                        message=msg
                    )
            except Exception as e:
                logger.error(f"Erro ao rodar cronjob {cron_type} pro projeto {project.id}: {e}")

def run_async(coro):
    """Executa a corrotina no loop ativo ou cria um novo se não houver."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return asyncio.create_task(coro)
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)

@shared_task(name="project_morning_alert")
def project_morning_alert_task():
    run_async(_process_project_cron("morning"))

@shared_task(name="project_midday_check")
def project_midday_check_task():
    run_async(_process_project_cron("midday"))

@shared_task(name="project_evening_summary")
def project_evening_summary_task():
    run_async(_process_project_cron("evening"))

@shared_task(name="project_d3_alert")
def project_d3_alert_task():
    run_async(_process_project_cron("d-3"))

@shared_task(name="project_overdue_alert")
def project_overdue_alert_task():
    run_async(_process_project_cron("overdue"))
