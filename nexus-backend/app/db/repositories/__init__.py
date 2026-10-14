"""
app.db.repositories — Data Access Layer (DAL) centralizada
===========================================================
Todos os repositórios do sistema são importados e re-exportados aqui.
Serviços e rotas devem importar sempre de 'app.db.repositories'.

Exemplo:
    from app.db.repositories import UserRepository, AgentRepository
"""
from app.db.repositories.user_repository import UserRepository
from app.db.repositories.flow_repository import FlowRepository
from app.db.repositories.execution_repository import ExecutionRepository
from app.db.repositories.agent_repository import AgentRepository
from app.db.repositories.plan_repository import PlanRepository
from app.db.repositories.audit_repository import AuditRepository

__all__ = [
    "UserRepository",
    "FlowRepository",
    "ExecutionRepository",
    "AgentRepository",
    "PlanRepository",
    "AuditRepository",
]
