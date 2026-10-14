"""
NEXUS.IA — Payment Gateway: Pydantic Schemas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, validator

from app.payments.models import ChargeStatus, WalletTxType, WithdrawalStatus, PixKeyType


# ── Client ────────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    name:     str           = Field(..., min_length=2, max_length=200)
    email:    Optional[str] = None
    phone:    Optional[str] = None
    document: Optional[str] = None  # CPF ou CNPJ
    notes:    Optional[str] = None

class ClientOut(BaseModel):
    id:         int
    company_id: int
    name:       str
    email:      Optional[str]
    phone:      Optional[str]
    document:   Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Charges ───────────────────────────────────────────────────────────────────

class ChargeCreate(BaseModel):
    # BUG-11 FIX: MercadoPago rejeita valores < R$0,01 com HTTP 400.
    # Validar no schema antes de chegar ao provider.
    amount:      Decimal = Field(..., ge=Decimal("0.01"), description="Valor em BRL (mínimo R$0,01)")
    description: str     = Field(..., min_length=3, max_length=500)
    due_date:    Optional[date] = None

    # Cliente: pode informar client_id OU dados inline
    client_id:    Optional[int] = None
    client_name:  Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None

    @validator("amount")
    def amount_must_be_valid(cls, v):
        v = round(v, 2)
        if v < Decimal("0.01"):
            raise ValueError("Valor mínimo é R$0,01")
        return v

class ChargeSendRequest(BaseModel):
    via:   str = Field(..., pattern="^(whatsapp|email|manual)$")
    phone: Optional[str] = None   # obrigatório se via=whatsapp sem client_id
    email: Optional[str] = None   # obrigatório se via=email sem client_id
    message: Optional[str] = None # mensagem personalizada opcional

class ChargeOut(BaseModel):
    id:                   int
    company_id:           int
    client_id:            Optional[int]
    amount:               Decimal
    description:          Optional[str]
    due_date:             Optional[date]
    status:               ChargeStatus
    external_provider:    str
    external_payment_id:  Optional[str]
    external_reference:   Optional[str]
    pix_qr_code:          Optional[str]
    pix_copy_paste_code:  Optional[str]
    payment_link:         Optional[str]
    sent_via:             Optional[str]
    sent_at:              Optional[datetime]
    paid_at:              Optional[datetime]
    cancelled_at:         Optional[datetime]
    created_at:           datetime
    updated_at:           datetime

    # Dados do cliente (join)
    client_name:  Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None

    class Config:
        from_attributes = True

class ChargeListOut(BaseModel):
    items:  List[ChargeOut]
    total:  int
    page:   int
    limit:  int
    pages:  int


# ── Wallet ────────────────────────────────────────────────────────────────────

class WalletOut(BaseModel):
    id:              int
    company_id:      int
    balance:         Decimal
    total_received:  Decimal
    total_withdrawn: Decimal
    currency:        str

    class Config:
        from_attributes = True

class WalletTransactionOut(BaseModel):
    id:            int
    type:          WalletTxType
    amount:        Decimal
    balance_after: Decimal
    description:   Optional[str]
    source:        Optional[str]
    charge_id:     Optional[int]
    withdrawal_id: Optional[int]
    created_at:    datetime

    class Config:
        from_attributes = True

class WalletTransactionListOut(BaseModel):
    items:  List[WalletTransactionOut]
    total:  int
    page:   int
    limit:  int


# ── Withdrawals ───────────────────────────────────────────────────────────────

class WithdrawalCreate(BaseModel):
    # BUG-32 FIX: sem le= a API aceitava qualquer valor positivo (ex: R$999.999).
    # O controle de saldo existe no service, mas a camada de schema deve barrar
    # valores absurdos antes de qualquer consulta ao DB.
    amount: Decimal = Field(
        ...,
        gt=0,
        le=Decimal("50000.00"),
        description="Valor do saque em BRL (máximo R$50.000 por operação)",
    )
    pix_key:      str      = Field(..., min_length=5, max_length=200)
    pix_key_type: PixKeyType
    # Opcionalmente banco bancário
    bank_name:    Optional[str] = None
    notes:        Optional[str] = None

    @validator("amount")
    def amount_must_be_valid(cls, v):
        v = round(v, 2)
        if v <= 0:
            raise ValueError("Valor deve ser positivo")
        if v > Decimal("50000.00"):
            raise ValueError("Valor máximo por saque é R$50.000,00")
        return v

class WithdrawalApprove(BaseModel):
    notes: Optional[str] = None

class WithdrawalReject(BaseModel):
    reason: str = Field(..., min_length=10, max_length=500)

class WithdrawalOut(BaseModel):
    id:                   int
    company_id:           int
    amount:               Decimal
    status:               WithdrawalStatus
    pix_key:              str
    pix_key_type:         PixKeyType
    mp_transfer_id:       Optional[str]
    mp_transfer_status:   Optional[str]
    rejection_reason:     Optional[str]
    admin_notes:          Optional[str]
    reviewed_at:          Optional[datetime]
    processed_at:         Optional[datetime]
    created_at:           datetime
    updated_at:           datetime

    class Config:
        from_attributes = True


# ── Admin Overview ─────────────────────────────────────────────────────────────

class PaymentOverviewOut(BaseModel):
    total_charged:          Decimal
    total_paid:             Decimal
    total_pending:          Decimal
    total_cancelled:        Decimal
    total_withdrawn:        Decimal
    system_balance:         Decimal     # soma de todas as wallets
    conversion_rate:        float       # paid / (paid + pending + expired)
    charges_pending:        int
    charges_paid:           int
    withdrawals_pending:    int
    webhooks_unprocessed:   int
