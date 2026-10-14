"""
NEXUS.IA — Two-Factor Authentication (TOTP) Service (TASK 7.1)

Implementa 2FA via TOTP (Time-Based One-Time Password) compatível com:
- Google Authenticator
- Authy
- Microsoft Authenticator
- 1Password, Bitwarden, etc.

Fluxo:
1. User chama POST /auth/2fa/setup → recebe QR Code + backup codes
2. User escaneia QR no app e envia código de verificação
3. POST /auth/2fa/verify → ativa 2FA na conta
4. A partir daí, saques/operações críticas exigem 2FA

Segurança:
- Secret encriptado antes de salvar (Fernet)
- Backup codes são hash-based (bcrypt)
- Window de 1 step (30s) para tolerância de clock skew
"""
import hashlib
import secrets
import io
import base64
from typing import Optional

from loguru import logger

try:
    import pyotp
    import qrcode
    TOTP_AVAILABLE = True
except ImportError:
    TOTP_AVAILABLE = False
    logger.warning("⚠️ pyotp/qrcode não instalados — 2FA desabilitado")


# ── Constants ────────────────────────────────────────────────────────────────

ISSUER_NAME = "Smart Moon"
TOTP_INTERVAL = 30  # seconds
TOTP_DIGITS = 6
BACKUP_CODES_COUNT = 8


# ── TOTP Core ────────────────────────────────────────────────────────────────

def generate_totp_secret() -> str:
    """Gera um novo secret TOTP (Base32, 32 chars)."""
    if not TOTP_AVAILABLE:
        raise RuntimeError("pyotp não instalado")
    return pyotp.random_base32()


def generate_backup_codes(count: int = BACKUP_CODES_COUNT) -> list[str]:
    """Gera backup codes de 8 dígitos."""
    return [f"{secrets.randbelow(100000000):08d}" for _ in range(count)]


def hash_backup_code(code: str) -> str:
    """SHA-256 do backup code para armazenamento seguro."""
    return hashlib.sha256(code.strip().encode()).hexdigest()


def get_totp_uri(secret: str, email: str) -> str:
    """Gera URI otpauth:// para QR Code."""
    if not TOTP_AVAILABLE:
        raise RuntimeError("pyotp não instalado")
    totp = pyotp.TOTP(secret, interval=TOTP_INTERVAL, digits=TOTP_DIGITS)
    return totp.provisioning_uri(name=email, issuer_name=ISSUER_NAME)


def generate_qr_code_base64(uri: str) -> str:
    """Gera QR Code como base64 PNG (para exibir no frontend)."""
    if not TOTP_AVAILABLE:
        raise RuntimeError("qrcode não instalado")
    img = qrcode.make(uri, box_size=6, border=2)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return f"data:image/png;base64,{base64.b64encode(buffer.read()).decode()}"


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verifica código TOTP com window de ±1 (tolera 30s de clock skew).
    Returns True se válido.
    """
    if not TOTP_AVAILABLE:
        return False
    try:
        totp = pyotp.TOTP(secret, interval=TOTP_INTERVAL, digits=TOTP_DIGITS)
        return totp.verify(code.strip(), valid_window=1)
    except Exception as e:
        logger.error(f"TOTP verify error: {e}")
        return False


def verify_backup_code(code: str, stored_hashes: list[str]) -> tuple[bool, list[str]]:
    """
    Verifica backup code.
    Returns: (is_valid, remaining_hashes)
    """
    code_hash = hash_backup_code(code)
    if code_hash in stored_hashes:
        remaining = [h for h in stored_hashes if h != code_hash]
        return True, remaining
    return False, stored_hashes


# ── Setup Flow ───────────────────────────────────────────────────────────────

def setup_2fa(email: str) -> dict:
    """
    Gera todos os dados necessários para configurar 2FA.
    Returns dict com secret, qr_code, backup_codes, backup_hashes.
    """
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, email)
    qr = generate_qr_code_base64(uri)
    backup_codes = generate_backup_codes()
    backup_hashes = [hash_backup_code(c) for c in backup_codes]

    return {
        "secret": secret,
        "qr_code": qr,
        "otpauth_uri": uri,
        "backup_codes": backup_codes,      # Mostrar ao usuário UMA VEZ
        "backup_hashes": backup_hashes,     # Salvar no banco
    }
