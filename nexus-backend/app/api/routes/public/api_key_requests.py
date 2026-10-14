"""
User-facing API Key Request endpoints.
Permite usuários solicitar acesso à API pública SmartMoon.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.api_key import ApiKey, ApiKeyRequest

router = APIRouter(prefix="/api-keys", tags=["API Keys — Solicitação"])


class RequestApiKeyBody(BaseModel):
    name: str           # nome da integração
    system_name: Optional[str] = None  # sistema que vai integrar
    reason: Optional[str] = None       # motivo


@router.post("/request")
async def request_api_key(
    body: RequestApiKeyBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Usuário solicita uma API Key. Admin precisa aprovar."""
    # Verifica se já existe solicitação pendente
    existing = await db.execute(
        select(ApiKeyRequest).where(
            ApiKeyRequest.company_id == user.company_id,
            ApiKeyRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Já existe uma solicitação pendente. Aguarde a análise do admin.")

    req = ApiKeyRequest(
        company_id=user.company_id,
        user_id=user.id,
        name=body.name,
        system_name=body.system_name,
        reason=body.reason,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return {
        "id": req.id,
        "status": "pending",
        "message": "Solicitação enviada! O admin será notificado e analisará seu pedido.",
    }


@router.get("/requests")
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista as solicitações de API Key da empresa do usuário."""
    result = await db.execute(
        select(ApiKeyRequest)
        .where(ApiKeyRequest.company_id == user.company_id)
        .order_by(ApiKeyRequest.created_at.desc())
    )
    reqs = result.scalars().all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "system_name": r.system_name,
            "reason": r.reason,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "generated_key": r.generated_key if hasattr(r, 'generated_key') else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
        for r in reqs
    ]


@router.get("/my-keys")
async def list_my_keys(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista API Keys da empresa do usuário (sem exibir hash)."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.company_id == user.company_id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        {
            "id": k.id,
            "name": k.name,
            "key_prefix": k.key_prefix,
            "rate_limit_rpm": k.rate_limit_rpm,
            "is_active": k.is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k in keys
    ]


@router.post("/my-keys/{key_id}/regenerate")
async def regenerate_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Regenera uma API Key — invalida a antiga e cria uma nova."""
    from app.middleware.api_key_auth import generate_api_key

    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.company_id == user.company_id)
    )
    old_key = result.scalar_one_or_none()
    if not old_key:
        raise HTTPException(404, "Chave não encontrada")

    # Gera nova
    raw_key, key_prefix, key_hash = generate_api_key()
    old_key.key_prefix = key_prefix
    old_key.key_hash = key_hash

    # Salva no request correspondente
    req_result = await db.execute(
        select(ApiKeyRequest).where(
            ApiKeyRequest.company_id == user.company_id,
            ApiKeyRequest.status == "approved",
        ).order_by(ApiKeyRequest.created_at.desc())
    )
    req = req_result.scalar_one_or_none()
    if req:
        req.generated_key = raw_key

    await db.commit()
    return {"key": raw_key, "key_prefix": key_prefix, "message": "Chave regenerada com sucesso!"}


class SetWebhookBody(BaseModel):
    webhook_url: Optional[str] = None


@router.post("/my-instances/{instance_id}/webhook")
async def set_instance_webhook(
    instance_id: int,
    body: SetWebhookBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Configura webhook URL para receber mensagens na instância."""
    from app.models import Integration
    from sqlalchemy.orm.attributes import flag_modified

    result = await db.execute(
        select(Integration).where(
            Integration.id == instance_id,
            Integration.company_id == user.company_id,
            Integration.provider == "smartmoon",
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Instância não encontrada")

    cfg = intg.config_json or {}
    cfg["webhook_url"] = body.webhook_url or None
    intg.config_json = cfg
    flag_modified(intg, "config_json")
    intg.external_webhook_url = body.webhook_url or None
    await db.commit()

    return {"message": f"Webhook {'configurado' if body.webhook_url else 'removido'}", "webhook_url": body.webhook_url}


# ── Instâncias e Flows ────────────────────────────────────

@router.get("/my-instances")
async def list_my_instances(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista instâncias SmartMoon da empresa do usuário."""
    from app.models import Integration

    result = await db.execute(
        select(Integration).where(
            Integration.company_id == user.company_id,
            Integration.provider == "smartmoon",
        ).order_by(Integration.id.desc())
    )
    instances = result.scalars().all()

    return [
        {
            "id": intg.id,
            "instance_id": (intg.config_json or {}).get("instance_id", ""),
            "instance_name": (intg.config_json or {}).get("instance_id", "").split("-", 1)[-1]
                if "-" in (intg.config_json or {}).get("instance_id", "") else (intg.config_json or {}).get("instance_id", ""),
            "display_phone": (intg.config_json or {}).get("display_phone", ""),
            "status": intg.status,
            "flow_id": (intg.config_json or {}).get("flow_id"),
            "flow_name": (intg.config_json or {}).get("flow_name"),
            "external_webhook_url": intg.external_webhook_url,
            "created_at": intg.created_at.isoformat() if intg.created_at else None,
        }
        for intg in instances
    ]


@router.get("/my-flows")
async def list_my_flows(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista flows/bots disponíveis para vincular a instâncias."""
    from app.models import Flow

    result = await db.execute(
        select(Flow.id, Flow.name, Flow.description)
        .where(
            Flow.company_id == user.company_id,
            Flow.status.in_(["published", "active", "draft"])
        )
        .order_by(Flow.name)
    )
    return [{"id": f.id, "name": f.name, "description": f.description} for f in result.all()]


class AttachFlowBody(BaseModel):
    flow_id: Optional[int] = None


@router.post("/my-instances/{instance_id}/flow")
async def attach_flow_to_my_instance(
    instance_id: int,
    body: AttachFlowBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Vincula ou desvincula um flow/bot de IA a uma instância do usuário."""
    from app.models import Integration, Flow
    from sqlalchemy.orm.attributes import flag_modified

    result = await db.execute(
        select(Integration).where(
            Integration.id == instance_id,
            Integration.company_id == user.company_id,
            Integration.provider == "smartmoon",
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Instância não encontrada")

    cfg = intg.config_json or {}
    flow_name = None

    if body.flow_id:
        flow_result = await db.execute(
            select(Flow).where(Flow.id == body.flow_id, Flow.company_id == user.company_id)
        )
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
        "message": f"Flow {'vinculado: ' + flow_name if body.flow_id else 'desvinculado'}",
    }

