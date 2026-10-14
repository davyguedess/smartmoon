from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class FlowCreate(BaseModel):
    name: str
    description: str = ""
    definition_json: dict


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    definition_json: Optional[dict] = None


class FlowOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    version: str
    status: str
    definition_json: dict
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FlowListItem(BaseModel):
    id: int
    name: str
    status: str
    version: str
    updated_at: Optional[datetime]
    total_executions: int = 0
    nodes_count: int = 0

    class Config:
        from_attributes = True
