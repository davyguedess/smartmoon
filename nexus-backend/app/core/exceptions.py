from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger


class NexusException(HTTPException):
    """Base exception for NEXUS.IA domain errors."""
    pass


class FlowNotFound(NexusException):
    def __init__(self, flow_id):
        super().__init__(status_code=404, detail=f"Fluxo {flow_id} não encontrado")


class ExecutionNotFound(NexusException):
    def __init__(self, exec_id):
        super().__init__(status_code=404, detail=f"Execução {exec_id} não encontrada")


class IntegrationError(NexusException):
    def __init__(self, provider: str, detail: str):
        super().__init__(status_code=502, detail=f"Erro na integração {provider}: {detail}")


async def nexus_exception_handler(request: Request, exc: NexusException):
    logger.warning(f"NexusException [{exc.status_code}]: {exc.detail} — {request.url}")
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"error": "Erro interno do servidor"})
