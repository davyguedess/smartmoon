"""Secret masking — prevent API keys and tokens from leaking into logs.

Usage:
    from app.utils.masks import mask_error

    except Exception as e:
        logger.error(f"Provider error: {mask_error(e)}")
"""
import re

# Patterns to detect and mask
_SENSITIVE_PATTERNS = [
    (re.compile(r'(sk-[A-Za-z0-9]{5})[A-Za-z0-9]+'), r'\1****'),            # OpenAI keys
    (re.compile(r'(AIza[A-Za-z0-9]{5})[A-Za-z0-9]+'), r'\1****'),           # Google keys
    (re.compile(r'(gsk_[A-Za-z0-9]{5})[A-Za-z0-9]+'), r'\1****'),           # Groq keys
    (re.compile(r'(sk-ant-[A-Za-z0-9]{5})[A-Za-z0-9-]+'), r'\1****'),       # Anthropic keys
    (re.compile(r'([A-Za-z0-9]{5})[A-Za-z0-9]{30,}'), r'\1****'),           # Generic long tokens
    (re.compile(r'(Bearer\s+)[A-Za-z0-9._-]+', re.I), r'\1****'),           # Bearer tokens
    (re.compile(r'(api[_-]?key[=:]\s*")[^"]+', re.I), r'\1****'),           # api_key="..."
    (re.compile(r'(password[=:]\s*")[^"]+', re.I), r'\1****'),              # password="..."
]

# Fields that should NEVER appear in logs
SENSITIVE_FIELDS = {
    "api_key", "apikey", "api-key",
    "token", "access_token", "refresh_token",
    "password", "password_hash", "secret",
    "encrypted_key", "encrypted_credentials",
    "authorization", "x-api-key", "xi-api-key",
}


def mask_string(text: str) -> str:
    """Mask sensitive patterns in a string."""
    for pattern, replacement in _SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def mask_error(error: Exception) -> str:
    """Mask sensitive data from error messages."""
    return mask_string(str(error))


def mask_dict(data: dict) -> dict:
    """Return a copy of dict with sensitive fields masked."""
    masked = {}
    for key, value in data.items():
        low_key = key.lower().replace("-", "_")
        if low_key in SENSITIVE_FIELDS:
            masked[key] = "****"
        elif isinstance(value, str):
            masked[key] = mask_string(value)
        elif isinstance(value, dict):
            masked[key] = mask_dict(value)
        else:
            masked[key] = value
    return masked
