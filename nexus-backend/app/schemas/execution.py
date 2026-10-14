from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ExecutionTrigger(BaseModel):
    flow_id: int
    trigger_type: str = "manual"
    input_payload: dict = {}


class StepOut(BaseModel):
    id: int
    node_id: str
    node_type: str
    status: str
    input_json: dict
    output_json: dict
    error_json: Optional[dict]
    duration_ms: Optional[int]
    started_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExecutionOut(BaseModel):
    id: int
    flow_id: int
    status: str
    trigger_type: Optional[str]
    input_payload: dict
    current_node_id: Optional[str]
    error_message: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime
    steps: List[StepOut] = []

    class Config:
        from_attributes = True


class ExecutionListItem(BaseModel):
    id: int
    flow_id: int
    status: str
    trigger_type: Optional[str]
    created_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True
