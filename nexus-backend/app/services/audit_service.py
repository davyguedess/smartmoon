"""Audit trail service — Protocol 5: mandatory event logging.

Every security-relevant action is recorded in the audit_logs table.
Events are logged non-blocking (errors in audit don't break the action).

Usage:
    from app.services.audit_service import audit

    await audit(db, user, "flow.published", "flow", flow.id, {"version": 2})
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from app.models import AuditLog


# ── Mandatory events ─────────────────────────────────
MANDATORY_EVENTS = {
    # Auth
    "auth.login",
    "auth.login_failed",
    "auth.refresh",
    "auth.logout",
    "auth.register",
    # Flows
    "flow.created",
    "flow.updated",
    "flow.published",
    "flow.deleted",
    # Executions
    "execution.started",
    "execution.canceled",
    # API Keys
    "apikey.created",
    "apikey.deleted",
    "apikey.updated",
    # Memory
    "memory.exported",
    "memory.cleared",
    # Admin
    "admin.server_viewed",
    "admin.files_viewed",
    "admin.file_content_viewed",
    "admin.database_viewed",
    "admin.table_data_viewed",
    # Settings
    "profile.updated",
    # RBAC
    "role.changed",
    # Integrations
    "integration.created",
    "integration.deleted",
    # TASK 3.5: Financial events
    "withdrawal.requested",
    "withdrawal.approved",
    "withdrawal.rejected",
    "withdrawal.completed",
    "withdrawal.failed",
    "charge.created",
    "charge.paid",
    "charge.refunded",
    "wallet.credit",
    "wallet.debit",
    "wallet.adjustment",
    "payment_limits.updated",
}


async def audit(
    db: AsyncSession,
    actor,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Record an audit event. Non-blocking — never raises.

    Args:
        db: Async database session
        actor: User object (must have .id and .company_id / ._token_company_id)
        action: Event name (e.g. 'auth.login', 'flow.published')
        resource_type: Type of resource (e.g. 'flow', 'user', 'apikey')
        resource_id: ID of the resource
        metadata: Additional context (masked before storage)
        ip_address: Client IP address
    """
    try:
        company_id = getattr(actor, "_token_company_id", None) or getattr(actor, "company_id", None)
        actor_id = getattr(actor, "id", None)

        entry = AuditLog(
            company_id=company_id,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            metadata_json=_mask_sensitive(metadata or {}),
            ip_address=ip_address,
        )
        db.add(entry)
        await db.flush()
        logger.debug(f"📋 Audit: {action} by user {actor_id} on {resource_type}/{resource_id}")
    except Exception as e:
        # Audit failures must NEVER break the main action
        logger.error(f"❌ Audit log failed: {e}")


async def audit_anonymous(
    db: AsyncSession,
    action: str,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Record an audit event without an authenticated actor (e.g. failed login)."""
    try:
        entry = AuditLog(
            company_id=None,
            actor_id=None,
            action=action,
            resource_type=None,
            resource_id=None,
            metadata_json=_mask_sensitive(metadata or {}),
            ip_address=ip_address,
        )
        db.add(entry)
        await db.flush()
    except Exception as e:
        logger.error(f"❌ Anonymous audit log failed: {e}")


# ── Sensitive data masking ───────────────────────────

_MASK_KEYS = {
    "password", "password_hash", "token", "access_token", "refresh_token",
    "api_key", "secret", "encrypted_key", "credentials", "cookie",
}


def _mask_sensitive(data: dict) -> dict:
    """Replace values of sensitive keys with ***."""
    if not isinstance(data, dict):
        return data
    masked = {}
    for k, v in data.items():
        if k.lower() in _MASK_KEYS:
            masked[k] = "***"
        elif isinstance(v, dict):
            masked[k] = _mask_sensitive(v)
        else:
            masked[k] = v
    return masked
