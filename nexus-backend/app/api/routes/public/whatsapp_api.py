"""
API Pública — Endpoints WhatsApp

Permite sistemas externos criar instâncias, conectar via QR,
enviar mensagens e receber mensagens via webhook configurável.

Autenticação: Authorization: Bearer sm_<chave>
Base URL:     /v1/whatsapp
"""
import base64
import os
import uuid
import aiofiles
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.session import get_db, AsyncSessionLocal
from app.middleware.api_key_auth import verify_api_key, log_api_usage
from app.models import Integration
from app.services.smartmoon_client import SmartMoonClient

router = APIRouter(prefix="/v1/whatsapp", tags=["Public API — WhatsApp"])

MEDIA_DIR = os.getenv("MEDIA_DIR", "/data/media")


# ── Schemas ──────────────────────────────────────────────────

class CreateInstanceRequest(BaseModel):
    name:        str               # ex: "suporte", "vendas"
    webhook_url: Optional[str] = None  # onde receber mensagens

class SetWebhookRequest(BaseModel):
    url: str

class SendTextRequest(BaseModel):
    instance_name: str
    phone:         str   # apenas dígitos: "5511999998888"
    text:          str

class SendImageRequest(BaseModel):
    instance_name: str
    phone:         str
    image_base64:  Optional[str] = None  # base64 da imagem
    image_url:     Optional[str] = None  # ou URL pública
    caption:       Optional[str] = None


# ── Helper: namespace de instâncias ──────────────────────────

def _instance_id(company_id: int, name: str) -> str:
    """Cria instance_id com namespace: "42-suporte" — evita colisão entre tenants."""
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_").lower()
    return f"{company_id}-{safe_name}"


async def _resolve_instance_id(company_id: int, name: str, db: AsyncSession) -> str:
    """Resolve o instance_id real buscando pela label no banco.

    Ordem de busca:
    1. Label exata (case-insensitive) na tabela integrations
    2. Fallback para _instance_id(company_id, name) (formato gerado pela API)
    """
    result = await db.execute(
        select(Integration).where(
            Integration.provider   == "smartmoon",
            Integration.company_id == company_id,
        )
    )
    name_lower = name.lower().strip()
    for intg in result.scalars().all():
        cfg   = intg.config_json or {}
        label = (cfg.get("label") or "").lower().strip()
        if label == name_lower:
            return cfg.get("instance_id") or _instance_id(company_id, name)

    # Fallback: formato gerado pela API pública
    return _instance_id(company_id, name)


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/instances", summary="Criar instância WhatsApp")
async def create_instance(
    body:    CreateInstanceRequest,
    db:      AsyncSession = Depends(get_db),
    api_key  = Depends(verify_api_key),
):
    """
    Cria uma nova instância WhatsApp.
    Após criar, faça GET /v1/whatsapp/instances/{name}/qr e exiba o QR para o usuário escanear.
    """
    instance_id = _instance_id(api_key.company_id, body.name)

    # Cria no engine
    webhook_url  = f"http://nexus_api:8000/webhook/smartmoon/{instance_id}/receive"
    status_url   = f"http://nexus_api:8000/webhook/smartmoon/{instance_id}/status"
    engine_result = await SmartMoonClient.create_instance(instance_id, webhook_url, status_url)

    if "error" in engine_result:
        raise HTTPException(502, f"Erro ao criar instância: {engine_result['error']}")

    # Verifica se já existe integração para esta empresa+instance
    existing = await db.execute(
        select(Integration).where(
            Integration.provider   == "smartmoon",
            Integration.company_id == api_key.company_id,
        )
    )
    for intg in existing.scalars().all():
        cfg = intg.config_json or {}
        if cfg.get("instance_id") == instance_id:
            # Já existe — retorna sem duplicar
            return {"instance_name": body.name, "status": "pending", "already_exists": True}

    # Registra no banco
    integration = Integration(
        company_id  = api_key.company_id,
        provider    = "smartmoon",
        status      = "pending",
        config_json = {
            "label":       body.name,
            "instance_id": instance_id,
            "display_phone": "",
            "push_name":   "",
            "flow_id":     None,
            "flow_name":   None,
        },
        external_webhook_url = body.webhook_url,
    )
    db.add(integration)
    await db.commit()

    await log_api_usage(api_key, "POST /v1/whatsapp/instances", instance_id=instance_id)

    return {
        "instance_name": body.name,
        "status":        "pending",
        "next_step":     f"GET /v1/whatsapp/instances/{body.name}/qr",
    }


