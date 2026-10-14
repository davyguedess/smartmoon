"""
NEXUS.IA — Rate Limiter Unit Tests
====================================
Tests for the global SlowAPI rate limiter module.
These tests run without Redis (in-memory backend).
"""
import os
import pytest

# Garantir que rodamos sem Redis neste teste
os.environ.setdefault("REDIS_URL", "memory://")


def test_limiter_is_initialized():
    """Limiter object must be importable and have a key_func."""
    from app.core.global_rate_limiter import limiter
    assert limiter is not None
    assert callable(limiter._key_func)


def test_plan_limits_table_coverage():
    """All expected plans must have a limit string defined."""
    from app.core.global_rate_limiter import _PLAN_LIMITS
    expected_plans = {"free", "pro", "enterprise"}
    assert expected_plans.issubset(set(_PLAN_LIMITS.keys()))


def test_plan_limits_format():
    """Each limit string must follow the SlowAPI format: N/unit."""
    from app.core.global_rate_limiter import _PLAN_LIMITS
    import re
    pattern = re.compile(r"^\d+/(second|minute|hour|day)$")
    for plan, limit in _PLAN_LIMITS.items():
        assert pattern.match(limit), f"Invalid limit format for plan '{plan}': '{limit}'"


def test_free_plan_limit_is_lower_than_pro():
    """Free plan must have a lower rate limit than Pro."""
    from app.core.global_rate_limiter import _PLAN_LIMITS
    def _parse_per_minute(s: str) -> int:
        """Normalise to req/minute."""
        n, unit = s.split("/")
        n = int(n)
        factors = {"second": 60, "minute": 1, "hour": 1/60, "day": 1/1440}
        return int(n * factors[unit])

    free_rpm = _parse_per_minute(_PLAN_LIMITS["free"])
    pro_rpm  = _parse_per_minute(_PLAN_LIMITS["pro"])
    assert free_rpm < pro_rpm, f"Free ({free_rpm} rpm) must be < Pro ({pro_rpm} rpm)"


def test_rate_limit_exceeded_handler_returns_429():
    """The custom 429 handler must return status 429 with structured body."""
    import asyncio
    from unittest.mock import MagicMock, patch
    from slowapi.errors import RateLimitExceeded
    from app.core.global_rate_limiter import rate_limit_exceeded_handler

    mock_request = MagicMock()

    # RateLimitExceeded requires a Limit object with error_message attribute.
    # We mock the exception directly to avoid constructing a real Limit.
    mock_exc = MagicMock(spec=RateLimitExceeded)
    mock_exc.detail = "60 per 1 minute"

    response = asyncio.get_event_loop().run_until_complete(
        rate_limit_exceeded_handler(mock_request, mock_exc)
    )
    assert response.status_code == 429
    import json
    body = json.loads(response.body)
    assert body["error"] == "rate_limit_exceeded"
    assert "detail" in body
    assert "retry_after" in body


def test_chat_rate_limit_returns_string_for_no_user():
    """chat_rate_limit must return a valid string when no user is attached to request."""
    from unittest.mock import MagicMock
    from app.core.global_rate_limiter import chat_rate_limit, _DEFAULT_LIMIT

    mock_request = MagicMock()
    mock_request.state = MagicMock(spec=[])  # no 'user' attribute

    result = chat_rate_limit(mock_request)
    assert result == _DEFAULT_LIMIT


def test_chat_rate_limit_returns_plan_limit_for_pro_user():
    """chat_rate_limit must return the pro plan limit for a Pro company user."""
    from unittest.mock import MagicMock
    from app.core.global_rate_limiter import chat_rate_limit, _PLAN_LIMITS

    mock_company = MagicMock()
    mock_company.plan = "pro"

    mock_user = MagicMock()
    mock_user.company = mock_company

    mock_request = MagicMock()
    mock_request.state.user = mock_user

    result = chat_rate_limit(mock_request)
    assert result == _PLAN_LIMITS["pro"]
