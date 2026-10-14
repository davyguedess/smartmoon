"""
Financial Records — SQLAlchemy Models
Tabela para protocolar compras, pagamentos a fornecedores e colaboradores.
Integrada ao Agente Financeiro via WhatsApp.
"""
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Date, Text,
    ForeignKey, Index, Numeric,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.session import Base
from .base import TimestampMixin


class FinancialRecord(Base, TimestampMixin):
    """Registro financeiro — cada compra/pagamento protocolado pelo agente."""
    __tablename__ = "financial_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agent_profiles.id"), nullable=True)
    session_id = Column(String(100), nullable=True)          # ID conversa WhatsApp
    recorded_by_phone = Column(String(30), nullable=True)    # Telefone de quem registrou

    # ── Dados do registro ─────────────────────────────────
    record_date = Column(Date, nullable=False)                # Data da compra/pagamento
    record_time = Column(String(8), nullable=True)            # HH:MM:SS
    description = Column(Text, nullable=False)                # "30 reais de açúcar"
    amount = Column(Numeric(12, 2), nullable=True)            # Valor em reais
    category = Column(
        String(50), default="compra",
        nullable=False,
    )  # compra|fornecedor|colaborador|operacional|outro
    supplier_name = Column(String(300), nullable=True)        # Nome do fornecedor
    payment_method = Column(String(50), nullable=True)        # pix|dinheiro|cartao|boleto|transferencia

    # ── Nota fiscal ───────────────────────────────────────
    has_invoice = Column(Boolean, default=False, nullable=False)
    invoice_pending = Column(Boolean, default=False, nullable=False)  # Aguardando envio da nota
    invoice_image_url = Column(String(500), nullable=True)    # URL da imagem da nota
    invoice_number = Column(String(100), nullable=True)       # Número da NF

    # ── Metadados ─────────────────────────────────────────
    input_type = Column(String(20), default="text")           # text|audio|image
    raw_message = Column(Text, nullable=True)                 # Mensagem original
    status = Column(String(20), default="confirmed")          # confirmed|cancelled|pending
    notes = Column(Text, nullable=True)                       # Observações adicionais

    # ── Tags para organização ─────────────────────────────
    tags = Column(JSONB, default=list)                        # ["urgente", "recorrente"]

    __table_args__ = (
        Index("ix_financial_company_date", "company_id", "record_date"),
        Index("ix_financial_company_category", "company_id", "category"),
        Index("ix_financial_company_status", "company_id", "status"),
    )
