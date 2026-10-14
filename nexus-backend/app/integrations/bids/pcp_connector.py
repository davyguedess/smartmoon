"""
PCP / Portais Municipais — manual_only.
Não existe API JSON pública. Licitações entram via /bids/manual-source/ingest.
"""
from loguru import logger
from typing import Optional


def get_status() -> str:
    return "manual_only"


async def search(
    keywords: Optional[str] = None,
    uf: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    """manual_only — não chamado no fluxo automático."""
    logger.debug("[PCP] manual_only — retornando []")
    return []
