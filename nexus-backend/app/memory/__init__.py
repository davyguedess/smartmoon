"""
NEXUS.IA — Memory module facade.

Re-exports all public functions from memory_service so other modules can use:

    from app.memory import build_context, maybe_summarize, extract_facts
"""
from app.services.memory_service import (
    build_context,
    maybe_summarize,
    extract_facts,
    cleanup_expired,
    _estimate_tokens,
)

__all__ = [
    "build_context",
    "maybe_summarize",
    "extract_facts",
    "cleanup_expired",
    "_estimate_tokens",
]
