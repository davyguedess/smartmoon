"""Middleware — correlation ID and audit logging for every request.

Adds X-Correlation-Id to every request/response for log traceability.
Logs request method, path, status, and duration.
"""
import uuid
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Inject a unique correlation ID into each request for structured log tracing."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())[:12]
        request.state.correlation_id = correlation_id

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        response.headers["X-Correlation-Id"] = correlation_id

        # Structured log — skip health checks to reduce noise
        path = request.url.path
        if path not in ("/health", "/", "/docs", "/redoc", "/openapi.json"):
            logger.info(
                f"[{correlation_id}] {request.method} {path} → {response.status_code} ({duration_ms}ms)"
            )

        return response
