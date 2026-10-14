"""Base node handler — all handlers inherit from this."""
from abc import ABC, abstractmethod
from typing import Optional


class BaseNodeHandler(ABC):
    def __init__(self, node: dict, context: dict, settings_ref: dict):
        self.node = node
        self.context = context
        self.config = settings_ref

    async def execute(self, input_payload: dict) -> dict:
        """Override this to implement node logic. Return output dict merged into context."""
        return {}
