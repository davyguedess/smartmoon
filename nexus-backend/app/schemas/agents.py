"""
Agent Schemas — Request/Response Pydantic models para módulo de agentes.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ── AgentProfile ──────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9_-]+$')
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: str = "llama3.2"
    provider: str = "ollama"
    temperature: str = "0.7"
    agent_type: str = "general"
    memory_rules: Optional[Dict[str, Any]] = None
    sales_config: Optional[Dict[str, Any]] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    temperature: Optional[str] = None
    is_active: Optional[bool] = None
    memory_rules: Optional[Dict[str, Any]] = None
    sales_config: Optional[Dict[str, Any]] = None


class AgentResponse(BaseModel):
    id: int
    company_id: int
    name: str
    slug: str
    description: Optional[str]
    model: str
    provider: str
    temperature: str
    agent_type: str
    is_active: bool
    memory_rules: Optional[Dict[str, Any]]
    sales_config: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentList(BaseModel):
    agents: List[AgentResponse]
    total: int


# ── AgentCustomSkill ──────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9_-]+$')
    icon: str = "🔧"
    category: str = "Custom"
    description: Optional[str] = None
    prompt_patch: Optional[str] = None


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_patch: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: int
    company_id: int
    name: str
    slug: str
    icon: str
    category: str
    description: Optional[str]
    prompt_patch: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
