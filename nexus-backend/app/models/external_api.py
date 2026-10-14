"""
External API Configurations — APIs exclusivas vinculadas a contas específicas.

Permite cadastrar APIs externas (ex: Duarte Estética Booking) e vinculá-las
a empresas/usuários específicos. O Flow Builder usa essas configs para executar
chamadas HTTP durante a execução dos fluxos.
"""
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin


class ExternalApiConfig(Base, TimestampMixin):
    """
    Configuração de uma API externa exclusiva.

    Cada registro representa uma API (ex: Duarte Booking API) que pode ser
    vinculada a uma ou mais empresas via ExternalApiBinding.

    Campos:
    - slug: identificador único (ex: 'duarte_booking')
    - display_name: nome amigável (ex: 'Duarte Estética — Agendamentos')
    - base_url: URL base da API (ex: 'https://esteticaduarte.com/booking/api_bookings')
    - auth_type: 'header' | 'query' | 'bearer' | 'none'
    - auth_header_name: nome do header (ex: 'X-API-Key')
    - auth_query_param: nome do param (ex: 'api_key')
    - endpoints_json: mapa de ações → {method, path, description}
    """
    __tablename__ = "external_api_configs"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(10), default="🔌")
    color = Column(String(20), default="#6366f1")
    base_url = Column(String(500), nullable=False)

    # Authentication
    auth_type = Column(String(20), default="header")  # header | query | bearer | none
    auth_header_name = Column(String(100), nullable=True)  # ex: X-API-Key
    auth_query_param = Column(String(100), nullable=True)  # ex: api_key
    default_api_key = Column(Text, nullable=True)  # chave padrão (pode ser override por binding)

    # Endpoint definitions: { "action_slug": { "method": "GET", "path": "/lookup", "description": "...", "params": [...] } }
    endpoints_json = Column(JSONB, default=dict, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    bindings = relationship("ExternalApiBinding", back_populates="api_config", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_external_api_slug", "slug", unique=True),
    )


class ExternalApiBinding(Base, TimestampMixin):
    """
    Vínculo de uma API externa a uma empresa específica.

    Permite que a mesma API seja direcionada a contas diferentes com chaves
    de acesso diferentes. Cada binding pode ter sua própria api_key.
    """
    __tablename__ = "external_api_bindings"

    id = Column(Integer, primary_key=True, index=True)
    api_config_id = Column(Integer, ForeignKey("external_api_configs.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)

    # Override da api_key para esta empresa (se null, usa default_api_key do config)
    api_key_override = Column(Text, nullable=True)

    # Configurações extras por empresa (ex: instance_id, webhook_url)
    config_override_json = Column(JSONB, default=dict)

    is_active = Column(Boolean, default=True, nullable=False)

    api_config = relationship("ExternalApiConfig", back_populates="bindings")
    company = relationship("Company")

    __table_args__ = (
        Index("ix_ext_api_binding_company", "company_id", "api_config_id", unique=True),
    )
