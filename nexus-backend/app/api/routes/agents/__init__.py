from .agent_memory import router as agent_router
from .agent_status import router as agent_status_router
from .ollama_train import router as ollama_router
from .knowledge import router as knowledge_router
from .duarte_sync import router as duarte_sync_router

__all__ = ["agent_router", "agent_status_router", "ollama_router", "knowledge_router", "duarte_sync_router"]
