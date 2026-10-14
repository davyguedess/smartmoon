"""
Smart Project Manager — Function Calling Tools
10 tools for the AI agent to manage the project state via natural language.
"""
from typing import Any
from loguru import logger
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import AsyncSessionLocal as async_session_maker
from app.services.tool_registry import tool_registry
from app.models.project import (
    Project, ProjectTask, ProjectMember, ProjectAlert,
    ProjectDecision, ProjectDailyReport, ProjectMeeting
)

# ── 1. pm_get_status ──────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_get_status",
    description="Consulta o status geral do projeto, incluindo tarefas pendentes e em progresso.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer", "description": "ID do projeto"},
        },
        "required": ["project_id"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_get_status(project_id: int, company_id: int, **kwargs) -> dict:
    async with async_session_maker() as db:
        result = await db.execute(
            select(ProjectTask).where(
                ProjectTask.project_id == project_id,
                ProjectTask.status.in_(["pending", "in_progress", "blocked", "overdue"])
            )
        )
        tasks = result.scalars().all()
        return {
            "active_tasks_count": len(tasks),
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "progress_percent": t.progress_percent,
                    "responsible_ids": t.responsible_member_ids
                } for t in tasks
            ]
        }

# ── 2. pm_update_task ─────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_update_task",
    description="Atualiza o status ou o progresso (%) de uma tarefa específica.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "task_id": {"type": "integer"},
            "status": {"type": "string", "enum": ["pending", "in_progress", "blocked", "completed", "overdue"]},
            "progress_percent": {"type": "integer", "description": "0 a 100"},
        },
        "required": ["project_id", "task_id"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_update_task(project_id: int, task_id: int, company_id: int, status: str = None, progress_percent: int = None, **kwargs) -> dict:
    async with async_session_maker() as db:
        result = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id, ProjectTask.project_id == project_id))
        task = result.scalar_one_or_none()
        if not task:
            return {"error": f"Tarefa {task_id} não encontrada."}

        if status:
            task.status = status
            if status == "in_progress" and not task.started_at:
                task.started_at = datetime.now(timezone.utc)
        if progress_percent is not None:
            task.progress_percent = progress_percent

        await db.commit()
        return {"success": True, "message": f"Tarefa {task_id} atualizada.", "new_status": task.status, "new_progress": task.progress_percent}

# ── 3. pm_complete_task ───────────────────────────────────────────────────

@tool_registry.register(
    name="pm_complete_task",
    description="Marca uma tarefa como concluída (100%) e registra notas/comentários de conclusão.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "task_id": {"type": "integer"},
            "notes": {"type": "string", "description": "Notas sobre o que foi feito"},
            "member_phone": {"type": "string", "description": "Telefone de quem completou a tarefa (se via WhatsApp)"},
        },
        "required": ["project_id", "task_id", "notes"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_complete_task(project_id: int, task_id: int, notes: str, company_id: int, member_phone: str = None, **kwargs) -> dict:
    async with async_session_maker() as db:
        result = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id, ProjectTask.project_id == project_id))
        task = result.scalar_one_or_none()
        if not task:
            return {"error": f"Tarefa {task_id} não encontrada."}

        task.status = "completed"
        task.progress_percent = 100
        task.completed_at = datetime.now(timezone.utc)
        task.completion_notes = notes
        task.completion_method = "whatsapp"

        if member_phone:
            m_res = await db.execute(select(ProjectMember.id).where(ProjectMember.phone_number == member_phone, ProjectMember.project_id == project_id))
            m_id = m_res.scalar_one_or_none()
            if m_id:
                task.completed_by_member_id = m_id

        await db.commit()
        return {"success": True, "message": f"Tarefa {task_id} concluída com sucesso."}