@router.get("/instances/{name}/qr", summary="Obter QR Code")
async def get_qr_code(name: str, api_key=Depends(verify_api_key), db: AsyncSession = Depends(get_db)):
    """
    Retorna o QR Code em base64 para conectar o WhatsApp.
    Consulte a cada 5s até receber status CONNECTED.

    Possíveis retornos:
    - { status: "QR_READY",    qrCode: "data:image/png;base64,..." }
    - { status: "CONNECTED",   phoneNumber: "5511999998888" }
    - { status: "INITIALIZING" } → aguarde e tente novamente
    """
    instance_id = await _resolve_instance_id(api_key.company_id, name, db)
    result = await SmartMoonClient.get_qr_code(instance_id)
    await log_api_usage(api_key, f"GET /v1/whatsapp/instances/{name}/qr", instance_id=instance_id)
    return result


@router.get("/instances/{name}/status", summary="Status da instância")
async def get_status(name: str, api_key=Depends(verify_api_key), db: AsyncSession = Depends(get_db)):
    """Status: INITIALIZING | QR_READY | CONNECTING | CONNECTED | DISCONNECTED | LOGGED_OUT"""
    instance_id = await _resolve_instance_id(api_key.company_id, name, db)
    return await SmartMoonClient.get_instance_status(instance_id)


@router.get("/instances", summary="Listar instâncias")
async def list_instances(db: AsyncSession = Depends(get_db), api_key=Depends(verify_api_key)):
    """Lista todas as instâncias desta empresa com status atual."""
    result = await db.execute(
        select(Integration).where(
            Integration.provider   == "smartmoon",
            Integration.company_id == api_key.company_id,
        )
    )
    instances = []
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        instances.append({
            "name":          cfg.get("label", ""),
            "instance_id":   cfg.get("instance_id", ""),
            "status":        intg.status,
            "phone":         cfg.get("display_phone", ""),
            "webhook_url":   intg.external_webhook_url,
        })
    return instances


@router.post("/instances/{name}/webhook", summary="Configurar URL de webhook")
async def set_webhook(
    name:    str,
    body:    SetWebhookRequest,
    db:      AsyncSession = Depends(get_db),
    api_key  = Depends(verify_api_key),
):
    """
    Configura o URL que receberá as mensagens quando alguém enviar para esta instância.

    Payload que seu sistema receberá:
    POST {seu_url}
    {
      "event":    "message.received",
      "instance": "suporte",
      "data": {
        "phone":     "5511999998888",
        "name":      "João Silva",
        "type":      "text",
        "text":      "Olá!",
        "timestamp": 1234567890000
      }
    }
    """
    instance_id = _instance_id(api_key.company_id, name)

    result = await db.execute(
        select(Integration).where(Integration.provider == "smartmoon")
    )
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        if cfg.get("instance_id") == instance_id and intg.company_id == api_key.company_id:
            intg.external_webhook_url = body.url
            await db.commit()
            return {"message": "Webhook configurado", "url": body.url}

    raise HTTPException(404, f"Instância '{name}' não encontrada")


@router.post("/messages/send-text", summary="Enviar mensagem de texto")
async def send_text(body: SendTextRequest, api_key=Depends(verify_api_key), db: AsyncSession = Depends(get_db)):
    """
    Envia mensagem de texto com delay humanizado (anti-ban).
    Retorna jobId — a mensagem é enfileirada, não enviada imediatamente.

    phone: apenas dígitos, com DDD e DDI. Ex: "5511999998888"
    """
    instance_id = await _resolve_instance_id(api_key.company_id, body.instance_name, db)
    result = await SmartMoonClient.send_text(instance_id, body.phone, body.text)

    if "error" in result:
        raise HTTPException(503, result["error"])

    await log_api_usage(api_key, "POST /v1/whatsapp/messages/send-text",
                        instance_id=instance_id, msgs_sent=1)
    return result


@router.post("/messages/send-image", summary="Enviar imagem")
async def send_image(body: SendImageRequest, api_key=Depends(verify_api_key)):
    """
    Envia imagem. Aceita:
    - image_base64: string base64 (sem prefixo data:image/...)
    - image_url: URL pública da imagem (baixamos para você)
    - caption: legenda opcional
    """
    instance_id = _instance_id(api_key.company_id, body.instance_name)

    if not body.image_base64 and not body.image_url:
        raise HTTPException(400, "Forneça image_base64 ou image_url")

    filepath = await _save_media(
        body.image_base64, body.image_url, "image/jpeg", instance_id
    )

    result = await SmartMoonClient.send_image(instance_id, body.phone, filepath, body.caption)
    await log_api_usage(api_key, "POST /v1/whatsapp/messages/send-image",
                        instance_id=instance_id, msgs_sent=1)
    return result


@router.delete("/instances/{name}", summary="Remover instância")
async def delete_instance(
    name:    str,
    db:      AsyncSession = Depends(get_db),
    api_key  = Depends(verify_api_key),
):
    """Remove a instância e desconecta do WhatsApp. Requer novo QR para reconectar."""
    instance_id = _instance_id(api_key.company_id, name)
    await SmartMoonClient.delete_instance(instance_id)

    result = await db.execute(
        select(Integration).where(Integration.provider == "smartmoon")
    )
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        if cfg.get("instance_id") == instance_id and intg.company_id == api_key.company_id:
            await db.delete(intg)
            await db.commit()
            break

    return {"message": f"Instância '{name}' removida"}


