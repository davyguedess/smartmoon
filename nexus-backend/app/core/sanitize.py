"""
NEXUS.IA — Input Sanitization Utilities (TASK 8.4)

Funções utilitárias para sanitizar inputs do usuário.
Previne: XSS, SQL injection (extra layer), path traversal, etc.

Uso:
    from app.core.sanitize import sanitize_string, sanitize_email

    clean = sanitize_string(user_input, max_length=200)
    email = sanitize_email(raw_email)
"""
import re
import html
from typing import Optional


# ── Patterns perigosos ───────────────────────────────────────────────────────

# XSS patterns
_XSS_PATTERNS = [
    re.compile(r'<\s*script', re.IGNORECASE),
    re.compile(r'javascript\s*:', re.IGNORECASE),
    re.compile(r'on\w+\s*=', re.IGNORECASE),  # onclick=, onerror=, etc.
    re.compile(r'<\s*iframe', re.IGNORECASE),
    re.compile(r'<\s*object', re.IGNORECASE),
    re.compile(r'<\s*embed', re.IGNORECASE),
    re.compile(r'<\s*svg\s', re.IGNORECASE),
    re.compile(r'data\s*:', re.IGNORECASE),
    re.compile(r'vbscript\s*:', re.IGNORECASE),
]

# SQL injection patterns
_SQL_PATTERNS = [
    re.compile(r"('\s*or\s*'?\d?\s*=\s*'?\d)", re.IGNORECASE),
    re.compile(r";\s*(drop|delete|insert|update|alter|create)\s", re.IGNORECASE),
    re.compile(r"union\s+(all\s+)?select", re.IGNORECASE),
    re.compile(r"--\s*$", re.MULTILINE),
    re.compile(r"/\*.*\*/", re.DOTALL),
]

# Path traversal
_PATH_TRAVERSAL = re.compile(r"\.\.[/\\]")


# ── Core Functions ───────────────────────────────────────────────────────────

def sanitize_string(
    value: Optional[str],
    max_length: int = 500,
    allow_html: bool = False,
    strip_newlines: bool = False,
) -> Optional[str]:
    """
    Sanitiza string de input.

    - Remove caracteres de controle (exceto newline/tab)
    - Escapa HTML (se allow_html=False)
    - Limita comprimento
    - Remove trailing/leading whitespace
    """
    if value is None:
        return None

    # Strip whitespace
    value = value.strip()

    if not value:
        return ""

    # Remove caracteres de controle (exceto \n, \t)
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)

    # Strip newlines se solicitado
    if strip_newlines:
        value = value.replace('\n', ' ').replace('\r', ' ')

    # Escapar HTML
    if not allow_html:
        value = html.escape(value, quote=True)

    # Limitar comprimento
    if len(value) > max_length:
        value = value[:max_length]

    return value


def sanitize_email(email: Optional[str]) -> Optional[str]:
    """Sanitiza e valida formato básico de email."""
    if not email:
        return None

    email = email.strip().lower()

    # Validação básica de formato
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        return None

    # Limitar comprimento
    if len(email) > 254:
        return None

    return email


def sanitize_phone(phone: Optional[str]) -> Optional[str]:
    """Sanitiza número de telefone (apenas dígitos e +)."""
    if not phone:
        return None
    clean = re.sub(r'[^\d+]', '', phone.strip())
    if len(clean) < 8 or len(clean) > 20:
        return None
    return clean


def sanitize_cpf_cnpj(doc: Optional[str]) -> Optional[str]:
    """Sanitiza CPF/CNPJ (apenas dígitos)."""
    if not doc:
        return None
    clean = re.sub(r'\D', '', doc.strip())
    if len(clean) not in (11, 14):
        return None
    return clean


def sanitize_monetary(value) -> Optional[str]:
    """Sanitiza valor monetário. Retorna string formatada."""
    if value is None:
        return None
    try:
        from decimal import Decimal, InvalidOperation
        d = Decimal(str(value))
        if d < 0:
            return None
        return f"{d:.2f}"
    except (InvalidOperation, ValueError):
        return None


# ── Detection Functions ──────────────────────────────────────────────────────

def has_xss(value: str) -> bool:
    """Detecta tentativas de XSS no input."""
    for pattern in _XSS_PATTERNS:
        if pattern.search(value):
            return True
    return False


def has_sql_injection(value: str) -> bool:
    """Detecta padrões comuns de SQL injection."""
    for pattern in _SQL_PATTERNS:
        if pattern.search(value):
            return True
    return False


def has_path_traversal(value: str) -> bool:
    """Detecta tentativas de path traversal."""
    return bool(_PATH_TRAVERSAL.search(value))


def is_safe_input(value: str) -> bool:
    """Verifica se o input é seguro (sem XSS, SQL injection, path traversal)."""
    return not (has_xss(value) or has_sql_injection(value) or has_path_traversal(value))


# ── Batch Sanitize ───────────────────────────────────────────────────────────

def sanitize_dict(data: dict, max_str_length: int = 500) -> dict:
    """
    Sanitiza todos os valores string de um dicionário.
    Útil para metadata/JSON arbitrário do usuário.
    """
    clean = {}
    for k, v in data.items():
        key = sanitize_string(str(k), max_length=100, strip_newlines=True) or str(k)[:100]
        if isinstance(v, str):
            clean[key] = sanitize_string(v, max_length=max_str_length)
        elif isinstance(v, dict):
            clean[key] = sanitize_dict(v, max_str_length)
        elif isinstance(v, list):
            clean[key] = [
                sanitize_string(str(item), max_length=max_str_length) if isinstance(item, str)
                else item
                for item in v[:100]  # Limitar arrays a 100 items
            ]
        else:
            clean[key] = v
    return clean
