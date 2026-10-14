"""
Tests for _resolve_booking_api (Fase 3 — multi-tenant booking API).

Verifies that a company with an ExternalApiBinding gets its OWN base_url + key,
and that a company without a binding falls back to the legacy Duarte defaults
(zero-regression for the original tenant).

Uses in-memory SQLite via aiosqlite, mapping JSONB → JSON for compatibility.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import Base
from app.models.external_api import ExternalApiConfig, ExternalApiBinding  # noqa
from app.engine.handlers import trained_agent_handler as tah


@pytest_asyncio.fixture()
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False,
                              json_deserializer=lambda x: x)
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture()
async def db(engine):
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_resolver_fallback_without_binding(db):
    """Company with no binding must fall back to the legacy Duarte defaults."""
    base, headers = await tah._resolve_booking_api(db, company_id=999)
    assert base == tah._DEFAULT_BOOKING_BASE
    assert headers["X-API-Key"] == tah._DEFAULT_BOOKING_KEY


@pytest.mark.asyncio
async def test_resolver_uses_company_binding(db):
    """Company with a binding must use its OWN base_url + overridden key/header."""
    config = ExternalApiConfig(
        slug=tah.BOOKING_API_SLUG,
        display_name="Clínica X Booking",
        base_url="https://clinicax.com/api/",  # trailing slash should be stripped
        auth_type="header",
        auth_header_name="X-Clinic-Key",
        default_api_key="default-key",
        endpoints_json={},
        is_active=True,
    )
    db.add(config)
    await db.flush()
    db.add(ExternalApiBinding(
        api_config_id=config.id,
        company_id=42,
        api_key_override="clinicax-secret",
        is_active=True,
    ))
    await db.commit()

    base, headers = await tah._resolve_booking_api(db, company_id=42)
    assert base == "https://clinicax.com/api"          # normalized (no trailing slash)
    assert headers == {"X-Clinic-Key": "clinicax-secret", "Content-Type": "application/json"}


@pytest.mark.asyncio
async def test_resolver_uses_default_key_when_no_override(db):
    """When binding has no api_key_override, fall back to config.default_api_key."""
    config = ExternalApiConfig(
        slug=tah.BOOKING_API_SLUG,
        display_name="Clínica Y",
        base_url="https://clinicay.com/api",
        auth_type="header",
        auth_header_name="X-API-Key",
        default_api_key="clinicay-default",
        endpoints_json={},
        is_active=True,
    )
    db.add(config)
    await db.flush()
    db.add(ExternalApiBinding(
        api_config_id=config.id, company_id=77, api_key_override=None, is_active=True,
    ))
    await db.commit()

    base, headers = await tah._resolve_booking_api(db, company_id=77)
    assert headers["X-API-Key"] == "clinicay-default"


@pytest.mark.asyncio
async def test_resolver_inactive_binding_falls_back(db):
    """An inactive binding must be ignored (fallback to defaults)."""
    config = ExternalApiConfig(
        slug=tah.BOOKING_API_SLUG, display_name="Clínica Z",
        base_url="https://clinicaz.com/api", auth_type="header",
        auth_header_name="X-API-Key", default_api_key="z-key",
        endpoints_json={}, is_active=True,
    )
    db.add(config)
    await db.flush()
    db.add(ExternalApiBinding(
        api_config_id=config.id, company_id=88, api_key_override="z-secret", is_active=False,
    ))
    await db.commit()

    base, headers = await tah._resolve_booking_api(db, company_id=88)
    assert base == tah._DEFAULT_BOOKING_BASE
