"""
Smart Project Manager — PDF Report Generator
Generates a professional PDF report for a project using basic HTML→PDF.
Uses weasyprint if available, otherwise falls back to a simple text file.
"""
import os
import io
from datetime import datetime, timezone
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import (
    Project, ProjectTask, ProjectMember, ProjectPhase,
    ProjectDecision, ProjectDailyReport, ProjectAlert
)


async def generate_project_pdf(
    db: AsyncSession,
    project_id: int,
) -> bytes:
    """Generate a PDF report for the project. Returns PDF bytes."""

    # Load project data
    p_res = await db.execute(select(Project).where(Project.id == project_id))
    project = p_res.scalar_one_or_none()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Tasks
    t_res = await db.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id).order_by(ProjectTask.step_number)
    )
    tasks = t_res.scalars().all()

    # Members
    m_res = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )
    members = m_res.scalars().all()

    # Decisions
    d_res = await db.execute(
        select(ProjectDecision).where(ProjectDecision.project_id == project_id).order_by(ProjectDecision.created_at.desc()).limit(20)
    )
    decisions = d_res.scalars().all()

    # Alerts
    a_res = await db.execute(
        select(ProjectAlert).where(ProjectAlert.project_id == project_id).order_by(ProjectAlert.created_at.desc()).limit(10)
    )
    alerts = a_res.scalars().all()

    # Build stats
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    overdue = sum(1 for t in tasks if t.status == "overdue")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    pending = sum(1 for t in tasks if t.status == "pending")
    progress_pct = round((completed / total) * 100, 1) if total > 0 else 0

    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")

    # Build HTML
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.6; }}
  h1 {{ color: #6366f1; font-size: 22pt; border-bottom: 3px solid #6366f1; padding-bottom: 8px; margin-bottom: 4px; }}
  h2 {{ color: #334155; font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }}
  .meta {{ color: #64748b; font-size: 10pt; margin-bottom: 20px; }}
  .stat-grid {{ display: flex; gap: 15px; margin: 15px 0; }}
  .stat-box {{ flex: 1; background: #f1f5f9; border-radius: 8px; padding: 12px; text-align: center; }}
  .stat-box .value {{ font-size: 22pt; font-weight: 700; color: #6366f1; }}
  .stat-box .label {{ font-size: 9pt; color: #64748b; text-transform: uppercase; }}
  table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
  th {{ background: #6366f1; color: white; text-align: left; padding: 8px 10px; font-size: 10pt; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10pt; }}
  tr:nth-child(even) {{ background: #f8fafc; }}
  .status {{ padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 600; display: inline-block; }}
  .status-completed {{ background: #dcfce7; color: #166534; }}
  .status-in_progress {{ background: #dbeafe; color: #1e40af; }}
  .status-pending {{ background: #f1f5f9; color: #475569; }}
  .status-overdue {{ background: #fee2e2; color: #991b1b; }}
  .status-blocked {{ background: #fef3c7; color: #92400e; }}
  .footer {{ margin-top: 30px; text-align: center; color: #94a3b8; font-size: 9pt; border-top: 1px solid #e2e8f0; padding-top: 8px; }}
  .priority-high {{ color: #ea580c; font-weight: 600; }}
  .priority-critical {{ color: #dc2626; font-weight: 700; }}
  .alert-box {{ background: #fff1f2; border-left: 4px solid #ef4444; padding: 8px 12px; margin: 5px 0; border-radius: 0 4px 4px 0; }}
</style>
</head>
<body>

<h1>📊 {project.name}</h1>
<div class="meta">
  Meta: {project.meta_goal or 'Não definida'} &nbsp;|&nbsp;
  Prazo: {project.deadline.strftime('%d/%m/%Y') if project.deadline else 'Não definido'} &nbsp;|&nbsp;
  Gerado em: {now}
</div>

<div class="stat-grid">
  <div class="stat-box">
    <div class="value">{progress_pct}%</div>
    <div class="label">Progresso</div>
  </div>
  <div class="stat-box">
    <div class="value">{completed}/{total}</div>
    <div class="label">Tarefas Concluídas</div>
  </div>
  <div class="stat-box">
    <div class="value" style="color: {'#ef4444' if overdue > 0 else '#22c55e'}">{overdue}</div>
    <div class="label">Atrasadas</div>
  </div>
  <div class="stat-box">
    <div class="value">{len(members)}</div>
    <div class="label">Membros</div>
  </div>
</div>

<h2>📋 Tarefas</h2>
<table>
<tr><th>#</th><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Prazo</th><th>Progresso</th></tr>
"""

    for t in tasks:
        status_class = f"status-{t.status}"
        priority_class = f"priority-{t.priority}" if t.priority in ("high", "critical") else ""
        due = t.due_date.strftime("%d/%m/%Y") if t.due_date else "-"
        html += f"""<tr>
  <td>{t.id}</td>
  <td>{t.title}</td>
  <td><span class="status {status_class}">{t.status}</span></td>
  <td class="{priority_class}">{t.priority}</td>
  <td>{due}</td>
  <td>{t.progress_percent}%</td>
</tr>
"""

    html += "</table>"

    # Members section
    html += "<h2>👥 Equipe</h2><table><tr><th>Nome</th><th>Função</th><th>Responsabilidades</th><th>Concluídas</th></tr>"
    for m in members:
        html += f"""<tr>
  <td>{m.name} {'🔑' if m.role == 'admin' else ''}</td>
  <td>{m.role}</td>
  <td>{m.responsibilities or '-'}</td>
  <td>{m.tasks_completed_count}</td>
</tr>"""
    html += "</table>"

    # Decisions
    if decisions:
        html += "<h2>📌 Decisões Registradas</h2>"
        for d in decisions:
            date_str = d.created_at.strftime("%d/%m") if d.created_at else ""
            html += f"<p><strong>{date_str}</strong> — {d.description}"
            if d.decided_by:
                html += f" <em>(por {d.decided_by})</em>"
            html += "</p>"

    # Alerts
    if alerts:
        html += "<h2>⚠️ Alertas</h2>"
        for a in alerts:
            html += f'<div class="alert-box"><strong>[{a.severity.upper()}]</strong> {a.title}'
            if a.description:
                html += f" — {a.description}"
            html += "</div>"

    html += f"""
<div class="footer">
  Relatório gerado automaticamente pelo Smart Project Manager — SmartMoon.online<br>
  {now} UTC
</div>
</body></html>"""

    # Convert HTML to PDF
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        logger.warning("weasyprint not available — returning HTML as fallback")
        return html.encode("utf-8")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        return html.encode("utf-8")
