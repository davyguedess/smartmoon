"""
API Key Model — SmartMoon Public API
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.session import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id             = Column(Integer, primary_key=True)
    company_id     = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name           = Column(String(100), nullable=False)
    key_prefix     = Column(String(16), nullable=False)   # "sm_abc12345" — exibido na UI
    key_hash       = Column(String(64), nullable=False, unique=True)  # SHA-256
    scopes         = Column(JSON, default=["send", "receive", "instances"])
    rate_limit_rpm = Column(Integer, default=60)
    is_active      = Column(Boolean, default=True, nullable=False)
    last_used_at   = Column(DateTime(timezone=True), nullable=True)
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_api_keys_company", "company_id"),
        Index("ix_api_keys_active", "company_id", "is_active"),
    )


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id          = Column(Integer, primary_key=True)
    api_key_id  = Column(Integer, ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    company_id  = Column(Integer, nullable=False)
    endpoint    = Column(String(100), nullable=True)
    method      = Column(String(10), nullable=True)
    instance_id = Column(String(100), nullable=True)
    status_code = Column(Integer, nullable=True)
    msgs_sent   = Column(Integer, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_api_usage_company", "company_id", "created_at"),
    )


class ApiKeyRequest(Base):
    __tablename__ = "api_key_requests"

    id          = Column(Integer, primary_key=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(200), nullable=False)
    reason      = Column(String(500), nullable=True)
    system_name = Column(String(200), nullable=True)
    status      = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    admin_notes = Column(String(500), nullable=True)
    generated_key = Column(String(100), nullable=True)  # chave em texto para o usuário ver
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_api_key_requests_company", "company_id", "status"),
    )
