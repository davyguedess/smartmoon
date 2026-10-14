"""
Check WhatsApp Handler — verifies if a phone number has WhatsApp
then sets context variables for multi-channel routing.
"""
import httpx
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.core.config import settings


class CheckWhatsAppHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        phone = (
            self.config.get("phone")
            or self.context.get("customer_phone")
            or input_payload.get("phone", "")
        )

        if not phone:
            return {"has_whatsapp": False, "error": "Telefone não definido"}

        # Normalize phone: remove spaces, dashes
        phone_clean = "".join(c for c in str(phone) if c.isdigit() or c == "+")

        if not settings.WHATSAPP_API_URL:
            # Heuristic: Brazilian mobile numbers starting with 9XXX typically have WA
            is_mobile = len(phone_clean.replace("+55", "").replace("55", "")) in (10, 11)
            has_wa = is_mobile
            logger.info(f"📱 WhatsApp check (heuristic) {phone}: {'✅' if has_wa else '❌'}")
            return {
                "has_whatsapp": has_wa,
                "phone": phone_clean,
                "check_method": "heuristic",
                "channel": "whatsapp" if has_wa else "email",
            }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{settings.WHATSAPP_API_URL}/chat/whatsappNumbers/{settings.WHATSAPP_INSTANCE}",
                    headers={"apikey": settings.WHATSAPP_API_KEY},
                    params={"numbers": [phone_clean]},
                )
                data = resp.json()
                exists = isinstance(data, list) and len(data) > 0 and data[0].get("exists", False)
                jid = data[0].get("jid") if exists else None

                logger.info(f"📱 WhatsApp {phone}: {'✅ tem WA' if exists else '❌ sem WA'}")
                return {
                    "has_whatsapp": exists,
                    "phone": phone_clean,
                    "jid": jid,
                    "check_method": "api",
                    "channel": "whatsapp" if exists else "email",
                }
        except Exception as e:
            logger.warning(f"WhatsApp check error: {e}")
            return {"has_whatsapp": False, "phone": phone_clean, "error": str(e), "channel": "email"}
