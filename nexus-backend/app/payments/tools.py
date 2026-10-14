"""
NEXUS.IA — Payment Tools
Ferramentas de pagamento registráveis no engine de agentes de IA.
Cada tool é uma função async que pode ser chamada pelo motor de execução.

REGISTRO: Chame register_payment_tools() durante o startup do FastAPI.
"""
from decimal import Decimal
from loguru import logger


async def register_payment_tools():
    """
    Registra as payment tools no registry global de ferramentas.
    Chamado durante o startup da aplicação (lifespan).
    """
    try:
        from app.services.tool_registry import tool_registry
    except ImportError:
        logger.warning("⚠️ tool_registry não disponível — payment tools não registradas")
        return

    # ── create_pix_charge ──────────────────────────────────────────────────────

    @tool_registry.register(
        name="create_pix_charge",
        description=(
            "Gera uma cobrança PIX para o cliente e retorna o código copia-e-cola. "
            "Registra a cobrança no sistema para rastreamento financeiro completo. "
            "IMPORTANTE: confirme o valor exato com o cliente ANTES de chamar esta tool."
        ),
        schema={
            "type": "object",
            "properties": {
                "amount": {
                    "type": "number",
                    "description": "Valor em R$ (ex: 97.00). Deve ser positivo.",
                },
                "description": {
                    "type": "string",
                    "description": "Descrição da cobrança (ex: 'Consultoria Julho/2025').",
                },
                "client_name": {
                    "type": "string",
                    "description": "Nome do cliente (para personalizar a mensagem).",
                },
                "client_email": {
                    "type": "string",
                    "description": "Email do cliente (opcional, para notificação).",
                },
            },
            "required": ["amount", "description"],
        },
        plans=["pro", "enterprise"],
        category="payments",
    )
    async def create_pix_charge(
        amount:       float,
        description:  str,
        client_name:  str  = "Cliente",
        client_email: str  = "cliente@nexus.ia",
        # Injetados pelo executor:
        company_id:   int  = None,
        db                 = None,
        **_kw,
    ) -> dict:
        if not company_id:
            return {"error": "company_id não disponível no contexto de execução"}
        try:
            from app.payments.services.charge_service import ChargeService
            from app.payments.schemas import ChargeCreate
            from app.db.session import AsyncSessionLocal

            charge_data = ChargeCreate(
                amount       = Decimal(str(amount)),
                description  = description,
                client_name  = client_name,
                client_email = client_email,
            )

            # BUG FIX: criar sessão própria se não injetada pelo executor
            async def _create(session):
                return await ChargeService.create_charge(
                    db         = session,
                    company_id = company_id,
                    data       = charge_data,
                )

            if db is not None:
                charge = await _create(db)
            else:
                async with AsyncSessionLocal() as session:
                    charge = await _create(session)

            return {
                "charge_id":      charge.id,
                "pix_copy_paste": charge.pix_copy_paste_code or "",
                "pix_link":       charge.payment_link or "",
                "amount":         float(charge.amount),
                "status":         charge.status.value,
                "message":        (
                    f"PIX de R$ {float(charge.amount):.2f} gerado com sucesso. "
                    f"Envie o código abaixo para o cliente:\n{charge.pix_copy_paste_code}"
                ),
            }
        except Exception as e:
            logger.error(f"create_pix_charge tool error: {e}")
            return {"error": str(e)}

    # ── get_payment_status ─────────────────────────────────────────────────────

    @tool_registry.register(
        name="get_payment_status",
        description=(
            "Consulta o status atual de uma cobrança PIX pelo ID retornado pelo create_pix_charge. "
            "Use para verificar se o cliente pagou antes de entregar o serviço."
        ),
        schema={
            "type": "object",
            "properties": {
                "charge_id": {
                    "type": "integer",
                    "description": "ID da cobrança retornado por create_pix_charge.",
                },
            },
            "required": ["charge_id"],
        },
        plans=["pro", "enterprise"],
        category="payments",
    )
    async def get_payment_status(
        charge_id:  int,
        company_id: int = None,
        db              = None,
        **_kw,
    ) -> dict:
        # BUG-38 FIX: db pode ser None quando executor nao injeta sessao
        async def _fetch(session):
            from sqlalchemy import select
            from app.payments.models import PaymentCharge
            result = await session.execute(
                select(PaymentCharge).where(
                    PaymentCharge.id         == charge_id,
                    PaymentCharge.company_id == company_id,
                )
            )
            charge = result.scalar_one_or_none()
            if not charge:
                return {"error": f"Cobranca #{charge_id} nao encontrada"}
            return {
                "charge_id":   charge.id,
                "status":      charge.status.value,
                "amount":      float(charge.amount),
                "description": charge.description,
                "paid":        charge.status.value == "paid",
                "paid_at":     charge.paid_at.isoformat() if charge.paid_at else None,
            }
        try:
            if db is not None:
                return await _fetch(db)
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                return await _fetch(session)
        except Exception as e:
            return {"error": str(e)}

    # ── list_pending_charges ───────────────────────────────────────────────────

    @tool_registry.register(
        name="list_pending_charges",
        description="Lista as cobranças PIX pendentes da empresa (até 10 mais recentes).",
        schema={"type": "object", "properties": {}, "required": []},
        plans=["pro", "enterprise"],
        category="payments",
    )
    async def list_pending_charges(
        company_id: int = None,
        db              = None,
        **_kw,
    ) -> dict:
        # BUG-38 FIX: db pode ser None quando executor nao injeta sessao
        async def _fetch(session):
            from sqlalchemy import select
            from app.payments.models import PaymentCharge, ChargeStatus
            result = await session.execute(
                select(PaymentCharge).where(
                    PaymentCharge.company_id == company_id,
                    PaymentCharge.status.in_([ChargeStatus.PENDING, ChargeStatus.SENT]),
                ).order_by(PaymentCharge.created_at.desc()).limit(10)
            )
            charges = result.scalars().all()
            return {
                "pending_count": len(charges),
                "charges": [
                    {
                        "id":          c.id,
                        "amount":      float(c.amount),
                        "description": c.description,
                        "created_at":  c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in charges
                ],
            }
        try:
            if db is not None:
                return await _fetch(db)
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                return await _fetch(session)
        except Exception as e:
            return {"error": str(e)}

    # ── cancel_charge ──────────────────────────────────────────────────────────

    @tool_registry.register(
        name="cancel_charge",
        description=(
            "Cancela uma cobrança PIX pendente. "
            "Use somente se o cliente desistiu explicitamente."
        ),
        schema={
            "type": "object",
            "properties": {
                "charge_id": {
                    "type": "integer",
                    "description": "ID da cobrança a cancelar.",
                },
            },
            "required": ["charge_id"],
        },
        plans=["pro", "enterprise"],
        category="payments",
    )
    async def cancel_charge(
        charge_id:  int,
        company_id: int = None,
        db              = None,
        **_kw,
    ) -> dict:
        # BUG-38 FIX: db pode ser None quando executor nao injeta sessao
        async def _cancel(session):
            from app.payments.services.charge_service import ChargeService
            charge = await ChargeService.cancel_charge(session, charge_id, company_id)
            return {
                "charge_id": charge.id,
                "status":    charge.status.value,
                "cancelled": True,
                "message":   f"Cobranca #{charge_id} cancelada com sucesso.",
            }
        try:
            if db is not None:
                return await _cancel(db)
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                result = await _cancel(session)
                await session.commit()
                return result
        except Exception as e:
            return {"error": str(e)}

    logger.success("✅ Payment tools registradas: create_pix_charge, get_payment_status, list_pending_charges, cancel_charge")
