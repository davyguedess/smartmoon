"""
NEXUS.IA — Notification Service
Envia notificações via WhatsApp (Z-API) e/ou Email (SMTP/Resend)
para eventos críticos do Gateway de Pagamentos.
"""
import httpx
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from decimal import Decimal
from typing import Optional
from loguru import logger

from app.core.config import settings


# ── WhatsApp via Z-API ────────────────────────────────────────────────────────

async def _send_whatsapp(phone: str, message: str) -> bool:
    """Envia mensagem WhatsApp via Z-API ou WHATSAPP_API_URL. Retorna True se OK."""
    # Suporta ambos: WHATSAPP_* (variáveis atuais do .env) e ZAPI_* (legado)
    instance_id = (
        getattr(settings, "WHATSAPP_INSTANCE", None)
        or getattr(settings, "ZAPI_INSTANCE_ID", None)
    )
    token = (
        getattr(settings, "WHATSAPP_API_KEY", None)
        or getattr(settings, "ZAPI_TOKEN", None)
        or getattr(settings, "ZAPI_INSTANCE_TOKEN", None)
    )
    client_tk = getattr(settings, "ZAPI_CLIENT_TOKEN", None)
    custom_url = getattr(settings, "WHATSAPP_API_URL", None)

    if not instance_id or not token:
        logger.debug("WhatsApp não configurado (WHATSAPP_INSTANCE/WHATSAPP_API_KEY) — notificação pulada")
        return False

    # Normalizar número (remover caracteres não numéricos)
    num = "".join(c for c in phone if c.isdigit())
    if not num.startswith("55"):
        num = "55" + num

    # BUG-43 FIX: validação mínima — número sem dígitos gera chamada inútil
    # com num="55" ou "55" + lixo. DDD (2) + número mínimo (8) + 55 = 12.
    if len(num) < 12:
        logger.warning(f"WhatsApp: número inválido ignorado ({num!r}, {len(num)} dígitos)")
        return False

    # URL: usa WHATSAPP_API_URL se disponível, senão Z-API padrão
    if custom_url:
        # Formato Z-API via URL customizada
        base = custom_url.rstrip("/")
        url = f"{base}/instances/{instance_id}/token/{token}/send-text"
    else:
        url = f"https://api.z-api.io/instances/{instance_id}/token/{token}/send-text"

    headers = {"Client-Token": client_tk} if client_tk else {}
    payload = {"phone": num, "message": message}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                logger.success(f"📲 WhatsApp enviado para {num[:6]}***")
                return True
            else:
                logger.warning(f"Z-API retornou {resp.status_code}: {resp.text[:100]}")
                return False
    except Exception as e:
        logger.error(f"Erro Z-API: {e}")
        return False


# ── Email via SMTP ────────────────────────────────────────────────────────────

async def _send_email(to_email: str, subject: str, body_html: str) -> bool:
    """Envia email via SMTP. Retorna True se OK."""
    smtp_host  = getattr(settings, "SMTP_HOST",  None)
    smtp_port  = getattr(settings, "SMTP_PORT",  587)
    smtp_user  = getattr(settings, "SMTP_USER",  None)
    smtp_pass  = getattr(settings, "SMTP_PASS",  None)
    from_email = getattr(settings, "SMTP_FROM",  smtp_user or "noreply@nexus.ia")

    if not smtp_host or not smtp_user:
        logger.debug("SMTP não configurado — notificação email pulada")
        return False

    # BUG-37 FIX: smtplib.SMTP() é SINCRONO e bloqueante.
    # Chamado diretamente em função async, trava o event loop inteiro do uvicorn
    # por 2-8 segundos durante o handshake SMTP + envio, bloqueando todas as
    # outras requisições. Solução: run_in_executor para rodar em thread pool.
    import asyncio

    def _send_sync() -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Smart Moon <{from_email}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(body_html, "html", "utf-8"))
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_sync)
        logger.success(f"📧 Email enviado para {to_email[:4]}***")
        return True
    except Exception as e:
        logger.error(f"Erro SMTP: {e}")
        return False


# ── Template helpers ──────────────────────────────────────────────────────────

def _fmtBRL(v) -> str:
    return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ── Notificações de Cobrança ──────────────────────────────────────────────────

