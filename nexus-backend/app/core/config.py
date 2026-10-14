from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Smart Moon"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False  # SEGURANÇA: False por padrão em produção

    # ── CORS ─────────────────────────────────────
    # Adicione origens extras separadas por vírgula no .env:
    # ALLOWED_ORIGINS=https://xxx.ngrok-free.app,https://meudominio.com
    ALLOWED_ORIGINS: str = ""

    # Security
    SECRET_KEY: str = ""  # OBRIGATÓRIO: definir no .env em produção
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15     # Protocol 1: short-lived
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    COOKIE_SECURE: bool = None                # If None, auto-detect; if bool, force value

    # ── Security Hardening ───────────────────────
    ADMIN_PANEL_ENABLED: bool = True          # set False in production
    ALLOW_ENV_PROVIDER_FALLBACK: bool = False # False = production-safe; True only for dev/test
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://nexus:nexus_secret@localhost:5432/nexus_db"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://nexus:nexus_secret@localhost:5432/nexus_db"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"

    # Ollama (local, sem GPU)
    OLLAMA_BASE_URL: str = ""
    OLLAMA_MODEL: str = ""

    # LocalAI (Docker, API OpenAI-compatível, GGUF)
    LOCALAI_BASE_URL: str = "http://nexus_localai:8080/v1"
    LOCALAI_MODEL: str = "llama3.2-3b"

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""

    # WhatsApp (Legacy — Evolution API)
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_KEY: str = ""
    WHATSAPP_INSTANCE: str = ""

    # WhatsApp Cloud API (Meta Official)
    META_WHATSAPP_APP_SECRET: str = ""   # For webhook signature verification
    WHATSAPP_VERIFY_TOKEN: str = "nexus-whatsapp-verify"  # Webhook subscribe token

    # Z-API (Secondary WhatsApp Provider)
    ZAPI_INSTANCE_ID: str = ""
    ZAPI_INSTANCE_TOKEN: str = ""
    ZAPI_CLIENT_TOKEN: str = ""
    ZAPI_WEBHOOK_SECRET: str = ""  # Optional secret for webhook validation

    # SmartMoon WhatsApp Engine (Internal microservice)
    SMARTMOON_ENGINE_URL: str = "http://smartmoon_engine:3100"
    SMARTMOON_ENGINE_KEY: str = ""  # API key shared with Node.js engine
    SMARTMOON_MEDIA_DIR: str = "/data/media"

    # SmartMoon Public API (External clients)
    # Mantenha False em produção até validação completa
    ENABLE_PUBLIC_API: str = "false"

    # Mercado Pago
    MERCADOPAGO_ACCESS_TOKEN: str = ""
    MERCADOPAGO_WEBHOOK_SECRET: str = ""

    # Efi Pay (TASK 4.5)
    EFIPAY_CLIENT_ID: str = ""
    EFIPAY_CLIENT_SECRET: str = ""
    EFIPAY_PIX_KEY: str = ""
    EFIPAY_CERT_PATH: str = ""
    EFIPAY_SANDBOX: bool = False
    EFIPAY_WEBHOOK_SECRET: str = ""

    # Meta Ads
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_ACCESS_TOKEN: str = ""

    # Encryption
    CREDENTIALS_ENCRYPTION_KEY: str = ""

    # ── AI Providers ──────────────────────────────
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    AI_DEFAULT_PROVIDER: str = "groq"   # groq | gemini | ollama | localai
    ELEVENLABS_API_KEY: str = ""
    
    # New AI Providers
    DEEPSEEK_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""
    TOGETHER_API_KEY: str = ""
    XAI_API_KEY: str = ""

    # ── Google Cloud ─────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/google/callback"


    # TTS Configuration
    TTS_PRIMARY_PROVIDER: str = "kokoro"
    TTS_FALLBACK_PROVIDER: str = "piper"
    KOKORO_TTS_URL: str = "http://localhost:8880"
    PIPER_TTS_URL: str = "http://localhost:8881"
    TTS_DEFAULT_FORMAT: str = "wav"
    TTS_STORAGE_MODE: str = "filesystem"
    TTS_STORAGE_PATH: str = "./storage/audio"
    TTS_TIMEOUT_SECONDS: int = 30

    # ── Infrastructure ───────────────────────────
    POSTGRES_PASSWORD: str = ""
    WEBHOOK_BASE_URL: str = ""
    # Public URL used for serving audio files to Z-API (must be reachable from internet)
    PUBLIC_API_URL: str = "http://187.127.14.153"


    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

# Export TTS config variables for easy import
TTS_PRIMARY_PROVIDER = settings.TTS_PRIMARY_PROVIDER
TTS_FALLBACK_PROVIDER = settings.TTS_FALLBACK_PROVIDER
KOKORO_TTS_URL = settings.KOKORO_TTS_URL
PIPER_TTS_URL = settings.PIPER_TTS_URL
TTS_DEFAULT_FORMAT = settings.TTS_DEFAULT_FORMAT
TTS_STORAGE_MODE = settings.TTS_STORAGE_MODE
TTS_STORAGE_PATH = settings.TTS_STORAGE_PATH
TTS_TIMEOUT_SECONDS = settings.TTS_TIMEOUT_SECONDS


