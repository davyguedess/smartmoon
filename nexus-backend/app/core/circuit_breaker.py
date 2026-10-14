"""Circuit Breaker — prevents cascading failures in external service calls.

States:
  CLOSED  → normal operation, calls pass through
  OPEN    → service is down, calls fail immediately (no external call)
  HALF_OPEN → after cooldown, allow one probe call to test recovery

Usage:
    from app.core.circuit_breaker import circuit_breaker

    breaker = circuit_breaker("openai")
    if not breaker.allow():
        raise ServiceUnavailable("OpenAI is down — circuit open")
    try:
        result = await call_openai(...)
        breaker.record_success()
    except Exception:
        breaker.record_failure()
        raise
"""
import time
from enum import Enum
from threading import Lock
from typing import Dict
from loguru import logger


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Per-service circuit breaker with configurable thresholds."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_max_calls: int = 1,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._half_open_calls = 0
        self._lock = Lock()

    @property
    def state(self) -> CircuitState:
        with self._lock:
            if self._state == CircuitState.OPEN:
                if time.time() - self._last_failure_time >= self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info(f"🔄 Circuit [{self.name}] → HALF_OPEN (probing)")
            return self._state

    def allow(self) -> bool:
        """Check if a call should be allowed through."""
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            with self._lock:
                if self._half_open_calls < self.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
            return False
        # OPEN
        return False

    def record_success(self):
        """Record a successful call."""
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    logger.info(f"✅ Circuit [{self.name}] → CLOSED (recovered)")
            else:
                self._failure_count = 0

    def record_failure(self):
        """Record a failed call."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                logger.warning(f"🔴 Circuit [{self.name}] → OPEN (probe failed)")
            elif self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
                logger.warning(
                    f"🔴 Circuit [{self.name}] → OPEN "
                    f"(failures={self._failure_count}/{self.failure_threshold})"
                )

    def reset(self):
        """Force reset the circuit breaker."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0

    def status(self) -> dict:
        """Return current circuit status for monitoring."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
        }


# ── Global registry of circuit breakers ──────────────
_breakers: Dict[str, CircuitBreaker] = {}
_registry_lock = Lock()


def circuit_breaker(
    service: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
) -> CircuitBreaker:
    """Get or create a named circuit breaker."""
    with _registry_lock:
        if service not in _breakers:
            _breakers[service] = CircuitBreaker(
                name=service,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
            )
        return _breakers[service]


def all_breaker_statuses() -> list:
    """Return status of all circuit breakers for monitoring."""
    with _registry_lock:
        return [b.status() for b in _breakers.values()]
