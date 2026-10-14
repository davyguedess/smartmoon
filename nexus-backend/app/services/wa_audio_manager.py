"""
WhatsApp Audio Manager — Smart Moon
=====================================
Gerencia o modo "resposta em áudio" por conversa via Redis.
Detecta pedidos de áudio/"pare o áudio" nas mensagens do usuário.
"""

import re
from typing import Optional

# ── Palavras-chave para ATIVAR modo áudio ────────────────────────────────────
_AUDIO_ON_PATTERNS = [
    r"\b(manda|envia|fala|responde?|me d[aá]|quero|pode)\b.{0,30}\b(áudio|audio|voz|falado|oral)\b",
    r"\b(áudio|audio|voz)\b.{0,20}\b(por favor|pf|pfv|please|agora|sim)\b",
    r"\b(ativa|ative|liga|ligue)\b.{0,20}\b(áudio|audio|voz|modo)\b",
    r"^(áudio|audio|voz|fala)[\s!.?]*$",
]

# ── Palavras-chave para DESATIVAR modo áudio ─────────────────────────────────
_AUDIO_OFF_PATTERNS = [
    r"\b(para|para de|desliga|desative|cancela|chega de|sem|não quero|nao quero|stop)\b.{0,25}\b(áudio|audio|voz)\b",
    r"\b(só texto|so texto|apenas texto|texto|escrito)\b",
    r"\b(pare|chega|basta|stop)\b.{0,10}\b(audio|áudio|voz|falar)\b",
    r"^(para|chega|stop|texto)[\s!.?]*$",
]

# ── Redis key helpers ────────────────────────────────────────────────────────
_PREFIX = "wa_audio_mode:"


def _redis_key(conversation_id: str) -> str:
    return f"{_PREFIX}{conversation_id}"


def detect_audio_request(message: str) -> Optional[bool]:
    """
    Returns:
        True  → user wants audio ON
        False → user wants audio OFF
        None  → no audio intent detected
    """
    msg = message.lower().strip()

    for pat in _AUDIO_OFF_PATTERNS:
        if re.search(pat, msg, re.IGNORECASE):
            return False

    for pat in _AUDIO_ON_PATTERNS:
        if re.search(pat, msg, re.IGNORECASE):
            return True

    return None


async def set_audio_mode(redis_client, conversation_id: str, enabled: bool, ttl: int = 3600) -> None:
    """Persist audio mode state in Redis (TTL default 1 hour)."""
    key = _redis_key(conversation_id)
    await redis_client.set(key, "1" if enabled else "0", ex=ttl)


async def get_audio_mode(redis_client, conversation_id: str) -> bool:
    """Returns True if audio mode is currently enabled for this conversation."""
    key = _redis_key(conversation_id)
    val = await redis_client.get(key)
    return val == b"1" or val == "1"
