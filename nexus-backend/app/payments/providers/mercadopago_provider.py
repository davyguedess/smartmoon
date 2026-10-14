"""
NEXUS.IA — MercadoPago Provider
Integração com Mercado Pago usando token ÚNICO da Smart Moon (conta centralizadora).
Todo dinheiro cai na conta Smart Moon. Saldo por empresa é ledger interno.
"""
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx
from loguru import logger

from app.core.config import settings
from app.payments.providers.base_provider import (
    PaymentProviderBase,
    PixChargeResult,
    PaymentStatusResult,
    PayoutResult,
    RefundResult,
)


# ── Token resolution — banco > .env —————————————————————————————

async def get_mp_token_from_db(db=None) -> Optional[str]:
    """
    Lê o Access Token do MP da tabela platform_settings.
    Tenta a session existente primeiro, depois abre uma nova.
    """
    import json
    from sqlalchemy import text

    async def _fetch(session) -> Optional[str]:
        try:
            result = await session.execute(
                text("SELECT value FROM platform_settings WHERE key = 'platform_gateway_config'")
            )
            row = result.scalar_one_or_none()
            if row:
                config = json.loads(row)
                token = config.get("mercadopago", {}).get("access_token")
                if token:
                    logger.debug(f"✅ MP token lido do banco (len={len(token)})")
                    return token
            logger.warning("⚠️ platform_gateway_config não encontrado ou sem access_token")
        except Exception as e:
            logger.warning(f"⚠️ Falha ao ler MP token: {e}")
        return None

    # Tenta session existente
    if db is not None:
        token = await _fetch(db)
        if token:
            return token

    # Fallback: session independente
    try:
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            return await _fetch(session)
    except Exception as e:
        logger.error(f"❌ Falha crítica ao ler MP token do banco: {e}")
    return None



# ── Provider ──────────────────────────────────────────────────────────────────

