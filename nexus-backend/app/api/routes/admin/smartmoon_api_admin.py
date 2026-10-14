"""
Admin — SmartMoon API Pública
Endpoints para gerenciar API Keys, ver conexões e logs de uso.
Requer superadmin.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone

from app.core.dependencies import require_superadmin as get_current_superadmin
from app.db.session import get_db
from app.middleware.api_key_auth import generate_api_key
from app.models.api_key import ApiKey, ApiUsageLog, ApiKeyRequest
from app.models import Integration, Company, User

from app.core.config import settings

router = APIRouter(prefix="/admin/smartmoon", tags=["Admin — SmartMoon API"])


# ── Schemas ──────────────────────────────────────────────────

class CreateApiKeyAdminRequest(BaseModel):
    company_id: int
    name: str
    rate_limit_rpm: Optional[int] = 60


# ── Lista de empresas (para seletor) ─────────────────────────

@router.get("/companies")
async def list_companies_for_select(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Lista empresas para popular o seletor na criação de API Key."""
    result = await db.execute(
        select(Company.id, Company.name)
        .order_by(Company.name)
    )
    return [{"id": row.id, "name": row.name} for row in result.all()]


# ── Stats / KPIs ─────────────────────────────────────────────

@router.get("/api-stats")
async def get_api_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """KPIs gerais da API pública para o dashboard admin."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour_start = now - timedelta(hours=1)

    # Total de keys
    total_keys = (await db.execute(
        select(func.count()).select_from(ApiKey).where(ApiKey.is_active == True)
    )).scalar_one() or 0

    revoked_keys = (await db.execute(
        select(func.count()).select_from(ApiKey).where(ApiKey.is_active == False)
    )).scalar_one() or 0

    # Conexões SmartMoon via API pública (todas instâncias smartmoon)
    total_connections = (await db.execute(
        select(func.count()).select_from(Integration).where(
            Integration.provider == "smartmoon",
            Integration.status == "connected",
        )
    )).scalar_one() or 0

    pending_connections = (await db.execute(
        select(func.count()).select_from(Integration).where(
            Integration.provider == "smartmoon",
            Integration.status == "pending",
        )
    )).scalar_one() or 0

    # Requisições hoje e na última hora
    requests_today = (await db.execute(
        select(func.count()).select_from(ApiUsageLog).where(
            ApiUsageLog.created_at >= today_start
        )
    )).scalar_one() or 0

    requests_hour = (await db.execute(
        select(func.count()).select_from(ApiUsageLog).where(
            ApiUsageLog.created_at >= hour_start
        )
    )).scalar_one() or 0

    # Mensagens enviadas hoje
    msgs_today = (await db.execute(
        select(func.sum(ApiUsageLog.msgs_sent)).where(
            ApiUsageLog.created_at >= today_start
        )
    )).scalar_one() or 0

    # Empresas únicas usando a API
    unique_companies = (await db.execute(
        select(func.count(func.distinct(ApiKey.company_id))).select_from(ApiKey).where(
            ApiKey.is_active == True
        )
    )).scalar_one() or 0

    # API sempre ativa — flag removida, controle via DB por empresa
    return {
        "api_enabled": True,
        "total_keys": total_keys,
        "revoked_keys": revoked_keys,
        "total_connections": total_connections,
        "pending_connections": pending_connections,
        "requests_today": requests_today,
        "requests_hour": requests_hour,
        "msgs_sent_today": int(msgs_today),
        "unique_companies": unique_companies,
    }


# ── API Keys CRUD ─────────────────────────────────────────────

@router.get("/api-keys")
async def list_all_api_keys(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Lista todas as API Keys com nome da empresa."""
    result = await db.execute(
        select(ApiKey, Company.name.label("company_name"))
        .join(Company, ApiKey.company_id == Company.id, isouter=True)
        .order_by(ApiKey.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": k.id,
            "company_id": k.company_id,
            "company_name": cn,
            "name": k.name,
            "key_prefix": k.key_prefix,
            "rate_limit_rpm": k.rate_limit_rpm,
            "is_active": k.is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k, cn in rows
    ]


@router.post("/api-keys")
async def create_api_key_admin(
    body: CreateApiKeyAdminRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Cria API Key para uma empresa. Retorna a chave raw UMA ÚNICA VEZ."""
    raw_key, key_prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        company_id=body.company_id,
        name=body.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        rate_limit_rpm=body.rate_limit_rpm or 60,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": raw_key,  # exibida apenas 1x
        "key_prefix": key_prefix,
        "warning": "Guarde esta chave agora — não será exibida novamente.",
    }


@router.delete("/api-keys/{key_id}")
async def revoke_api_key_admin(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Revoga uma API Key imediatamente (soft delete)."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")
    api_key.is_active = False
    await db.commit()
    return {"message": f"API Key '{api_key.name}' revogada"}


@router.delete("/api-keys/{key_id}/delete")
async def delete_api_key_admin(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Exclui permanentemente uma API Key (hard delete)."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")
    await db.delete(api_key)
    await db.commit()
    return {"message": f"API Key '{api_key.name}' excluída permanentemente"}


class UpdateApiKeyRequest(BaseModel):
    name: Optional[str] = None
    rate_limit_rpm: Optional[int] = None
    instance_name: Optional[str] = None  # Novo nome de instância para a empresa
    company_id: Optional[int] = None     # Trocar empresa vinculada


@router.patch("/api-keys/{key_id}")
async def update_api_key_admin(
    key_id: int,
    body: UpdateApiKeyRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Atualiza nome, rate limit, empresa ou instância vinculada a uma API Key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")

    if body.name is not None:
        api_key.name = body.name
    if body.rate_limit_rpm is not None:
        api_key.rate_limit_rpm = body.rate_limit_rpm

    # Trocar empresa vinculada
    if body.company_id is not None and body.company_id != api_key.company_id:
        # Verificar se a nova empresa existe
        comp = await db.execute(select(Company).where(Company.id == body.company_id))
        if not comp.scalar_one_or_none():
            raise HTTPException(400, "Empresa não encontrada")
        api_key.company_id = body.company_id

    # Atualizar instância na Integration vinculada à empresa
    if body.instance_name is not None:
        intg_result = await db.execute(
            select(Integration).where(
                Integration.company_id == api_key.company_id,
                Integration.provider == "smartmoon",
            ).limit(1)
        )
        intg = intg_result.scalar_one_or_none()
        if intg:
            cfg = intg.config_json or {}
            cfg["label"] = body.instance_name
            cfg["instance_id"] = f"{api_key.company_id}-{body.instance_name.lower().replace(' ', '-')}"
            from sqlalchemy.orm.attributes import flag_modified
            intg.config_json = cfg
            flag_modified(intg, "config_json")

    await db.commit()
    return {"message": "API Key atualizada", "id": key_id}


@router.post("/api-keys/{key_id}/rotate")
async def rotate_api_key_admin(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Gera uma nova chave secreta para esta entrada, invalidando a anterior."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(404, "API Key não encontrada")

    raw_key, key_prefix, key_hash = generate_api_key()
    api_key.key_prefix = key_prefix
    api_key.key_hash = key_hash
    api_key.is_active = True
    api_key.last_used_at = None
    await db.commit()

    return {
        "message": "Nova chave gerada. A anterior foi invalidada.",
        "key": raw_key,
        "key_prefix": key_prefix,
        "warning": "Guarde esta chave agora — não será exibida novamente.",
    }


# ── Conexões ──────────────────────────────────────────────────

@router.get("/api-connections")
async def list_api_connections(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Lista instâncias SmartMoon criadas por clientes externos da API."""
    from app.models import Flow

    result = await db.execute(
        select(Integration, Company.name.label("company_name"))
        .join(Company, Integration.company_id == Company.id, isouter=True)
        .where(Integration.provider == "smartmoon")
        .order_by(Integration.created_at.desc())
    )
    rows = result.all()

    connections = []
    for intg, company_name in rows:
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            import json
            cfg = json.loads(cfg)

        # Busca a API Key desta empresa
        key_result = await db.execute(
            select(ApiKey.key_prefix).where(
                ApiKey.company_id == intg.company_id,
                ApiKey.is_active == True,
            ).limit(1)
        )
        key_prefix = key_result.scalar_one_or_none()

        connections.append({
            "id": intg.id,
            "instance_id": cfg.get("instance_id", ""),
            "company_id": intg.company_id,
            "company_name": company_name,
            "key_prefix": key_prefix,
            "display_phone": cfg.get("display_phone", ""),
            "status": intg.status,
            "external_webhook_url": intg.external_webhook_url,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "created_at": intg.created_at.isoformat() if intg.created_at else None,
            "updated_at": intg.updated_at.isoformat() if intg.updated_at else None,
        })
    return connections


@router.get("/api-connections/{instance_id}/flows")
async def list_flows_for_company_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Lista flows disponíveis para a empresa da instância."""
    from app.models import Flow

    # Busca a empresa da instância
    result = await db.execute(select(Integration).where(Integration.id == instance_id))
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Instância não encontrada")

    flows = await db.execute(
        select(Flow.id, Flow.name, Flow.description)
        .where(Flow.company_id == intg.company_id)
        .order_by(Flow.name)
    )
    return [{"id": f.id, "name": f.name, "description": f.description} for f in flows.all()]


class AdminAttachFlowBody(BaseModel):
    flow_id: Optional[int] = None


@router.post("/api-connections/{instance_id}/flow")
async def admin_attach_flow_to_instance(
    instance_id: int,
    body: AdminAttachFlowBody,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Admin vincula ou desvincula um flow/bot de IA a qualquer instância SmartMoon."""
    from app.models import Flow
    from sqlalchemy.orm.attributes import flag_modified

    result = await db.execute(
        select(Integration).where(
            Integration.id == instance_id,
            Integration.provider == "smartmoon",
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Instância não encontrada")

    cfg = intg.config_json or {}
    flow_name = None

    if body.flow_id:
        flow_result = await db.execute(select(Flow).where(Flow.id == body.flow_id))
        flow = flow_result.scalar_one_or_none()
        if not flow:
            raise HTTPException(404, "Flow não encontrado")
        flow_name = flow.name
        cfg["flow_id"] = body.flow_id
        cfg["flow_name"] = flow_name
    else:
        cfg["flow_id"] = None
        cfg["flow_name"] = None

    intg.config_json = cfg
    flag_modified(intg, "config_json")
    await db.commit()

    return {
        "flow_id": body.flow_id,
        "flow_name": flow_name,
        "message": f"Flow {'vinculado: ' + flow_name if body.flow_id else 'desvinculado'} com sucesso!",
    }


# ── Logs de uso ───────────────────────────────────────────────

@router.get("/api-usage")
async def get_api_usage_logs(
    hours: int = 24,
    endpoint: str = "",
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Log de requisições da API pública com nome de empresa e prefixo da key."""
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    query = (
        select(
            ApiUsageLog,
            ApiKey.key_prefix,
            ApiKey.name.label("key_name"),
            Company.name.label("company_name"),
        )
        .join(ApiKey, ApiUsageLog.api_key_id == ApiKey.id, isouter=True)
        .join(Company, ApiUsageLog.company_id == Company.id, isouter=True)
        .where(ApiUsageLog.created_at >= since)
    )

    if endpoint:
        query = query.where(ApiUsageLog.endpoint.contains(endpoint))

    query = query.order_by(ApiUsageLog.created_at.desc()).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": log.id,
            "company_id": log.company_id,
            "company_name": company_name,
            "key_prefix": key_prefix,
            "key_name": key_name,
            "endpoint": log.endpoint,
            "method": log.method,
            "instance_id": log.instance_id,
            "status_code": log.status_code,
            "msgs_sent": log.msgs_sent,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log, key_prefix, key_name, company_name in rows
    ]


# ── Solicitações de API Key ───────────────────────────────

@router.get("/api-requests")
async def list_api_key_requests(
    status_filter: str = "",
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_superadmin),
):
    """Lista todas as solicitações de API Key."""
    query = (
        select(
            ApiKeyRequest,
            Company.name.label("company_name"),
            User.name.label("user_name"),
            User.email.label("user_email"),
        )
        .join(Company, ApiKeyRequest.company_id == Company.id, isouter=True)
        .join(User, ApiKeyRequest.user_id == User.id, isouter=True)
        .order_by(ApiKeyRequest.created_at.desc())
    )
    if status_filter:
        query = query.where(ApiKeyRequest.status == status_filter)
    result = await db.execute(query)
    return [
        {
            "id": r.id,
            "company_id": r.company_id,
            "company_name": company_name,
            "user_name": user_name,
            "user_email": user_email,
            "name": r.name,
            "system_name": r.system_name,
            "reason": r.reason,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
        for r, company_name, user_name, user_email in result.all()
    ]


class ReviewRequestBody(BaseModel):
    admin_notes: Optional[str] = None
    rate_limit_rpm: Optional[int] = 60


@router.post("/api-requests/{request_id}/approve")
async def approve_api_key_request(
    request_id: int,
    body: ReviewRequestBody,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_superadmin),
):
    """Aprova solicitação e cria a API Key automaticamente."""
    result = await db.execute(select(ApiKeyRequest).where(ApiKeyRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Solicitação não encontrada")
    if req.status != "pending":
        raise HTTPException(400, f"Solicitação já foi {req.status}")

    # Criar API Key
    raw_key, key_prefix, key_hash = generate_api_key()
    api_key = ApiKey(
        company_id=req.company_id,
        name=req.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        rate_limit_rpm=body.rate_limit_rpm or 60,
    )
    db.add(api_key)

    # Atualizar solicitação
    req.status = "approved"
    req.admin_notes = body.admin_notes
    req.generated_key = raw_key  # salva para o usuário ver
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "message": "Solicitação aprovada! API Key criada.",
        "key": raw_key,
        "key_prefix": key_prefix,
        "warning": "Copie e envie esta chave ao usuário. Não será exibida novamente.",
    }


@router.post("/api-requests/{request_id}/reject")
async def reject_api_key_request(
    request_id: int,
    body: ReviewRequestBody,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_superadmin),
):
    """Rejeita uma solicitação de API Key."""
    result = await db.execute(select(ApiKeyRequest).where(ApiKeyRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Solicitação não encontrada")
    if req.status != "pending":
        raise HTTPException(400, f"Solicitação já foi {req.status}")

    req.status = "rejected"
    req.admin_notes = body.admin_notes
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Solicitação rejeitada"}
