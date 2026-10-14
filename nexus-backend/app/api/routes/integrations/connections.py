"""
Connections API — Unified status panel for all channels.
Supports: WhatsApp Cloud (Meta), Z-API, Telegram, Google Workspace.
⚠️ Multi-tenant: all endpoints require authentication and filter by company_id.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db, AsyncSessionLocal
from app.models import Integration
from app.models.whatsapp_models import WhatsAppConversation, WhatsAppMessage
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/connections", tags=["Connections"])


@router.get("/status")
async def connections_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Consolidated status for all active channel integrations — scoped to current company."""
    channels = []
    company_id = user.company_id

    # ── WhatsApp Cloud (Meta) ──
    wa_result = await db.execute(
        select(Integration).where(
            Integration.provider == "whatsapp_cloud",
            Integration.company_id == company_id,
        )
    )
    for intg in wa_result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        conv_count, msg_count = await _count_whatsapp_stats(db, intg.id)

        channels.append({
            "channel": "whatsapp",
            "provider": "whatsapp_cloud",
            "integration_id": intg.id,
            "label": cfg.get("label", "WhatsApp Cloud (Meta)"),
            "phone_number_id": cfg.get("phone_number_id"),
            "display_phone": cfg.get("display_phone"),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "conversations": conv_count,
            "messages": msg_count,
        })

    # ── Z-API ──
    zapi_result = await db.execute(
        select(Integration).where(
            Integration.provider == "zapi",
            Integration.company_id == company_id,
        )
    )
    for intg in zapi_result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        conv_count, msg_count = await _count_whatsapp_stats(db, intg.id)

        channels.append({
            "channel": "whatsapp",
            "provider": "zapi",
            "integration_id": intg.id,
            "label": cfg.get("label", "WhatsApp (Z-API)"),
            "instance_id": cfg.get("instance_id"),
            "display_phone": cfg.get("display_phone", ""),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "conversations": conv_count,
            "messages": msg_count,
        })

    # ── SmartMoon Engine (WhatsApp Direto) ──
    sm_result = await db.execute(
        select(Integration).where(
            Integration.provider == "smartmoon",
            Integration.company_id == company_id,
        )
    )
    for intg in sm_result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        conv_count, msg_count = await _count_whatsapp_stats(db, intg.id)

        channels.append({
            "channel": "whatsapp",
            "provider": "smartmoon",
            "integration_id": intg.id,
            "label": cfg.get("label", "WhatsApp Direto (SmartMoon)"),
            "instance_id": cfg.get("instance_id"),
            "display_phone": cfg.get("display_phone", ""),
            "push_name": cfg.get("push_name", ""),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "conversations": conv_count,
            "messages": msg_count,
        })

    # ── Telegram ──
    tg_result = await db.execute(
        select(Integration).where(
            Integration.provider == "telegram",
            Integration.company_id == company_id,
        )
    )
    for intg in tg_result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        tg_conv_count = 0
        tg_msg_count = 0
        try:
            from app.models.telegram_models import TelegramConversation, TelegramMessage
            tg_conv_count = await db.scalar(
                select(func.count(TelegramConversation.id)).where(
                    TelegramConversation.integration_id == intg.id
                )
            ) or 0
            tg_msg_count = await db.scalar(
                select(func.count(TelegramMessage.id)).where(
                    TelegramMessage.conversation_id.in_(
                        select(TelegramConversation.id).where(
                            TelegramConversation.integration_id == intg.id
                        )
                    )
                )
            ) or 0
        except Exception:
            pass

        channels.append({
            "channel": "telegram",
            "provider": "telegram",
            "integration_id": intg.id,
            "label": cfg.get("label", cfg.get("bot_username", "Telegram Bot")),
            "username": cfg.get("bot_username"),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "conversations": tg_conv_count,
            "messages": tg_msg_count,
        })

    # ── Instagram DM ──
    ig_result = await db.execute(
        select(Integration).where(
            Integration.provider == "instagram_dm",
            Integration.company_id == company_id,
        )
    )
    for intg in ig_result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        ig_conv_count = 0
        ig_msg_count = 0
        try:
            from app.models.instagram_models import InstagramConversation, InstagramMessage
            ig_conv_count = await db.scalar(
                select(func.count(InstagramConversation.id)).where(
                    InstagramConversation.integration_id == intg.id
                )
            ) or 0
            ig_msg_count = await db.scalar(
                select(func.count(InstagramMessage.id)).where(
                    InstagramMessage.conversation_id.in_(
                        select(InstagramConversation.id).where(
                            InstagramConversation.integration_id == intg.id
                        )
                    )
                )
            ) or 0
        except Exception:
            pass

        channels.append({
            "channel": "instagram",
            "provider": "instagram_dm",
            "integration_id": intg.id,
            "label": f"@{cfg.get('username', 'Instagram')}",
            "username": cfg.get("username"),
            "display_name": cfg.get("display_name"),
            "profile_pic_url": cfg.get("profile_pic_url"),
            "status": intg.status,
            "conversations": ig_conv_count,
            "messages": ig_msg_count,
        })

    # ── Google (Gmail, Calendar, etc.) — PER COMPANY ──
    try:
        from app.integrations.google_oauth import is_google_connected_for_company
        google_connected = await is_google_connected_for_company(company_id, db)
        channels.append({
            "channel": "google",
            "provider": "google_oauth",
            "label": "Google Workspace",
            "status": "connected" if google_connected else "disconnected",
            "services": ["Gmail", "Contacts", "Calendar", "Sheets"],
        })
    except Exception:
        pass

    return {
        "total_channels": len(channels),
        "channels": channels,
    }


