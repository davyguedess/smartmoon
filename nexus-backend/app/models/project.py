"""
Smart Project Manager — SQLAlchemy Models
13 tabelas para gerenciamento de projetos com coordenação via WhatsApp.
"""
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Date, Text,
    ForeignKey, Index, Float,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from app.db.session import Base
from .base import TimestampMixin


# ── 1. Projects ──────────────────────────────────────────────────────────

class Project(Base, TimestampMixin):
    """Projeto mãe — cada empresa pode ter múltiplos projetos."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(300), nullable=False)
    slug = Column(String(200), nullable=False)           # URL pública: /p/{slug}
    description = Column(Text, nullable=True)
    meta_goal = Column(String(500), nullable=True)       # Ex: "Reinauguração Oficial"
    deadline = Column(Date, nullable=True)
    status = Column(String(30), default="active")        # active|paused|completed|archived

    # Configuração do Agente WhatsApp
    whatsapp_instance_id = Column(Integer, nullable=True)  # ID da instância SmartMoon
    whatsapp_group_id = Column(String(100), nullable=True) # ID do grupo no WhatsApp
    agent_profile_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    flow_id = Column(Integer, ForeignKey("flows.id"), nullable=True)
    agent_enabled = Column(Boolean, default=False)
    agent_schedule_json = Column(JSONB, default=lambda: {
        "morning_alert": "08:00",
        "midday_check": "12:00",
        "evening_summary": "17:00",
    })

    # Modelo padrão para o agente (otimização de tokens)
    agent_model = Column(String(100), default="gemini-2.0-flash")
    agent_provider = Column(String(50), default="gemini")

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        Index("ix_projects_company", "company_id"),
        Index("ix_projects_slug", "slug", unique=True),
    )


# ── 2. Project Phases ────────────────────────────────────────────────────

class ProjectPhase(Base, TimestampMixin):
    """Fases/Sprints do projeto (Ex: 'Base Tecnológica', 'Estrutura Operacional')."""
    __tablename__ = "project_phases"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    order_index = Column(Integer, default=0)
    status = Column(String(30), default="active")        # active|completed
    color = Column(String(20), default="#6366f1")

    __table_args__ = (
        Index("ix_project_phases_project", "project_id"),
    )


# ── 3. Project Tasks ────────────────────────────────────────────────────

class ProjectTask(Base, TimestampMixin):
    """Tarefas/Etapas do projeto com status, prazo, dependências e progresso."""
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(Integer, ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True)
    step_number = Column(Integer, default=0)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    focus = Column(Text, nullable=True)                  # Foco da entrega

    # Responsáveis (IDs dos project_members)
    responsible_member_ids = Column(JSONB, default=list)  # [1, 3, 5]

    # Prazos
    due_date = Column(Date, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Status e prioridade
    status = Column(String(30), default="pending")       # pending|in_progress|blocked|completed|overdue
    priority = Column(String(20), default="normal")      # normal|high|critical

    # Dependências e progresso
    depends_on_task_ids = Column(JSONB, default=list)    # [2, 4] — IDs de tarefas que bloqueiam esta
    progress_percent = Column(Integer, default=0)        # 0-100

    # Estimativa de tempo
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)

    # Entregas esperadas
    deliverables = Column(JSONB, default=list)           # ["Config do sistema", "Testes"]

    # Conclusão
    completed_by_member_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)
    completion_method = Column(String(20), nullable=True)  # dashboard|whatsapp
    completion_notes = Column(Text, nullable=True)
    evidence_file_paths = Column(JSONB, default=list)

    __table_args__ = (
        Index("ix_project_tasks_project", "project_id"),
        Index("ix_project_tasks_status", "project_id", "status"),
    )


# ── 4. Project Subtasks ──────────────────────────────────────────────────

class ProjectSubtask(Base):
    """Checklist de sub-tarefas dentro de cada tarefa."""
    __tablename__ = "project_subtasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    is_done = Column(Boolean, default=False)
    done_by_member_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)
    done_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 5. Project Members ───────────────────────────────────────────────────

class ProjectMember(Base, TimestampMixin):
    """Membros do projeto com número WhatsApp e papel (admin/membro)."""
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    phone_number = Column(String(30), nullable=False)    # WhatsApp (com DDI)
    role = Column(String(20), default="member")          # admin|member
    responsibilities = Column(Text, nullable=True)       # Texto livre
    is_active = Column(Boolean, default=True)

    # Tracking de atividade
    last_dashboard_access = Column(DateTime(timezone=True), nullable=True)
    last_whatsapp_activity = Column(DateTime(timezone=True), nullable=True)
    tasks_completed_count = Column(Integer, default=0)
    tasks_overdue_count = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_project_members_project", "project_id"),
        Index("ix_project_members_phone", "project_id", "phone_number", unique=True),
    )


# ── 6. Project Meetings ─────────────────────────────────────────────────

class ProjectMeeting(Base, TimestampMixin):
    """Reuniões gravadas e processadas (áudio → ATA JSON)."""
    __tablename__ = "project_meetings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Áudio
    audio_file_path = Column(String(500), nullable=True)
    audio_size_bytes = Column(Integer, nullable=True)

    # Status do processamento
    status = Column(String(30), default="recording")     # recording|uploading|processing|processed|error
    error_message = Column(Text, nullable=True)

    # Tópicos marcados durante a reunião
    topic_markers_json = Column(JSONB, default=list)     # [{timestamp: "00:05:12", label: "Tópico 1"}]
    participants_detected = Column(JSONB, default=list)  # ["Davy", "Fabi", "Rafa"]

    # ATA gerada pela IA
    ata_json = Column(JSONB, nullable=True)              # JSON completo da ATA

    # Referências a tarefas/decisões criadas
    tasks_created_ids = Column(JSONB, default=list)
    decisions_logged_ids = Column(JSONB, default=list)

    # Compartilhamento
    shared_to_whatsapp_at = Column(DateTime(timezone=True), nullable=True)

    created_by_member_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        Index("ix_project_meetings_project", "project_id"),
    )


# ── 7. Project Decisions ─────────────────────────────────────────────────

class ProjectDecision(Base):
    """Log de decisões oficiais do projeto."""
    __tablename__ = "project_decisions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    meeting_id = Column(Integer, ForeignKey("project_meetings.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=False)
    decided_by = Column(String(200), nullable=True)      # Nome de quem decidiu
    context = Column(Text, nullable=True)                # Contexto da decisão
    status = Column(String(30), default="active")        # active|revised|revoked
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 8. Project Comments ──────────────────────────────────────────────────

class ProjectComment(Base):
    """Comentários/atividade por tarefa."""
    __tablename__ = "project_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    source = Column(String(20), default="dashboard")     # dashboard|whatsapp|agent
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 9. Project Files ─────────────────────────────────────────────────────

class ProjectFile(Base):
    """Arquivos/evidências/entregas anexadas a tarefas ou reuniões."""
    __tablename__ = "project_files"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), nullable=True)
    meeting_id = Column(Integer, ForeignKey("project_meetings.id", ondelete="SET NULL"), nullable=True)
    member_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(300), nullable=False)
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    file_type = Column(String(30), default="document")   # evidence|deliverable|document|audio
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 10. Project Alerts ────────────────────────────────────────────────────

class ProjectAlert(Base):
    """Alertas de risco gerados pela IA ou pelo sistema."""
    __tablename__ = "project_alerts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    alert_type = Column(String(30), nullable=False)      # risk|overdue|blocked|milestone
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="medium")      # low|medium|high|critical
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 11. Project Daily Reports ─────────────────────────────────────────────

class ProjectDailyReport(Base):
    """Relatórios diários gerados automaticamente pelo agente."""
    __tablename__ = "project_daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    report_date = Column(Date, nullable=False)
    report_json = Column(JSONB, nullable=True)           # Dados estruturados do relatório
    report_text = Column(Text, nullable=True)            # Versão texto para WhatsApp
    sent_to_whatsapp = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_daily_reports_project_date", "project_id", "report_date", unique=True),
    )


# ── 12. Project OTP Codes ─────────────────────────────────────────────────

class ProjectOTPCode(Base):
    """Códigos OTP para autenticação no dashboard público via WhatsApp."""
    __tablename__ = "project_otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    phone_number = Column(String(30), nullable=False)
    code = Column(String(6), nullable=False)             # Código de 6 dígitos
    expires_at = Column(DateTime(timezone=True), nullable=False)  # 5 minutos
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── 13. Project Member Sessions ───────────────────────────────────────────

class ProjectMemberSession(Base):
    """Sessões JWT para acesso ao dashboard público."""
    __tablename__ = "project_member_sessions"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("project_members.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False, index=True)  # SHA-256 do JWT
    expires_at = Column(DateTime(timezone=True), nullable=False)  # 24 horas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
