"""
NEXUS.IA — Efi Pay Provider (TASK 4.3)

Integração com Efi Pay (formerly Gerencianet) para PIX.
API OAuth2 + mTLS para autenticação.

Documentação: https://dev.efipay.com.br/docs/api-pix/
SDK Python: https://github.com/efipay/sdk-python-apis-efi

Modelo:
- Autenticação via OAuth2 client_credentials
- mTLS obrigatório com certificado .pem
- Cobranças via /v2/cob (imediata) ou /v2/cobv (com vencimento)
- Payouts via /v2/pix (envio de PIX)

Configuração (.env):
    EFIPAY_CLIENT_ID=xxx
    EFIPAY_CLIENT_SECRET=xxx
    EFIPAY_PIX_KEY=xxx
    EFIPAY_CERT_PATH=/path/to/cert.pem  (certificado mTLS)
    EFIPAY_SANDBOX=false
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
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


class EfiPayProvider(PaymentProviderBase):
    """
    Efi Pay PIX Integration.

    Fluxo de autenticação:
    1. OAuth2 token via /oauth/token (client_credentials)
    2. Token válido por 600s — cacheado internamente
    3. Todas as chamadas usam mTLS (certificado obrigatório)
    """

    PROD_URL    = "https://pix.api.efipay.com.br"
    SANDBOX_URL = "https://pix-h.api.efipay.com.br"
    TIMEOUT     = 30

    STATUS_MAP = {
        "ATIVA":          "waiting_payment",
        "CONCLUIDA":      "paid",
        "REMOVIDA_PELO_USUARIO_RECEBEDOR": "cancelled",
        "REMOVIDA_PELO_PSP": "cancelled",
        "DEVOLVIDA":      "refunded",
        "EXPIRADA":       "expired",
    }

    # Cache do token OAuth2
    _access_token: Optional[str] = None
    _token_expires_at: float = 0

    def __init__(
        self,
        client_id:     Optional[str] = None,
        client_secret: Optional[str] = None,
        pix_key:       Optional[str] = None,
        cert_path:     Optional[str] = None,
        sandbox:       bool = False,
    ):
        self.client_id     = client_id     or getattr(settings, "EFIPAY_CLIENT_ID", "")
        self.client_secret = client_secret or getattr(settings, "EFIPAY_CLIENT_SECRET", "")
        self.pix_key       = pix_key       or getattr(settings, "EFIPAY_PIX_KEY", "")
        self.cert_path     = cert_path     or getattr(settings, "EFIPAY_CERT_PATH", "")
        self.sandbox       = sandbox       or getattr(settings, "EFIPAY_SANDBOX", False)
        self.base_url      = self.SANDBOX_URL if self.sandbox else self.PROD_URL

        if not all([self.client_id, self.client_secret, self.pix_key]):
            raise ValueError(
                "EFIPAY_CLIENT_ID, EFIPAY_CLIENT_SECRET e EFIPAY_PIX_KEY são obrigatórios"
            )

    @property
    def provider_name(self) -> str:
        return "efipay"

    def normalize_status(self, provider_status: str) -> str:
        return self.STATUS_MAP.get(provider_status, "pending")

    # ── OAuth2 Token ─────────────────────────────────────────────────────────

    async def _get_token(self) -> str:
        """Obtém token OAuth2 com cache. Renova se expirado."""
        import time
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        import base64
        auth_string = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()

        ssl_ctx = self._get_ssl_context()

        async with httpx.AsyncClient(
            timeout=self.TIMEOUT,
            verify=ssl_ctx if ssl_ctx else True,
        ) as client:
            resp = await client.post(
                f"{self.base_url}/oauth/token",
                headers={
                    "Authorization": f"Basic {auth_string}",
                    "Content-Type": "application/json",
                },
                json={"grant_type": "client_credentials"},
            )

        if resp.status_code != 200:
            logger.error(f"Efi OAuth error: {resp.status_code} — {resp.text}")
            raise RuntimeError(f"Efi Pay OAuth failed: {resp.status_code}")

        data = resp.json()
        self._access_token = data["access_token"]
        self._token_expires_at = time.time() + data.get("expires_in", 600) - 30
        logger.debug("✅ Efi Pay OAuth token obtido")
        return self._access_token

    def _get_ssl_context(self):
        """Cria contexto SSL com certificado mTLS."""
        if not self.cert_path:
            logger.warning("⚠️ EFIPAY_CERT_PATH não configurado — mTLS desabilitado")
            return None
        try:
            import ssl
            ctx = ssl.create_default_context()
            ctx.load_cert_chain(certfile=self.cert_path)
            return ctx
        except Exception as e:
            logger.error(f"❌ Erro ao carregar certificado Efi: {e}")
            return None

    async def _headers(self) -> dict:
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def _http_client(self) -> httpx.AsyncClient:
        """Cria httpx client com mTLS."""
        ssl_ctx = self._get_ssl_context()
        return httpx.AsyncClient(
            timeout=self.TIMEOUT,
            verify=ssl_ctx if ssl_ctx else True,
        )

    # ── Cobranças PIX ────────────────────────────────────────────────────────

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
        Cria cobrança PIX imediata via Efi Pay API /v2/cob.
        Retorna QR Code + código copia e cola.
        """
        txid = external_reference.replace("-", "")[:35]  # Efi limita txid a 35 chars alfanuméricos
        txid = ''.join(c for c in txid if c.isalnum())   # Remove chars especiais

        payload = {
            "calendario": {
                "expiracao": 86400,  # 24h default
            },
            "devedor": {
                "nome": payer_email.split("@")[0] if payer_email else "Pagador",
            },
            "valor": {
                "original": f"{amount:.2f}",
            },
            "chave": self.pix_key,
            "solicitacaoPagador": description[:140],
            "infoAdicionais": [
                {"nome": "ref", "valor": external_reference},
            ],
        }

        if due_date:
            payload["calendario"]["expiracao"] = max(
                3600,
                int((datetime.combine(due_date, datetime.max.time().replace(tzinfo=timezone.utc))
                     - datetime.now(timezone.utc)).total_seconds())
            )

        logger.info(f"💳 Efi: Criando PIX R${amount:.2f} | txid={txid}")

        headers = await self._headers()
        async with self._http_client() as client:
            resp = await client.put(
                f"{self.base_url}/v2/cob/{txid}",
                json=payload,
                headers=headers,
            )

        if resp.status_code not in (200, 201):
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"detail": resp.text}
            logger.error(f"Efi create_pix_charge error: {resp.status_code} — {err}")
            raise RuntimeError(
                f"Efi Pay error {resp.status_code}: {err.get('mensagem', str(err))}"
            )

        data = resp.json()

        # Buscar QR Code
        qr_code = ""
        copy_paste = ""
        try:
            qr_resp = await client.get(
                f"{self.base_url}/v2/cob/{txid}/qrcode",
                headers=headers,
            )
            if qr_resp.status_code == 200:
                qr_data = qr_resp.json()
                qr_code = qr_data.get("imagemQrcode", "")
                copy_paste = qr_data.get("qrcode", "")
        except Exception as e:
            logger.warning(f"⚠️ Efi QR code fetch failed: {e}")

        # Gerar link de pagamento
        payment_link = f"https://pix.efipay.com.br/{txid}" if not self.sandbox else None

        logger.success(f"✅ Efi PIX criado: R${amount:.2f} | txid={txid}")

        return PixChargeResult(
            external_payment_id  = txid,
            external_reference   = external_reference,
            pix_qr_code          = qr_code,
            pix_copy_paste_code  = copy_paste,
            payment_link         = payment_link,
            status               = self.normalize_status(data.get("status", "ATIVA")),
            raw_response         = data,
        )

    async def get_payment_status(self, external_payment_id: str) -> PaymentStatusResult:
        """Consulta status de cobrança PIX na Efi Pay."""
        headers = await self._headers()
        async with self._http_client() as client:
            resp = await client.get(
                f"{self.base_url}/v2/cob/{external_payment_id}",
                headers=headers,
            )

        if resp.status_code != 200:
            raise RuntimeError(f"Efi status check failed: {resp.status_code}")

        data = resp.json()
        efi_status = data.get("status", "ATIVA")
        amount = float(data.get("valor", {}).get("original", "0"))

        # Verificar se tem pagamento confirmado
        paid_at = None
        pix_list = data.get("pix", [])
        if pix_list:
            paid_at = pix_list[0].get("horario")

        return PaymentStatusResult(
            external_payment_id = external_payment_id,
            mp_status           = efi_status,
            internal_status     = self.normalize_status(efi_status),
            amount              = amount,
            paid_at             = paid_at,
            raw_response        = data,
        )

    async def cancel_charge(self, external_payment_id: str) -> bool:
        """Cancela cobrança PIX pendente na Efi Pay."""
        headers = await self._headers()
        async with self._http_client() as client:
            resp = await client.patch(
                f"{self.base_url}/v2/cob/{external_payment_id}",
                json={"status": "REMOVIDA_PELO_USUARIO_RECEBEDOR"},
                headers=headers,
            )

        success = resp.status_code == 200
        if not success:
            logger.error(f"Efi cancel error: {resp.status_code} — {resp.text}")
        return success

    # ── Payouts (Envio de PIX) ───────────────────────────────────────────────

    async def send_pix_payout(
        self,
        amount:          float,
        pix_key:         str,
        pix_key_type:    str,
        idempotency_key: str,
        description:     str = "Saque Smart Moon",
    ) -> PayoutResult:
        """
        Envia PIX para chave do cliente via Efi Pay /v2/pix.
        Requer saldo disponível na conta Efi Pay.
        """
        e2eid = idempotency_key.replace("-", "")[:35]

        payload = {
            "valor": f"{amount:.2f}",
            "pagador": {
                "chave": self.pix_key,
                "infoPagador": description[:140],
            },
            "favorecido": {
                "chave": pix_key,
            },
        }

        logger.info(f"💸 Efi Payout: R${amount:.2f} → PIX {pix_key_type}:{pix_key[:6]}***")

        headers = await self._headers()
        async with self._http_client() as client:
            resp = await client.post(
                f"{self.base_url}/v2/pix",
                json=payload,
                headers=headers,
            )

        data = resp.json()

        if resp.status_code not in (200, 201):
            logger.error(f"Efi payout error: {resp.status_code} — {data}")
            raise RuntimeError(
                f"Efi payout error {resp.status_code}: {data.get('mensagem', str(data))}"
            )

        transfer_id = data.get("e2eId", data.get("endToEndId", str(uuid.uuid4())))
        status = "approved" if data.get("status") == "REALIZADO" else "pending"

        logger.success(f"✅ Efi Payout enviado: e2eId={transfer_id} | status={status}")

        return PayoutResult(
            mp_transfer_id = str(transfer_id),
            status         = status,
            raw_response   = data,
        )

    # ── Reembolso (Devolução PIX) ────────────────────────────────────────────

    async def refund_payment(
        self,
        external_payment_id: str,
        amount:              Optional[float] = None,
        idempotency_key:     Optional[str] = None,
    ) -> RefundResult:
        """
        Devolução de PIX via Efi Pay.
        external_payment_id = e2eId do PIX recebido.
        """
        devolution_id = idempotency_key or str(uuid.uuid4()).replace("-", "")[:35]

        # Primeiro buscar o pagamento para obter e2eId
        status_result = await self.get_payment_status(external_payment_id)
        pix_list = status_result.raw_response.get("pix", [])
        if not pix_list:
            raise RuntimeError("Pagamento não possui PIX confirmado para devolução")

        e2eid = pix_list[0].get("endToEndId", "")
        original_amount = float(pix_list[0].get("valor", "0"))
        refund_amount = amount or original_amount

        payload = {
            "valor": f"{refund_amount:.2f}",
        }

        headers = await self._headers()
        async with self._http_client() as client:
            resp = await client.put(
                f"{self.base_url}/v2/pix/{e2eid}/devolucao/{devolution_id}",
                json=payload,
                headers=headers,
            )

        data = resp.json()

        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Efi refund error {resp.status_code}: {data.get('mensagem', str(data))}"
            )

        return RefundResult(
            refund_id    = data.get("id", devolution_id),
            status       = "approved" if data.get("status") == "DEVOLVIDO" else "pending",
            amount       = refund_amount,
            raw_response = data,
        )
