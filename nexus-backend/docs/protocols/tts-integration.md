# TTS Integration Protocol

## Objective
Define the integration of Text‑to‑Speech (TTS) capabilities into NEXUS.IA using **Kokoro‑FastAPI** as the primary provider and **Piper** as a fallback.

## Components
- **Service**: `app/services/tts_service.py` – orchestrates synthesis, fallback handling, storage, and returns metadata.
- **Clients**:
  - `app/integrations/tts/kokoro_client.py` – HTTP wrapper for Kokoro‑FastAPI.
  - `app/integrations/tts/piper_client.py` – HTTP wrapper for Piper.
- **Worker**: `app/workers/tts_worker.py` – Celery task consuming the `tts` queue, generating audio, persisting it.
- **API Test Endpoint**: `app/api/tts_test.py` – simple POST endpoint to trigger synthesis for manual testing.

## Configuration (add to `app/core/config.py` or environment)
```
TTS_PRIMARY_PROVIDER = "kokoro"
TTS_FALLBACK_PROVIDER = "piper"
KOKORO_TTS_URL = "http://localhost:8001/synthesize"
PIPER_TTS_URL = "http://localhost:8002/synthesize"
TTS_DEFAULT_FORMAT = "wav"
TTS_STORAGE_MODE = "filesystem"  # or "s3"
TTS_STORAGE_PATH = "./storage/audio"
TTS_TIMEOUT_SECONDS = 30
```

## Security & Auditing
- All requests must include a valid **service token** (`X-Service-Token`) verified by `app.core.security.verify_service_token`.
- Audit logs are written to `/audit/tts/` with fields: `task_id`, `provider`, `status`, `duration_ms`, `error`.
- Files are stored with a UUID filename and the original text hash for deduplication.

## Failure Handling
1. Attempt synthesis with the primary provider.
2. On HTTP error, timeout, or non‑200 response, automatically retry with the fallback provider.
3. If both fail, mark the Celery task as `failed` and log the error.

## Monitoring
- Expose Prometheus metrics `tts_requests_total`, `tts_success_total`, `tts_failure_total`.
- Include latency histogram `tts_processing_seconds`.

## Deployment Checklist
- [ ] Add environment variables to deployment config.
- [ ] Ensure the `tts` Celery queue is defined in `celery-configuration.md`.
- [ ] Verify storage path is writable by the worker process.
- [ ] Add unit tests for both clients and the service.
- [ ] Add integration test for the `/tts/test` endpoint.

## References
- Kokoro‑FastAPI docs: https://github.com/kokoro/tts
- Piper TTS repo: https://github.com/rhasspy/piper
