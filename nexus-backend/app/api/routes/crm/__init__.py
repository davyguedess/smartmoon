"""SmartMoon CRM API — Route aggregator."""
from fastapi import APIRouter

from .contacts import router as contacts_router
from .tags import router as tags_router
from .quick_replies import router as quick_replies_router
from .operators import router as operators_router
from .messages import router as messages_router
from .broadcasts import router as broadcasts_router
from .metrics import router as metrics_router

crm_router = APIRouter(prefix="/crm", tags=["CRM"])

crm_router.include_router(contacts_router)
crm_router.include_router(tags_router)
crm_router.include_router(quick_replies_router)
crm_router.include_router(operators_router)
crm_router.include_router(messages_router)
crm_router.include_router(broadcasts_router)
crm_router.include_router(metrics_router)
