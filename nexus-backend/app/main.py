"""
NEXUS.IA — FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger


from app.core.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import NexusException, nexus_exception_handler, generic_exception_handler
from app.core.middleware import CorrelationIdMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.middleware.quota import QuotaMiddleware
# ── Routes — organized by domain ─────────────────────────
from app.api.routes.admin import router as admin_router, gateway_router as admin_gateway_router, luna_admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.auth.twofa import router as twofa_router
from app.api.routes.chat import router as chat_router

from app.api.routes.agents import agent_router, agent_status_router, knowledge_router, duarte_sync_router

from app.api.routes.voice import voice_router
from app.api.routes.luna import router as luna_router

from app.api.routes.marketing import campaign_router, brand_kit_router, studio_templates_router
from app.api.routes.marketing.studio_projects import router as studio_projects_router
from app.api.routes.marketing.studio_uploads import router as studio_uploads_router
from app.api.routes.admin.marketing_admin import router as admin_marketing_router

from app.api.routes.integrations import (
    whatsapp_router,
    telegram_router,
    zapi_webhook_router,
    smartmoon_webhook_router,
    connections_router,
    google_router,
    instagram_router,
    instagram_webhook_router,
)

from app.api.routes.flows import flows_router, executions_router, ws_executions_router

from app.api.routes.bids import bids_router
from app.api.routes.store import router as store_router
from app.api.routes.store.ai_tokens import router as ai_token_store_router
from app.api.routes.admin.ai_tokens_admin import router as admin_ai_tokens_router

from app.api.routes.core import (
    health_router,
    settings_router,
    metrics_router,
    analytics_router,
    billing_router,
    webhooks_router,
)
from app.db.session import engine, Base
import app.models.licitacao  # noqa: F401 — expõe tabelas ao Base.metadata
import app.payments.models  # noqa: F401 — payment gateway tables
import app.models.marketing  # noqa: F401 — marketing pro tables
import app.models.external_api  # noqa: F401 — external API configs


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting...")

    # Sem segredo forte qualquer um forja um JWT de superadmin — recusa subir.
    weak = {"", "change-me", "changeme", "secret", "change-me-to-a-very-long-random-secret-key-in-production"}
    if settings.SECRET_KEY.strip().lower() in weak or len(settings.SECRET_KEY) < 32 or settings.SECRET_KEY.lower().startswith("change"):
        raise RuntimeError("SECRET_KEY ausente ou fraca — gere com `openssl rand -hex 32` e defina no .env")
    if not settings.CREDENTIALS_ENCRYPTION_KEY or settings.CREDENTIALS_ENCRYPTION_KEY.lower().startswith("change"):
        logger.error("❌ CREDENTIALS_ENCRYPTION_KEY ausente/placeholder — credenciais de clientes ficam sem cifra real. Gere com `openssl rand -hex 32`.")

    # Auto-create tables in dev mode (requires Postgres to be running)
    if settings.DEBUG:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Database tables verified")
        except Exception as e:
            logger.warning(f"⚠️  DB not available yet (start Postgres): {e}")

    # Registrar payment tools para agentes de IA
    try:
        from app.payments.tools import register_payment_tools
        await register_payment_tools()
        
        # Registrar tools do Project Manager
        import app.services.project_tools
        
        # Registrar tools do Agente Financeiro
        import app.services.financial_tools
    except Exception as e:
        logger.warning(f"⚠️ Tools não registradas: {e}")

    yield

    logger.info("🛑 NEXUS.IA shutting down")


# ── Security: docs/swagger desabilitados em produção ─────
app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description="Plataforma de orquestração de agentes de IA — Motor operacional da Smart Moon",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)



# ── CORS ──────────────────────────────────────────
# NOTE: allow_credentials=True is incompatible with allow_origins=["*"].
# Adicione origens extras no .env: ALLOWED_ORIGINS=https://xxx.ngrok-free.app
# Em produção, apenas origens explícitas no .env são permitidas.
_default_origins = [
    "http://localhost:5173",   # Vite dev
    "http://localhost:3000",   # Alt dev
    "http://localhost:5174",   # Vite alt port
] if settings.DEBUG else []
_extra_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
_allowed_origins = list(dict.fromkeys(_default_origins + _extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,        # Required for HttpOnly cookies
    # TASK 3.7: Headers e métodos explícitos (não wildcard)
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type", "Authorization", "X-Reauth-Password",
        "X-API-Key", "X-2FA-Code", "X-Request-ID",
        "X-Requested-With", "Accept", "Origin", "X-Sync-Secret",
    ],
    expose_headers=["Set-Cookie", "X-Request-ID"],
)

# ── Exception handlers ───────────────────────────
app.add_exception_handler(NexusException, nexus_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ── Middleware (order matters: last added = first executed) ──
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(QuotaMiddleware)
app.add_middleware(SecurityHeadersMiddleware)  # TASK 7.2: OWASP security headers

# ── Routers ──────────────────────────────────────
# ── Routers — core ───────────────────────────────────────
app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(analytics_router)
app.include_router(webhooks_router)
app.include_router(settings_router)
app.include_router(billing_router)

# ── Routers — auth ────────────────────────────────────────
app.include_router(auth_router)
app.include_router(twofa_router)  # TASK 7.1: 2FA TOTP routes

# ── Routers — agents ─────────────────────────────────────
app.include_router(agent_router)
app.include_router(agent_status_router)
app.include_router(knowledge_router)
app.include_router(duarte_sync_router)  # Sync preços Duarte ↔ AgentProfile
# ollama_router REMOVIDO — serviço Ollama desinstalado (segurança)

# ── Routers — flows ───────────────────────────────────────
app.include_router(flows_router)
app.include_router(executions_router)
app.include_router(ws_executions_router)

# ── Routers — projects ────────────────────────────────────
from app.api.routes.projects.projects import router as projects_router
from app.api.routes.projects.public import router as public_project_router
from app.api.routes.admin.projects_admin import router as admin_projects_router
app.include_router(projects_router)
app.include_router(public_project_router)
app.include_router(admin_projects_router)

# ── Routers — financial ──────────────────────────────────
from app.api.routes.financial.financial import router as financial_router
app.include_router(financial_router)

# ── Routers — voice ───────────────────────────────────────
app.include_router(voice_router)
app.include_router(luna_router)
# tts_router (tts_test.py) REMOVIDO — endpoint de teste sem auth (segurança)

# ── Routers — marketing ───────────────────────────────────
app.include_router(campaign_router)
app.include_router(brand_kit_router)
app.include_router(studio_templates_router)
app.include_router(studio_projects_router)   # ← Sprint A3.3: salvar projetos do usuário
app.include_router(studio_uploads_router)    # ← Sprint A3.5: upload de assets
app.include_router(admin_marketing_router)

# ── Routers — integrations ────────────────────────────────
app.include_router(whatsapp_router)
app.include_router(telegram_router)
app.include_router(zapi_webhook_router)
app.include_router(smartmoon_webhook_router)
app.include_router(connections_router)
app.include_router(google_router)
app.include_router(instagram_router)
app.include_router(instagram_webhook_router)

# ── Routers — payments (Gateway) ─────────────────────────
from app.api.routes.payments.charges import router as charges_router
from app.api.routes.payments.wallet import router as wallet_router, admin_router as admin_wallet_router
app.include_router(charges_router)
app.include_router(wallet_router)
app.include_router(admin_wallet_router)

# ── Routers — Open Gateway API (TASK 5.5) ────────────────
from app.payments.gateway.routes import router as gateway_public_router
from app.payments.gateway.admin_routes import router as gateway_admin_router
import app.payments.gateway as _gw_models  # noqa: F401 — expõe GatewayApiKey ao ORM
app.include_router(gateway_public_router)
app.include_router(gateway_admin_router)

# ── Routers — Financial Reports (TASK 8.3) ────────────────
from app.payments.reports import router as reports_router
app.include_router(reports_router)

# ── Security events model (TASK 8.2) ─────────────────────
import app.core.security_events as _se_models  # noqa: F401 — expõe SecurityEvent ao ORM

# ── Routers — bids ────────────────────────────────────────
app.include_router(bids_router)

# ── Routers — CRM WhatsApp ────────────────────────────────
from app.api.routes.crm import crm_router
app.include_router(crm_router)

# ── Routers — store (Skills & Agents + IA Token marketplace) ────
app.include_router(store_router)
app.include_router(ai_token_store_router)

# ── Routers — chat / admin ────────────────────────────────
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(admin_gateway_router)
app.include_router(admin_ai_tokens_router)
app.include_router(luna_admin_router)   # Luna Admin — Knowledge & Tours

# ── Routers — SmartMoon API Pública (admin) ───────────────
from app.api.routes.admin.smartmoon_api_admin import router as smartmoon_api_admin_router
app.include_router(smartmoon_api_admin_router)

# ── Routers — External APIs Admin ────────────────────────
from app.api.routes.admin.external_apis_admin import router as external_apis_admin_router
app.include_router(external_apis_admin_router)

# ── Routers — Solicitação de API Key (usuário) ───────────
from app.api.routes.public.api_key_requests import router as api_key_requests_router
app.include_router(api_key_requests_router)

# ── Routers — billing: token packs (cliente) ─────────────
from app.api.routes.billing.token_packs import router as token_packs_router
app.include_router(token_packs_router)

# ── Routers — billing: SM credit packs (cliente) ─────────
from app.api.routes.billing.credit_packs import router as credit_packs_router
app.include_router(credit_packs_router)

# ── Routers — SmartMoon Public API ───────────────────────
# Sempre ativa — controle de acesso via API Keys por empresa
from app.api.routes.public.whatsapp_api import router as public_wa_router
app.include_router(public_wa_router)
logger.info("✅ SmartMoon Public API habilitada (/v1/whatsapp)")

from app.api.routes.public.crm_api import router as public_crm_router
app.include_router(public_crm_router)
logger.info("✅ SmartMoon CRM Public API habilitada (/v1/crm)")



# ── Serve generated TTS audio files publicly for Z-API download ────────────
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_audio_storage = Path(settings.TTS_STORAGE_PATH if hasattr(settings, 'TTS_STORAGE_PATH') else "./storage/audio")
_audio_storage.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(_audio_storage)), name="audio")

# Serve brand kit logos publicly
_brand_storage = Path("./uploads/brand")
_brand_storage.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/brand", StaticFiles(directory=str(_brand_storage)), name="brand")

# Serve studio uploads publicly (imagens enviadas pelos usuários para o Studio)
_studio_storage = Path("./uploads/studio")
_studio_storage.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/studio", StaticFiles(directory=str(_studio_storage)), name="studio")

# Serve invoice PDFs publicly (generated by Duarte API tool)
_invoice_storage = Path("./storage/invoices")
_invoice_storage.mkdir(parents=True, exist_ok=True)
app.mount("/storage/invoices", StaticFiles(directory=str(_invoice_storage)), name="invoices")



@app.get("/", tags=["Root"])
async def root():
    return {
        "status": "online",
    }