# ── 4. pm_create_task ─────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_create_task",
    description="Cria uma nova tarefa no projeto. ATENÇÃO: Somente admin deve solicitar isso.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "priority": {"type": "string", "enum": ["normal", "high", "critical"]},
            "due_date_iso": {"type": "string", "description": "Formato YYYY-MM-DD"},
        },
        "required": ["project_id", "title"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_create_task(project_id: int, title: str, company_id: int, description: str = None, priority: str = "normal", due_date_iso: str = None, **kwargs) -> dict:
    async with async_session_maker() as db:
        due_date = date.fromisoformat(due_date_iso) if due_date_iso else None
        task = ProjectTask(
            project_id=project_id,
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return {"success": True, "task_id": task.id, "message": f"Tarefa '{title}' criada (ID {task.id})."}

# ── 5. pm_change_deadline ─────────────────────────────────────────────────

@tool_registry.register(
    name="pm_change_deadline",
    description="Altera o prazo (deadline) de uma tarefa. ATENÇÃO: Confirme que o remetente é ADMIN antes de usar.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "task_id": {"type": "integer"},
            "new_date_iso": {"type": "string", "description": "Novo prazo YYYY-MM-DD"},
            "reason": {"type": "string", "description": "Motivo da alteração"},
        },
        "required": ["project_id", "task_id", "new_date_iso", "reason"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_change_deadline(project_id: int, task_id: int, new_date_iso: str, reason: str, company_id: int, **kwargs) -> dict:
    async with async_session_maker() as db:
        result = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id, ProjectTask.project_id == project_id))
        task = result.scalar_one_or_none()
        if not task:
            return {"error": "Tarefa não encontrada."}

        old_date = task.due_date.isoformat() if task.due_date else "Sem prazo"
        task.due_date = date.fromisoformat(new_date_iso)
        
        # Loga motivo como comentário automático
        from app.models.project import ProjectComment
        db.add(ProjectComment(task_id=task_id, content=f"Prazo alterado de {old_date} para {new_date_iso}. Motivo: {reason}", source="agent"))
        
        await db.commit()
        return {"success": True, "message": f"Prazo alterado para {new_date_iso}."}

# ── 6. pm_assign_member ───────────────────────────────────────────────────

@tool_registry.register(
    name="pm_assign_member",
    description="Designa um responsável para uma tarefa (por nome ou ID).",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "task_id": {"type": "integer"},
            "member_name": {"type": "string"},
        },
        "required": ["project_id", "task_id", "member_name"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_assign_member(project_id: int, task_id: int, member_name: str, company_id: int, **kwargs) -> dict:
    async with async_session_maker() as db:
        # Encontra o member
        m_res = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.name.ilike(f"%{member_name}%")))
        member = m_res.scalars().first()
        if not member:
            return {"error": f"Membro '{member_name}' não encontrado."}

        t_res = await db.execute(select(ProjectTask).where(ProjectTask.id == task_id, ProjectTask.project_id == project_id))
        task = t_res.scalar_one_or_none()
        if not task:
            return {"error": "Tarefa não encontrada."}

        curr = list(task.responsible_member_ids)
        if member.id not in curr:
            curr.append(member.id)
            task.responsible_member_ids = curr
            await db.commit()
            return {"success": True, "message": f"{member.name} adicionado à tarefa {task_id}."}
        return {"success": True, "message": f"{member.name} já era responsável."}

# ── 7. pm_create_alert ────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_create_alert",
    description="Cria um alerta de risco ou bloqueio relatado pela equipe.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "alert_type": {"type": "string", "enum": ["risk", "blocked", "overdue"]},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
        },
        "required": ["project_id", "alert_type", "title"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_create_alert(project_id: int, alert_type: str, title: str, company_id: int, description: str = None, severity: str = "medium", **kwargs) -> dict:
    async with async_session_maker() as db:
        alert = ProjectAlert(
            project_id=project_id,
            alert_type=alert_type,
            title=title,
            description=description,
            severity=severity,
        )
        db.add(alert)
        await db.commit()
        return {"success": True, "message": "Alerta registrado. Sugira no chat discutir com a equipe."}

# ── 8. pm_log_decision ────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_log_decision",
    description="Registra uma decisão oficial do projeto comunicada via chat.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "description": {"type": "string"},
            "decided_by": {"type": "string", "description": "Nome de quem decidiu"},
            "context": {"type": "string", "description": "Contexto breve"},
        },
        "required": ["project_id", "description"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_log_decision(project_id: int, description: str, company_id: int, decided_by: str = None, context: str = None, **kwargs) -> dict:
    async with async_session_maker() as db:
        decision = ProjectDecision(
            project_id=project_id,
            description=description,
            decided_by=decided_by,
            context=context,
        )
        db.add(decision)
        await db.commit()
        return {"success": True, "message": "Decisão oficializada no diário do projeto."}

# ── 9. pm_daily_report ────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_daily_report",
    description="Grava e recupera o relatório do dia.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "report_text": {"type": "string", "description": "Resumo executivo do dia a ser guardado."},
        },
        "required": ["project_id", "report_text"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_daily_report(project_id: int, report_text: str, company_id: int, **kwargs) -> dict:
    async with async_session_maker() as db:
        today = datetime.now(timezone.utc).date()
        rep = ProjectDailyReport(
            project_id=project_id,
            report_date=today,
            report_text=report_text,
            sent_to_whatsapp=True
        )
        db.add(rep)
        try:
            await db.commit()
            return {"success": True, "message": "Relatório salvo."}
        except Exception:
            await db.rollback()
            return {"error": "Relatório de hoje já existe, não foi sobrescrito."}

# ── 10. pm_get_metrics ────────────────────────────────────────────────────

@tool_registry.register(
    name="pm_get_metrics",
    description="Obtém métricas REAIS de tráfego pago (Meta Ads, Google Ads) ou combinadas do projeto.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer"},
            "platform": {"type": "string", "enum": ["meta_ads", "google_ads", "general"], "description": "Plataforma para buscar métricas"},
            "date_range": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_14d", "last_30d"], "description": "Período de análise"},
        },
        "required": ["project_id"],
    },
    plans=["free", "pro", "enterprise"],
)
async def pm_get_metrics(project_id: int, company_id: int, platform: str = "general", date_range: str = "last_7d", **kwargs) -> dict:
    from app.services.project_metrics_service import (
        get_meta_ads_metrics, get_google_ads_metrics, get_combined_metrics
    )
    async with async_session_maker() as db:
        # Resolve company_id from project if needed
        if not company_id:
            p_res = await db.execute(select(Project).where(Project.id == project_id))
            proj = p_res.scalar_one_or_none()
            if proj:
                company_id = proj.company_id

        if platform == "meta_ads":
            return await get_meta_ads_metrics(db, company_id, date_range)
        elif platform == "google_ads":
            return await get_google_ads_metrics(db, company_id, date_range)
        else:
            return await get_combined_metrics(db, company_id, date_range)

