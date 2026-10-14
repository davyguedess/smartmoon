"""
NEXUS.IA — Security Event Logger (TASK 8.2)

Centraliza logging de eventos de segurança para auditoria e detecção
de atividades suspeitas. Non-blocking.

Tipos de eventos:
- login_success / login_failed / login_blocked
- 2fa_setup / 2fa_verified / 2fa_disabled
- password_changed / password_reset
- api_key_created / api_key_revoked
- suspicious_withdrawal / suspicious_login
- session_expired / session_revoked
"""
from typing import Optional

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import Base


# ── Model ────────────────────────────────────────────────────────────────────

class SecurityEvent(Base):
    __tablename__ = "security_events"
    __table_args__ = {"extend_existing": True}

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, nullable=True, index=True)
    event_type  = Column(String(50), nullable=False, index=True)
    ip_address  = Column(String(45), nullable=True)
    user_agent  = Column(Text, nullable=True)
    event_metadata = Column("metadata", JSON, default=dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ── Service ──────────────────────────────────────────────────────────────────

async def log_security_event(
    db: AsyncSession,
    event_type: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    extra_metadata: Optional[dict] = None,
) -> None:
    """
    Registra evento de segurança. Non-blocking: nunca lança exceção.

    Args:
        event_type: Tipo do evento (ex: 'login_failed', '2fa_setup')
        user_id: ID do usuário (se aplicável)
        ip_address: IP da request
        user_agent: User-Agent header
        metadata: Dados extras (JSON)
    """
    try:
        entry = SecurityEvent(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            event_metadata=extra_metadata or {},
        )
        db.add(entry)
        await db.flush()

        # Log level baseado no tipo
        severity = _get_severity(event_type)
        if severity == "critical":
            logger.critical(f"🚨 SECURITY: {event_type} user={user_id} ip={ip_address}")
        elif severity == "warning":
            logger.warning(f"⚠️ SECURITY: {event_type} user={user_id} ip={ip_address}")
        else:
            logger.info(f"🔒 SECURITY: {event_type} user={user_id} ip={ip_address}")

    except Exception as e:
        logger.error(f"❌ Security event log failed: {e} | event={event_type}")


def _get_severity(event_type: str) -> str:
    """Classifica severidade do evento."""
    critical = {"suspicious_withdrawal", "suspicious_login", "brute_force_detected", "api_key_compromised"}
    warning = {"login_failed", "login_blocked", "2fa_disabled", "password_reset", "api_key_revoked"}

    if event_type in critical:
        return "critical"
    elif event_type in warning:
        return "warning"
    return "info"


# ── Helper: extrair info da request ──────────────────────────────────────────

def extract_request_info(request) -> dict:
    """Extrai IP e User-Agent de um FastAPI Request."""
    return {
        "ip_address": request.client.host if request and request.client else "unknown",
        "user_agent": (request.headers.get("user-agent", "")[:500]) if request else "",
    }
