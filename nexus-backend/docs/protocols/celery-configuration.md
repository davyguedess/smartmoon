# Celery Configuration Protocol

## Objective
Define the configuration and deployment guidelines for Celery workers that will process asynchronous tasks such as executions, webhooks, TTS generation, and maintenance.

## Requirements
- **Broker**: Redis (`redis://localhost:6379/0`).
- **Result Backend**: Redis (`redis://localhost:6379/1`).
- **Concurrency**: Use prefork workers; default pool size = number of CPU cores.
- **Task Queues**:
  - `executions`
  - `webhooks`
  - `tts`
  - `exports`
  - `maintenance`
- **Retry Policy**: Automatic retries with exponential backoff, max 3 attempts.
- **Graceful Shutdown**: Workers must handle SIGTERM and finish in‑flight tasks.

## Configuration (`settings.py`)
```python
CELERY_BROKER_URL = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = "redis://localhost:6379/1"
CELERY_TASK_QUEUES = {
    "executions": {"routing_key": "executions"},
    "webhooks": {"routing_key": "webhooks"},
    "tts": {"routing_key": "tts"},
    "exports": {"routing_key": "exports"},
    "maintenance": {"routing_key": "maintenance"},
}
CELERY_TASK_DEFAULT_QUEUE = "executions"
CELERY_TASK_DEFAULT_EXCHANGE = "nexus"
CELERY_TASK_DEFAULT_ROUTING_KEY = "executions"
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_ACKS_LATE = True
```

## Worker Startup Script (`celery_worker.sh`)
```bash
#!/usr/bin/env bash
# Start Celery worker for NEXUS.IA
source .env
celery -A app.workers.celery_app worker \
    --loglevel=info \
    -Q executions,webhooks,tts,exports,maintenance \
    --concurrency=$(nproc)
```
Make the script executable (`chmod +x celery_worker.sh`).

## Deployment Steps
1. Install dependencies: `pip install celery[redis]`.
2. Ensure Redis is running (see Redis configuration protocol).
3. Add the above settings to `app/core/settings.py`.
4. Run the startup script on each worker host.
5. Verify with `celery -A app.workers.celery_app inspect ping`.

## Auditing
- Log worker start/stop events to `/audit/celery/`.
- Store task execution metadata (task_id, queue, status, duration) in `audit.celery_tasks` table.
- Retain logs for 180 days.
