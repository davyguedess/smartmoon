"""
NEXUS.IA — Payment Gateway: SQLAlchemy Models
Tabelas financeiras: cobranças, carteiras, extrato, saques, webhooks.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
import enum

from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Date, DateTime,
    Text, JSON, ForeignKey, UniqueConstraint, Index, Enum as SAEnum, func
)
from sqlalchemy.orm import relationship
from app.db.session import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class ChargeStatus(str, enum.Enum):
    DRAFT           = "draft"
    PENDING         = "pending"
    SENT            = "sent"
    WAITING_PAYMENT = "waiting_payment"
    PAID            = "paid"
    EXPIRED         = "expired"
    CANCELLED       = "cancelled"
    FAILED          = "failed"
    REFUNDED        = "refunded"


class WalletTxType(str, enum.Enum):
    CREDIT      = "credit"
    DEBIT       = "debit"
    HOLD        = "hold"
    RELEASE     = "release"
    REFUND      = "refund"
    FEE         = "fee"
    ADJUSTMENT  = "adjustment"


class WithdrawalStatus(str, enum.Enum):
    PENDING       = "pending"
    UNDER_REVIEW  = "under_review"
    APPROVED      = "approved"
    PROCESSING    = "processing"
    COMPLETED     = "completed"
    REJECTED      = "rejected"
    CANCELLED     = "cancelled"
    FAILED        = "failed"


class PixKeyType(str, enum.Enum):
    CPF     = "cpf"
    CNPJ    = "cnpj"
    EMAIL   = "email"
    PHONE   = "phone"
    RANDOM  = "random"


# ── Modelos ───────────────────────────────────────────────────────────────────

class PaymentClient(Base):
    """Clientes da empresa para cobranças."""
    __tablename__ = "payment_clients"

    id           = Column(Integer, primary_key=True, index=True)
    company_id   = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(200), nullable=False)
    email        = Column(String(200), nullable=True)
    phone        = Column(String(30),  nullable=True)
    document     = Column(String(20),  nullable=True)  # CPF ou CNPJ
    notes        = Column(Text,        nullable=True)
    metadata_    = Column("metadata", JSON, default=dict)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    company      = relationship("Company", foreign_keys=[company_id])
    charges      = relationship("PaymentCharge", back_populates="client",
                                cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_payment_clients_company", "company_id"),
        Index("ix_payment_clients_phone",   "company_id", "phone"),
        Index("ix_payment_clients_email",   "company_id", "email"),
    )


class PaymentCharge(Base):
    """Cobrança PIX criada pelo sistema."""
    __tablename__ = "payment_charges"

    id                    = Column(Integer, primary_key=True, index=True)
    company_id            = Column(Integer, ForeignKey("companies.id"), nullable=False)
    client_id             = Column(Integer, ForeignKey("payment_clients.id"), nullable=True)
    created_by_user_id    = Column(Integer, ForeignKey("users.id"),    nullable=True)
    created_by_agent_id   = Column(Integer, nullable=True)  # soft FK — agent_profiles

    # Provider (sempre mercadopago nesta fase)
    external_provider     = Column(String(30),  nullable=False, default="mercadopago")
    external_payment_id   = Column(String(100), nullable=True, index=True)  # ID do MP
    external_reference    = Column(String(100), nullable=True, unique=True)  # nossa ref

    # Valores
    amount                = Column(Numeric(12, 2), nullable=False)
    description           = Column(Text,           nullable=True)
    due_date              = Column(Date,            nullable=True)
    expires_at            = Column(DateTime(timezone=True), nullable=True)

    # Status interno padronizado
    status                = Column(
        SAEnum(
            ChargeStatus,
            name="charge_status_enum",
            create_type=True,
            values_callable=lambda x: [e.value for e in x],  # usa .value (minúsculo) não .name
        ),
        nullable=False, default=ChargeStatus.DRAFT
    )

    # PIX
    pix_qr_code           = Column(Text,         nullable=True)  # base64
    pix_copy_paste_code   = Column(Text,         nullable=True)
    payment_link          = Column(String(500),  nullable=True)

    # Envio
    sent_via              = Column(String(30),   nullable=True)  # whatsapp|email|manual
    sent_at               = Column(DateTime(timezone=True), nullable=True)
    paid_at               = Column(DateTime(timezone=True), nullable=True)
    cancelled_at          = Column(DateTime(timezone=True), nullable=True)

    # Rastreamento
    metadata_             = Column("metadata", JSON,     default=dict)
    webhook_payload_last  = Column(JSON,                 nullable=True)

    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), server_default=func.now(),
                                   onupdate=func.now())

    # Relationships
    company  = relationship("Company",        foreign_keys=[company_id])
    client   = relationship("PaymentClient",  back_populates="charges")
    deposits = relationship("DepositRecord",  back_populates="charge",
                            cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_charges_company",  "company_id"),
        Index("ix_charges_status",   "company_id", "status"),
        Index("ix_charges_ext_ref",  "external_reference"),
        Index("ix_charges_ext_id",   "external_payment_id"),
        Index("ix_charges_created",  "company_id", "created_at"),
    )


class Wallet(Base):
    """Carteira interna — 1 por empresa."""
    __tablename__ = "wallets"

    id              = Column(Integer,         primary_key=True, index=True)
    company_id      = Column(Integer,         ForeignKey("companies.id"), nullable=False, unique=True)
    balance         = Column(Numeric(12, 2),  nullable=False, default=Decimal("0.00"))
    total_received  = Column(Numeric(12, 2),  nullable=False, default=Decimal("0.00"))
    total_withdrawn = Column(Numeric(12, 2),  nullable=False, default=Decimal("0.00"))
    currency        = Column(String(3),       nullable=False, default="BRL")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(),
                             onupdate=func.now())

    company       = relationship("Company", foreign_keys=[company_id])
    transactions  = relationship("WalletTransaction", back_populates="wallet",
                                 cascade="all, delete-orphan")
    withdrawals   = relationship("WithdrawalRequest", back_populates="wallet",
                                 cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", name="uq_wallets_company"),
        Index("ix_wallets_company", "company_id", unique=True),
    )


class WalletTransaction(Base):
    """
    Ledger imutável de movimentações financeiras.
    NUNCA deletar ou UPDATE os campos de valor após criação.
    """
    __tablename__ = "wallet_transactions"

    id                  = Column(Integer,        primary_key=True, index=True)
    company_id          = Column(Integer,        ForeignKey("companies.id"), nullable=False)
    wallet_id           = Column(Integer,        ForeignKey("wallets.id"), nullable=False)
    charge_id           = Column(Integer,        ForeignKey("payment_charges.id"), nullable=True)
    withdrawal_id       = Column(Integer,        nullable=True)  # soft FK withdrawal_requests

    type                = Column(
        SAEnum(
            WalletTxType,
            name="wallet_tx_type_enum",
            create_type=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False
    )
    amount              = Column(Numeric(12, 2), nullable=False)
    balance_after       = Column(Numeric(12, 2), nullable=False)  # saldo snapshot imutável
    description         = Column(Text,           nullable=True)
    reference           = Column(String(100),    nullable=True)
    source              = Column(String(30),     nullable=True)
    # pix_payment | withdrawal | manual | refund_reversal | adjustment

    # Quem criou
    created_by_system   = Column(Boolean,    nullable=False, default=False)
    created_by_user_id  = Column(Integer,    ForeignKey("users.id"), nullable=True)

    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    # NÃO tem updated_at — IMUTÁVEL

    wallet              = relationship("Wallet",    back_populates="transactions")
    company             = relationship("Company",   foreign_keys=[company_id])

    __table_args__ = (
        Index("ix_wallet_tx_company",  "company_id", "created_at"),
        Index("ix_wallet_tx_wallet",   "wallet_id",  "created_at"),
        Index("ix_wallet_tx_charge",   "charge_id"),
    )


class WithdrawalRequest(Base):
    """Solicitações de saque — aprovação → MP Payouts API."""
    __tablename__ = "withdrawal_requests"

    id                    = Column(Integer,        primary_key=True, index=True)
    company_id            = Column(Integer,        ForeignKey("companies.id"), nullable=False)
    wallet_id             = Column(Integer,        ForeignKey("wallets.id"),   nullable=False)
    requested_by_user_id  = Column(Integer,        ForeignKey("users.id"),     nullable=True)

    amount                = Column(Numeric(12, 2), nullable=False)

    status                = Column(
        SAEnum(
            WithdrawalStatus,
            name="withdrawal_status_enum",
            create_type=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False, default=WithdrawalStatus.PENDING
    )

    # Chave PIX do beneficiário (empresa cliente)
    pix_key               = Column(String(200), nullable=False)
    pix_key_type          = Column(
        # BUG-44 FIX: SAEnum sem values_callable usa o NOME do enum Python
        # (ex: "RANDOM") mas pix_key_type_enum no PG tem valores em lowercase.
        # values_callable forca o uso de .value (random, cpf...) no INSERT.
        SAEnum(
            PixKeyType,
            name="pix_key_type_enum",
            create_type=False,  # tipo ja existe no banco
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False
    )


    # Resultado MP Payouts
    mp_transfer_id        = Column(String(100), nullable=True)
    mp_transfer_status    = Column(String(50),  nullable=True)
    mp_idempotency_key    = Column(String(100), nullable=True, unique=True)

    # Admin
    reviewed_by_user_id   = Column(Integer,    ForeignKey("users.id"), nullable=True)
    reviewed_at           = Column(DateTime(timezone=True),            nullable=True)
    rejection_reason      = Column(Text,                               nullable=True)
    admin_notes           = Column(Text,                               nullable=True)
    processed_at          = Column(DateTime(timezone=True),            nullable=True)

    metadata_             = Column("metadata", JSON, default=dict)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), server_default=func.now(),
                                   onupdate=func.now())

    wallet  = relationship("Wallet",  back_populates="withdrawals")
    company = relationship("Company", foreign_keys=[company_id])

    __table_args__ = (
        Index("ix_withdrawals_company", "company_id"),
        Index("ix_withdrawals_status",  "status"),
    )


class PaymentWebhookEvent(Base):
    """
    Idempotência de webhooks de pagamento.
    UNIQUE (provider, provider_event_id) — webhook duplicado nunca processa duas vezes.
    """
    __tablename__ = "payment_webhook_events"

    id                = Column(Integer,     primary_key=True, index=True)
    provider          = Column(String(30),  nullable=False)
    provider_event_id = Column(String(200), nullable=False)
    event_type        = Column(String(50),  nullable=True)
    charge_id         = Column(Integer,     ForeignKey("payment_charges.id"), nullable=True)

    raw_payload       = Column(JSON,        nullable=False)
    processed         = Column(Boolean,     nullable=False, default=False)
    processed_at      = Column(DateTime(timezone=True), nullable=True)
    processing_error  = Column(Text,        nullable=True)

    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    charge = relationship("PaymentCharge", foreign_keys=[charge_id])

    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id", name="uq_payment_webhook_event"),
        Index("ix_pwe_provider", "provider", "processed"),
    )


class DepositRecord(Base):
    """Registro de cada crédito confirmado na carteira."""
    __tablename__ = "deposit_records"

    id                  = Column(Integer,        primary_key=True, index=True)
    company_id          = Column(Integer,        ForeignKey("companies.id"), nullable=False)
    wallet_id           = Column(Integer,        ForeignKey("wallets.id"),   nullable=False)
    charge_id           = Column(Integer,        ForeignKey("payment_charges.id"), nullable=True)

    amount              = Column(Numeric(12, 2), nullable=False)
    source              = Column(String(30),     nullable=False)
    # pix_payment | manual | refund_reversal | adjustment
    provider            = Column(String(30),     nullable=True)
    provider_payment_id = Column(String(100),    nullable=True)
    description         = Column(Text,           nullable=True)

    created_by          = Column(Integer,        ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    charge = relationship("PaymentCharge", back_populates="deposits",
                          foreign_keys=[charge_id])

    __table_args__ = (
        Index("ix_deposit_records_company", "company_id", "created_at"),
    )
