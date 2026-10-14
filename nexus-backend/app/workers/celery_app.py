"""Celery application — hardened configuration for production.

Queues:
  execution  → flow execution tasks (soft timeout 300s)
  webhooks   → webhook processing (soft timeout 60s)
  dead_letter → failed tasks after max retries for later analysis
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "nexus_ia",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks", "app.workers.tts_worker", "app.workers.project_cron", "app.workers.meeting_processor"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="America/Sao_Paulo",
    enable_utc=True,

    # Reliability
    task_track_started=True,
    task_acks_late=True,               # Only ack after task completes
    worker_prefetch_multiplier=1,      # Fair dispatch (1 task at a time per worker)

    # Timeouts
    task_soft_time_limit=350,          # 350s soft limit (Ollama can take up to 300s)
    task_time_limit=420,               # 7 min hard kill
    result_expires=3600,               # Results expire after 1 hour

    # Retry policy for broker connection
    broker_connection_retry_on_startup=True,
    broker_transport_options={
        "visibility_timeout": 43200,   # 12 hours
    },

    # Rate limits (global)
    worker_max_tasks_per_child=200,    # Restart worker after 200 tasks (memory leak prevention)

    # Routing
    task_routes={
        "execute_flow_task": {"queue": "execution"},
        "process_channel_message_task": {"queue": "execution"},
        "process_webhook_task": {"queue": "webhooks"},
        "process_payment_webhook_task": {"queue": "webhooks"},
        "dead_letter_task": {"queue": "dead_letter"},
        "cleanup_expired_memories": {"queue": "execution"},
        "auto_dream_task": {"queue": "execution"},
        "daily_cost_report": {"queue": "execution"},
        "cleanup_stale_charges": {"queue": "execution"},
        "tts_worker_task": {"queue": "tts"},
        "project_morning_alert": {"queue": "execution"},
        "project_midday_check": {"queue": "execution"},
        "project_evening_summary": {"queue": "execution"},
        "project_d3_alert": {"queue": "execution"},
        "project_overdue_alert": {"queue": "execution"},
        "process_meeting_task": {"queue": "execution"},
    },

    # Default priority
    task_default_queue="execution",
    task_default_priority=5,

    # Scheduled tasks (Celery Beat)
    beat_schedule={
        "cleanup-expired-memories-daily": {
            "task": "cleanup_expired_memories",
            # BUG-29 FIX: plain dict {"hour": 3} era interpretado como timedelta,
            # não como expressão cron. crontab() é o tipo correto para agendamento
            # baseado em hora/minuto do dia.
            "schedule": crontab(hour=3, minute=0),
        },
        "auto-dream-nightly": {
            "task": "auto_dream_task",
            "schedule": crontab(hour=3, minute=30),   # 03:30 após cleanup
        },
        "daily-cost-report": {
            "task": "daily_cost_report",
            "schedule": crontab(hour=7, minute=0),    # 07:00 relatório matinal
        },
        # Cancela cobranças PIX pendentes há mais de 48h
        "cleanup-stale-charges-hourly": {
            "task": "cleanup_stale_charges",
            "schedule": crontab(minute=0),            # todo início de hora
        },
        
        # ── Smart Project Manager Cronjobs ──
        "project-morning-alert": {
            "task": "project_morning_alert",
            "schedule": crontab(hour=8, minute=0),    # 08:00
        },
        "project-midday-check": {
            "task": "project_midday_check",
            "schedule": crontab(hour=12, minute=0),   # 12:00
        },
        "project-evening-summary": {
            "task": "project_evening_summary",
            "schedule": crontab(hour=17, minute=0),   # 17:00
        },
        "project-d3-alert": {
            "task": "project_d3_alert",
            "schedule": crontab(hour=9, minute=0),    # 09:00 (D-3)
        },
        "project-overdue-alert": {
            "task": "project_overdue_alert",
            "schedule": crontab(hour=9, minute=30),   # 09:30 (Atrasados)
        },
    },
)


# ── Worker Process Init Signal ────────────────────────
# Reinitialize SQLAlchemy async engine after Celery ForkPoolWorker fork.
# Fixes: "Future attached to a different loop" — asyncpg connections
# created before fork become invalid in child processes.
from celery.signals import worker_process_init

@worker_process_init.connect
def reset_db_engine(**kwargs):
    """Clear loop-aware caches after fork to ensure fresh engines in child processes."""
    try:
        from app.db import session as db_session
        db_session._engines = {}
        db_session._sessionmakers = {}
        import logging
        logging.getLogger(__name__).info("worker_process_init: DB engine caches cleared")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"worker_process_init: cache clear failed: {e}")
