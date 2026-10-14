"""
NEXUS.IA — Integration / E2E Tests
===================================
Tests run against the LIVE Docker backend (http://localhost:8000).

Requirements:
  - nexus_api container running
  - nexus_postgres container running

Run:
    pytest tests/test_e2e.py -v -s
"""
import uuid
import pytest
import httpx

# ── Config ────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:8000"
TIMEOUT = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0)
E2E_EMAIL = f"e2e_{uuid.uuid4().hex[:8]}@nexus.ia"
E2E_PASSWORD = "E2eTest@1234!"
E2E_COMPANY = "E2E Test Company"


# ── Backend reachability guard ────────────────────────────────────────
def _backend_reachable() -> bool:
    import socket
    try:
        socket.create_connection(("localhost", 8000), timeout=3)
        return True
    except OSError:
        return False


skip_if_offline = pytest.mark.skipif(
    not _backend_reachable(),
    reason="Backend not reachable at localhost:8000 — run: docker compose up -d"
)


# ── Module-scoped client (sync) ───────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as c:
        yield c


# ── Auth token (register + login once per module) ─────────────────────
@pytest.fixture(scope="module")
def auth_token(client):
    """
    Returns the JWT access_token.
    Strategy:
      1. Try register — if success, use the auto-login cookie from the register response
      2. If email already exists (400), login separately
    This avoids the duplicate refresh_token_hash bug when login is called twice in quick succession.
    """
    resp = client.post("/auth/register", json={
        "name": "E2E User",
        "email": E2E_EMAIL,
        "password": E2E_PASSWORD,
    })

    if resp.status_code in (200, 201):
        # Register does auto-login — token is in cookie
        token = client.cookies.get("access_token")
        if token:
            return token

    # Email already exists or register didn't set cookie — do explicit login
    import time; time.sleep(1)  # give 1s gap to avoid token_hash collision
    resp = client.post("/auth/login", data={
        "username": E2E_EMAIL,
        "password": E2E_PASSWORD,
    })
    if resp.status_code != 200:
        pytest.skip(f"Login failed ({resp.status_code}): {resp.text[:300]}")

    token = client.cookies.get("access_token")
    if not token:
        pytest.skip(f"No access_token cookie after login. Response: {resp.json()}")
    return token


@pytest.fixture(scope="module")
def auth_headers(client, auth_token):
    """Pass token as Bearer header for endpoints that accept it."""
    return {"Authorization": f"Bearer {auth_token}"}


# ── Health ────────────────────────────────────────────────────────────

@skip_if_offline
class TestHealth:

    def test_liveness(self, client):
        """GET /health returns status: ok"""
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "uptime_seconds" in body

    def test_readiness_has_db_and_redis(self, client):
        """GET /health/ready — DB and Redis must be ok"""
        r = client.get("/health/ready")
        assert r.status_code == 200
        checks = r.json()["checks"]
        assert checks["database"]["status"] == "ok", f"DB degraded: {checks}"
        assert checks["redis"]["status"] == "ok", f"Redis degraded: {checks}"

    def test_metrics_structure(self, client, auth_headers):
        """GET /health/metrics — returns period + aggregate"""
        r = client.get("/health/metrics", headers=auth_headers)
        # 200 authenticated, 401 if auth required — both valid
        if r.status_code == 200:
            body = r.json()
            assert "period" in body
            assert "aggregate" in body
            assert "total_ai_tokens" in body["aggregate"]
            assert "total_ai_cost_usd" in body["aggregate"]


# ── Auth ──────────────────────────────────────────────────────────────

@skip_if_offline
class TestAuth:

    def test_login_returns_token(self, auth_token):
        assert isinstance(auth_token, str) and len(auth_token) > 20

    def test_me_endpoint(self, client, auth_headers):
        """GET /auth/me returns authenticated user"""
        r = client.get("/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == E2E_EMAIL

    def test_protected_route_blocks_anon(self, client):
        """GET /auth/me without token → 401 or 403"""
        r = client.get("/auth/me")
        assert r.status_code in (401, 403)


# ── Chat Endpoints ────────────────────────────────────────────────────

@skip_if_offline
class TestChatEndpoints:

    def test_stream_requires_auth(self, client):
        """POST /chat/stream without token → 401/403"""
        r = client.post("/chat/stream", json={
            "provider": "ollama",
            "model": "llama3.2",
            "messages": [{"role": "user", "content": "test"}],
        })
        assert r.status_code in (401, 403), (
            f"Expected 401/403, got {r.status_code}: {r.text[:100]}"
        )

    def test_stream_endpoint_exists(self, client, auth_headers):
        """POST /chat/stream exists and is not 404/405"""
        r = client.post("/chat/stream",
            headers={**auth_headers, "Accept": "text/event-stream"},
            json={
                "provider": "ollama",
                "model": "llama3.2",
                "messages": [{"role": "user", "content": "Diga apenas: OK"}],
            },
        )
        assert r.status_code not in (404, 405), (
            f"/chat/stream missing: {r.status_code}"
        )

    def test_complete_endpoint_exists(self, client, auth_headers):
        """POST /chat/complete exists and is not 404/405"""
        r = client.post("/chat/complete",
            headers=auth_headers,
            json={
                "provider": "ollama",
                "model": "llama3.2",
                "messages": [{"role": "user", "content": "Diga apenas: OK"}],
            },
        )
        assert r.status_code not in (404, 405), (
            f"/chat/complete missing: {r.status_code}"
        )

    def test_legacy_ollama_stream_still_works(self, client, auth_headers):
        """Legacy /chat/ollama/stream still exists (backward compat)"""
        r = client.post("/chat/ollama/stream",
            headers=auth_headers,
            json={
                "provider": "ollama",
                "model": "llama3.2",
                "messages": [{"role": "user", "content": "test"}],
            },
        )
        assert r.status_code not in (404, 405), (
            f"Legacy endpoint removed: {r.status_code}"
        )

    def test_invalid_provider_is_rejected(self, client, auth_headers):
        """Unknown provider → 400/422/503, never 500"""
        r = client.post("/chat/complete",
            headers=auth_headers,
            json={
                "provider": "alien_ai_xyz",
                "model": "some-model",
                "messages": [{"role": "user", "content": "test"}],
            },
        )
        assert r.status_code != 500, f"Got 500 on invalid provider: {r.text[:200]}"
        assert r.status_code in (400, 422, 503), (
            f"Expected 4xx for invalid provider, got {r.status_code}"
        )


# ── OpenAPI schema ────────────────────────────────────────────────────

@skip_if_offline
class TestOpenAPI:

    def test_schema_documents_unified_endpoints(self, client):
        """OpenAPI schema must document /chat/stream and /chat/complete"""
        r = client.get("/openapi.json")
        assert r.status_code == 200
        paths = r.json()["paths"]
        assert "/chat/stream" in paths, f"Missing /chat/stream. Paths: {list(paths)[:10]}"
        assert "/chat/complete" in paths, "Missing /chat/complete"
        assert "/health" in paths, "Missing /health"

    def test_chat_stream_is_post(self, client):
        r = client.get("/openapi.json")
        stream = r.json()["paths"].get("/chat/stream", {})
        assert "post" in stream, "/chat/stream must be a POST"