# ── Media Proxy ───────────────────────────────────────────────

async def _save_media(b64: Optional[str], url: Optional[str], mime: str, instance_id: str) -> str:
    """Converte base64 ou URL pública em file path no volume compartilhado."""
    ext = mime.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{uuid.uuid4()}.{ext}"
    dirpath  = os.path.join(MEDIA_DIR, instance_id)
    filepath = os.path.join(dirpath, filename)
    os.makedirs(dirpath, exist_ok=True)

    if b64:
        # Remove prefixo data:image/...;base64, se presente
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        data = base64.b64decode(b64)
        async with aiofiles.open(filepath, "wb") as f:
            await f.write(data)
    elif url:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            async with aiofiles.open(filepath, "wb") as f:
                await f.write(resp.content)

    return filepath


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FLOW / BOT — Vincular IA a uma instância
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AttachFlowRequest(BaseModel):
    flow_id: Optional[int] = None  # None = desvincular


@router.get("/flows")
async def list_available_flows(
    api_key_data=Depends(verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Lista flows/bots disponíveis na empresa para vincular a uma instância."""
    from app.models import Flow
    company_id = api_key_data["company_id"]

    result = await db.execute(
        select(Flow.id, Flow.name, Flow.description, Flow.is_active)
        .where(
            Flow.company_id == company_id,
            Flow.is_active == True,
        )
        .order_by(Flow.name)
    )
    flows = result.all()

    await log_api_usage(api_key_data, "/v1/whatsapp/flows", "GET", db=db)
    return {
        "flows": [
            {"id": f.id, "name": f.name, "description": f.description}
            for f in flows
        ]
    }


@router.post("/instances/{instance_name}/flow")
async def attach_flow_to_instance(
    instance_name: str,
    body: AttachFlowRequest,
    api_key_data=Depends(verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Vincula ou desvincula um flow/bot de IA a uma instância WhatsApp.

    Quando vinculado:
    - Mensagens recebidas são processadas automaticamente pelo bot de IA
    - As respostas são enviadas de volta ao WhatsApp automaticamente
    - O webhook externo continua funcionando em paralelo (se configurado)

    Para desvincular, envie flow_id = null.
    """
    company_id = api_key_data["company_id"]
    instance_id = f"{company_id}-{instance_name}"

    # Buscar integração
    result = await db.execute(
        select(Integration).where(
            Integration.provider == "smartmoon",
            Integration.company_id == company_id,
            Integration.config_json["instance_id"].astext == instance_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, f"Instância '{instance_name}' não encontrada")

    cfg = integration.config_json or {}
    flow_name = None

    if body.flow_id:
        # Validar que o flow pertence à empresa
        from app.models import Flow
        flow_result = await db.execute(
            select(Flow).where(Flow.id == body.flow_id, Flow.company_id == company_id)
        )
        flow = flow_result.scalar_one_or_none()
        if not flow:
            raise HTTPException(404, f"Flow #{body.flow_id} não encontrado ou não pertence à sua empresa")
        flow_name = flow.name
        cfg["flow_id"] = body.flow_id
        cfg["flow_name"] = flow_name
    else:
        cfg["flow_id"] = None
        cfg["flow_name"] = None

    integration.config_json = cfg
    flag_modified(integration, "config_json")
    await db.commit()

    await log_api_usage(api_key_data, f"/v1/whatsapp/instances/{instance_name}/flow", "POST", instance_id=instance_id, db=db)

    return {
        "instance": instance_name,
        "flow_id": body.flow_id,
        "flow_name": flow_name,
        "message": f"Flow {'vinculado: ' + flow_name if body.flow_id else 'desvinculado'} com sucesso",
        "note": "Mensagens recebidas serão processadas pelo bot de IA automaticamente" if body.flow_id else "Instância operando sem bot de IA",
    }


@router.get("/instances/{instance_name}/flow")
async def get_instance_flow(
    instance_name: str,
    api_key_data=Depends(verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Verifica qual flow/bot está vinculado a uma instância."""
    company_id = api_key_data["company_id"]
    instance_id = f"{company_id}-{instance_name}"

    result = await db.execute(
        select(Integration).where(
            Integration.provider == "smartmoon",
            Integration.company_id == company_id,
            Integration.config_json["instance_id"].astext == instance_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, f"Instância '{instance_name}' não encontrada")

    cfg = integration.config_json or {}
    await log_api_usage(api_key_data, f"/v1/whatsapp/instances/{instance_name}/flow", "GET", instance_id=instance_id, db=db)

    return {
        "instance": instance_name,
        "flow_id": cfg.get("flow_id"),
        "flow_name": cfg.get("flow_name"),
        "has_bot": cfg.get("flow_id") is not None,
    }

