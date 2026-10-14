"""
Smart Project Manager — Public API.
Endpoints for project members to access the dashboard via OTP.
"""
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.project import (
    Project, ProjectTask, ProjectMember, ProjectOTPCode, ProjectMemberSession
)

router = APIRouter(prefix="/projects/public", tags=["Projects Public"])

# ── Schemas ──────────────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone_number: str

class VerifyOTPRequest(BaseModel):
    phone_number: str
    code: str

class CompleteTaskRequest(BaseModel):
    notes: str = ""

# ── Helpers ──────────────────────────────────────────────────────────────

async def _get_member_by_token(db: AsyncSession, slug: str, token: str):
    """Verifies token and returns (project, member_session, member)."""
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    raw_token = token.replace("Bearer ", "")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    # Find Project
    p_res = await db.execute(select(Project).where(Project.slug == slug))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Find Session
    s_res = await db.execute(
        select(ProjectMemberSession).where(
            ProjectMemberSession.token_hash == token_hash,
            ProjectMemberSession.project_id == project.id,
            ProjectMemberSession.expires_at > datetime.now(timezone.utc)
        )
    )
    session = s_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")

    # Find Member
    m_res = await db.execute(select(ProjectMember).where(ProjectMember.id == session.member_id))
    member = m_res.scalar_one_or_none()
    if not member or not member.is_active:
        raise HTTPException(status_code=403, detail="Membro inativo")

    return project, session, member


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("/{slug}/otp/send")
async def send_otp(slug: str, body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Generates an OTP code and theoretically sends via WhatsApp."""
    # Find project
    p_res = await db.execute(select(Project).where(Project.slug == slug))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

    # Verify if member is in project
    m_res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.phone_number == body.phone_number,
            ProjectMember.is_active == True
        )
    )
    member = m_res.scalar_one_or_none()
    if not member:
        raise HTTPException(403, "Número não autorizado para este projeto")

    # Generate 6-digit code
    code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP
    otp = ProjectOTPCode(
        project_id=project.id,
        phone_number=body.phone_number,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(otp)
    await db.commit()

    # Enviar OTP via SmartMoon WhatsApp
    try:
        from app.services.smartmoon_client import SmartMoonClient
        from sqlalchemy import text as sa_text
        
        # Buscar instance_id configurado para a empresa do projeto
        int_res = await db.execute(
            sa_text("""
                SELECT config_json->>'instance_id' FROM integrations
                WHERE company_id = :cid AND provider = 'smartmoon'
                ORDER BY id DESC LIMIT 1
            """),
            {"cid": project.company_id}
        )
        instance_id = int_res.scalar_one_or_none()
        
        if instance_id:
            otp_msg = (
                f"🔐 *Smart Project Manager*\n\n"
                f"Seu código de acesso ao projeto *{project.name}*:\n\n"
                f"```{code}```\n\n"
                f"⏱️ Válido por 10 minutos."
            )
            await SmartMoonClient.send_text(
                instance_id=instance_id,
                phone=body.phone_number,
                message=otp_msg
            )
        else:
            # Fallback: log para debug se não tem instância configurada
            import logging
            logging.getLogger(__name__).warning(f"OTP {code} para {body.phone_number} — sem instância SmartMoon configurada")
    except Exception as otp_err:
        import logging
        logging.getLogger(__name__).error(f"Falha ao enviar OTP via WhatsApp: {otp_err}")

    return {"success": True, "message": "Código enviado para o WhatsApp"}


@router.post("/{slug}/otp/verify")
async def verify_otp(slug: str, body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verifies OTP and returns a session token."""
    p_res = await db.execute(select(Project).where(Project.slug == slug))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Projeto não encontrado")

    # Find valid OTP
    o_res = await db.execute(
        select(ProjectOTPCode).where(
            ProjectOTPCode.project_id == project.id,
            ProjectOTPCode.phone_number == body.phone_number,
            ProjectOTPCode.code == body.code,
            ProjectOTPCode.used == False,
            ProjectOTPCode.expires_at > datetime.now(timezone.utc)
        )
    )
    otp = o_res.scalar_one_or_none()
    if not otp:
        raise HTTPException(401, "Código inválido ou expirado")

    # Find Member
    m_res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.phone_number == body.phone_number
        )
    )
    member = m_res.scalar_one_or_none()
    
    if not member:
        raise HTTPException(403, "Membro não encontrado")

    # Mark OTP used
    otp.used = True

    # Generate Token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    session = ProjectMemberSession(
        member_id=member.id,
        project_id=project.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()

    return {"success": True, "token": raw_token}


@router.get("/{slug}/dashboard")
async def get_public_dashboard(
    slug: str,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Returns the project dashboard data for a member."""
    project, session, member = await _get_member_by_token(db, slug, authorization)

    # Fetch tasks
    t_res = await db.execute(
        select(ProjectTask).where(ProjectTask.project_id == project.id).order_by(ProjectTask.step_number)
    )
    tasks = t_res.scalars().all()

    # Update last access
    member.last_dashboard_access = datetime.now(timezone.utc)
    await db.commit()

    return {
        "project": {
            "name": project.name,
            "description": project.description,
            "meta_goal": project.meta_goal,
            "total_tasks": len(tasks),
            "completed_tasks": sum(1 for t in tasks if t.status == "completed"),
        },
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "responsible_member_ids": t.responsible_member_ids or [],
                "completion_notes": t.completion_notes
            } for t in tasks
        ],
        "my_member_id": member.id,
        "my_role": member.role
    }


@router.post("/{slug}/tasks/{task_id}/complete")
async def complete_task_public(
    slug: str,
    task_id: int,
    body: CompleteTaskRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Allows a member to mark their task as completed."""
    project, session, member = await _get_member_by_token(db, slug, authorization)

    t_res = await db.execute(
        select(ProjectTask).where(
            ProjectTask.id == task_id,
            ProjectTask.project_id == project.id
        )
    )
    task = t_res.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Tarefa não encontrada")

    # Verify if member is responsible
    if member.id not in (task.responsible_member_ids or []):
        raise HTTPException(403, "Você não é o responsável por esta tarefa")

    task.status = "completed"
    task.progress_percent = 100
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by_member_id = member.id
    task.completion_notes = body.notes
    task.completion_method = "dashboard"

    await db.commit()
    return {"success": True}


@router.get("/{slug}/marketing")
async def get_public_marketing(
    slug: str,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Returns full project data for the public marketing dashboard."""
    project, session, member = await _get_member_by_token(db, slug, authorization)

    # Fetch tasks
    t_res = await db.execute(
        select(ProjectTask).where(ProjectTask.project_id == project.id).order_by(ProjectTask.step_number)
    )
    tasks = t_res.scalars().all()

    # Fetch all members
    m_res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.is_active == True
        ).order_by(ProjectMember.role.desc(), ProjectMember.name)
    )
    members = m_res.scalars().all()

    # Update last access
    member.last_dashboard_access = datetime.now(timezone.utc)
    await db.commit()

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "slug": project.slug,
            "description": project.description,
            "meta_goal": project.meta_goal,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "status": project.status,
            "total_tasks": len(tasks),
            "completed_tasks": sum(1 for t in tasks if t.status == "completed"),
        },
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "responsible_member_ids": t.responsible_member_ids or [],
                "progress_percent": t.progress_percent,
                "completion_notes": t.completion_notes,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            } for t in tasks
        ],
        "members": [
            {
                "id": m.id,
                "name": m.name,
                "role": m.role,
                "phone_number": m.phone_number,
            } for m in members
        ],
        "my_member_id": member.id,
        "my_name": member.name,
        "my_role": member.role,
    }
