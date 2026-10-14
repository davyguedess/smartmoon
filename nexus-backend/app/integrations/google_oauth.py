"""
NEXUS.IA — Google OAuth2 Integration (Multi-Tenant)
Handles the full OAuth2 flow for Google APIs (Gmail, Contacts, Calendar, Sheets)
Each company has its OWN OAuth token, stored encrypted in the integrations table.
"""
import json
import os
from pathlib import Path
from typing import Optional
from loguru import logger

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/analytics.readonly",
]

# The credentials JSON file (project config) is still global — it defines the
# Google Cloud project/app. Tokens (per user) are stored in the DB.
CREDENTIALS_PATH = Path("google_credentials.json")


def get_flow(redirect_uri: str) -> Flow:
    """Create OAuth2 flow from credentials file or env vars."""
    if CREDENTIALS_PATH.exists():
        flow = Flow.from_client_secrets_file(
            str(CREDENTIALS_PATH),
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )
    else:
        # Build from env vars
        from app.core.config import settings
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        }
        flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=redirect_uri)
    return flow


# ── Per-Company Token Storage (Database) ──────────────────────────────────────

async def get_credentials_for_company(company_id: int, db) -> Optional[Credentials]:
    """Load and refresh Google credentials from the integrations table for a specific company."""
    from sqlalchemy import select, text
    from app.models import Integration

    try:
        result = await db.execute(
            select(Integration).where(
                Integration.company_id == company_id,
                Integration.provider == "google_oauth",
            )
        )
        intg = result.scalars().first()
        if not intg:
            return None

        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)

        token_data = cfg.get("oauth_token")
        if not token_data:
            return None

        creds = Credentials.from_authorized_user_info(token_data, SCOPES)

        # Auto-refresh if expired
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token back to DB
            await save_credentials_for_company(company_id, creds, db)

        return creds if creds and creds.valid else None

    except Exception as e:
        logger.warning(f"Google credentials error for company {company_id}: {e}")
        return None


async def save_credentials_for_company(company_id: int, creds: Credentials, db):
    """Persist OAuth credentials to the integrations table for a specific company."""
    from sqlalchemy import select
    from sqlalchemy.orm.attributes import flag_modified
    from app.models import Integration

    try:
        # Find existing integration or create new one
        result = await db.execute(
            select(Integration).where(
                Integration.company_id == company_id,
                Integration.provider == "google_oauth",
            )
        )
        intg = result.scalars().first()

        token_data = json.loads(creds.to_json())

        if intg:
            cfg = intg.config_json or {}
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            cfg["oauth_token"] = token_data
            intg.config_json = cfg
            intg.status = "connected"
            flag_modified(intg, "config_json")
        else:
            intg = Integration(
                company_id=company_id,
                provider="google_oauth",
                status="connected",
                config_json={"oauth_token": token_data},
            )
            db.add(intg)

        await db.commit()
        logger.info(f"✅ Google credentials saved for company {company_id}")

    except Exception as e:
        logger.error(f"❌ Failed to save Google credentials for company {company_id}: {e}")
        raise


async def is_google_connected_for_company(company_id: int, db) -> bool:
    """Check if Google is connected for a specific company."""
    creds = await get_credentials_for_company(company_id, db)
    return creds is not None


async def disconnect_google_for_company(company_id: int, db):
    """Disconnect Google for a specific company by removing the token."""
    from sqlalchemy import select
    from sqlalchemy.orm.attributes import flag_modified
    from app.models import Integration

    result = await db.execute(
        select(Integration).where(
            Integration.company_id == company_id,
            Integration.provider == "google_oauth",
        )
    )
    intg = result.scalars().first()
    if intg:
        cfg = intg.config_json or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        cfg.pop("oauth_token", None)
        intg.config_json = cfg
        intg.status = "disconnected"
        flag_modified(intg, "config_json")
        await db.commit()
        logger.info(f"🔌 Google disconnected for company {company_id}")


# ── Per-Company Google Services ──────────────────────────────────────────────

async def get_gmail_service(company_id: int, db):
    from googleapiclient.discovery import build
    creds = await get_credentials_for_company(company_id, db)
    if not creds:
        raise ValueError(f"Google not connected for company {company_id} — complete OAuth first")
    return build("gmail", "v1", credentials=creds)


async def get_people_service(company_id: int, db):
    from googleapiclient.discovery import build
    creds = await get_credentials_for_company(company_id, db)
    if not creds:
        raise ValueError(f"Google not connected for company {company_id}")
    return build("people", "v1", credentials=creds)


async def get_calendar_service(company_id: int, db):
    from googleapiclient.discovery import build
    creds = await get_credentials_for_company(company_id, db)
    if not creds:
        raise ValueError(f"Google not connected for company {company_id}")
    return build("calendar", "v3", credentials=creds)


async def get_sheets_service(company_id: int, db):
    from googleapiclient.discovery import build
    creds = await get_credentials_for_company(company_id, db)
    if not creds:
        raise ValueError(f"Google not connected for company {company_id}")
    return build("sheets", "v4", credentials=creds)


# ── LEGACY: Global file-based functions (kept for backwards compatibility) ────
# These will be removed once all handlers are migrated to per-company

def get_credentials() -> Optional[Credentials]:
    """DEPRECATED: Use get_credentials_for_company instead."""
    TOKEN_PATH = Path("google_token.json")
    if not TOKEN_PATH.exists():
        return None
    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
        return creds if creds and creds.valid else None
    except Exception as e:
        logger.warning(f"Google credentials error (legacy): {e}")
        return None


def save_credentials(creds: Credentials):
    """DEPRECATED: Use save_credentials_for_company instead."""
    TOKEN_PATH = Path("google_token.json")
    TOKEN_PATH.write_text(creds.to_json())
    logger.info("✅ Google credentials saved (legacy file)")


def is_google_connected() -> bool:
    """DEPRECATED: Use is_google_connected_for_company instead."""
    return get_credentials() is not None
