"""Pydantic schemas for the Smart Project Manager module."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# ── Project ──────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    meta_goal: Optional[str] = None
    deadline: Optional[date] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    meta_goal: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None
    agent_enabled: Optional[bool] = None
    agent_profile_id: Optional[int] = None   # Link to trained AgentProfile
    whatsapp_instance_id: Optional[int] = None
    whatsapp_group_id: Optional[str] = None
    agent_model: Optional[str] = None

class ProjectOut(BaseModel):
    id: int
    company_id: int
    name: str
    slug: str
    description: Optional[str]
    meta_goal: Optional[str]
    deadline: Optional[date]
    status: str
    agent_enabled: bool
    agent_profile_id: Optional[int] = None   # Linked trained agent
    agent_model: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    # Computed
    total_tasks: int = 0
    completed_tasks: int = 0
    overdue_tasks: int = 0
    members_count: int = 0

    class Config:
        from_attributes = True



# ── Phase ────────────────────────────────────────────────────────────────

class PhaseCreate(BaseModel):
    name: str
    color: Optional[str] = "#6366f1"

class PhaseOut(BaseModel):
    id: int
    project_id: int
    name: str
    order_index: int
    status: str
    color: str

    class Config:
        from_attributes = True


# ── Task ─────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    focus: Optional[str] = None
    phase_id: Optional[int] = None
    responsible_member_ids: List[int] = []
    due_date: Optional[date] = None
    priority: str = "normal"
    depends_on_task_ids: List[int] = []
    estimated_hours: Optional[float] = None
    deliverables: List[str] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    focus: Optional[str] = None
    phase_id: Optional[int] = None
    responsible_member_ids: Optional[List[int]] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    progress_percent: Optional[int] = None
    depends_on_task_ids: Optional[List[int]] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    deliverables: Optional[List[str]] = None

class TaskComplete(BaseModel):
    completion_notes: Optional[str] = None
    completion_method: str = "dashboard"

class TaskOut(BaseModel):
    id: int
    project_id: int
    phase_id: Optional[int]
    step_number: int
    title: str
    description: Optional[str]
    focus: Optional[str]
    responsible_member_ids: list
    due_date: Optional[date]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: str
    priority: str
    depends_on_task_ids: list
    progress_percent: int
    estimated_hours: Optional[float]
    actual_hours: Optional[float]
    deliverables: list
    completion_notes: Optional[str]
    completion_method: Optional[str]
    completed_by_member_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Member ───────────────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    name: str
    phone_number: str
    role: str = "member"               # admin|member
    responsibilities: Optional[str] = None

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = None
    responsibilities: Optional[str] = None
    is_active: Optional[bool] = None

class MemberOut(BaseModel):
    id: int
    project_id: int
    name: str
    phone_number: str
    role: str
    responsibilities: Optional[str]
    is_active: bool
    last_dashboard_access: Optional[datetime]
    last_whatsapp_activity: Optional[datetime]
    tasks_completed_count: int
    tasks_overdue_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Meeting ──────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: Optional[str] = None

class MeetingOut(BaseModel):
    id: int
    project_id: int
    title: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    status: str
    participants_detected: list
    ata_json: Optional[dict]
    tasks_created_ids: list
    shared_to_whatsapp_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Public Dashboard (OTP) ───────────────────────────────────────────────

class OTPRequest(BaseModel):
    phone_number: str

class OTPVerify(BaseModel):
    phone_number: str
    code: str

class OTPResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    member: Optional[MemberOut] = None
