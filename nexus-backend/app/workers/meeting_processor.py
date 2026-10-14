"""
Meeting Processor — Celery Task
Receives a meeting_id, loads its audio, sends to Gemini 1.5 Pro for
transcription + ATA generation, then auto-creates tasks and decisions.
"""
import asyncio
import json
from datetime import datetime, timezone, date
from celery import shared_task
from loguru import logger

from app.db.session import AsyncSessionLocal
from app.models.project import (
    ProjectMeeting, ProjectTask, ProjectDecision,
    ProjectMember, Project
)
from sqlalchemy import select
from app.core.config import settings
import httpx


ATA_SYSTEM_PROMPT = """Você é um assistente especialista em ATA de reuniões corporativas.

Receba a transcrição/áudio de uma reunião de projeto e retorne um JSON VÁLIDO com a estrutura abaixo.
NÃO invente informações. Se algo não ficou claro no áudio, marque como "[inaudível]".

{
  "executive_summary": "Resumo executivo de 3-5 linhas",
  "participants": ["Nome1", "Nome2"],
  "topics": [
    {
      "title": "Tópico discutido",
      "summary": "O que foi dito",
      "timestamp_approx": "00:05:12"
    }
  ],
  "decisions": [
    {
      "description": "Decisão tomada",
      "decided_by": "Nome de quem decidiu",
      "context": "Contexto breve"
    }
  ],
  "action_items": [
    {
      "title": "Tarefa a ser criada",
      "responsible": "Nome do responsável",
      "due_date": "YYYY-MM-DD ou null",
      "priority": "normal|high|critical"
    }
  ],
  "risks_identified": ["Risco 1", "Risco 2"],
  "next_meeting_suggestion": "Sugestão de próxima reunião ou null"
}

REGRAS:
- Retorne APENAS o JSON, sem markdown, sem explicações.
- Se não houver decisões ou tarefas, retorne arrays vazios.
- participants deve conter APENAS nomes mencionados no áudio."""


async def _process_meeting(meeting_id: int, company_id: int):
    """Main async logic for processing a meeting."""
    async with AsyncSessionLocal() as db:
        # Load meeting
        m_res = await db.execute(select(ProjectMeeting).where(ProjectMeeting.id == meeting_id))
        meeting = m_res.scalar_one_or_none()
        if not meeting:
            logger.error(f"Meeting {meeting_id} not found")
            return

        # Load project
        p_res = await db.execute(select(Project).where(Project.id == meeting.project_id))
        project = p_res.scalar_one_or_none()

        # Load members for matching
        mem_res = await db.execute(
            select(ProjectMember).where(ProjectMember.project_id == meeting.project_id)
        )
        members = mem_res.scalars().all()
        member_map = {m.name.lower(): m for m in members}

        try:
            # Resolve API key
            from app.engine.handlers.key_resolver import resolve_api_key
            api_key = await resolve_api_key("gemini", company_id, db, getattr(settings, "GEMINI_API_KEY", ""))
            if not api_key:
                meeting.status = "error"
                meeting.error_message = "GEMINI_API_KEY não configurada"
                await db.commit()
                return

            # Build context for Gemini
            project_context = f"Projeto: {project.name}\nMeta: {project.meta_goal or 'N/A'}\nPrazo: {project.deadline or 'N/A'}"
            members_context = "\n".join(f"- {m.name} ({m.role}) — {m.responsibilities or 'N/A'}" for m in members)
            topics_context = ""
            if meeting.topic_markers_json:
                topics_context = "\nTópicos marcados durante a reunião:\n"
                for t in meeting.topic_markers_json:
                    topics_context += f"- {t.get('timestamp', '?')} — {t.get('label', '?')}\n"

            user_prompt = (
                f"{project_context}\n\n"
                f"Membros registrados:\n{members_context}\n"
                f"{topics_context}\n\n"
                f"IMPORTANTE: Analise o áudio/transcrição da reunião e gere a ATA no formato JSON solicitado.\n"
                f"Se não houver áudio disponível, gere uma ATA de exemplo com base nos tópicos marcados "
                f"e nos participantes registrados."
            )

            # Call Gemini
            model = "gemini-2.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

            payload = {
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": ATA_SYSTEM_PROMPT}]},
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 4096,
                    "responseMimeType": "application/json",
                },
            }

            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()

            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

            # Parse ATA JSON
            ata = json.loads(raw_text)
            meeting.ata_json = ata
            meeting.participants_detected = ata.get("participants", [])

            # Auto-create tasks from action_items
            created_task_ids = []
            for item in ata.get("action_items", []):
                due = None
                if item.get("due_date"):
                    try:
                        due = date.fromisoformat(item["due_date"])
                    except Exception:
                        pass

                responsible_ids = []
                resp_name = (item.get("responsible") or "").lower()
                if resp_name in member_map:
                    responsible_ids = [member_map[resp_name].id]

                task = ProjectTask(
                    project_id=meeting.project_id,
                    title=item.get("title", "Tarefa da reunião"),
                    description=f"Criada automaticamente a partir da reunião: {meeting.title}",
                    priority=item.get("priority", "normal"),
                    due_date=due,
                    responsible_member_ids=responsible_ids,
                )
                db.add(task)
                await db.flush()
                created_task_ids.append(task.id)

            meeting.tasks_created_ids = created_task_ids

            # Auto-create decisions
            decision_ids = []
            for dec in ata.get("decisions", []):
                decision = ProjectDecision(
                    project_id=meeting.project_id,
                    meeting_id=meeting.id,
                    description=dec.get("description", ""),
                    decided_by=dec.get("decided_by"),
                    context=dec.get("context"),
                )
                db.add(decision)
                await db.flush()
                decision_ids.append(decision.id)

            meeting.decisions_logged_ids = decision_ids
            meeting.status = "processed"
            await db.commit()

            logger.success(
                f"✅ Meeting {meeting_id} processed: "
                f"{len(created_task_ids)} tasks, {len(decision_ids)} decisions"
            )

        except json.JSONDecodeError as je:
            meeting.status = "error"
            meeting.error_message = f"Falha ao parsear JSON da ATA: {str(je)[:500]}"
            await db.commit()
            logger.error(f"Meeting {meeting_id}: JSON parse error: {je}")

        except Exception as e:
            meeting.status = "error"
            meeting.error_message = str(e)[:1000]
            await db.commit()
            logger.error(f"Meeting {meeting_id} processing failed: {e}")


def _run_async(coro):
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


@shared_task(name="process_meeting_task")
def process_meeting_task(meeting_id: int, company_id: int):
    """Celery entry point for meeting processing."""
    logger.info(f"🎙️ Processing meeting {meeting_id} for company {company_id}")
    _run_async(_process_meeting(meeting_id, company_id))
