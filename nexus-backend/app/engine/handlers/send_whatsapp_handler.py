"""
SendWhatsAppHandler — Multi-provider edition.

Supports:
  1. SmartMoon Engine (provider='smartmoon') — internal, primary (our own infra)
  2. Meta Cloud API (provider='whatsapp_cloud') — official
  3. Z-API (provider='zapi') — secondary/fallback

Reads credentials from the Integration (provider='whatsapp_cloud', 'zapi', or 'smartmoon')
then sends via the appropriate client.
Falls back to mock mode when no integration is configured (dev/test).
"""
from typing import Optional, Tuple
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.services.whatsapp_cloud import WhatsAppCloudClient
from app.services.zapi_client import ZAPIClient
from app.services.smartmoon_client import SmartMoonClient


class SendWhatsAppHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        # ── Debug: log context keys available ────────────────
        logger.info(f"SendWhatsApp context keys: {sorted(self.context.keys())}")
        logger.info(f"SendWhatsApp wa_id={self.context.get('wa_id')} company_id={self.context.get('company_id')} ai_response_len={len(self.context.get('ai_response',''))}")

        # ── Resolve message text ──────────────────────────────
        # Priority: ai_response (from previous AI node) → node config → input
        text = (
            self.context.get("ai_response")
            or self.context.get("message")
            or self.config.get("message")
            or (input_payload.get("ai_response") if isinstance(input_payload, dict) else None)
            or (input_payload.get("message") if isinstance(input_payload, dict) else None)
            or ""
        )

        # ── Resolve destination phone ────────────────────────
        # wa_id comes from the inbound webhook context (set by zapi_webhook.py)
        phone = (
            self.context.get("wa_id")
            or self.context.get("phone")
            or self.config.get("phone")
            or (input_payload.get("wa_id") if isinstance(input_payload, dict) else None)
            or (input_payload.get("phone") if isinstance(input_payload, dict) else None)
        )

        logger.debug(f"SendWhatsApp: phone={phone}, text_len={len(text) if text else 0}")

        if not phone:
            logger.warning("SendWhatsApp: no destination phone in context — check wa_id")
            return {"whatsapp_sent": False, "whatsapp_error": "missing phone"}

        # Clean phone number (digits only if not a JID)
        phone_str = str(phone)
        if "@" in phone_str:
            phone_clean = phone_str
        else:
            phone_clean = "".join(c for c in phone_str if c.isdigit())

        # ── Check for image to send (from generate_image node) ────────────
        image_url = (
            self.context.get("image_url")
            or self.config.get("image_url")
        )
        caption = text or self.config.get("caption", "")

        if image_url:
            logger.info(f"🖼️ Sending WhatsApp IMAGE to {phone_clean}: {image_url[:80]}...")
            provider, creds = await self._resolve_provider()
            if provider == "whatsapp_cloud" and creds:
                return await self._send_image_via_meta(phone_clean, image_url, caption, creds)
            elif provider == "zapi" and creds:
                return await self._send_image_via_zapi(phone_clean, image_url, caption, creds)
            elif provider == "smartmoon" and creds:
                return await self._send_image_via_smartmoon(phone_clean, image_url, caption, creds)
            else:
                logger.warning(f"🖼️ [MOCK] WhatsApp IMAGE to {phone_clean}: {image_url} (no provider)")
                return {"whatsapp_sent": True, "whatsapp_mock": True, "image_url": image_url}

        if not text:
            logger.warning("SendWhatsApp: no message text to send")
            return {"whatsapp_sent": False, "whatsapp_error": "missing message"}

        logger.info(f"📤 Sending WhatsApp to {phone_clean}: {text[:80]}...")

        # Determine provider and load credentials
        provider, creds = await self._resolve_provider()

        # ── Split message if it contains ---PIX--- separator ──────────
        if "---PIX---" in text:
            parts = text.split("---PIX---", 1)
            main_msg = parts[0].strip()
            pix_msg = parts[1].strip()
            logger.info(f"📤 Splitting message: main ({len(main_msg)} chars) + PIX ({len(pix_msg)} chars)")

            # Send main message first
            result1 = await self._send_single(phone_clean, main_msg, provider, creds)

            # Small delay for natural feel
            import asyncio
            await asyncio.sleep(1.5)

            # Send PIX as separate message
            result2 = await self._send_single(phone_clean, pix_msg, provider, creds)
            return result2  # return last result

        return await self._send_single(phone_clean, text, provider, creds)

    async def _send_single(self, phone_clean: str, text: str, provider, creds) -> dict:
        """Send a single message via the resolved provider."""
        if provider == "whatsapp_cloud" and creds:
            return await self._send_via_meta(phone_clean, text, creds)
        elif provider == "zapi" and creds:
            return await self._send_via_zapi(phone_clean, text, creds)
        elif provider == "smartmoon" and creds:
            return await self._send_via_smartmoon(phone_clean, text, creds)
        else:
            # ── Mock mode (dev/no credentials) ──
            logger.warning(
                f"📱 [MOCK] WhatsApp to {phone_clean}: {text[:80]}... "
                f"(No WhatsApp integration found with status=connected)"
            )
            return {"whatsapp_sent": True, "whatsapp_mock": True}

    async def _send_via_meta(self, phone: str, text: str, creds: dict) -> dict:
        """Send via Meta Cloud API."""
        result = await WhatsAppCloudClient.send_text(
            phone_number_id=creds["phone_number_id"],
            to=phone,
            text=text,
            access_token=creds["access_token"],
        )

        if "error" in result and isinstance(result["error"], dict):
            error_msg = result["error"].get("message", "Unknown API error")
            logger.error(f"WhatsApp Cloud API send failed: {error_msg}")

            # Fallback to Z-API if available
            fallback_creds = await self._load_zapi_credentials()
            if fallback_creds:
                logger.info("⚡ Falling back to Z-API...")
                return await self._send_via_zapi(phone, text, fallback_creds)

            return {"whatsapp_sent": False, "whatsapp_error": error_msg, "whatsapp_provider": "meta"}

        wamid = None
        messages = result.get("messages", [])
        if messages:
            wamid = messages[0].get("id")

        logger.info(f"✅ WhatsApp sent to {phone} via Cloud API (wamid={wamid})")
        await self._persist_outbound(text, wamid, "meta")

        return {"whatsapp_sent": True, "whatsapp_wamid": wamid, "whatsapp_provider": "meta"}

    async def _send_via_zapi(self, phone: str, text: str, creds: dict) -> dict:
        """Send text via Z-API."""
        result = await ZAPIClient.send_text(
            instance_id=creds["instance_id"],
            token=creds["instance_token"],
            client_token=creds["client_token"],
            phone=phone,
            message=text,
        )

        if "error" in result:
            error_msg = result.get("error", "Unknown Z-API error")
            logger.error(f"Z-API send failed: {error_msg}")
            return {"whatsapp_sent": False, "whatsapp_error": error_msg, "whatsapp_provider": "zapi"}

        # Z-API returns { "zapiMessageId": "xxx", "messageId": "xxx" }
        zapi_msg_id = result.get("zapiMessageId") or result.get("messageId")

        logger.info(f"✅ WhatsApp sent to {phone} via Z-API (id={zapi_msg_id})")
        await self._persist_outbound(text, zapi_msg_id, "zapi")

        return {"whatsapp_sent": True, "whatsapp_wamid": zapi_msg_id, "whatsapp_provider": "zapi"}

    # ── Image send methods ───────────────────────────────────────────────────

    async def _send_image_via_meta(self, phone: str, image_url: str, caption: str, creds: dict) -> dict:
        """Send image via Meta Cloud API."""
        import httpx
        url = f"https://graph.facebook.com/v19.0/{creds['phone_number_id']}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "image",
            "image": {"link": image_url, "caption": caption},
        }
        headers = {"Authorization": f"Bearer {creds['access_token']}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
        result = resp.json()
        if resp.status_code != 200 or "error" in result:
            err = result.get("error", {}).get("message", resp.text)
            logger.error(f"Meta image send failed: {err}")
            return {"whatsapp_sent": False, "whatsapp_error": err, "whatsapp_provider": "meta"}
        wamid = result.get("messages", [{}])[0].get("id")
        logger.success(f"✅ Image sent to {phone} via Meta (wamid={wamid})")
        return {"whatsapp_sent": True, "whatsapp_wamid": wamid, "whatsapp_provider": "meta", "image_sent": True}

    async def _send_image_via_zapi(self, phone: str, image_url: str, caption: str, creds: dict) -> dict:
        """Send image via Z-API."""
        result = await ZAPIClient.send_image(
            instance_id=creds["instance_id"],
            token=creds["instance_token"],
            client_token=creds["client_token"],
            phone=phone,
            image_url=image_url,
            caption=caption,
        )
        if "error" in result:
            err = result.get("error", "Z-API image error")
            logger.error(f"Z-API image send failed: {err}")
            return {"whatsapp_sent": False, "whatsapp_error": err, "whatsapp_provider": "zapi"}
        msg_id = result.get("zapiMessageId") or result.get("messageId")
        logger.success(f"✅ Image sent to {phone} via Z-API (id={msg_id})")
        return {"whatsapp_sent": True, "whatsapp_wamid": msg_id, "whatsapp_provider": "zapi", "image_sent": True}

    async def _send_via_smartmoon(self, phone: str, text: str, creds: dict) -> dict:
        """Send text via SmartMoon Engine (internal, anti-ban queue)."""
        instance_id = creds["instance_id"]
        result = await SmartMoonClient.send_text(
            instance_id=instance_id,
            phone=phone,
            message=text,
        )

        if "error" in result:
            error_msg = result.get("error", "SmartMoon engine error")
            logger.error(f"SmartMoon send failed: {error_msg}")
            # Fallback to Z-API if available
            fallback_creds = await self._load_zapi_credentials()
            if fallback_creds:
                logger.info("⚡ Falling back to Z-API...")
                return await self._send_via_zapi(phone, text, fallback_creds)
            return {"whatsapp_sent": False, "whatsapp_error": error_msg, "whatsapp_provider": "smartmoon"}

        job_id = result.get("jobId")
        msg_id = result.get("messageId") or job_id

        logger.info(f"✅ WhatsApp sent to {phone} via SmartMoon (job={job_id})")
        await self._persist_outbound(text, msg_id, "smartmoon")

        return {"whatsapp_sent": True, "whatsapp_wamid": msg_id, "whatsapp_provider": "smartmoon"}

    async def _send_image_via_smartmoon(self, phone: str, image_url: str, caption: str, creds: dict) -> dict:
        """Send image via SmartMoon Engine.

        SmartMoon reads files from the shared Docker volume, NOT HTTP URLs.
        If image_url is an HTTP URL, we download it first to the shared media volume.
        """
        import os, httpx, uuid, mimetypes
        instance_id = creds["instance_id"]
        image_path = image_url

        # If it's an HTTP(S) URL, download to shared volume
        if image_url.startswith("http"):
            try:
                media_dir = getattr(settings, "SMARTMOON_MEDIA_DIR", "/data/media")
                os.makedirs(media_dir, exist_ok=True)
                ext = ".jpg"
                try:
                    ct = mimetypes.guess_type(image_url.split("?")[0])[0] or ""
                    ext = mimetypes.guess_extension(ct) or ".jpg"
                except Exception:
                    pass
                filename = f"{uuid.uuid4().hex}{ext}"
                filepath = os.path.join(media_dir, filename)
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(image_url)
                    resp.raise_for_status()
                    with open(filepath, "wb") as f:
                        f.write(resp.content)
                image_path = filepath
                logger.debug(f"Downloaded image to shared volume: {filepath}")
            except Exception as dl_err:
                logger.error(f"Failed to download image for SmartMoon: {dl_err}")
                return {"whatsapp_sent": False, "whatsapp_error": str(dl_err), "whatsapp_provider": "smartmoon"}

        result = await SmartMoonClient.send_image(
            instance_id=instance_id,
            phone=phone,
            image_path=image_path,
            caption=caption,
        )
        if "error" in result:
            err = result.get("error", "SmartMoon image error")
            logger.error(f"SmartMoon image send failed: {err}")
            return {"whatsapp_sent": False, "whatsapp_error": err, "whatsapp_provider": "smartmoon"}
        msg_id = result.get("jobId") or result.get("messageId")
        logger.success(f"✅ Image sent to {phone} via SmartMoon (id={msg_id})")
        return {"whatsapp_sent": True, "whatsapp_wamid": msg_id, "whatsapp_provider": "smartmoon", "image_sent": True}

    async def _resolve_provider(self) -> Tuple[Optional[str], Optional[dict]]:
        """Determine which WhatsApp provider to use and load its credentials.

        Priority:
        1. Explicit provider in context (from inbound webhook — 'zapi' or 'meta')
        2. Z-API (if connected)
        3. Meta Cloud API
        """
        forced_provider = self.context.get("whatsapp_provider")

        if forced_provider == "smartmoon":
            creds = await self._load_smartmoon_credentials()
            if creds:
                return "smartmoon", creds

        if forced_provider == "zapi":
            creds = await self._load_zapi_credentials()
            if creds:
                return "zapi", creds

        if forced_provider in ("whatsapp_cloud", "meta"):
            creds = await self._load_meta_credentials()
            if creds:
                return "whatsapp_cloud", creds

        # Auto-detect: SmartMoon first (our infra), then Z-API, then Meta
        smartmoon_creds = await self._load_smartmoon_credentials()
        if smartmoon_creds:
            return "smartmoon", smartmoon_creds

        zapi_creds = await self._load_zapi_credentials()
        if zapi_creds:
            return "zapi", zapi_creds

        meta_creds = await self._load_meta_credentials()
        if meta_creds:
            return "whatsapp_cloud", meta_creds

        return None, None

    async def _load_meta_credentials(self) -> Optional[dict]:
        """Load Meta Cloud API credentials from Integration table."""
        return await self._load_credentials_from_db("whatsapp_cloud")

    async def _load_zapi_credentials(self) -> Optional[dict]:
        """Load Z-API credentials from Integration table."""
        return await self._load_credentials_from_db("zapi")

    async def _load_smartmoon_credentials(self) -> Optional[dict]:
        """Load SmartMoon Engine credentials from Integration table."""
        return await self._load_credentials_from_db("smartmoon")

    async def _load_credentials_from_db(self, provider: str) -> Optional[dict]:
        """Generic credential loader from integrations table."""
        company_id = self.context.get("company_id")
        if not company_id:
            logger.warning(f"SendWhatsApp: no company_id in context, cannot load {provider} creds")
            return None

        try:
            from app.db.session import AsyncSessionLocal
            from sqlalchemy import text

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    text("""
                        SELECT config_json FROM integrations
                        WHERE company_id = :cid
                          AND provider = :provider
                        ORDER BY id DESC LIMIT 1
                    """),
                    {"cid": company_id, "provider": provider}
                )
                row = result.fetchone()
                if row and row[0]:
                    import json
                    cfg = row[0] if isinstance(row[0], dict) else json.loads(row[0])

                    if provider == "whatsapp_cloud":
                        pnid = cfg.get("phone_number_id")
                        at = cfg.get("access_token")
                        if pnid and at:
                            return {"phone_number_id": pnid, "access_token": at}

                    elif provider == "zapi":
                        iid = cfg.get("instance_id")
                        it = cfg.get("instance_token")
                        ct = cfg.get("client_token")
                        if iid and it and ct:
                            return {"instance_id": iid, "instance_token": it, "client_token": ct}
                        else:
                            logger.warning(
                                f"Z-API integration found but missing fields: "
                                f"instance_id={bool(iid)}, token={bool(it)}, client_token={bool(ct)}"
                            )

                    elif provider == "smartmoon":
                        iid = cfg.get("instance_id")
                        if iid:
                            return {"instance_id": iid}
                        else:
                            logger.warning("SmartMoon integration found but missing instance_id")

        except Exception as e:
            logger.error(f"Failed to load {provider} credentials: {e}")

        return None

    async def _persist_outbound(self, text: str, wamid: Optional[str], provider: str):
        """Save outbound message to WhatsAppMessage table."""
        conv_id = self.context.get("whatsapp_conversation_id") or self.context.get("conversation_id")
        if not conv_id:
            return
        try:
            from app.db.session import AsyncSessionLocal
            from app.models.whatsapp_models import WhatsAppMessage

            async with AsyncSessionLocal() as db:
                msg = WhatsAppMessage(
                    conversation_id=conv_id,
                    direction="outbound",
                    sender_type="agent",
                    message_type="text",
                    content_text=text,
                    wamid=wamid,
                    delivery_status="sent",
                    agent_id=self.context.get("agent_id"),
                    model=self.context.get("model"),
                    provider=provider,
                    tokens_input=self.context.get("tokens_input", 0),
                    tokens_output=self.context.get("tokens_output", 0),
                )
                db.add(msg)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to persist outbound WA message: {e}")
