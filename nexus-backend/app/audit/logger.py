from loguru import logger
from datetime import datetime
from typing import Any, Dict, Union

class AuditLogger:
    """Simple audit logger that records deployment, feature flag, and rollback events.
    In a real system this would write to a database table `audit_events`.
    Here we log to a structured file using Loguru.
    """

    @staticmethod
    def log_event(event_type: str, details: Union[Dict[str, Any], str]) -> None:
        """Log an audit event.
        Args:
            event_type: Type of the event, e.g. "deployment", "feature_flag_change", "rollback".
            details: Arbitrary details about the event.
        """
        timestamp = datetime.utcnow().isoformat()
        logger.info(f"[AUDIT] {{'timestamp': '{timestamp}', 'event': '{event_type}', 'details': {details}}}")
