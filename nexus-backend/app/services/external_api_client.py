"""
External API Client — Cliente genérico para APIs externas configuradas.

Executa chamadas HTTP baseado na configuração de ExternalApiConfig.
Suporta autenticação via header, query param ou bearer token.
"""
import os
import httpx
from typing import Optional
from loguru import logger


class ExternalApiClient:
    """Cliente HTTP genérico para APIs externas cadastradas na plataforma."""

    def __init__(self, base_url: str, api_key: str = None,
                 auth_type: str = "header", auth_header_name: str = "X-API-Key",
                 auth_query_param: str = "api_key", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.auth_type = auth_type
        self.auth_header_name = auth_header_name
        self.auth_query_param = auth_query_param
        self.timeout = timeout

    def _build_headers(self) -> dict:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            if self.auth_type == "header":
                headers[self.auth_header_name] = self.api_key
            elif self.auth_type == "bearer":
                headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _build_params(self, params: dict = None) -> dict:
        params = dict(params or {})
        if self.api_key and self.auth_type == "query":
            params[self.auth_query_param] = self.api_key
        return params

    async def call(self, method: str, path: str,
                   params: dict = None, body: dict = None,
                   path_params: dict = None) -> dict:
        """
        Executa uma chamada à API externa.

        Args:
            method: GET, POST, PUT, DELETE
            path: caminho relativo (ex: /lookup)
            params: query string parameters
            body: corpo JSON para POST/PUT
            path_params: substituições no path (ex: {id} → valor)
        """
        # Resolve path params: /detail/{id} → /detail/123
        resolved_path = path
        if path_params:
            for key, value in path_params.items():
                resolved_path = resolved_path.replace(f"{{{key}}}", str(value))

        url = f"{self.base_url}{resolved_path}"
        headers = self._build_headers()
        query_params = self._build_params(params)

        logger.info(f"🔌 ExternalAPI {method} {url} params={query_params}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method.upper(),
                    url=url,
                    headers=headers,
                    params=query_params,
                    json=body if body and method.upper() in ("POST", "PUT", "PATCH") else None,
                )

                if response.status_code >= 400:
                    error_text = response.text[:500]
                    logger.error(f"❌ ExternalAPI {response.status_code}: {error_text}")
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "error": error_text,
                    }

                try:
                    data = response.json()
                except Exception:
                    data = {"raw_response": response.text[:2000]}

                return {
                    "success": True,
                    "status_code": response.status_code,
                    "data": data,
                }

        except httpx.TimeoutException:
            logger.error(f"⏱️ ExternalAPI timeout: {url}")
            return {"success": False, "error": "Timeout na chamada à API externa"}
        except Exception as e:
            logger.error(f"❌ ExternalAPI error: {e}")
            return {"success": False, "error": str(e)}


class DuarteBookingClient(ExternalApiClient):
    """
    Cliente especializado para a API de agendamentos da Duarte Estética.

    Base URL: https://esteticaduarte.com/booking/api_bookings
    Auth: X-API-Key header ou ?api_key= query param
    hospital_id: 98 | SmartMoon instance: Duarte
    """

    def __init__(self, api_key: str = ""):
        api_key = api_key or os.getenv("DUARTE_API_KEY", "")
        super().__init__(
            base_url="https://esteticaduarte.com/booking/api_bookings",
            api_key=api_key,
            auth_type="header",
            auth_header_name="X-API-Key",
            auth_query_param="api_key",
        )

    async def lookup_client(self, email: str = None, cpf: str = None) -> dict:
        """Busca cliente + agendamentos por email ou CPF."""
        params = {}
        if email:
            params["email"] = email
        if cpf:
            params["cpf"] = cpf
        return await self.call("GET", "/lookup", params=params)

    async def get_appointment_detail(self, appointment_id: int) -> dict:
        """Detalhes de um agendamento específico."""
        return await self.call("GET", f"/detail/{appointment_id}")

    async def confirm_appointment(self, appointment_id: int) -> dict:
        """Confirma presença do cliente."""
        return await self.call("POST", f"/confirm/{appointment_id}")

    async def cancel_appointment(self, appointment_id: int, motivo: str = "") -> dict:
        """Cancela um agendamento."""
        return await self.call("POST", f"/cancel/{appointment_id}", body={"motivo": motivo})

    async def reschedule_appointment(self, appointment_id: int, availability_id: int) -> dict:
        """Reagenda um agendamento para outro horário."""
        return await self.call("POST", f"/reschedule/{appointment_id}", body={"availability_id": availability_id})

    async def get_available_slots(self, service_id: int) -> dict:
        """Lista horários disponíveis para um serviço."""
        return await self.call("GET", f"/available_slots/{service_id}")

    async def get_services(self) -> dict:
        """Lista todos os serviços disponíveis com preço, categoria e duração."""
        return await self.call("GET", "/services")

    async def create_appointment(self, service_id: int, availability_id: int,
                                  nome: str, email: str,
                                  telefone: str = None) -> dict:
        """
        Cria um novo agendamento e gera PIX para pagamento (Mercado Pago, expira em 30min).

        Args:
            service_id: ID do serviço a agendar
            availability_id: ID do horário disponível (obtido via /available_slots/{service_id})
            nome: Nome completo do cliente
            email: Email do cliente
            telefone: Telefone com DDD (ex: 5585999999999)

        Body enviado: {nome, telefone, email, service_id, availability_id}
        Response: {success, booking_id, booking_token, servico, data, horario,
                   profissional, valor, pagamento: {pix_code, payment_id, expira_em}, cliente}
        """
        body = {
            "service_id": service_id,
            "availability_id": availability_id,
            "nome": nome,
            "email": email,
        }
        if telefone:
            body["telefone"] = telefone
        return await self.call("POST", "/create", body=body)

    async def get_invoice_pdf(self, booking_id: int) -> bytes | None:
        """
        Baixa a fatura em PDF de um agendamento.

        Returns:
            bytes do PDF se sucesso, None se erro.
        """
        import httpx
        url = f"{self.base_url}/invoice/{booking_id}"
        headers = self._build_headers()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200 and "application/pdf" in resp.headers.get("content-type", ""):
                    return resp.content
                return None
        except Exception:
            return None
