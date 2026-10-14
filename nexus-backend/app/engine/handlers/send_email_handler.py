"""Gmail Send Handler — sends email via Google Gmail API (Multi-Tenant)"""
import base64
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler


class SendEmailHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        to = (
            self.config.get("to")
            or self.context.get("customer_email")
            or input_payload.get("email", "")
        )
        subject = self.config.get("subject", "Mensagem da Smart Moon")
        body = (
            self.config.get("body")
            or self.context.get("openai_response")
            or self.context.get("claude_response")
            or self.context.get("message", "")
        )

        if not to:
            return {"email_status": "error", "error": "E-mail do destinatário não definido"}

        try:
            from app.integrations.google_oauth import get_gmail_service
            import email.mime.text as mime_text
            import email.mime.multipart as mime_multi

            company_id = self.context.get("_company_id")
            db = self.context.get("_db")

            if not company_id or not db:
                logger.warning("SendEmail: missing company_id or db in context — mock mode")
                return {"email_status": "mock", "to": to, "subject": subject}

            service = await get_gmail_service(company_id, db)
            message = mime_multi.MIMEMultipart()
            message["to"] = to
            message["subject"] = subject
            message.attach(mime_text.MIMEText(body, "plain", "utf-8"))
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
            logger.success(f"📧 Email enviado para {to} por company {company_id} — id: {sent.get('id')}")
            return {"email_status": "sent", "to": to, "message_id": sent.get("id")}
        except ValueError as e:
            logger.warning(f"SendEmail mock (Google not connected): {e}")
            return {"email_status": "mock", "to": to, "subject": subject}
        except Exception as e:
            logger.error(f"SendEmail error: {e}")
            return {"email_status": "error", "error": str(e)}

