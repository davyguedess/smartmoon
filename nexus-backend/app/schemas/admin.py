"""
Admin Schemas — Request/Response para endpoints do painel administrativo.
"""
from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ── System Overview ───────────────────────────────────────────────────────────

class SystemMetrics(BaseModel):
    hostname: str
    os: str
    python: str
    cpu_percent: float
    ram_percent: float
    disk_percent: float
    uptime_seconds: int
    database_url: str
    redis_url: str
    ollama_url: str


# ── Users (Admin view) ────────────────────────────────────────────────────────

class AdminUserItem(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    company_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserList(BaseModel):
    users: List[AdminUserItem]
    total: int
    limit: int
    offset: int


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None


# ── Companies (Admin view) ────────────────────────────────────────────────────

class AdminCompanyItem(BaseModel):
    id: int
    name: str
    plan: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminCompanyList(BaseModel):
    companies: List[AdminCompanyItem]
    total: int


# ── Agents (Admin view) ───────────────────────────────────────────────────────

class AdminAgentItem(BaseModel):
    id: int
    name: str
    slug: str
    company_id: int
    model: str
    provider: str
    agent_type: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminAgentList(BaseModel):
    agents: List[AdminAgentItem]
    total: int


# ── Dashboard Overview ────────────────────────────────────────────────────────

class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_companies: int
    total_agents: int
    active_agents: int
    ai_cost_usd_current_month: float
    plans_distribution: dict


# ── Audit (Admin view) ────────────────────────────────────────────────────────

class AdminAuditItem(BaseModel):
    id: int
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    actor_id: Optional[int]
    company_id: Optional[int]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
