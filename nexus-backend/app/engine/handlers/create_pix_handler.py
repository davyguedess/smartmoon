"""
NEXUS.IA — Create PIX Charge Handler
Cria cobranças PIX via ChargeService (com registro no ledger e banco de dados).

CORREÇÃO CRÍTICA: antes chamava a API do MP diretamente (sem registrar em payment_charges),
o que tornava os pagamentos de agentes invisíveis para o sistema financeiro.
Agora usa ChargeService para garantir rastreabilidade completa.
"""
from decimal import Decimal, InvalidOperation
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler


class CreatePixHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        # ── Extrair parâmetros do contexto / config / payload ──────────────
        entities    = self.context.get("entities", {})
        amount_raw  = (
            entities.get("amount")
            or self.config.get("amount")
            or input_payload.get("amount")
        )
        customer    = (
            entities.get("customer_name")
            or input_payload.get("customer_name", "Cliente")
        )
        description = self.config.get(
            "description", f"Cobrança Smart Moon — {customer}"
        )
        payer_email = input_payload.get("email", "cliente@nexus.ia")
        company_id  = self.context.get("company_id")

        # ── Guardrails ─────────────────────────────────────────────────────
        if not amount_raw:
            return {"pix_status": "error", "error": "Valor não definido para o PIX"}

        if not company_id:
            logger.warning("CreatePixHandler: company_id ausente no contexto")
            return {"pix_status": "error", "error": "company_id não encontrado no contexto"}

        try:
            amount_decimal = Decimal(str(amount_raw).replace(",", ".").strip())
            if amount_decimal <= 0:
                raise ValueError("Valor deve ser maior que zero")
        except (InvalidOperation, ValueError) as e:
            return {"pix_status": "error", "error": f"Valor inválido: {e}"}

        # ── Criar cobrança via ChargeService (registra no banco + MP) ──────
        try:
            from app.payments.services.charge_service import ChargeService
            from app.payments.schemas import ChargeCreate
            from app.db.session import AsyncSessionLocal

            charge_data = ChargeCreate(
                amount       = amount_decimal,
                description  = description,
                client_name  = customer,
                client_email = payer_email,
            )

            async with AsyncSessionLocal() as db:
                charge = await ChargeService.create_charge(
                    db                    = db,
                    company_id            = company_id,
                    data                  = charge_data,
                    created_by_agent_id   = self.context.get("agent_id"),
                )

            logger.success(
                f"💳 CreatePixHandler: PIX registrado no ledger — "
                f"charge #{charge.id} | R${float(amount_decimal):.2f} | empresa {company_id}"
            )

            return {
                "pix_status":     "created",
                "charge_id":      charge.id,
                "pix_qr_code":    charge.pix_qr_code or "",
                "pix_copy_paste": charge.pix_copy_paste_code or "",
                "pix_link":       charge.payment_link or "",
                "amount":         float(charge.amount),
                "customer":       customer,
            }

        except Exception as e:
            logger.error(f"❌ CreatePixHandler error: {e}")
            return {"pix_status": "error", "error": str(e)}