class MercadoPagoProvider(PaymentProviderBase):
    """
    Mercado Pago PIX Integration.

    MODELO CENTRALIZADO:
    - Um único access_token (conta Smart Moon)
    - external_reference vincula pagamento à cobrança interna
    - notification_url aponta para nosso webhook handler
    """

    BASE_URL = "https://api.mercadopago.com"
    TIMEOUT  = 30  # segundos

    @property
    def provider_name(self) -> str:
        return "mercadopago"

    STATUS_MAP = {
        "pending":      "waiting_payment",
        "approved":     "paid",
        "authorized":   "waiting_payment",
        "in_process":   "waiting_payment",
        "in_mediation": "waiting_payment",
        "rejected":     "failed",
        "cancelled":    "cancelled",
        "refunded":     "refunded",
        "charged_back": "refunded",
    }

    def __init__(self, access_token: Optional[str] = None):
        self.token = access_token or settings.MERCADOPAGO_ACCESS_TOKEN
        if not self.token:
            raise ValueError("MERCADOPAGO_ACCESS_TOKEN não configurado")

    @classmethod
    async def get_instance(cls, db=None) -> "MercadoPagoProvider":
        """
        Factory async: resolve token na ordem de prioridade:
        1. Banco de dados (platform_settings, configurado via AdminGatewayPage)
        2. Variável de ambiente MERCADOPAGO_ACCESS_TOKEN
        Passa db existente para evitar abrir nova sessão desnecessária.
        """
        token = await get_mp_token_from_db(db=db) or settings.MERCADOPAGO_ACCESS_TOKEN
        return cls(access_token=token)

    def _headers(self, idempotency_key: Optional[str] = None) -> dict:
        h = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type":  "application/json",
        }
        if idempotency_key:
            h["X-Idempotency-Key"] = idempotency_key
        return h

    def normalize_status(self, mp_status: str) -> str:
        """Converte status do MP para status interno padronizado."""
        return self.STATUS_MAP.get(mp_status, "pending")

    # ── Cobranças ─────────────────────────────────────────────────────────────

    async def create_pix_charge(
        self,
        amount:             float,
        description:        str,
        external_reference: str,
        payer_email:        str,
        due_date:           Optional[date] = None,
        idempotency_key:    Optional[str] = None,
    ) -> PixChargeResult:
        """
        Cria cobrança PIX na conta Smart Moon.
        Retorna QR Code (base64) + código copia e cola + link de pagamento.
        """
        idempotency_key = idempotency_key or str(uuid.uuid4())

        payload: dict = {
            "transaction_amount":   round(float(amount), 2),
            "description":          description[:250],  # MP limita a 250 chars
            "payment_method_id":    "pix",
            "external_reference":   external_reference,
            "payer": {
                "email": payer_email or "pagador@smartmoon.com.br",
            },
            "notification_url": (
                f"{settings.WEBHOOK_BASE_URL.rstrip('/')}/webhooks/mercadopago"
                if settings.WEBHOOK_BASE_URL
                else ""
            ),
        }

        if due_date:
            payload["date_of_expiration"] = due_date.strftime("%Y-%m-%dT23:59:59.000-03:00")

        logger.info(f"💳 MP: Criando PIX R${amount:.2f} | ref={external_reference}")

        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            resp = await client.post(
                f"{self.BASE_URL}/v1/payments",
                json=payload,
                headers=self._headers(idempotency_key),
            )

        if resp.status_code not in (200, 201):
            err = resp.json()
            logger.error(f"MP create_pix_charge error: {resp.status_code} — {err}")
            raise RuntimeError(
                f"MercadoPago error {resp.status_code}: "
                f"{err.get('message', err.get('cause', str(err)))}"
            )

        data = resp.json()
        pix_data = data.get("point_of_interaction", {}).get("transaction_data", {})

        qr_code          = pix_data.get("qr_code_base64", "")
        copy_paste        = pix_data.get("qr_code", "")
        payment_link      = pix_data.get("ticket_url")
        mp_payment_id     = str(data.get("id", ""))
        mp_status         = data.get("status", "pending")

        logger.success(
            f"✅ PIX criado: R${amount:.2f} | MP ID={mp_payment_id} | status={mp_status}"
        )

        return PixChargeResult(
            external_payment_id  = mp_payment_id,
            external_reference   = external_reference,
            pix_qr_code          = qr_code,
            pix_copy_paste_code  = copy_paste,
            payment_link         = payment_link,
            status               = self.normalize_status(mp_status),
            raw_response         = data,
        )

    async def get_payment_status(self, mp_payment_id: str) -> PaymentStatusResult:
        """Consulta status REAL de um pagamento no MP (anti-fraude)."""
        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            resp = await client.get(
                f"{self.BASE_URL}/v1/payments/{mp_payment_id}",
                headers=self._headers(),
            )

        if resp.status_code != 200:
            logger.error(f"MP get_payment_status error: {resp.status_code}")
            raise RuntimeError(f"MP status check failed: {resp.status_code}")

        data     = resp.json()
        mp_status = data.get("status", "pending")
        paid_at   = data.get("date_approved")

        return PaymentStatusResult(
            external_payment_id = str(data.get("id", mp_payment_id)),
            mp_status           = mp_status,
            internal_status     = self.normalize_status(mp_status),
            amount              = float(data.get("transaction_amount", 0)),
            paid_at             = paid_at,
            raw_response        = data,
        )

    async def cancel_charge(self, mp_payment_id: str) -> bool:
        """Cancela uma cobiança PIX pendente."""
        # BUG-40 FIX: sem X-Idempotency-Key, retry da task de limpeza enviava
        # dois PUT /cancel ao MP. Adicionada chave derivada do payment_id para
        # garantir que retries produzam o mesmo resultado (idempotente).
        idempotency_key = f"cancel-{mp_payment_id}"
        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            resp = await client.put(
                f"{self.BASE_URL}/v1/payments/{mp_payment_id}",
                json={"status": "cancelled"},
                headers=self._headers(idempotency_key),
            )

        success = resp.status_code in (200, 201)
        if not success:
            logger.error(f"MP cancel_charge error: {resp.status_code} — {resp.text}")
        return success

    # ── Payouts (Saques automáticos) ──────────────────────────────────────────

    async def send_pix_payout(
        self,
        amount:          float,
        pix_key:         str,
        pix_key_type:    str,   # cpf | cnpj | email | phone | random
        idempotency_key: str,   # UUID único — reutilizar para retry seguro
        description:     str    = "Saque Smart Moon",
    ) -> PayoutResult:
        """
        Envia PIX automaticamente para chave do cliente via MP Transfers API.
        X-Idempotency-Key garante que retry não duplica a transferência.

        IMPORTANTE: A conta Smart Moon precisa ter a permissão "money-transfer"
        habilitada pelo Mercado Pago para usar este endpoint.

        MP também tem a API /v1/advanced_payments para split, mas aqui usamos
        transferência simples entre contas MP ou para chave PIX externa.
        """
        # MP Payouts (transferência para chave PIX externa)
        # Ref: https://www.mercadopago.com.br/developers/pt/docs/money-transfers

        payload = {
            "amount":      round(float(amount), 2),
            "currency_id": "BRL",
            "receiver": {
                "type": "pix",
                "pix_alias": {
                    "type":  self._map_pix_key_type(pix_key_type),
                    "value": pix_key,
                },
            },
            "description": description[:250],
        }

        logger.info(
            f"💸 MP Payout: R${amount:.2f} → PIX {pix_key_type}:{pix_key[:6]}***"
        )

        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            resp = await client.post(
                f"{self.BASE_URL}/v1/transfers",
                json=payload,
                headers=self._headers(idempotency_key),
            )

        data = resp.json()

        if resp.status_code not in (200, 201):
            logger.error(f"MP payout error: {resp.status_code} — {data}")
            raise RuntimeError(
                f"MP payout error {resp.status_code}: "
                f"{data.get('message', data.get('cause', str(data)))}"
            )

        transfer_id = str(data.get("id", ""))
        status      = data.get("status", "pending")

        logger.success(f"✅ MP Payout enviado: ID={transfer_id} | status={status}")

        return PayoutResult(
            mp_transfer_id = transfer_id,
            status         = status,
            raw_response   = data,
        )

    @staticmethod
    def _map_pix_key_type(pix_key_type: str) -> str:
        """Mapeia nosso tipo interno para o tipo do MP."""
        PIX_TYPE_MAP = {
            "cpf":    "CPF",
            "cnpj":   "CNPJ",
            "email":  "EMAIL",
            "phone":  "PHONE",
            "random": "RANDOM",
        }
        return PIX_TYPE_MAP.get(pix_key_type.lower(), "EMAIL")

    # ── Reembolso ─────────────────────────────────────────────────────────────

    async def refund_payment(
        self,
        mp_payment_id:   str,
        amount:          Optional[float] = None,   # None = reembolso total
        idempotency_key: Optional[str]  = None,
    ) -> RefundResult:
        """
        Reembolso total ou parcial via MP.
        Válido até 180 dias após a aprovação do pagamento.
        Se amount=None → reembolso total do valor original.
        """
        payload: dict = {}
        if amount is not None:
            payload["amount"] = round(float(amount), 2)

        idempotency_key = idempotency_key or str(uuid.uuid4())

        logger.info(
            f"🔄 MP Refund: payment_id={mp_payment_id} | "
            f"amount={'total' if amount is None else f'R${amount:.2f}'}"
        )

        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            resp = await client.post(
                f"{self.BASE_URL}/v1/payments/{mp_payment_id}/refunds",
                json=payload,
                headers=self._headers(idempotency_key),
            )

        data = resp.json()

        if resp.status_code not in (200, 201):
            logger.error(f"MP refund error: {resp.status_code} — {data}")
            raise RuntimeError(
                f"MP refund error {resp.status_code}: "
                f"{data.get('message', data.get('cause', str(data)))}"
            )

        refund_id = str(data.get("id", ""))
        status    = data.get("status", "")
        refunded  = float(data.get("amount", amount or 0))

        logger.success(f"✅ Refund processado: ID={refund_id} | R${refunded:.2f} | status={status}")

        return RefundResult(
            refund_id    = refund_id,
            status       = status,
            amount       = refunded,
            raw_response = data,
        )
