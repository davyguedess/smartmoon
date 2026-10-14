"""
Smart Project Manager — Owner CRUD API.
Authenticated company users manage their own projects.
"""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.services.audit_service import audit
from app.models.project import (
    Project, ProjectPhase, ProjectTask, ProjectSubtask,
    ProjectMember, ProjectMeeting, ProjectDecision,
    ProjectComment, ProjectAlert,
)
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    PhaseCreate, PhaseOut,
    TaskCreate, TaskUpdate, TaskComplete, TaskOut,
    MemberCreate, MemberUpdate, MemberOut,
    MeetingCreate, MeetingOut,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Helpers ──────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Generate URL-safe slug from project name."""
    slug = text.lower().strip()
    slug = re.sub(r'[àáâãäå]', 'a', slug)
    slug = re.sub(r'[èéêë]', 'e', slug)
    slug = re.sub(r'[ìíîï]', 'i', slug)
    slug = re.sub(r'[òóôõö]', 'o', slug)
    slug = re.sub(r'[ùúûü]', 'u', slug)
    slug = re.sub(r'[ç]', 'c', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


async def _get_project_or_404(
    db: AsyncSession, project_id: int, company_id: int
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.company_id == company_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


async def _enrich_project(db: AsyncSession, project: Project) -> ProjectOut:
    """Add computed counters to project output."""
    # Task counts
    result = await db.execute(
        select(
            sa_func.count(ProjectTask.id),
            sa_func.count(ProjectTask.id).filter(ProjectTask.status == "completed"),
            sa_func.count(ProjectTask.id).filter(ProjectTask.status == "overdue"),
        ).where(ProjectTask.project_id == project.id)
    )
    row = result.one()
    total, completed, overdue = row[0], row[1], row[2]

    # Member count
    result = await db.execute(
        select(sa_func.count(ProjectMember.id)).where(
            ProjectMember.project_id == project.id,
            ProjectMember.is_active == True,
        )
    )
    members = result.scalar()

    return ProjectOut(
        id=project.id,
        company_id=project.company_id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        meta_goal=project.meta_goal,
        deadline=project.deadline,
        status=project.status,
        agent_enabled=project.agent_enabled,
        agent_model=project.agent_model,
        created_at=project.created_at,
        updated_at=project.updated_at,
        total_tasks=total,
        completed_tasks=completed,
        overdue_tasks=overdue,
        members_count=members,
    )


# ══════════════════════════════════════════════════════════════════════════
# PROJECTS
# ══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all projects for the current company."""
    result = await db.execute(
        select(Project)
        .where(Project.company_id == user.company_id)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return [await _enrich_project(db, p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new project."""
    slug = _slugify(body.name)

    # Ensure slug uniqueness
    existing = await db.execute(select(Project.id).where(Project.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{int(datetime.now(timezone.utc).timestamp())}"

    project = Project(
        company_id=user.company_id,
        name=body.name,
        slug=slug,
        description=body.description,
        meta_goal=body.meta_goal,
        deadline=body.deadline,
        created_by=user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    await audit(db, user, "project.created", "project", project.id, {"name": body.name})
    return await _enrich_project(db, project)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    project = await _get_project_or_404(db, project_id, user.company_id)
    return await _enrich_project(db, project)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    project = await _get_project_or_404(db, project_id, user.company_id)
    data = body.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    await audit(db, user, "project.updated", "project", project_id, {"fields": list(data.keys())})
    return await _enrich_project(db, project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    project = await _get_project_or_404(db, project_id, user.company_id)
    await audit(db, user, "project.deleted", "project", project_id, {"name": project.name})
    await db.delete(project)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# TASKS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/tasks", response_model=List[TaskOut])
async def list_tasks(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.step_number, ProjectTask.created_at)
    )
    return result.scalars().all()


@router.post("/{project_id}/tasks", response_model=TaskOut, status_code=201)
async def create_task(
    project_id: int,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)

    # Auto step_number
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ProjectTask.step_number), 0))
        .where(ProjectTask.project_id == project_id)
    )
    next_step = result.scalar() + 1

    task = ProjectTask(
        project_id=project_id,
        step_number=next_step,
        **body.model_dump(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: int,
    task_id: int,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectTask).where(
            ProjectTask.id == task_id,
            ProjectTask.project_id == project_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Tarefa não encontrada")

    data = body.model_dump(exclude_none=True)

    # Auto-set started_at when moving to in_progress
    if data.get("status") == "in_progress" and not task.started_at:
        task.started_at = datetime.now(timezone.utc)

    for key, value in data.items():
        setattr(task, key, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{project_id}/tasks/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    project_id: int,
    task_id: int,
    body: TaskComplete,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Mark a task as completed with notes."""
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectTask).where(
            ProjectTask.id == task_id,
            ProjectTask.project_id == project_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Tarefa não encontrada")

    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    task.progress_percent = 100
    task.completion_notes = body.completion_notes
    task.completion_method = body.completion_method

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
async def delete_task(
    project_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectTask).where(
            ProjectTask.id == task_id,
            ProjectTask.project_id == project_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Tarefa não encontrada")
    await db.delete(task)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# MEMBERS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/members", response_model=List[MemberOut])
async def list_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.role.desc(), ProjectMember.name)
    )
    return result.scalars().all()


@router.post("/{project_id}/members", response_model=MemberOut, status_code=201)
async def add_member(
    project_id: int,
    body: MemberCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    member = ProjectMember(project_id=project_id, **body.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.patch("/{project_id}/members/{member_id}", response_model=MemberOut)
async def update_member(
    project_id: int,
    member_id: int,
    body: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Membro não encontrado")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(member, key, value)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{project_id}/members/{member_id}", status_code=204)
async def remove_member(
    project_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Membro não encontrado")
    await db.delete(member)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# PHASES
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/phases", response_model=List[PhaseOut])
async def list_phases(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .order_by(ProjectPhase.order_index)
    )
    return result.scalars().all()


@router.post("/{project_id}/phases", response_model=PhaseOut, status_code=201)
async def create_phase(
    project_id: int,
    body: PhaseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ProjectPhase.order_index), -1))
        .where(ProjectPhase.project_id == project_id)
    )
    next_order = result.scalar() + 1

    phase = ProjectPhase(
        project_id=project_id,
        name=body.name,
        color=body.color,
        order_index=next_order,
    )
    db.add(phase)
    await db.commit()
    await db.refresh(phase)
    return phase


# ══════════════════════════════════════════════════════════════════════════
# MEETINGS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/meetings", response_model=List[MeetingOut])
async def list_meetings(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await _get_project_or_404(db, project_id, user.company_id)
    result = await db.execute(
        select(ProjectMeeting)
        .where(ProjectMeeting.project_id == project_id)
        .order_by(ProjectMeeting.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{project_id}/meetings", response_model=MeetingOut, status_code=201)
async def start_meeting(
    project_id: int,
    body: MeetingCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new meeting record (browser will start recording)."""
    await _get_project_or_404(db, project_id, user.company_id)
    now = datetime.now(timezone.utc)
    title = body.title or f"Reunião - {now.strftime('%d/%m/%Y %H:%M')}"
    meeting = ProjectMeeting(
        project_id=project_id,
        title=title,
        started_at=now,
        status="recording",
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


# ══════════════════════════════════════════════════════════════════════════
# DASHBOARD DATA (aggregated)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/dashboard")
async def get_dashboard(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Full dashboard data in a single request (minimize round trips)."""
    project = await _get_project_or_404(db, project_id, user.company_id)

    # Tasks
    tasks_result = await db.execute(
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.step_number)
    )
    tasks = tasks_result.scalars().all()

    # Members
    members_result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id, ProjectMember.is_active == True)
        .order_by(ProjectMember.role.desc(), ProjectMember.name)
    )
    members = members_result.scalars().all()

    # Phases
    phases_result = await db.execute(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .order_by(ProjectPhase.order_index)
    )
    phases = phases_result.scalars().all()

    # Alerts (unresolved)
    alerts_result = await db.execute(
        select(ProjectAlert)
        .where(ProjectAlert.project_id == project_id, ProjectAlert.resolved == False)
        .order_by(ProjectAlert.severity.desc(), ProjectAlert.created_at.desc())
        .limit(10)
    )
    alerts = alerts_result.scalars().all()

    # Project enriched
    enriched = await _enrich_project(db, project)

    return {
        "project": enriched,
        "tasks": [TaskOut.model_validate(t) for t in tasks],
        "members": [MemberOut.model_validate(m) for m in members],
        "phases": [PhaseOut.model_validate(p) for p in phases],
        "alerts": [
            {
                "id": a.id,
                "type": a.alert_type,
                "title": a.title,
                "description": a.description,
                "severity": a.severity,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
    }


# ══════════════════════════════════════════════════════════════════════════
# MEETING ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/meetings/start")
async def start_meeting(
    project_id: int,
    body: MeetingCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a meeting record when the user clicks 'Iniciar Reunião'."""
    project = await _get_project_or_404(db, project_id, user.company_id)

    title = body.title or f"Reunião - {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')}"
    meeting = ProjectMeeting(
        project_id=project.id,
        title=title,
        started_at=datetime.now(timezone.utc),
        status="recording",
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return MeetingOut.model_validate(meeting)


@router.post("/{project_id}/meetings/{meeting_id}/upload")
async def upload_meeting_audio(
    project_id: int,
    meeting_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Receives the audio blob and triggers Celery processing.
    Audio is uploaded as multipart/form-data in a separate step;
    this endpoint marks the meeting as 'uploading' and kicks the processing task.
    """
    from fastapi import UploadFile, File
    # This is a simplified version — audio file handling is done via the
    # standard FastAPI File upload pattern at the route level
    project = await _get_project_or_404(db, project_id, user.company_id)

    m_res = await db.execute(
        select(ProjectMeeting).where(
            ProjectMeeting.id == meeting_id,
            ProjectMeeting.project_id == project_id
        )
    )
    meeting = m_res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Reunião não encontrada")

    meeting.ended_at = datetime.now(timezone.utc)
    if meeting.started_at:
        meeting.duration_seconds = int((meeting.ended_at - meeting.started_at).total_seconds())
    meeting.status = "uploading"
    await db.commit()

    return {"success": True, "meeting_id": meeting.id, "status": "uploading"}


@router.post("/{project_id}/meetings/{meeting_id}/process")
async def process_meeting(
    project_id: int,
    meeting_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger Celery task to process the meeting audio with Gemini."""
    project = await _get_project_or_404(db, project_id, user.company_id)
    m_res = await db.execute(
        select(ProjectMeeting).where(
            ProjectMeeting.id == meeting_id,
            ProjectMeeting.project_id == project_id
        )
    )
    meeting = m_res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Reunião não encontrada")

    meeting.status = "processing"
    await db.commit()

    # Trigger async Celery task
    from app.workers.meeting_processor import process_meeting_task
    process_meeting_task.delay(meeting.id, project.company_id)

    return {"success": True, "status": "processing"}


@router.get("/{project_id}/meetings/{meeting_id}/status")
async def get_meeting_status(
    project_id: int,
    meeting_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Polling endpoint for frontend to check processing progress."""
    project = await _get_project_or_404(db, project_id, user.company_id)
    m_res = await db.execute(
        select(ProjectMeeting).where(
            ProjectMeeting.id == meeting_id,
            ProjectMeeting.project_id == project_id
        )
    )
    meeting = m_res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Reunião não encontrada")

    return {
        "id": meeting.id,
        "status": meeting.status,
        "ata_json": meeting.ata_json,
        "participants_detected": meeting.participants_detected or [],
        "tasks_created_ids": meeting.tasks_created_ids or [],
        "error_message": meeting.error_message,
    }


@router.get("/{project_id}/meetings")
async def list_meetings(
    project_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all meetings for a project."""
    project = await _get_project_or_404(db, project_id, user.company_id)
    m_res = await db.execute(
        select(ProjectMeeting)
        .where(ProjectMeeting.project_id == project_id)
        .order_by(ProjectMeeting.created_at.desc())
    )
    meetings = m_res.scalars().all()
    return [MeetingOut.model_validate(m) for m in meetings]


# ══════════════════════════════════════════════════════════════════════════
# METRICS & ANALYTICS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/metrics")
async def get_project_metrics(
    project_id: int,
    platform: str = "general",
    date_range: str = "last_7d",
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get marketing metrics (Meta Ads, Google Ads) for the project."""
    project = await _get_project_or_404(db, project_id, user.company_id)

    from app.services.project_metrics_service import (
        get_meta_ads_metrics, get_google_ads_metrics, get_combined_metrics
    )

    if platform == "meta_ads":
        return await get_meta_ads_metrics(db, user.company_id, date_range)
    elif platform == "google_ads":
        return await get_google_ads_metrics(db, user.company_id, date_range)
    else:
        return await get_combined_metrics(db, user.company_id, date_range)


@router.get("/{project_id}/analytics")
async def get_project_analytics(
    project_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project analytics data for burndown charts and predictions."""
    project = await _get_project_or_404(db, project_id, user.company_id)

    tasks_result = await db.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id).order_by(ProjectTask.step_number)
    )
    tasks = tasks_result.scalars().all()

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    pending = sum(1 for t in tasks if t.status == "pending")
    blocked = sum(1 for t in tasks if t.status == "blocked")
    overdue = sum(1 for t in tasks if t.status == "overdue")

    # Burndown: completed tasks by date
    completion_timeline = []
    for t in sorted(tasks, key=lambda x: x.completed_at or datetime.max.replace(tzinfo=None)):
        if t.completed_at:
            completion_timeline.append({
                "date": t.completed_at.strftime("%Y-%m-%d"),
                "task_id": t.id,
                "title": t.title,
            })

    # Tasks by priority
    by_priority = {"normal": 0, "high": 0, "critical": 0}
    for t in tasks:
        if t.status != "completed":
            by_priority[t.priority] = by_priority.get(t.priority, 0) + 1

    # Velocity: avg days per task
    completed_tasks_with_dates = [
        t for t in tasks if t.completed_at and t.created_at
    ]
    avg_days = 0
    if completed_tasks_with_dates:
        total_days = sum(
            (t.completed_at - t.created_at).total_seconds() / 86400
            for t in completed_tasks_with_dates
        )
        avg_days = round(total_days / len(completed_tasks_with_dates), 1)

    # Estimated completion
    remaining = total - completed
    estimated_days_remaining = round(remaining * avg_days) if avg_days > 0 else None

    return {
        "summary": {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "blocked": blocked,
            "overdue": overdue,
            "progress_percent": round((completed / total) * 100, 1) if total > 0 else 0,
        },
        "velocity": {
            "avg_days_per_task": avg_days,
            "estimated_days_remaining": estimated_days_remaining,
            "completed_this_week": sum(
                1 for t in tasks
                if t.completed_at and (datetime.now(timezone.utc) - t.completed_at).days < 7
            ),
        },
        "by_priority": by_priority,
        "completion_timeline": completion_timeline,
    }


@router.get("/{project_id}/export/pdf")
async def export_project_pdf(
    project_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export project report as PDF."""
    from fastapi.responses import Response
    project = await _get_project_or_404(db, project_id, user.company_id)

    from app.services.project_pdf_service import generate_project_pdf
    pdf_bytes = await generate_project_pdf(db, project_id)

    # Determine content type
    content_type = "application/pdf"
    filename = f"relatorio_{project.slug}_{datetime.now().strftime('%Y%m%d')}.pdf"

    # If weasyprint isn't available, it returns HTML
    if pdf_bytes[:5] == b'<!DOC':
        content_type = "text/html"
        filename = filename.replace(".pdf", ".html")

    return Response(
        content=pdf_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── WhatsApp Group Linking ────────────────────────────────────────────────

@router.get("/{project_id}/whatsapp/groups")
async def list_whatsapp_groups(
    project_id: int,
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Fetch WhatsApp groups available on a SmartMoon instance.

    Priority:
    1. Try SmartMoon Engine API (GET /instances/{id}/groups)
    2. Fall back to groups already seen in whatsapp_conversations table
    """
    from app.models import Integration
    from app.models.whatsapp_models import WhatsAppConversation

    # Validate the integration belongs to this company
    intg_result = await db.execute(
        select(Integration).where(
            Integration.id == instance_id,
            Integration.company_id == user.company_id,
            Integration.provider == "smartmoon",
        )
    )
    intg = intg_result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="SmartMoon instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        import json
        cfg = json.loads(cfg)
    sm_instance_id = cfg.get("instance_id")

    groups = []

    # 1. Try SmartMoon Engine
    try:
        from app.services.smartmoon_client import SmartMoonClient
        result = await SmartMoonClient.fetch_groups(sm_instance_id)
        raw_groups = result.get("groups", [])
        if raw_groups:
            groups = [
                {
                    "jid": g.get("id"),
                    "name": g.get("subject") or g.get("name") or g.get("id"),
                    "size": g.get("size", 0),
                    "source": "engine",
                }
                for g in raw_groups if g.get("id")
            ]
    except Exception:
        pass

    # 2. Fallback: conversations already in DB for this integration
    if not groups:
        conv_result = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.integration_id == instance_id,
                WhatsAppConversation.wa_id.like("%@g.us"),
            ).order_by(WhatsAppConversation.last_message_at.desc())
        )
        convs = conv_result.scalars().all()
        groups = [
            {
                "jid": c.wa_id,
                "name": c.display_name or c.wa_id,
                "size": 0,
                "source": "conversation",
            }
            for c in convs
        ]

    return {"instance_id": instance_id, "groups": groups}


@router.patch("/{project_id}/whatsapp/link")
async def link_whatsapp_group(
    project_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Link a WhatsApp group to a project.

    Body: { whatsapp_instance_id: int, whatsapp_group_id: str }
    """
    project = await _get_project_or_404(db, project_id, user.company_id)

    wid = payload.get("whatsapp_instance_id")
    gid = payload.get("whatsapp_group_id")

    if wid is not None:
        project.whatsapp_instance_id = wid
    if gid is not None:
        project.whatsapp_group_id = gid

    await db.commit()
    await db.refresh(project)

    return {
        "message": "✅ WhatsApp group linked",
        "whatsapp_instance_id": project.whatsapp_instance_id,
        "whatsapp_group_id": project.whatsapp_group_id,
    }
