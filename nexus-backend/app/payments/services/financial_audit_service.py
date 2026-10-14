"""
NEXUS.IA — Financial Audit Service (TASK 3.2)

Log imutável de TODAS as operações financeiras.
Non-blocking: nunca lança exceção (try/except interno).
Registra: quem fez, o que mudou, quando, de onde.

Usage:
    from app.payments.services.financial_audit_service import financial_audit

    await financial_audit(
        db=db,
        company_id=company_id,
        entity_type="withdrawal",
        entity_id=withdrawal.id,
        action="approved",
        performed_by=admin_user_id,
        old_values={"status": "pending"},
        new_values={"status": "approved", "balance_after": "1234.56"},
    )
"""
from typing import Optional

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import Base


# ── Modelo SQLAlchemy ────────────────────────────────────────────────────────

class FinancialAuditLog(Base):
    __tablename__ = "financial_audit_log"

    id           = Column(Integer, primary_key=True)
    company_id   = Column(Integer, nullable=False, index=True)
    entity_type  = Column(String(30), nullable=False)
    entity_id    = Column(Integer, nullable=False)
    action       = Column(String(50), nullable=False)
    performed_by = Column(Integer, nullable=True)
    ip_address   = Column(String(45), nullable=True)
    user_agent   = Column(Text, nullable=True)
    old_values   = Column(JSON, nullable=True)
    new_values   = Column(JSON, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


# ── Service Function ─────────────────────────────────────────────────────────

async def financial_audit(
    db:          AsyncSession,
    company_id:  int,
    entity_type: str,
    entity_id:   int,
    action:      str,
    performed_by: Optional[int] = None,
    ip_address:   Optional[str] = None,
    user_agent:   Optional[str] = None,
    old_values:   Optional[dict] = None,
    new_values:   Optional[dict] = None,
) -> None:
    """
    Registra evento financeiro no log imutável.

    NUNCA lança exceção — falha silenciosa com log de erro.
    Isso garante que a operação principal nunca é interrompida por audit.

    Args:
        entity_type: "withdrawal" | "charge" | "wallet" | "limits"
        action: "credit" | "debit" | "hold" | "release" | "requested" |
                "approved" | "rejected" | "completed" | "failed" | "updated"
    """
    try:
        # Serializar Decimal/datetime em old_values/new_values
        safe_old = _safe_json(old_values) if old_values else None
        safe_new = _safe_json(new_values) if new_values else None

        entry = FinancialAuditLog(
            company_id=company_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by=performed_by,
            ip_address=ip_address,
            user_agent=user_agent,
            old_values=safe_old,
            new_values=safe_new,
        )
        db.add(entry)
        await db.flush()

        logger.debug(
            f"📋 FinAudit: {action} {entity_type}#{entity_id} "
            f"company={company_id} by={'system' if not performed_by else performed_by}"
        )
    except Exception as e:
        # CRITICAL: audit failures must NEVER break financial operations
        logger.error(f"❌ Financial audit log failed: {e}")


def _safe_json(data: dict) -> dict:
    """Convert Decimal/datetime to JSON-serializable types."""
    from decimal import Decimal
    from datetime import datetime

    safe = {}
    for k, v in data.items():
        if isinstance(v, Decimal):
            safe[k] = str(v)
        elif isinstance(v, datetime):
            safe[k] = v.isoformat()
        elif isinstance(v, dict):
            safe[k] = _safe_json(v)
        else:
            safe[k] = v
    return safe
