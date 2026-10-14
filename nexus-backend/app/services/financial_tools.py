"""
Agente Financeiro — Function Calling Tools
6 tools para o agente financeiro gerenciar registros via WhatsApp.

Segue o padrão de app/services/project_tools.py:
- Registradas no ToolRegistry singleton
- Chamadas pelo trained_agent_handler.py via function calling
- Cada tool abre sua própria sessão DB (async_session_maker)
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import select

from app.db.session import AsyncSessionLocal as async_session_maker
from app.services.tool_registry import tool_registry
from app.services import financial_service


BRT = timezone(timedelta(hours=-3))


# ── 1. fin_registrar_despesa ─────────────────────────────────────

@tool_registry.register(
    name="fin_registrar_despesa",
    description=(
        "Registra uma nova compra ou pagamento no controle financeiro. "
        "Use quando o usuário informar que comprou algo, pagou um fornecedor, "
        "ou fez qualquer tipo de despesa. Extraia descrição, valor, categoria e fornecedor "
        "da mensagem do usuário."
    ),
    schema={
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "Descrição da compra/pagamento (ex: '30 reais de açúcar')",
            },
            "amount": {
                "type": "number",
                "description": "Valor em reais (ex: 30.00). Se não souber, deixe null.",
            },
            "category": {
                "type": "string",
                "enum": ["compra", "fornecedor", "colaborador", "operacional", "outro"],
                "description": "Tipo da despesa: compra (insumos/materiais), fornecedor (pagamento a fornecedor), colaborador (pagamento de salário/freelancer), operacional (contas/despesas fixas), outro",
            },
            "supplier_name": {
                "type": "string",
                "description": "Nome do fornecedor ou loja (se mencionado)",
            },
            "payment_method": {
                "type": "string",
                "enum": ["pix", "dinheiro", "cartao", "boleto", "transferencia"],
                "description": "Forma de pagamento (se mencionada)",
            },
            "has_invoice": {
                "type": "boolean",
                "description": "Se o usuário informou que tem nota fiscal",
            },
            "record_date": {
                "type": "string",
                "description": "Data da compra no formato YYYY-MM-DD (se diferente de hoje)",
            },
            "notes": {
                "type": "string",
                "description": "Observações adicionais",
            },
        },
        "required": ["description", "category"],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_registrar_despesa(
    description: str,
    category: str = "compra",
    company_id: int = 0,
    amount: float = None,
    supplier_name: str = None,
    payment_method: str = None,
    has_invoice: bool = False,
    record_date: str = None,
    notes: str = None,
    **kwargs,
) -> dict:
    parsed_date = None
    if record_date:
        try:
            parsed_date = date.fromisoformat(record_date)
        except (ValueError, TypeError):
            pass

    async with async_session_maker() as db:
        result = await financial_service.create_record(
            db=db,
            company_id=company_id,
            description=description,
            amount=amount,
            category=category,
            supplier_name=supplier_name,
            payment_method=payment_method,
            has_invoice=has_invoice,
            invoice_pending=not has_invoice,
            input_type=kwargs.get("input_type", "text"),
            raw_message=kwargs.get("raw_message"),
            session_id=kwargs.get("session_id"),
            agent_id=kwargs.get("agent_id"),
            recorded_by_phone=kwargs.get("recorded_by_phone"),
            record_date=parsed_date,
            notes=notes,
        )
        await db.commit()

    amount_str = f"R${amount:.2f}" if amount else "valor não informado"
    return {
        "success": True,
        "record_id": result["id"],
        "message": f"✅ Registrado: {description} — {amount_str} [{category}]",
        "has_invoice": has_invoice,
        "invoice_pending": not has_invoice,
    }


# ── 2. fin_consultar_registros ───────────────────────────────────

@tool_registry.register(
    name="fin_consultar_registros",
    description=(
        "Lista os registros financeiros com filtros. "
        "Use quando o usuário perguntar sobre compras recentes, gastos, "
        "ou quiser ver o histórico financeiro."
    ),
    schema={
        "type": "object",
        "properties": {
            "date_from": {
                "type": "string",
                "description": "Data inicial no formato YYYY-MM-DD",
            },
            "date_to": {
                "type": "string",
                "description": "Data final no formato YYYY-MM-DD",
            },
            "category": {
                "type": "string",
                "enum": ["compra", "fornecedor", "colaborador", "operacional", "outro"],
                "description": "Filtrar por categoria",
            },
            "limit": {
                "type": "integer",
                "description": "Número máximo de registros (padrão 10)",
                "default": 10,
            },
        },
        "required": [],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_consultar_registros(
    company_id: int = 0,
    date_from: str = None,
    date_to: str = None,
    category: str = None,
    limit: int = 10,
    **kwargs,
) -> dict:
    d_from = date.fromisoformat(date_from) if date_from else None
    d_to = date.fromisoformat(date_to) if date_to else None

    async with async_session_maker() as db:
        result = await financial_service.list_records(
            db=db,
            company_id=company_id,
            date_from=d_from,
            date_to=d_to,
            category=category,
            limit=limit,
        )

    # Simplify for LLM context
    simplified = []
    for r in result["records"]:
        simplified.append({
            "id": r["id"],
            "data": r["record_date"],
            "descricao": r["description"],
            "valor": r["amount"],
            "categoria": r["category_label"],
            "fornecedor": r["supplier_name"],
            "nota": "Sim" if r["has_invoice"] else ("Pendente" if r["invoice_pending"] else "Não"),
        })

    return {
        "registros": simplified,
        "total": result["total"],
        "exibindo": len(simplified),
    }


# ── 3. fin_resumo_periodo ────────────────────────────────────────

@tool_registry.register(
    name="fin_resumo_periodo",
    description=(
        "Retorna um resumo dos gastos por período e categoria. "
        "Use quando o usuário perguntar 'quanto gastei', 'resumo do mês', "
        "'total de compras', etc."
    ),
    schema={
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "enum": ["today", "week", "month", "custom"],
                "description": "Período: today (hoje), week (últimos 7 dias), month (mês atual), custom (datas específicas)",
            },
            "date_from": {
                "type": "string",
                "description": "Data inicial (para period=custom), formato YYYY-MM-DD",
            },
            "date_to": {
                "type": "string",
                "description": "Data final (para period=custom), formato YYYY-MM-DD",
            },
        },
        "required": ["period"],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_resumo_periodo(
    period: str = "month",
    company_id: int = 0,
    date_from: str = None,
    date_to: str = None,
    **kwargs,
) -> dict:
    now = datetime.now(BRT).date()

    if period == "today":
        d_from = d_to = now
    elif period == "week":
        d_from = now - timedelta(days=7)
        d_to = now
    elif period == "month":
        d_from = now.replace(day=1)
        d_to = now
    else:
        d_from = date.fromisoformat(date_from) if date_from else now.replace(day=1)
        d_to = date.fromisoformat(date_to) if date_to else now

    async with async_session_maker() as db:
        result = await financial_service.get_summary(
            db=db,
            company_id=company_id,
            date_from=d_from,
            date_to=d_to,
        )

    return result


# ── 4. fin_exportar_csv ──────────────────────────────────────────

@tool_registry.register(
    name="fin_exportar_csv",
    description=(
        "Gera uma planilha CSV com todos os registros financeiros do período. "
        "Use quando o usuário pedir 'exportar planilha', 'gerar CSV', 'baixar relatório'."
    ),
    schema={
        "type": "object",
        "properties": {
            "date_from": {
                "type": "string",
                "description": "Data inicial no formato YYYY-MM-DD (padrão: início do mês)",
            },
            "date_to": {
                "type": "string",
                "description": "Data final no formato YYYY-MM-DD (padrão: hoje)",
            },
        },
        "required": [],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_exportar_csv(
    company_id: int = 0,
    date_from: str = None,
    date_to: str = None,
    **kwargs,
) -> dict:
    d_from = date.fromisoformat(date_from) if date_from else None
    d_to = date.fromisoformat(date_to) if date_to else None

    async with async_session_maker() as db:
        filepath, filename, count = await financial_service.export_csv(
            db=db,
            company_id=company_id,
            date_from=d_from,
            date_to=d_to,
        )

    from app.core.config import settings
    public_url = f"{settings.PUBLIC_API_URL}/storage/financial/{filename}"

    return {
        "success": True,
        "message": f"📊 Planilha gerada com {count} registros",
        "csv_url": public_url,
        "filename": filename,
        "record_count": count,
    }


# ── 5. fin_cancelar_registro ─────────────────────────────────────

@tool_registry.register(
    name="fin_cancelar_registro",
    description=(
        "Cancela (estorna) um registro financeiro pelo ID. "
        "Use quando o usuário pedir para remover ou cancelar um lançamento."
    ),
    schema={
        "type": "object",
        "properties": {
            "record_id": {
                "type": "integer",
                "description": "ID do registro a cancelar",
            },
        },
        "required": ["record_id"],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_cancelar_registro(
    record_id: int,
    company_id: int = 0,
    **kwargs,
) -> dict:
    async with async_session_maker() as db:
        success = await financial_service.cancel_record(
            db=db,
            record_id=record_id,
            company_id=company_id,
        )
        await db.commit()

    if success:
        return {"success": True, "message": f"❌ Registro #{record_id} cancelado com sucesso."}
    else:
        return {"success": False, "message": f"Registro #{record_id} não encontrado ou já cancelado."}


# ── 6. fin_atualizar_nota ────────────────────────────────────────

@tool_registry.register(
    name="fin_atualizar_nota",
    description=(
        "Atualiza o status da nota fiscal de um registro. "
        "Use quando o usuário enviar a nota depois, ou confirmar que não tem nota."
    ),
    schema={
        "type": "object",
        "properties": {
            "record_id": {
                "type": "integer",
                "description": "ID do registro para atualizar a nota",
            },
            "has_invoice": {
                "type": "boolean",
                "description": "Se tem nota fiscal ou não",
            },
            "invoice_number": {
                "type": "string",
                "description": "Número da nota fiscal (se informado)",
            },
        },
        "required": ["record_id", "has_invoice"],
    },
    plans=["free", "pro", "enterprise"],
    category="financial",
)
async def fin_atualizar_nota(
    record_id: int,
    has_invoice: bool,
    company_id: int = 0,
    invoice_number: str = None,
    **kwargs,
) -> dict:
    async with async_session_maker() as db:
        result = await financial_service.update_invoice_status(
            db=db,
            record_id=record_id,
            company_id=company_id,
            has_invoice=has_invoice,
            invoice_number=invoice_number,
        )
        await db.commit()

    if result:
        status_msg = "com nota ✅" if has_invoice else "sem nota ⚠️"
        return {"success": True, "message": f"Registro #{record_id} atualizado — {status_msg}"}
    else:
        return {"success": False, "message": f"Registro #{record_id} não encontrado."}
