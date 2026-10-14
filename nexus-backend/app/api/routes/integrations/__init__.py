from .whatsapp import router as whatsapp_router
from .telegram import router as telegram_router
from .zapi_webhook import router as zapi_webhook_router
from .smartmoon_webhook import router as smartmoon_webhook_router
from .connections import router as connections_router
from .google import router as google_router
from .instagram import router as instagram_router
from .instagram_webhook import router as instagram_webhook_router

__all__ = [
    "whatsapp_router",
    "telegram_router",
    "zapi_webhook_router",
    "smartmoon_webhook_router",
    "connections_router",
    "google_router",
    "instagram_router",
    "instagram_webhook_router",
]


