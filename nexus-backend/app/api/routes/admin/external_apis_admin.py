"""
Admin Routes — Gerenciamento de APIs Externas

CRUD completo para cadastrar APIs externas, definir endpoints,
e vincular a empresas/contas específicas.

Apenas superadmin pode gerenciar.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import require_superadmin
from app.models.external_api import ExternalApiConfig, ExternalApiBinding
from app.services.external_api_client import ExternalApiClient

router = APIRouter(prefix="/admin/external-apis", tags=["Admin — External APIs"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class EndpointDef(BaseModel):
    method: str = "GET"
    path: str
    description: str = ""
    params: list = []

class ExternalApiCreate(BaseModel):
    slug: str
    display_name: str
    description: Optional[str] = None
    icon: str = "🔌"
    color: str = "#6366f1"
    base_url: str
    auth_type: str = "header"  # header | query | bearer | none
    auth_header_name: Optional[str] = "X-API-Key"
    auth_query_param: Optional[str] = "api_key"
    default_api_key: Optional[str] = None
    endpoints_json: dict = {}
    is_active: bool = True

class ExternalApiUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_header_name: Optional[str] = None
    auth_query_param: Optional[str] = None
    default_api_key: Optional[str] = None
    endpoints_json: Optional[dict] = None
    is_active: Optional[bool] = None

class BindingCreate(BaseModel):
    company_id: int
    api_key_override: Optional[str] = None
    config_override_json: dict = {}
    is_active: bool = True

class BindingUpdate(BaseModel):
    api_key_override: Optional[str] = None
    config_override_json: Optional[dict] = None
    is_active: Optional[bool] = None


# ── API Configs CRUD ─────────────────────────────────────────────────────────

@router.get("", summary="Listar todas as APIs externas")
async def list_external_apis(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(
        select(ExternalApiConfig)
        .options(selectinload(ExternalApiConfig.bindings))
        .order_by(ExternalApiConfig.display_name)
    )
    apis = result.scalars().all()

    return {
        "apis": [
            {
                "id": api.id,
                "slug": api.slug,
                "display_name": api.display_name,
                "description": api.description,
                "icon": api.icon,
                "color": api.color,
                "base_url": api.base_url,
                "auth_type": api.auth_type,
                "auth_header_name": api.auth_header_name,
                "auth_query_param": api.auth_query_param,
                "has_default_key": bool(api.default_api_key),
                "endpoints_json": api.endpoints_json or {},
                "endpoints_count": len(api.endpoints_json or {}),
                "is_active": api.is_active,
                "bindings_count": len(api.bindings),
                "bindings": [
                    {
                        "id": b.id,
                        "company_id": b.company_id,
                        "has_key_override": bool(b.api_key_override),
                        "config_override": b.config_override_json or {},
                        "is_active": b.is_active,
                    }
                    for b in api.bindings
                ],
                "created_at": api.created_at.isoformat() if api.created_at else None,
            }
            for api in apis
        ]
    }


@router.post("", summary="Criar API externa", status_code=status.HTTP_201_CREATED)
async def create_external_api(
    body: ExternalApiCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    # Check slug uniqueness
    existing = await db.execute(
        select(ExternalApiConfig).where(ExternalApiConfig.slug == body.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"API com slug '{body.slug}' já existe")

    api = ExternalApiConfig(
        slug=body.slug,
        display_name=body.display_name,
        description=body.description,
        icon=body.icon,
        color=body.color,
        base_url=body.base_url,
        auth_type=body.auth_type,
        auth_header_name=body.auth_header_name,
        auth_query_param=body.auth_query_param,
        default_api_key=body.default_api_key,
        endpoints_json=body.endpoints_json,
        is_active=body.is_active,
        created_by=user.id,
    )
    db.add(api)
    await db.commit()
    await db.refresh(api)

    logger.info(f"✅ External API criada: {api.slug} (#{api.id})")
    return {"id": api.id, "slug": api.slug, "message": f"API '{api.display_name}' criada com sucesso"}


@router.put("/{api_id}", summary="Atualizar API externa")
async def update_external_api(
    api_id: int,
    body: ExternalApiUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(select(ExternalApiConfig).where(ExternalApiConfig.id == api_id))
    api = result.scalar_one_or_none()
    if not api:
        raise HTTPException(404, "API não encontrada")

    data = body.dict(exclude_none=True)
    for key, value in data.items():
        setattr(api, key, value)

    await db.commit()
    return {"message": f"API '{api.display_name}' atualizada"}


@router.delete("/{api_id}", summary="Remover API externa", status_code=status.HTTP_204_NO_CONTENT)
async def delete_external_api(
    api_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(select(ExternalApiConfig).where(ExternalApiConfig.id == api_id))
    api = result.scalar_one_or_none()
    if not api:
        raise HTTPException(404, "API não encontrada")

    await db.delete(api)
    await db.commit()
    logger.info(f"🗑️ External API removida: {api.slug}")


@router.post("/{api_id}/test", summary="Testar conexão com a API externa")
async def test_external_api(
    api_id: int,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(select(ExternalApiConfig).where(ExternalApiConfig.id == api_id))
    api = result.scalar_one_or_none()
    if not api:
        raise HTTPException(404, "API não encontrada")

    client = ExternalApiClient(
        base_url=api.base_url,
        api_key=api.default_api_key,
        auth_type=api.auth_type or "header",
        auth_header_name=api.auth_header_name or "X-API-Key",
        auth_query_param=api.auth_query_param or "api_key",
        timeout=15,
    )

    # Tenta chamar o primeiro endpoint definido, ou faz um HEAD na base
    endpoints = api.endpoints_json or {}
    if action and action in endpoints:
        ep = endpoints[action]
        result_data = await client.call(ep.get("method", "GET"), ep.get("path", "/"))
    elif endpoints:
        first_key = list(endpoints.keys())[0]
        ep = endpoints[first_key]
        result_data = await client.call(ep.get("method", "GET"), ep.get("path", "/"))
    else:
        result_data = await client.call("GET", "/")

    return {
        "status": "ok" if result_data.get("success") else "error",
        "status_code": result_data.get("status_code"),
        "error": result_data.get("error"),
        "data_preview": str(result_data.get("data", ""))[:500] if result_data.get("data") else None,
    }


# ── Bindings (vincular API a empresas) ───────────────────────────────────────

@router.get("/{api_id}/bindings", summary="Listar vínculos da API")
async def list_bindings(
    api_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(
        select(ExternalApiBinding).where(ExternalApiBinding.api_config_id == api_id)
    )
    bindings = result.scalars().all()

    # Enrich with company names
    from app.models import Company
    company_ids = [b.company_id for b in bindings]
    companies = {}
    if company_ids:
        comp_result = await db.execute(
            select(Company).where(Company.id.in_(company_ids))
        )
        companies = {c.id: c.name for c in comp_result.scalars().all()}

    return {
        "bindings": [
            {
                "id": b.id,
                "company_id": b.company_id,
                "company_name": companies.get(b.company_id, f"Company #{b.company_id}"),
                "has_key_override": bool(b.api_key_override),
                "config_override": b.config_override_json or {},
                "is_active": b.is_active,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in bindings
        ]
    }


@router.post("/{api_id}/bindings", summary="Vincular API a uma empresa")
async def create_binding(
    api_id: int,
    body: BindingCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    # Verifica API
    api_result = await db.execute(select(ExternalApiConfig).where(ExternalApiConfig.id == api_id))
    if not api_result.scalar_one_or_none():
        raise HTTPException(404, "API não encontrada")

    # Verifica se binding já existe
    existing = await db.execute(
        select(ExternalApiBinding).where(
            ExternalApiBinding.api_config_id == api_id,
            ExternalApiBinding.company_id == body.company_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"API já vinculada à empresa #{body.company_id}")

    binding = ExternalApiBinding(
        api_config_id=api_id,
        company_id=body.company_id,
        api_key_override=body.api_key_override,
        config_override_json=body.config_override_json,
        is_active=body.is_active,
    )
    db.add(binding)
    await db.commit()
    await db.refresh(binding)

    logger.info(f"✅ API #{api_id} vinculada à empresa #{body.company_id}")
    return {"id": binding.id, "message": f"API vinculada à empresa #{body.company_id}"}


@router.put("/{api_id}/bindings/{binding_id}", summary="Atualizar vínculo")
async def update_binding(
    api_id: int,
    binding_id: int,
    body: BindingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(
        select(ExternalApiBinding).where(
            ExternalApiBinding.id == binding_id,
            ExternalApiBinding.api_config_id == api_id,
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        raise HTTPException(404, "Vínculo não encontrado")

    data = body.dict(exclude_none=True)
    for key, value in data.items():
        setattr(binding, key, value)

    await db.commit()
    return {"message": "Vínculo atualizado"}


@router.delete("/{api_id}/bindings/{binding_id}", summary="Remover vínculo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_binding(
    api_id: int,
    binding_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    result = await db.execute(
        select(ExternalApiBinding).where(
            ExternalApiBinding.id == binding_id,
            ExternalApiBinding.api_config_id == api_id,
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        raise HTTPException(404, "Vínculo não encontrado")

    await db.delete(binding)
    await db.commit()
    logger.info(f"🗑️ Binding #{binding_id} removido da API #{api_id}")


# ── Endpoint para o Flow Builder listar APIs disponíveis ─────────────────────

@router.get("/available", summary="APIs disponíveis para o flow builder")
async def list_available_apis(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_superadmin),
):
    """Lista APIs externas com seus endpoints, para uso na paleta de nós do flow builder."""
    result = await db.execute(
        select(ExternalApiConfig).where(ExternalApiConfig.is_active == True)
        .order_by(ExternalApiConfig.display_name)
    )
    apis = result.scalars().all()

    return {
        "apis": [
            {
                "slug": api.slug,
                "display_name": api.display_name,
                "icon": api.icon,
                "color": api.color,
                "endpoints": [
                    {"action": k, "method": v.get("method", "GET"), "description": v.get("description", "")}
                    for k, v in (api.endpoints_json or {}).items()
                ],
            }
            for api in apis
        ]
    }
