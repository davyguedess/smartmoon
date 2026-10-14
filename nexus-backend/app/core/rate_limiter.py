"""In-memory + Redis login rate limiter — Protocol 1: brute-force protection.

TASK 3.6: Migrated to Redis-first with in-memory fallback.
- Redis: persiste entre restarts, funciona com múltiplas instâncias
- In-memory: fallback automático se Redis estiver indisponível

Tracks failed login attempts by IP and email.
After MAX_LOGIN_ATTEMPTS failures within the lockout window, blocks further attempts.
"""
import time
from threading import Lock
from typing import Optional

from fastapi import HTTPException, status, Request
from loguru import logger

from app.core.config import settings

# ── In-memory fallback ───────────────────────────────
_lock = Lock()
_attempts: dict[str, list[float]] = {}


def _key(ip: str, email: str) -> str:
    return f"login_attempts:{ip}:{email}"


def _prune(timestamps: list[float], window: float) -> list[float]:
    now = time.time()
    return [t for t in timestamps if now - t < window]


# ── Redis helper ─────────────────────────────────────

_redis_client = None
_redis_checked = False


def _get_redis():
    """Lazy-load Redis client. Returns None if unavailable."""
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    try:
        import redis
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
        logger.info("✅ Rate limiter: usando Redis")
        return _redis_client
    except Exception as e:
        logger.warning(f"⚠️ Rate limiter: Redis indisponível ({e}), usando fallback in-memory")
        _redis_client = None
        return None


# ── Public API ───────────────────────────────────────

def check_login_rate(request: Request, email: str) -> None:
    """Call BEFORE validating credentials. Raises 429 if locked out."""
    ip = request.client.host if request.client else "unknown"
    k = _key(ip, email.lower())
    window = settings.LOGIN_LOCKOUT_MINUTES * 60

    r = _get_redis()
    if r:
        try:
            count = r.get(k)
            if count and int(count) >= settings.MAX_LOGIN_ATTEMPTS:
                ttl = r.ttl(k)
                remaining_min = max(1, (ttl or 60) // 60)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Muitas tentativas de login. Tente novamente em {remaining_min} minuto(s).",
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis check_login_rate fallback: {e}")

    # In-memory fallback
    with _lock:
        if k in _attempts:
            _attempts[k] = _prune(_attempts[k], window)
            if len(_attempts[k]) >= settings.MAX_LOGIN_ATTEMPTS:
                remaining = int(window - (time.time() - _attempts[k][0]))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Muitas tentativas de login. Tente novamente em {remaining // 60 + 1} minuto(s).",
                )


def record_failed_login(request: Request, email: str) -> None:
    """Call AFTER a failed login attempt."""
    ip = request.client.host if request.client else "unknown"
    k = _key(ip, email.lower())
    window = int(settings.LOGIN_LOCKOUT_MINUTES * 60)

    r = _get_redis()
    if r:
        try:
            pipe = r.pipeline()
            pipe.incr(k)
            pipe.expire(k, window)
            pipe.execute()
            return
        except Exception as e:
            logger.warning(f"Redis record_failed_login fallback: {e}")

    # In-memory fallback
    with _lock:
        if k not in _attempts:
            _attempts[k] = []
        _attempts[k].append(time.time())


def clear_login_attempts(request: Request, email: str) -> None:
    """Call AFTER a successful login to reset the counter."""
    ip = request.client.host if request.client else "unknown"
    k = _key(ip, email.lower())

    r = _get_redis()
    if r:
        try:
            r.delete(k)
            return
        except Exception as e:
            logger.warning(f"Redis clear_login_attempts fallback: {e}")

    # In-memory fallback
    with _lock:
        _attempts.pop(k, None)
