"""
Smart Moon — Google API Routes (Multi-Tenant)
OAuth2 flow + Gmail + Contacts + Calendar + Sheets
All tokens are stored PER-COMPANY in the integrations table.
"""
import json as json_lib
import base64
from fastapi import APIRouter, Request, HTTPException, Query, UploadFile, File, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.google_oauth import (
    get_flow, get_credentials_for_company, save_credentials_for_company,
    is_google_connected_for_company, disconnect_google_for_company,
    get_gmail_service, get_people_service, get_calendar_service,
    CREDENTIALS_PATH
)
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.core.config import settings

router = APIRouter(prefix="/google", tags=["Google"])

# In-memory store: state -> {flow, company_id, user_id}
_flows: dict = {}


# ── OAuth2 ────────────────────────────────────────────────────────────────────

@router.get("/auth")
async def google_auth(request: Request, user=Depends(get_current_user)):
    """Start OAuth2 flow — redirect user to Google consent screen."""
    redirect_uri = str(request.base_url) + "google/callback"
    flow = get_flow(redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    # Store flow + company_id for the callback
    _flows[state] = {"flow": flow, "company_id": user.company_id, "user_id": user.id}
    logger.info(f"🔐 Google OAuth redirect for company {user.company_id}: {auth_url[:80]}...")
    return RedirectResponse(auth_url)


@router.get("/callback")
async def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth2 callback — exchange code for tokens, save PER COMPANY."""
    redirect_uri = str(request.base_url) + "google/callback"
    
    flow_data = _flows.pop(state, None)
    if not flow_data:
        logger.warning("Google callback: flow state not found, cannot determine company")
        base_url = getattr(settings, 'FRONTEND_URL', 'https://smartmoon.online')
        return RedirectResponse(f"{base_url}/integrations?google=error&msg=session_expired")

    flow = flow_data["flow"]
    company_id = flow_data["company_id"]

    try:
        flow.fetch_token(code=code)
    except Exception as e:
        logger.error(f"❌ Google token exchange failed for company {company_id}: {e}")
        base_url = getattr(settings, 'FRONTEND_URL', 'https://smartmoon.online')
        return RedirectResponse(f"{base_url}/integrations?google=error&msg={str(e)[:80]}")

    # Save token to DB (per company — NOT global file)
    await save_credentials_for_company(company_id, flow.credentials, db)
    
    logger.success(f"✅ Google OAuth completed for company {company_id}")
    base_url = getattr(settings, 'FRONTEND_URL', 'https://smartmoon.online')
    return RedirectResponse(f"{base_url}/integrations?google=connected")


@router.get("/status")
async def google_status(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if Google is connected — PER COMPANY."""
    connected = await is_google_connected_for_company(user.company_id, db)
    return {
        "connected": connected,
        "company_id": user.company_id,
        "message": "Google conectado" if connected else "Google não conectado — acesse /google/auth",
    }


@router.post("/disconnect")
async def google_disconnect(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google for current company."""
    await disconnect_google_for_company(user.company_id, db)
    return {"success": True, "message": "Google desconectado para sua empresa"}


@router.get("/credentials-info")
async def google_credentials_info(user=Depends(get_current_user)):
    """Return info about stored credentials file (without exposing secrets)."""
    if not CREDENTIALS_PATH.exists():
        return {"configured": False, "client_id": None, "project_id": None}
    try:
        data = json_lib.loads(CREDENTIALS_PATH.read_text())
        cfg = data.get("web") or data.get("installed") or {}
        return {
            "configured": True,
            "client_id": cfg.get("client_id", "")[:30] + "...",
            "project_id": cfg.get("project_id", ""),
        }
    except Exception:
        return {"configured": False, "client_id": None, "project_id": None}


@router.post("/upload-credentials")
async def upload_google_credentials(file: UploadFile = File(...), user=Depends(get_current_user)):
    """
    Upload google_credentials.json from Google Cloud Console.
    This is the PROJECT config (shared) — not the user's OAuth token.
    OAuth tokens are stored per-company in the database.
    """
    try:
        content = await file.read()
        raw = json_lib.loads(content)

        cfg = raw.get("web") or raw.get("installed")
        if not cfg:
            raise HTTPException(status_code=400, detail="JSON inválido: esperado chave 'web' ou 'installed'")

        # Get frontend URL for redirect
        base_url = getattr(settings, 'FRONTEND_URL', 'https://smartmoon.online')

        normalized = {
            "web": {
                "client_id": cfg["client_id"],
                "project_id": cfg.get("project_id", ""),
                "auth_uri": cfg.get("auth_uri", "https://accounts.google.com/o/oauth2/auth"),
                "token_uri": cfg.get("token_uri", "https://oauth2.googleapis.com/token"),
                "auth_provider_x509_cert_url": cfg.get("auth_provider_x509_cert_url", "https://www.googleapis.com/oauth2/v1/certs"),
                "client_secret": cfg["client_secret"],
                "redirect_uris": [f"{base_url.rstrip('/')}/google/callback"],
            }
        }

        CREDENTIALS_PATH.write_text(json_lib.dumps(normalized, indent=2))
        logger.success(f"✅ Google credentials uploaded by company {user.company_id}: project={cfg.get('project_id')}")

        return {
            "success": True,
            "project_id": cfg.get("project_id"),
            "client_id_preview": cfg["client_id"][:30] + "...",
            "message": "Credenciais salvas. Agora clique em 'Autorizar com Google' para conectar."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar JSON: {e}")


# ── Gmail ─────────────────────────────────────────────────────────────────────

@router.get("/gmail/messages")
async def list_gmail_messages(
    max_results: int = 10,
    query: str = "",
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent Gmail messages — PER COMPANY."""
    try:
        service = await get_gmail_service(user.company_id, db)
        result = service.users().messages().list(
            userId="me", maxResults=max_results, q=query or "in:inbox"
        ).execute()
        messages = result.get("messages", [])

        parsed = []
        for msg_ref in messages[:max_results]:
            msg = service.users().messages().get(
                userId="me", id=msg_ref["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"]
            ).execute()
            headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
            parsed.append({
                "id": msg["id"],
                "thread_id": msg["threadId"],
                "from": headers.get("From", ""),
                "subject": headers.get("Subject", ""),
                "date": headers.get("Date", ""),
                "snippet": msg.get("snippet", ""),
                "labels": msg.get("labelIds", []),
            })
        return {"messages": parsed, "total": len(parsed)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gmail error: {e}")


@router.get("/gmail/message/{msg_id}")
async def get_gmail_message(
    msg_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full email body — PER COMPANY."""
    try:
        service = await get_gmail_service(user.company_id, db)
        msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}

        body = ""
        parts = msg["payload"].get("parts", [])
        if parts:
            for part in parts:
                if part["mimeType"] == "text/plain":
                    data = part["body"].get("data", "")
                    body = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
                    break
        else:
            data = msg["payload"]["body"].get("data", "")
            if data:
                body = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

        return {
            "id": msg_id,
            "from": headers.get("From", ""),
            "to": headers.get("To", ""),
            "subject": headers.get("Subject", ""),
            "date": headers.get("Date", ""),
            "body": body,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gmail read error: {e}")


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    reply_to_thread: Optional[str] = None


@router.post("/gmail/send")
async def send_gmail(
    req: SendEmailRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an email using Gmail API — PER COMPANY."""
    try:
        service = await get_gmail_service(user.company_id, db)
        import email.mime.text as mime_text
        import email.mime.multipart as mime_multi

        message = mime_multi.MIMEMultipart()
        message["to"] = req.to
        message["subject"] = req.subject
        message.attach(mime_text.MIMEText(req.body, "plain", "utf-8"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        body = {"raw": raw}
        if req.reply_to_thread:
            body["threadId"] = req.reply_to_thread

        sent = service.users().messages().send(userId="me", body=body).execute()
        logger.success(f"📧 Email sent to {req.to} by company {user.company_id} — id: {sent.get('id')}")
        return {"success": True, "message_id": sent.get("id"), "to": req.to}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gmail send error: {e}")


# ── Google Contacts ───────────────────────────────────────────────────────────

@router.get("/contacts")
async def list_contacts(
    max_results: int = 100,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import all Google Contacts — PER COMPANY."""
    try:
        service = await get_people_service(user.company_id, db)
        result = service.people().connections().list(
            resourceName="people/me",
            pageSize=max_results,
            personFields="names,emailAddresses,phoneNumbers",
        ).execute()

        contacts = []
        for person in result.get("connections", []):
            names = person.get("names", [{}])
            emails = person.get("emailAddresses", [])
            phones = person.get("phoneNumbers", [])
            contacts.append({
                "resource_name": person.get("resourceName"),
                "name": names[0].get("displayName") if names else "Sem nome",
                "emails": [e.get("value") for e in emails],
                "phones": [p.get("value") for p in phones],
                "has_phone": len(phones) > 0,
            })

        logger.info(f"📒 Company {user.company_id} imported {len(contacts)} Google Contacts")
        return {"contacts": contacts, "total": len(contacts)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Contacts error: {e}")


@router.post("/contacts/check-whatsapp")
async def check_whatsapp_bulk(phones: List[str], user=Depends(get_current_user)):
    """Check which phone numbers have WhatsApp."""
    from app.core.config import settings
    import httpx

    if not settings.WHATSAPP_API_URL:
        return {
            "has_whatsapp": [{"phone": p, "whatsapp": True} for p in phones[:len(phones)//2]],
            "no_whatsapp": [{"phone": p, "whatsapp": False} for p in phones[len(phones)//2:]],
            "note": "Modo simulação — configure WhatsApp API URL",
        }

    results = {"has_whatsapp": [], "no_whatsapp": []}
    async with httpx.AsyncClient(timeout=30) as client:
        for phone in phones:
            try:
                resp = await client.get(
                    f"{settings.WHATSAPP_API_URL}/chat/whatsappNumbers/{settings.WHATSAPP_INSTANCE}",
                    headers={"apikey": settings.WHATSAPP_API_KEY},
                    params={"numbers": [phone]},
                )
                data = resp.json()
                if isinstance(data, list) and data and data[0].get("exists"):
                    results["has_whatsapp"].append({"phone": phone, "jid": data[0].get("jid")})
                else:
                    results["no_whatsapp"].append({"phone": phone})
            except Exception as e:
                results["no_whatsapp"].append({"phone": phone, "error": str(e)})

    return results


# ── Google Calendar ───────────────────────────────────────────────────────────

class CreateEventRequest(BaseModel):
    summary: str
    description: str = ""
    start_datetime: str
    end_datetime: str
    attendees: List[str] = []


@router.get("/calendar/events")
async def list_calendar_events(
    max_results: int = 10,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List upcoming calendar events — PER COMPANY."""
    try:
        from datetime import datetime, timezone
        service = await get_calendar_service(user.company_id, db)
        now = datetime.now(timezone.utc).isoformat()
        events_result = service.events().list(
            calendarId="primary", timeMin=now,
            maxResults=max_results, singleEvents=True,
            orderBy="startTime"
        ).execute()
        events = events_result.get("items", [])
        return {"events": [{
            "id": e["id"],
            "summary": e.get("summary"),
            "start": e["start"].get("dateTime"),
            "end": e["end"].get("dateTime"),
        } for e in events]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Calendar error: {e}")


@router.post("/calendar/events")
async def create_calendar_event(
    req: CreateEventRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a calendar event — PER COMPANY."""
    try:
        service = await get_calendar_service(user.company_id, db)
        event_body = {
            "summary": req.summary,
            "description": req.description,
            "start": {"dateTime": req.start_datetime, "timeZone": "America/Sao_Paulo"},
            "end": {"dateTime": req.end_datetime, "timeZone": "America/Sao_Paulo"},
            "attendees": [{"email": e} for e in req.attendees],
        }
        event = service.events().insert(calendarId="primary", body=event_body).execute()
        logger.success(f"📅 Calendar event created by company {user.company_id}: {req.summary}")
        return {"success": True, "event_id": event["id"], "link": event.get("htmlLink")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Calendar create error: {e}")