@router.get("/health")
async def connections_health(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Health check for each active integration — scoped to current company."""
    results = []
    company_id = user.company_id

    integrations = await db.execute(
        select(Integration).where(
            Integration.status == "connected",
            Integration.company_id == company_id,
        )
    )

    for intg in integrations.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        health = {
            "integration_id": intg.id,
            "provider": intg.provider,
            "label": cfg.get("label", intg.provider),
            "status": "ok",
            "issues": [],
        }

        if intg.provider == "whatsapp_cloud":
            if not cfg.get("access_token"):
                health["status"] = "error"
                health["issues"].append("Missing access_token")
            if not cfg.get("phone_number_id"):
                health["status"] = "error"
                health["issues"].append("Missing phone_number_id")
            if not cfg.get("flow_id"):
                health["status"] = "warning"
                health["issues"].append("No flow connected")

        elif intg.provider == "zapi":
            if not cfg.get("instance_id"):
                health["status"] = "error"
                health["issues"].append("Missing instance_id")
            if not cfg.get("instance_token"):
                health["status"] = "error"
                health["issues"].append("Missing instance_token")
            if not cfg.get("client_token"):
                health["status"] = "error"
                health["issues"].append("Missing client_token")
            if not cfg.get("flow_id"):
                health["status"] = "warning"
                health["issues"].append("No flow connected")

        elif intg.provider == "smartmoon":
            if not cfg.get("instance_id"):
                health["status"] = "error"
                health["issues"].append("Missing instance_id")
            if not cfg.get("flow_id"):
                health["status"] = "warning"
                health["issues"].append("No flow connected")
            # Check engine reachability
            try:
                from app.services.smartmoon_client import SmartMoonClient
                engine_health = await SmartMoonClient.health()
                if engine_health.get("status") == "unreachable":
                    health["status"] = "error"
                    health["issues"].append("SmartMoon Engine unreachable")
            except Exception:
                health["status"] = "warning"
                health["issues"].append("Could not check engine health")

        elif intg.provider == "telegram":
            if not cfg.get("bot_token"):
                health["status"] = "error"
                health["issues"].append("Missing bot_token")
            if not cfg.get("flow_id"):
                health["status"] = "warning"
                health["issues"].append("No flow connected")

        results.append(health)

    return {"integrations": results}


# ── Z-API Management Endpoints ─────────────────────────

from pydantic import BaseModel
from typing import Optional
from app.services.zapi_client import ZAPIClient


class AddZAPIRequest(BaseModel):
    instance_id: str
    instance_token: str
    client_token: str
    label: Optional[str] = None


@router.get("/zapi/numbers")
async def list_zapi_numbers(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all registered Z-API instances — scoped to current company."""
    result = await db.execute(
        select(Integration).where(
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        ).order_by(Integration.id)
    )
    instances = []
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        conv_count = 0
        msg_count = 0
        try:
            conv_result = await db.execute(
                text("SELECT COUNT(*) FROM whatsapp_conversations WHERE integration_id = :iid"),
                {"iid": intg.id},
            )
            conv_count = conv_result.scalar() or 0
            if conv_count > 0:
                msg_result = await db.execute(
                    text("""SELECT COUNT(*) FROM whatsapp_messages m
                           JOIN whatsapp_conversations c ON c.id = m.conversation_id
                           WHERE c.integration_id = :iid"""),
                    {"iid": intg.id},
                )
                msg_count = msg_result.scalar() or 0
        except Exception:
            pass
        instances.append({
            "id": intg.id,
            "instance_id": cfg.get("instance_id", ""),
            "label": cfg.get("label", "WhatsApp (Z-API)"),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "conversations": conv_count,
            "messages": msg_count,
        })
    return instances


@router.post("/zapi/numbers")
async def add_zapi_number(
    req: AddZAPIRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Register a Z-API WhatsApp instance — scoped to current company."""
    status = await ZAPIClient.get_instance_status(
        req.instance_id, req.instance_token, req.client_token
    )

    is_connected = status.get("connected", False)
    status_code = status.get("statusCode", 0)

    if "error" in status and status_code == 0:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach Z-API: {status['error']}"
        )

    # Check for existing instance in same company
    existing = await db.execute(
        select(Integration).where(
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    for intg in existing.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        if cfg.get("instance_id") == req.instance_id:
            raise HTTPException(
                status_code=409,
                detail=f"Z-API instance {req.instance_id} already registered"
            )

    integration = Integration(
        company_id=user.company_id,  # ✅ usa empresa do usuário autenticado
        provider="zapi",
        status="connected" if is_connected else "disconnected",
        config_json={
            "label": req.label or "WhatsApp (Z-API)",
            "instance_id": req.instance_id,
            "instance_token": req.instance_token,
            "client_token": req.client_token,
            "display_phone": "",
            "flow_id": None,
            "flow_name": None,
        },
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)

    webhook_url = f"/webhook/zapi/{req.instance_id}/receive"
    status_url = f"/webhook/zapi/{req.instance_id}/status"

    return {
        "id": integration.id,
        "message": "✅ Z-API instance registered",
        "instance_id": req.instance_id,
        "connected": is_connected,
        "webhook_url": webhook_url,
        "status_webhook_url": status_url,
        "note": f"Configure these webhook URLs in Z-API panel: Receive → https://YOUR_DOMAIN{webhook_url}, Status → https://YOUR_DOMAIN{status_url}",
    }


@router.get("/zapi/{integration_id}/status")
async def get_zapi_status(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Check the real-time connection status of a Z-API instance."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Z-API instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    status = await ZAPIClient.get_instance_status(
        cfg["instance_id"],
        cfg["instance_token"],
        cfg["client_token"],
    )

    return {
        "integration_id": integration_id,
        "instance_id": cfg["instance_id"],
        **status,
    }


@router.get("/zapi/{integration_id}/qr-code")
async def get_zapi_qr_code(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get QR code image to connect Z-API instance to WhatsApp."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Z-API instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    qr = await ZAPIClient.get_qr_code(
        cfg["instance_id"],
        cfg["instance_token"],
        cfg["client_token"],
    )

    return qr


@router.delete("/zapi/{integration_id}")
async def remove_zapi_instance(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Remove a Z-API integration — only owner company can remove."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)
    try:
        await ZAPIClient.disconnect(
            cfg["instance_id"],
            cfg["instance_token"],
            cfg["client_token"],
        )
    except Exception:
        pass

    await db.delete(intg)
    await db.commit()

    return {"message": "✅ Z-API instance removed"}


@router.patch("/zapi/{integration_id}/connect-flow")
async def connect_zapi_flow(
    integration_id: int,
    flow_id: int = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Connect/disconnect a flow from a Z-API instance."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Z-API instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    flow_name = None
    if flow_id:
        from app.models import Flow
        flow_result = await db.execute(
            select(Flow).where(
                Flow.id == flow_id,
                Flow.company_id == user.company_id,  # ✅ garante que flow é da mesma empresa
            )
        )
        flow = flow_result.scalar_one_or_none()
        if not flow:
            raise HTTPException(status_code=404, detail=f"Flow #{flow_id} not found")
        flow_name = flow.name

    cfg["flow_id"] = flow_id
    cfg["flow_name"] = flow_name
    intg.config_json = cfg

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(intg, "config_json")

    await db.commit()

    return {
        "message": f"✅ Flow {'connected: ' + flow_name if flow_id else 'disconnected'}",
        "flow_id": flow_id,
        "flow_name": flow_name,
    }


@router.get("/zapi/{integration_id}/check-phone/{phone}")
async def check_phone_exists(
    integration_id: int,
    phone: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Check if a phone number has WhatsApp using Z-API."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "zapi",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Z-API instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    phone_clean = "".join(c for c in str(phone) if c.isdigit())
    result = await ZAPIClient.phone_exists(
        cfg["instance_id"],
        cfg["instance_token"],
        cfg["client_token"],
        phone_clean,
    )

    return {"phone": phone_clean, **result}


# ── SmartMoon Engine Management Endpoints ──────────────

from app.services.smartmoon_client import SmartMoonClient


class CreateSmartMoonRequest(BaseModel):
    instance_id: str
    label: Optional[str] = None


@router.get("/smartmoon/instances")
async def list_smartmoon_instances(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all SmartMoon WhatsApp instances — scoped to current company."""
    result = await db.execute(
        select(Integration).where(
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        ).order_by(Integration.id)
    )
    instances = []
    for intg in result.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        conv_count, msg_count = await _count_whatsapp_stats(db, intg.id)
        instances.append({
            "id": intg.id,
            "instance_id": cfg.get("instance_id", ""),
            "label": cfg.get("label", "WhatsApp Direto (SmartMoon)"),
            "display_phone": cfg.get("display_phone", ""),
            "push_name": cfg.get("push_name", ""),
            "status": intg.status,
            "flow_id": cfg.get("flow_id"),
            "flow_name": cfg.get("flow_name"),
            "conversations": conv_count,
            "messages": msg_count,
        })
    return instances


@router.post("/smartmoon/instances")
async def create_smartmoon_instance(
    req: CreateSmartMoonRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new SmartMoon WhatsApp instance and register it in the DB.

    Flow: 1) Create instance in engine → 2) Save to integrations table → 3) Return QR info
    """
    # Check for existing instance
    existing = await db.execute(
        select(Integration).where(
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    for intg in existing.scalars().all():
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        if cfg.get("instance_id") == req.instance_id:
            raise HTTPException(
                status_code=409,
                detail=f"SmartMoon instance {req.instance_id} already registered"
            )

    # Create instance in the SmartMoon Engine
    webhook_url = f"http://nexus_api:8000/webhook/smartmoon/{req.instance_id}/receive"
    status_url = f"http://nexus_api:8000/webhook/smartmoon/{req.instance_id}/status"

    engine_result = await SmartMoonClient.create_instance(
        instance_id=req.instance_id,
        webhook_url=webhook_url,
        status_webhook_url=status_url,
    )

    if "error" in engine_result:
        raise HTTPException(
            status_code=502,
            detail=f"SmartMoon Engine error: {engine_result['error']}"
        )

    # Register in DB
    integration = Integration(
        company_id=user.company_id,
        provider="smartmoon",
        status="pending",
        config_json={
            "label": req.label or "WhatsApp Direto (SmartMoon)",
            "instance_id": req.instance_id,
            "display_phone": "",
            "push_name": "",
            "flow_id": None,
            "flow_name": None,
        },
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)

    return {
        "id": integration.id,
        "message": "✅ SmartMoon instance created",
        "instance_id": req.instance_id,
        "status": "pending",
        "note": "Scan the QR code to connect your WhatsApp",
    }


@router.get("/smartmoon/{integration_id}/status")
async def get_smartmoon_status(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get real-time status of a SmartMoon instance from the engine."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="SmartMoon instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    engine_status = await SmartMoonClient.get_instance_status(cfg["instance_id"])

    return {
        "integration_id": integration_id,
        "instance_id": cfg["instance_id"],
        "db_status": intg.status,
        **engine_status,
    }


@router.get("/smartmoon/{integration_id}/qr")
async def get_smartmoon_qr(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get QR code for SmartMoon instance pairing."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="SmartMoon instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    qr_data = await SmartMoonClient.get_qr_code(cfg["instance_id"])
    return qr_data


@router.post("/smartmoon/{integration_id}/restart")
async def restart_smartmoon_instance(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Restart a SmartMoon instance (reconnect with existing session)."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="SmartMoon instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    engine_result = await SmartMoonClient.restart_instance(cfg["instance_id"])
    return {"message": "Instance restart requested", **engine_result}


@router.delete("/smartmoon/{integration_id}")
async def remove_smartmoon_instance(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Remove a SmartMoon integration and delete the engine instance."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="Not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    # Logout and delete from engine
    try:
        await SmartMoonClient.logout_instance(cfg["instance_id"])
    except Exception:
        pass
    try:
        await SmartMoonClient.delete_instance(cfg["instance_id"])
    except Exception:
        pass

    await db.delete(intg)
    await db.commit()

    return {"message": "✅ SmartMoon instance removed"}


@router.patch("/smartmoon/{integration_id}/connect-flow")
async def connect_smartmoon_flow(
    integration_id: int,
    flow_id: int = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Connect/disconnect a flow from a SmartMoon instance."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.provider == "smartmoon",
            Integration.company_id == user.company_id,
        )
    )
    intg = result.scalar_one_or_none()
    if not intg:
        raise HTTPException(status_code=404, detail="SmartMoon instance not found")

    cfg = intg.config_json or {}
    if isinstance(cfg, str):
        cfg = json.loads(cfg)

    flow_name = None
    if flow_id:
        from app.models import Flow
        flow_result = await db.execute(
            select(Flow).where(
                Flow.id == flow_id,
                Flow.company_id == user.company_id,
            )
        )
        flow = flow_result.scalar_one_or_none()
        if not flow:
            raise HTTPException(status_code=404, detail=f"Flow #{flow_id} not found")
        flow_name = flow.name

    cfg["flow_id"] = flow_id
    cfg["flow_name"] = flow_name
    intg.config_json = cfg

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(intg, "config_json")

    await db.commit()

    return {
        "message": f"✅ Flow {'connected: ' + flow_name if flow_id else 'disconnected'}",
        "flow_id": flow_id,
        "flow_name": flow_name,
    }


# ── Helper ──────────────────────────────────────────────

async def _count_whatsapp_stats(db, integration_id: int) -> tuple[int, int]:
    """Count conversations and messages for a WhatsApp integration."""
    conv_count = await db.scalar(
        select(func.count(WhatsAppConversation.id)).where(
            WhatsAppConversation.integration_id == integration_id
        )
    ) or 0
    msg_count = await db.scalar(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.conversation_id.in_(
                select(WhatsAppConversation.id).where(
                    WhatsAppConversation.integration_id == integration_id
                )
            )
        )
    ) or 0
    return conv_count, msg_count
