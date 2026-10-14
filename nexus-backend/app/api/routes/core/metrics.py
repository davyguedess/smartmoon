"""
NEXUS.IA — /system metrics (PROTEGIDO)
Returns real-time CPU, RAM, disk usage.
Requer autenticação de superadmin para evitar information disclosure.
"""
import psutil
from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, require_superadmin

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/metrics")
async def get_metrics(user=Depends(require_superadmin)):
    """Returns live CPU %, RAM %, disk %. Somente superadmin."""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    cpu = psutil.cpu_percent(interval=0.2)

    return {
        "cpu": {
            "percent": cpu,
            "cores": psutil.cpu_count(logical=False),
            "threads": psutil.cpu_count(logical=True),
        },
        "ram": {
            "percent": mem.percent,
            "used_gb": round(mem.used / 1e9, 2),
            "total_gb": round(mem.total / 1e9, 2),
            "available_gb": round(mem.available / 1e9, 2),
        },
        "disk": {
            "percent": disk.percent,
            "used_gb": round(disk.used / 1e9, 1),
            "total_gb": round(disk.total / 1e9, 1),
        },
    }
