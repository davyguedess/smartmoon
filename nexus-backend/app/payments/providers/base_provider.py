"""
NEXUS.IA — Payment Provider Interface (TASK 4.1)

Classe abstrata que define o contrato para qualquer provider de pagamento.
Todos os providers (MercadoPago, Efi Pay, Stripe, etc) devem implementar.

Benefícios:
- Trocar provider sem alterar services (ChargeService, WithdrawalService)
- Testar com mock provider em desenvolvimento
- Suportar múltiplos providers simultâneos por empresa
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Optional


# ── Result DTOs (compartilhados por todos os providers) ──────────────────────

@dataclass
class PixChargeResult:
    """Resultado padronizado de criação de cobrança PIX."""
    external_payment_id:  str
    external_reference:   str
    pix_qr_code:          str        # base64 do QR code
    pix_copy_paste_code:  str        # código copia e cola
    payment_link:         Optional[str]
    status:               str        # normalized internal status
    raw_response:         dict


@dataclass
class PaymentStatusResult:
    """Resultado padronizado de consulta de status."""
    external_payment_id:  str
    mp_status:            str        # status original do provider
    internal_status:      str        # status normalizado
    amount:               float
    paid_at:              Optional[str]
    raw_response:         dict


@dataclass
class PayoutResult:
    """Resultado padronizado de payout (transferência PIX out)."""
    mp_transfer_id:       str
    status:               str
    raw_response:         dict


@dataclass
class RefundResult:
    """Resultado padronizado de reembolso."""
    refund_id:            str
    status:               str
    amount:               float
    raw_response:         dict


# ── Abstract Base Class ──────────────────────────────────────────────────────

class PaymentProviderBase(ABC):
    """
    Interface abstrata para providers de pagamento.

    Todo provider concreto DEVE implementar:
    - create_pix_charge()
    - get_payment_status()
    - cancel_charge()
    - send_pix_payout()
    - refund_payment()
    - normalize_status()
    - provider_name (property)
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Nome canônico do provider (e.g. 'mercadopago', 'efipay')."""
        ...

    @abstractmethod
    def normalize_status(self, provider_status: str) -> str:
        """Converte status do provider para status interno padronizado."""
        ...

    @abstractmethod
    async def create_pix_charge(
        self,
        amount:             float,
        description:        str,
        external_reference: str,
        payer_email:        str,
        due_date:           Optional[date] = None,
        idempotency_key:    Optional[str] = None,
    ) -> PixChargeResult:
        """Cria cobrança PIX e retorna QR code + copia e cola."""
        ...

    @abstractmethod
    async def get_payment_status(self, external_payment_id: str) -> PaymentStatusResult:
        """Consulta status real do pagamento no provider."""
        ...

    @abstractmethod
    async def cancel_charge(self, external_payment_id: str) -> bool:
        """Cancela cobrança pendente. Retorna True se sucesso."""
        ...

    @abstractmethod
    async def send_pix_payout(
        self,
        amount:          float,
        pix_key:         str,
        pix_key_type:    str,
        idempotency_key: str,
        description:     str = "Saque Smart Moon",
    ) -> PayoutResult:
        """Envia PIX (transferência out) para chave do cliente."""
        ...

    @abstractmethod
    async def refund_payment(
        self,
        external_payment_id: str,
        amount:              Optional[float] = None,
        idempotency_key:     Optional[str] = None,
    ) -> RefundResult:
        """Reembolso total ou parcial."""
        ...
