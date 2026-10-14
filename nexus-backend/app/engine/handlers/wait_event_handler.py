"""Wait-for-event handler — pauses execution until an external event resumes it."""
from loguru import logger
from app.engine.handlers.base import BaseNodeHandler
from app.engine.exceptions import WaitingForEvent


class WaitEventHandler(BaseNodeHandler):
    async def execute(self, input_payload: dict) -> dict:
        event_name = self.config.get("event_name") or self.node.get("subtype", "webhook")
        node_id = self.node.get("id")

        logger.info(f"⏳ Node {node_id} waiting for event: {event_name}")
        raise WaitingForEvent(node_id=node_id, event_name=event_name)
