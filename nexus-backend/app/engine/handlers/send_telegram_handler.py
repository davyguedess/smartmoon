"""Send text message to Telegram — used when flow has a send_telegram node.
For voice responses, use send_telegram_voice node instead.
The flow builder decides which one to use — no auto-detection here.
"""
import httpx
import json
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings
from sqlalchemy import select, update
from app.models import Integration, TelegramMessage, TelegramConversation
from datetime import datetime, timezone


class SendTelegramHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        company_id = self.context.get("company_id")
        chat_id = self.config.get("chat_id") or input_payload.get("chat_id")
        db = self.context.get("_db")

        # 1. Resolve bot token from Integration (most recent connected)
        bot_token = settings.TELEGRAM_BOT_TOKEN
        if db and company_id:
            try:
                result = await db.execute(
                    select(Integration).where(
                        Integration.company_id == company_id,
                        Integration.provider == "telegram",
                        Integration.status == "connected"
                    ).order_by(Integration.id.desc()).limit(1)
                )
                integration = result.scalars().first()
                if integration and integration.config_json:
                    cfg = integration.config_json if isinstance(integration.config_json, dict) else json.loads(integration.config_json)
                    bot_token = cfg.get("bot_token") or bot_token
            except Exception as e:
                logger.error(f"Failed to load Telegram token from DB: {e}")

        # 2. Resolve text to send
        text = self.config.get("message")
        if not text:
            text = self.context.get("ai_response") or input_payload.get("ai_response")
        if not text:
            pix_status = self.context.get("pix_status", "")
            if pix_status == "created":
                amount = self.context.get("amount", "")
                customer = self.context.get("customer", "")
                pix_id = self.context.get("pix_id", "")
                text = (f"✅ *PIX de R$ {amount:.2f} gerado e enviado para {customer}!*\n"
                        f"ID: `{pix_id}`\nAguardando confirmação de pagamento.")
            else:
                text = "📢 Fluxo concluído."

        if not bot_token or not chat_id:
            logger.warning(f"Telegram not fully configured (token={bool(bot_token)}, chat_id={chat_id})")
            return {"telegram_status": "error", "reason": "config_missing"}

        # 3. Send text message
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                )
                if resp.status_code != 200:
                    logger.error(f"Telegram API error: {resp.text}")
                resp.raise_for_status()
                logger.success(f"📱 Telegram text sent to {chat_id}")

            # 4. Record outbound message in DB
            if db:
                try:
                    res_conv = await db.execute(
                        select(TelegramConversation.id).where(
                            TelegramConversation.external_chat_id == str(chat_id)
                        )
                    )
                    conv_id = res_conv.scalar_one_or_none()
                    if conv_id:
                        db.add(TelegramMessage(
                            conversation_id=conv_id,
                            direction="outbound",
                            sender_type="bot",
                            content_text=text,
                            content_json={"status": "sent"},
                        ))
                        await db.execute(
                            update(TelegramConversation)
                            .where(TelegramConversation.id == conv_id)
                            .values(updated_at=datetime.now(timezone.utc))
                        )
                except Exception as rec_err:
                    logger.warning(f"Failed to record outbound message: {rec_err}")

            return {"telegram_status": "sent", "chat_id": chat_id}

        except Exception as e:
            logger.error(f"Telegram send error: {e}")
            return {"telegram_status": "error", "error": str(e)}
