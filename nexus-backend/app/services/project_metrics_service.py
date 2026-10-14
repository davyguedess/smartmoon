"""
Smart Project Manager — Metrics Service
Pulls real metrics from Meta Ads (Graph API) and Google Ads
for projects that have marketing/traffic integrations configured.

Returns empty/null when no integration is configured — no fake data.
"""
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

META_GRAPH_URL = "https://graph.facebook.com/v21.0"


async def _get_integration_config(db: AsyncSession, company_id: int, provider: str) -> Optional[dict]:
    """Load integration config_json for a given provider."""
    try:
        result = await db.execute(
            text("""
                SELECT config_json FROM integrations
                WHERE company_id = :cid AND provider = :provider AND status = 'connected'
                ORDER BY id DESC LIMIT 1
            """),
            {"cid": company_id, "provider": provider}
        )
        row = result.fetchone()
        if row and row[0]:
            import json
            return row[0] if isinstance(row[0], dict) else json.loads(row[0])
    except Exception as e:
        logger.error(f"Failed to load {provider} config for company {company_id}: {e}")
    return None


def _empty_metrics() -> dict:
    """Return zeroed metrics structure."""
    return {
        "reach": 0, "impressions": 0, "clicks": 0,
        "cpc": 0, "cpm": 0, "spend": 0, "leads": 0,
    }


async def get_meta_ads_metrics(
    db: AsyncSession,
    company_id: int,
    date_range: str = "last_7d",
) -> dict:
    """
    Pull real Meta Ads metrics from Graph API.
    Requires an integration with provider='meta_ads' or 'instagram'
    that has an access_token and ad_account_id.
    Returns not_configured=True when no integration exists.
    """
    config = await _get_integration_config(db, company_id, "meta_ads")
    if not config:
        config = await _get_integration_config(db, company_id, "instagram")

    if not config:
        return {"success": False, "not_configured": True, "error": "Nenhuma integração Meta Ads configurada."}

    access_token = config.get("access_token") or config.get("token")
    ad_account_id = config.get("ad_account_id")

    if not access_token:
        return {"success": False, "not_configured": True, "error": "Access token não encontrado."}

    if not ad_account_id:
        return {"success": False, "not_configured": True, "error": "ad_account_id não configurado."}

    # Map date range
    date_presets = {
        "today": "today",
        "yesterday": "yesterday",
        "last_7d": "last_7d",
        "last_14d": "last_14d",
        "last_30d": "last_30d",
        "this_month": "this_month",
        "last_month": "last_month",
    }
    preset = date_presets.get(date_range, "last_7d")

    try:
        url = f"{META_GRAPH_URL}/act_{ad_account_id}/insights"
        params = {
            "access_token": access_token,
            "date_preset": preset,
            "fields": "reach,impressions,clicks,cpc,cpm,spend,actions,cost_per_action_type",
            "level": "account",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)

        if resp.status_code != 200:
            err = resp.json().get("error", {}).get("message", resp.text[:200])
            logger.error(f"Meta Ads API error: {err}")
            return {"success": False, "error": err}

        data = resp.json()
        insights = data.get("data", [])

        if not insights:
            return {"success": True, "platform": "Meta Ads", "period": preset, "metrics": _empty_metrics()}

        row = insights[0]

        # Extract leads from actions
        leads = 0
        for action in row.get("actions", []):
            if action.get("action_type") == "lead":
                leads = int(action.get("value", 0))

        return {
            "success": True,
            "platform": "Meta Ads",
            "period": preset,
            "metrics": {
                "reach": int(row.get("reach", 0)),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "cpc": float(row.get("cpc", 0)),
                "cpm": float(row.get("cpm", 0)),
                "spend": float(row.get("spend", 0)),
                "leads": leads,
            }
        }

    except Exception as e:
        logger.error(f"Meta Ads fetch failed: {e}")
        return {"success": False, "error": str(e)}


async def get_google_ads_metrics(
    db: AsyncSession,
    company_id: int,
    date_range: str = "last_7d",
) -> dict:
    """
    Pull Google Ads metrics.
    Requires integration with provider='google_ads'.
    Returns not_configured=True when no integration exists.
    """
    config = await _get_integration_config(db, company_id, "google_ads")

    if not config:
        return {"success": False, "not_configured": True, "error": "Nenhuma integração Google Ads configurada."}

    customer_id = config.get("customer_id")
    refresh_token = config.get("refresh_token")

    if not customer_id or not refresh_token:
        return {"success": False, "not_configured": True, "error": "Credenciais Google Ads incompletas."}

    # TODO: Implement Google Ads API v16 call via google-ads Python client
    logger.info(f"Google Ads metrics requested for company {company_id} — API not yet implemented")

    return {
        "success": False,
        "not_configured": True,
        "error": "Integração Google Ads pendente de implementação.",
    }


async def get_combined_metrics(
    db: AsyncSession,
    company_id: int,
    date_range: str = "last_7d",
) -> dict:
    """Get metrics from all configured platforms. Only includes platforms with real data."""
    meta = await get_meta_ads_metrics(db, company_id, date_range)
    google = await get_google_ads_metrics(db, company_id, date_range)

    # Only count platforms that have real data
    has_meta = meta.get("success") and not meta.get("not_configured")
    has_google = google.get("success") and not google.get("not_configured")

    if not has_meta and not has_google:
        return {
            "success": False,
            "not_configured": True,
            "error": "Nenhuma integração de tráfego pago configurada.",
        }

    meta_metrics = meta.get("metrics", {}) if has_meta else {}
    google_metrics = google.get("metrics", {}) if has_google else {}

    total_spend = (meta_metrics.get("spend", 0) or 0) + (google_metrics.get("spend", 0) or 0)
    total_clicks = (meta_metrics.get("clicks", 0) or 0) + (google_metrics.get("clicks", 0) or 0)
    total_impressions = (meta_metrics.get("impressions", 0) or 0) + (google_metrics.get("impressions", 0) or 0)
    total_leads = (meta_metrics.get("leads", 0) or 0) + (google_metrics.get("conversions", 0) or 0)

    platforms = {}
    if has_meta:
        platforms["meta_ads"] = meta
    if has_google:
        platforms["google_ads"] = google

    return {
        "success": True,
        "platform": "Combined",
        "period": date_range,
        "platforms": platforms,
        "totals": {
            "total_spend": round(total_spend, 2),
            "total_clicks": total_clicks,
            "total_impressions": total_impressions,
            "total_leads": total_leads,
            "avg_cpc": round(total_spend / total_clicks, 2) if total_clicks > 0 else 0,
            "project_health": _calc_health(total_leads, total_spend),
        }
    }


def _calc_health(leads: int, spend: float) -> str:
    """Simple health indicator based on cost per lead."""
    if leads == 0:
        return "No Data" if spend == 0 else "Low"
    cpl = spend / leads
    if cpl < 20:
        return "Excellent"
    elif cpl < 50:
        return "Good"
    elif cpl < 100:
        return "Average"
    else:
        return "Low"
