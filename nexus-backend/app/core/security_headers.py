"""
NEXUS.IA — Security Headers Middleware (TASK 7.2)

Adiciona headers de segurança HTTP em TODAS as respostas.
Protege contra: XSS, clickjacking, MIME sniffing, info leak, etc.

Reference: OWASP Secure Headers Project
https://owasp.org/www-project-secure-headers/
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injeta headers de segurança em todas as respostas HTTP.

    Headers:
    - X-Content-Type-Options: nosniff → previne MIME type sniffing
    - X-Frame-Options: DENY → previne clickjacking (iframe)
    - X-XSS-Protection: 1; mode=block → ativa filtro XSS do browser
    - Referrer-Policy: strict-origin-when-cross-origin → limita info em referrer
    - Permissions-Policy: camera=(), microphone=(), geolocation=() → desabilita APIs sensíveis
    - Content-Security-Policy: frame-ancestors 'none' → reforça anti-iframe
    - Strict-Transport-Security: max-age=31536000 → força HTTPS (HSTS)
    - X-Permitted-Cross-Domain-Policies: none → bloqueia Flash/Adobe requests
    - Cache-Control: no-store em APIs → previne cache de dados sensíveis
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # ── Core Security Headers ────────────────────────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Permissions-Policy: desabilita APIs que o backend não precisa
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "interest-cohort=(), payment=()"
        )

        # CSP: apenas frame-ancestors para não quebrar frontend SPA
        response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"

        # HSTS: force HTTPS por 1 ano (incluir subdomínios)
        # NOTA: Desabilitamos em modo DEBUG para facilitar desenvolvimento via IP/HTTP
        from app.core.config import settings
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # ── API-specific headers ─────────────────────────────────────────
        # Impedir cache de respostas de API (dados sensíveis)
        path = request.url.path
        if path.startswith("/api/") or path.startswith("/auth/") or path.startswith("/admin/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        # Remover header de server que expõe tecnologia
        if "server" in response.headers:
            del response.headers["server"]

        return response
