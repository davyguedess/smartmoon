"""Structured logging — Protocol 5: security-compliant log configuration.

Rules:
  - Colored human format for dev, clean format for production
  - Sensitive data masking: tokens, passwords, API keys never in logs
  - File logs rotated daily, retained 30 days
"""
import sys
import re
from loguru import logger
from app.core.config import settings


# ── Sensitive data patterns to scrub from log messages ──
_REDACT_PATTERNS = [
    (re.compile(r'(access_token|refresh_token|api_key|password|secret|authorization)["\s:=]+["\']?[\w\-\.]+["\']?', re.IGNORECASE), r'\1=***'),
    (re.compile(r'(Bearer\s+)[\w\-\.]+', re.IGNORECASE), r'\1***'),
]


def _redact(message: str) -> str:
    """Strip sensitive values from log messages."""
    for pattern, replacement in _REDACT_PATTERNS:
        message = pattern.sub(replacement, message)
    return message


class RedactFilter:
    """Loguru filter that redacts sensitive data from messages."""
    def __call__(self, record):
        record["message"] = _redact(record["message"])
        return True


def setup_logging():
    logger.remove()
    level = "DEBUG" if settings.DEBUG else "INFO"
    redact = RedactFilter()

    # Console output
    logger.add(
        sys.stdout,
        level=level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> — <white>{message}</white>",
        colorize=True,
        filter=redact,
    )

    # File logging — daily rotation, 30-day retention
    logger.add(
        "logs/nexus_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="30 days",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
        filter=redact,
    )
