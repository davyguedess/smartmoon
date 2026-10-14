# app/workers/tts_worker.py

"""TTS Worker

Celery task that consumes the `tts` queue, generates audio using the TTS service, and stores the result.
It logs audit information and handles failures with retry and dead‑letter logic.
"""

from celery import Task
from app.workers.celery_app import celery_app
from app.services.tts_service import tts_service
from app.core.logging import logger

# Optional: configure retries, timeouts, etc.

@celery_app.task(
    name="tts_worker_task",
    bind=True,
    max_retries=3,
    soft_time_limit=30,
    time_limit=60,
    acks_late=True,
)
def tts_worker_task(self: Task, text: str, fmt: str = None):
    """Generate TTS audio for *text*.
    Returns the file path of the generated audio.
    """
    try:
        result = tts_service.synthesize(text, fmt=fmt)
        logger.info(f"✅ TTS generated: {result['file_path']} (provider={result['provider']})")
        return result
    except Exception as exc:
        logger.error(f"❌ TTS worker failed: {exc}")
        # Retry with exponential backoff
        retry_count = self.request.retries
        if retry_count < self.max_retries:
            countdown = 10 * (2 ** retry_count)
            raise self.retry(exc=exc, countdown=countdown)
        else:
            # Final failure – could send to dead‑letter queue or alert
            logger.error("💀 TTS task permanently failed after retries")
            raise
