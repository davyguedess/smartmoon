"""
Smart Project Manager — Admin API.
SmartMoon admin endpoints to manage ALL projects across companies.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func as sa_func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import require_superadmin
from app.models.project import (
    Project, ProjectPhase, ProjectTask, ProjectMember,
    ProjectMeeting, ProjectAlert, ProjectDailyReport,
    ProjectDecision, ProjectComment
)

router = APIRouter(prefix="/admin/projects", tags=["Admin - Projects"])


# ── List all projects (cross-company) ────────────────────────────────────

@router.get("")
async def admin_list_projects(
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    """List all projects with stats. SuperUser only."""
    query = select(Project)
    if status:
        query = query.where(Project.status == status)
    if company_id:
        query = query.where(Project.company_id == company_id)

    # Count total
    count_q = select(sa_func.count(Project.id))
    if status:
        count_q = count_q.where(Project.status == status)
    if company_id:
        count_q = count_q.where(Project.company_id == company_id)
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(Project.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    projects = result.scalars().all()

    items = []
    for p in projects:
        # Task stats
        t_res = await db.execute(
            select(
                sa_func.count(ProjectTask.id),
                sa_func.count(ProjectTask.id).filter(ProjectTask.status == "completed"),
                sa_func.count(ProjectTask.id).filter(ProjectTask.status == "overdue"),
            ).where(ProjectTask.project_id == p.id)
        )
        row = t_res.one()

        # Member count
        m_count = (await db.execute(
            select(sa_func.count(ProjectMember.id)).where(ProjectMember.project_id == p.id)
        )).scalar() or 0

        # Alert count (unresolved)
        a_count = (await db.execute(
            select(sa_func.count(ProjectAlert.id)).where(
                ProjectAlert.project_id == p.id,
                ProjectAlert.resolved == False
            )
        )).scalar() or 0

        items.append({
            "id": p.id,
            "company_id": p.company_id,
            "name": p.name,
            "slug": p.slug,
            "status": p.status,
            "deadline": p.deadline.isoformat() if p.deadline else None,
            "agent_enabled": p.agent_enabled,
            "agent_model": p.agent_model,
            "total_tasks": row[0],
            "completed_tasks": row[1],
            "overdue_tasks": row[2],
            "members_count": m_count,
            "active_alerts": a_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


# ── Get single project details ───────────────────────────────────────────

@router.get("/{project_id}")
async def admin_get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    """Full project details for admin view."""
    p_res = await db.execute(select(Project).where(Project.id == project_id))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

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

    # Alerts
    a_res = await db.execute(
        select(ProjectAlert).where(ProjectAlert.project_id == project_id).order_by(ProjectAlert.created_at.desc()).limit(20)
    )
    alerts = a_res.scalars().all()

    # Decisions
    d_res = await db.execute(
        select(ProjectDecision).where(ProjectDecision.project_id == project_id).order_by(ProjectDecision.created_at.desc()).limit(20)
    )
    decisions = d_res.scalars().all()

    # Daily Reports
    dr_res = await db.execute(
        select(ProjectDailyReport).where(ProjectDailyReport.project_id == project_id).order_by(ProjectDailyReport.report_date.desc()).limit(10)
    )
    reports = dr_res.scalars().all()

    # Meetings
    mt_res = await db.execute(
        select(ProjectMeeting).where(ProjectMeeting.project_id == project_id).order_by(ProjectMeeting.created_at.desc()).limit(10)
    )
    meetings = mt_res.scalars().all()

    return {
        "project": {
            "id": project.id,
            "company_id": project.company_id,
            "name": project.name,
            "slug": project.slug,
            "description": project.description,
            "meta_goal": project.meta_goal,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "status": project.status,
            "agent_enabled": project.agent_enabled,
            "agent_profile_id": project.agent_profile_id,
            "flow_id": project.flow_id,
            "whatsapp_group_id": project.whatsapp_group_id,
            "agent_model": project.agent_model,
            "agent_provider": project.agent_provider,
            "created_at": project.created_at.isoformat() if project.created_at else None,
        },
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "progress_percent": t.progress_percent,
                "responsible_member_ids": t.responsible_member_ids or [],
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "completion_notes": t.completion_notes,
            } for t in tasks
        ],
        "members": [
            {
                "id": m.id,
                "name": m.name,
                "phone_number": m.phone_number,
                "role": m.role,
                "responsibilities": m.responsibilities,
                "is_active": m.is_active,
                "tasks_completed_count": m.tasks_completed_count,
                "tasks_overdue_count": m.tasks_overdue_count,
                "last_whatsapp_activity": m.last_whatsapp_activity.isoformat() if m.last_whatsapp_activity else None,
                "last_dashboard_access": m.last_dashboard_access.isoformat() if m.last_dashboard_access else None,
            } for m in members
        ],
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "title": a.title,
                "description": a.description,
                "severity": a.severity,
                "resolved": a.resolved,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            } for a in alerts
        ],
        "decisions": [
            {
                "id": d.id,
                "description": d.description,
                "decided_by": d.decided_by,
                "context": d.context,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            } for d in decisions
        ],
        "daily_reports": [
            {
                "id": r.id,
                "report_date": r.report_date.isoformat(),
                "report_text": r.report_text,
                "sent_to_whatsapp": r.sent_to_whatsapp,
            } for r in reports
        ],
        "meetings": [
            {
                "id": mt.id,
                "title": mt.title,
                "started_at": mt.started_at.isoformat() if mt.started_at else None,
                "ended_at": mt.ended_at.isoformat() if mt.ended_at else None,
                "status": mt.status,
                "participants_detected": mt.participants_detected or [],
                "ata_json": mt.ata_json,
            } for mt in meetings
        ],
    }


# ── Toggle agent on/off ──────────────────────────────────────────────────

@router.patch("/{project_id}/agent-toggle")
async def admin_toggle_agent(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    """Toggle the project agent on/off."""
    p_res = await db.execute(select(Project).where(Project.id == project_id))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

    project.agent_enabled = not project.agent_enabled
    await db.commit()
    return {"success": True, "agent_enabled": project.agent_enabled}


# ── Admin stats summary ──────────────────────────────────────────────────

@router.get("/stats/summary")
async def admin_projects_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_superadmin),
):
    """Global stats for the admin dashboard card."""
    total = (await db.execute(select(sa_func.count(Project.id)))).scalar() or 0
    active = (await db.execute(
        select(sa_func.count(Project.id)).where(Project.status == "active")
    )).scalar() or 0
    total_tasks = (await db.execute(select(sa_func.count(ProjectTask.id)))).scalar() or 0
    completed_tasks = (await db.execute(
        select(sa_func.count(ProjectTask.id)).where(ProjectTask.status == "completed")
    )).scalar() or 0
    overdue_tasks = (await db.execute(
        select(sa_func.count(ProjectTask.id)).where(ProjectTask.status == "overdue")
    )).scalar() or 0
    total_members = (await db.execute(select(sa_func.count(ProjectMember.id)))).scalar() or 0

    return {
        "total_projects": total,
        "active_projects": active,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "overdue_tasks": overdue_tasks,
        "total_members": total_members,
        "completion_rate": round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0,
    }