async def notify_charge_created(
    client_name: str,
    client_phone: Optional[str],
    client_email: Optional[str],
    amount: Decimal,
    description: str,
    pix_copy_paste: Optional[str] = None,
    due_date: Optional[str] = None,
):
    """Notifica cliente sobre nova cobrança PIX gerada."""
    valor = _fmtBRL(amount)
    nome  = client_name or "Cliente"

    # ── WhatsApp ──
    if client_phone:
        msg = (
            f"🔔 *Olá, {nome}!*\n\n"
            f"Uma cobrança PIX foi gerada para você:\n\n"
            f"💰 *Valor:* {valor}\n"
            f"📝 *Descrição:* {description}\n"
        )
        if due_date:
            msg += f"📅 *Vencimento:* {due_date}\n"
        if pix_copy_paste:
            msg += f"\n📋 *Código PIX (Copia e Cola):*\n`{pix_copy_paste}`\n"
        msg += "\n_Smart Moon Payment Gateway_"
        await _send_whatsapp(client_phone, msg)

    # ── Email ──
    if client_email:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
            <h2 style="color: #a78bfa; margin: 0 0 16px;">💳 Cobrança PIX Gerada</h2>
            <p>Olá, <strong>{nome}</strong>!</p>
            <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px;"><strong>Valor:</strong> {valor}</p>
                <p style="margin: 0 0 8px;"><strong>Descrição:</strong> {description}</p>
                {f'<p style="margin: 0;"><strong>Vencimento:</strong> {due_date}</p>' if due_date else ''}
            </div>
            {f'<div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0; word-break: break-all; font-family: monospace; font-size: 12px;">{pix_copy_paste}</div>' if pix_copy_paste else ''}
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">NEXUS.IA Payment Gateway</p>
        </div>
        """
        await _send_email(client_email, f"[Smart Moon] Cobrança PIX — {valor}", html)


async def notify_charge_paid(
    client_name: str,
    client_phone: Optional[str],
    client_email: Optional[str],
    amount: Decimal,
    description: str,
):
    """Notifica cliente que o pagamento PIX foi confirmado."""
    valor = _fmtBRL(amount)
    nome  = client_name or "Cliente"

    if client_phone:
        msg = (
            f"✅ *Pagamento confirmado!*\n\n"
            f"Olá, {nome}!\n\n"
            f"💰 *Valor pago:* {valor}\n"
            f"📝 *Descrição:* {description}\n\n"
            f"Obrigado pelo pagamento! 🙏\n"
            f"_Smart Moon Payment Gateway_"
        )
        await _send_whatsapp(client_phone, msg)

    if client_email:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
            <h2 style="color: #10b981; margin: 0 0 16px;">✅ Pagamento Confirmado</h2>
            <p>Olá, <strong>{nome}</strong>! Recebemos seu pagamento PIX com sucesso.</p>
            <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px;"><strong>Valor:</strong> {valor}</p>
                <p style="margin: 0;"><strong>Descrição:</strong> {description}</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">NEXUS.IA Payment Gateway</p>
        </div>
        """
        await _send_email(client_email, f"[Smart Moon] Pagamento confirmado — {valor}", html)


async def notify_withdrawal_requested(
    admin_phone: Optional[str],
    admin_email: Optional[str],
    company_id: int,
    amount: Decimal,
    pix_key: str,
    withdrawal_id: int,
):
    """Notifica admin sobre novo saque solicitado."""
    valor = _fmtBRL(amount)

    if admin_phone:
        msg = (
            f"🔔 *Novo saque solicitado!*\n\n"
            f"💼 *Empresa:* #{company_id}\n"
            f"💰 *Valor:* {valor}\n"
            f"🏦 *Chave PIX:* {pix_key[:6]}***\n"
            f"🆔 *Saque #:* {withdrawal_id}\n\n"
            f"Acesse o painel admin para aprovar ou rejeitar.\n"
            f"_Smart Moon Admin_"
        )
        await _send_whatsapp(admin_phone, msg)


async def notify_withdrawal_approved(
    owner_phone: Optional[str],
    owner_email: Optional[str],
    amount: Decimal,
    pix_key: str,
    withdrawal_id: int,
    mp_transfer_id: Optional[str] = None,
):
    """Notifica empresa que saque foi aprovado e enviado."""
    valor = _fmtBRL(amount)

    if owner_phone:
        msg = (
            f"✅ *Saque aprovado e enviado!*\n\n"
            f"💰 *Valor:* {valor}\n"
            f"🏦 *Chave PIX:* {pix_key[:6]}***\n"
            f"📋 *Transfer ID:* {mp_transfer_id or '—'}\n\n"
            f"O PIX foi processado e o valor está a caminho.\n"
            f"_Smart Moon Payment Gateway_"
        )
        await _send_whatsapp(owner_phone, msg)


async def notify_withdrawal_rejected(
    owner_phone: Optional[str],
    owner_email: Optional[str],
    amount: Decimal,
    reason: str,
    withdrawal_id: int,
):
    """Notifica empresa que saque foi rejeitado e saldo devolvido."""
    valor = _fmtBRL(amount)

    if owner_phone:
        msg = (
            f"❌ *Saque rejeitado*\n\n"
            f"💰 *Valor:* {valor}\n"
            f"📝 *Motivo:* {reason}\n\n"
            f"Seu saldo foi devolvido à carteira.\n"
            f"Em caso de dúvidas, entre em contato com o suporte.\n"
            f"_Smart Moon Payment Gateway_"
        )
        await _send_whatsapp(owner_phone, msg)
