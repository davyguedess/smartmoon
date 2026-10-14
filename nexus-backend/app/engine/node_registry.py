"""
Node Registry — maps node type string → handler class.
Full registry including Google and AI provider nodes.
"""
from app.engine.handlers.base import BaseNodeHandler

# Local AI
from app.engine.handlers.classifier_handler import ClassifierHandler
from app.engine.handlers.ai_chat_handler import AIChatHandler
from app.engine.handlers.trained_agent_handler import TrainedAgentHandler
from app.engine.handlers.luna_handler import LunaHandler


# Actions
from app.engine.handlers.create_pix_handler import CreatePixHandler
from app.engine.handlers.send_whatsapp_handler import SendWhatsAppHandler
from app.engine.handlers.send_telegram_handler import SendTelegramHandler
from app.engine.handlers.send_telegram_voice_handler import SendTelegramVoiceHandler
from app.engine.handlers.send_email_handler import SendEmailHandler

# Image Generation
from app.engine.handlers.generate_image_handler import GenerateImageHandler

from app.engine.handlers.check_whatsapp_handler import CheckWhatsAppHandler

# External APIs
from app.engine.handlers.external_api_handler import ExternalApiHandler

# Wait
from app.engine.handlers.wait_event_handler import WaitEventHandler

# AI Providers
from app.engine.handlers.openai_handler import OpenAIHandler
from app.engine.handlers.gemini_handler import GeminiHandler
from app.engine.handlers.claude_handler import ClaudeHandler
from app.engine.handlers.elevenlabs_handler import ElevenLabsHandler
from app.engine.handlers.whisper_handler import WhisperHandler
from app.engine.handlers.groq_handler import GroqHandler

node_registry: dict[str, type[BaseNodeHandler]] = {
    # ── Trigger nodes (pass-through) ─────────────────
    "trigger": BaseNodeHandler,
    "gmail_inbox": BaseNodeHandler,
    "whatsapp_trigger": BaseNodeHandler,
    "zapi_trigger": BaseNodeHandler,        # Z-API webhook trigger
    "smartmoon_trigger": BaseNodeHandler,   # SmartMoon webhook trigger
    "telegram_trigger": BaseNodeHandler,
    "webhook_trigger": BaseNodeHandler,
    "schedule": BaseNodeHandler,

    # ── Local AI (Ollama) ────────────────────────────
    "ai": AIChatHandler,
    "ai_chat": AIChatHandler,
    "classifier": ClassifierHandler,
    "ollama": AIChatHandler,
    "router": ClassifierHandler,

    # ── Trained Agents ───────────────────────────────
    "trained_agent": TrainedAgentHandler,
    "trained_agent_node": TrainedAgentHandler,
    "agent": TrainedAgentHandler,


    # ── Cloud AI Providers ───────────────────────────
    "openai": OpenAIHandler,
    "gpt4": OpenAIHandler,
    "gpt": OpenAIHandler,
    "gemini": GeminiHandler,
    "google_ai": GeminiHandler,
    "claude": ClaudeHandler,
    "anthropic": ClaudeHandler,
    "groq": GroqHandler,
    "llama_groq": GroqHandler,

    # ── Voice ────────────────────────────────────────
    "elevenlabs": ElevenLabsHandler,
    "tts": ElevenLabsHandler,
    "text_to_speech": ElevenLabsHandler,
    "whisper": WhisperHandler,
    "stt": WhisperHandler,
    "transcribe": WhisperHandler,

    # ── Messaging Actions ────────────────────────────
    "send_whatsapp": SendWhatsAppHandler,
    "whatsapp_send": SendWhatsAppHandler,
    "zapi_send": SendWhatsAppHandler,       # Z-API explicit node
    "smartmoon_send": SendWhatsAppHandler,   # SmartMoon explicit node
    "send_zapi": SendWhatsAppHandler,       # Z-API alias
    "send_telegram": SendTelegramHandler,
    "telegram": SendTelegramHandler,
    "send_telegram_voice": SendTelegramVoiceHandler,
    "telegram_voice": SendTelegramVoiceHandler,
    "telegram_audio": SendTelegramVoiceHandler,

    "send_email": SendEmailHandler,
    "gmail_send": SendEmailHandler,
    "email": SendEmailHandler,

    # ── Google Actions ───────────────────────────────
    "google_contacts": BaseNodeHandler,   # Triggers contact fetch (handled by Google routes)
    "create_event": BaseNodeHandler,
    "update_sheet": BaseNodeHandler,

    # ── Payment ──────────────────────────────────────
    "create_pix": CreatePixHandler,
    "mercadopago": CreatePixHandler,
    "pix": CreatePixHandler,

    # ── Flow Control ─────────────────────────────────
    "check_whatsapp": CheckWhatsAppHandler,
    "filter_contacts": CheckWhatsAppHandler,
    "multi_channel": CheckWhatsAppHandler,
    "logic": BaseNodeHandler,
    "condition": BaseNodeHandler,
    "action": BaseNodeHandler,

    # ── Wait ─────────────────────────────────────────
    "wait": WaitEventHandler,
    "wait_event": WaitEventHandler,
    "wait_webhook": WaitEventHandler,
    "wait_payment": WaitEventHandler,

    # ── Image Generation (FAL.ai / Flux) ─────────────
    "generate_image": GenerateImageHandler,
    "image_gen":      GenerateImageHandler,
    "fal_image":      GenerateImageHandler,
    "flux":           GenerateImageHandler,
    "ai_image":       GenerateImageHandler,

    # ── Luna IA ──────────────────────────────────────
    "luna":           LunaHandler,
    "luna_voice":     LunaHandler,

    # ── External APIs (APIs exclusivas por conta) ────
    "external_api":      ExternalApiHandler,
    "duarte_booking":    ExternalApiHandler,
    "api_externa":       ExternalApiHandler,
}
