"""Send voice message to Telegram using the NEXUS Kokoro TTS engine (same quality as chat)."""
import io
import json
import httpx
from loguru import logger
from sqlalchemy import select, update
from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings
from app.models import Integration, TelegramMessage, TelegramConversation
from datetime import datetime, timezone


class SendTelegramVoiceHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        db = self.context.get("_db")
        company_id = self.context.get("company_id")
        chat_id = self.config.get("chat_id") or input_payload.get("chat_id")

        # 1. Resolve bot token
        bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
        voice_config = {}
        if db and company_id:
            try:
                result = await db.execute(
                    select(Integration).where(
                        Integration.company_id == company_id,
                        Integration.provider == "telegram",
                        Integration.status == "connected",
                    ).order_by(Integration.id.desc()).limit(1)
                )
                integration = result.scalars().first()
                if integration and integration.config_json:
                    cfg = (
                        integration.config_json
                        if isinstance(integration.config_json, dict)
                        else json.loads(integration.config_json)
                    )
                    bot_token = cfg.get("bot_token") or bot_token
                    # Voice config saved in integration config
                    voice_config = cfg.get("voice", {})
            except Exception as e:
                logger.error(f"Failed to load Telegram token: {e}")

        # 2. Get AI response text to speak
        text = (
            self.context.get("ai_response")
            or input_payload.get("ai_response")
            or self.config.get("message")
        )

        if not text or not bot_token or not chat_id:
            logger.warning(
                f"Voice handler missing config (text={bool(text)}, "
                f"token={bool(bot_token)}, chat_id={chat_id})"
            )
            return {"telegram_voice_status": "error", "reason": "config_missing"}

        # 3. Generate audio using Kokoro TTS (same engine as the chat system)
        audio_bytes = None
        audio_format = "wav"
        
        try:
            from app.services.tts_service import tts_service
            from pathlib import Path

            # Voice settings: from config node → integration config → defaults
            voice_id = (
                self.config.get("voice_id")
                or voice_config.get("voice_id")
                or "pf_dora"  # Default: Portuguese female voice
            )
            audio_format = (
                self.config.get("format")
                or voice_config.get("format")
                or "wav"
            )

            logger.info(f"🎙️ Generating TTS with Kokoro: voice={voice_id}, lang based on voice prefix")
            tts_result = await tts_service.synthesize(
                text=text,
                voice=voice_id,
                fmt=audio_format,
                company_id=company_id,
                channel="telegram",
            )
            file_path = tts_result.get("file_path")
            if file_path:
                audio_bytes = Path(file_path).read_bytes()
                logger.debug(f"✅ Kokoro TTS audio: {len(audio_bytes)} bytes, {tts_result.get('generation_time_ms')}ms")

        except Exception as kokoro_err:
            logger.warning(f"Kokoro TTS failed ({kokoro_err}), falling back to gTTS")

        # 4. Fallback to gTTS if Kokoro failed
        if not audio_bytes:
            try:
                from gtts import gTTS
                voice_id_fallback = self.config.get("voice_id") or voice_config.get("voice_id") or "pf_dora"
                # Extract language from voice prefix (pf=pt, af=en, ef=es, etc.)
                lang_map = {"af": "en", "bf": "en", "pf": "pt", "ef": "es", "ff": "fr"}
                lang_prefix = voice_id_fallback[:2] if len(voice_id_fallback) >= 2 else "pf"
                lang = lang_map.get(lang_prefix, self.config.get("language", "pt"))
                
                tts = gTTS(text=text, lang=lang, slow=False)
                buf = io.BytesIO()
                tts.write_to_fp(buf)
                buf.seek(0)
                audio_bytes = buf.read()
                audio_format = "mp3"
                logger.debug(f"🎙️ gTTS fallback: {len(audio_bytes)} bytes, lang={lang}")
            except Exception as tts_err:
                logger.error(f"gTTS fallback also failed: {tts_err}")
                return {"telegram_voice_status": "error", "error": str(tts_err)}

        # 5. Send voice via Telegram API
        try:
            mime_type = "audio/wav" if audio_format == "wav" else "audio/mpeg"
            filename = f"voice.{audio_format}"

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendVoice",
                    data={"chat_id": chat_id},
                    files={"voice": (filename, audio_bytes, mime_type)},
                )
                if resp.status_code != 200:
                    logger.error(f"Telegram sendVoice error: {resp.text}")
                    resp.raise_for_status()

            logger.success(f"🎵 Voice message sent to {chat_id}")

            # 6. Record outbound voice message in DB
            if db and company_id:
                try:
                    res_conv = await db.execute(
                        select(TelegramConversation.id).where(
                            TelegramConversation.external_chat_id == str(chat_id)
                        )
                    )
                    conv_id = res_conv.scalar_one_or_none()
                    if conv_id:
                        db.add(
                            TelegramMessage(
                                conversation_id=conv_id,
                                direction="outbound",
                                sender_type="bot",
                                content_text=f"[ÁUDIO] {text[:100]}...",
                                content_json={
                                    "type": "voice",
                                    "status": "sent",
                                    "text_preview": text[:200],
                                    "voice_id": voice_id if 'voice_id' in dir() else "unknown",
                                },
                            )
                        )
                        await db.execute(
                            update(TelegramConversation)
                            .where(TelegramConversation.id == conv_id)
                            .values(updated_at=datetime.now(timezone.utc))
                        )
                except Exception as rec_err:
                    logger.warning(f"Failed to record voice message: {rec_err}")

            return {"telegram_voice_status": "sent", "chat_id": chat_id}

        except Exception as e:
            logger.error(f"Telegram voice send error: {e}")
            return {"telegram_voice_status": "error", "error": str(e)}
