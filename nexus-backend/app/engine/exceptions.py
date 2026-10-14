"""
NEXUS.IA Flow Engine Exceptions
"""

class WaitingForEvent(Exception):
    """Raised by a wait_event handler to pause execution."""
    def __init__(self, node_id: str, event_name: str):
        self.node_id = node_id
        self.event_name = event_name
        super().__init__(f"Waiting for event: {event_name}")
