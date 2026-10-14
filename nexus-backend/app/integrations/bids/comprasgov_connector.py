"""
ComprasGov — Fonte desabilitada temporariamente.
Endpoint removido: dadosabertos.compras.gov.br/licitacoes/v1/ retorna 404.
Retorna [] imediatamente para não bloquear a busca agregada.
Status: DISABLED_404
"""
from loguru import logger
from typing import Optional

_STATUS = "disabled_404"


def get_status() -> str:
    return _STATUS


async def search(
    keywords: Optional[str] = None,
    uf: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    """
    Fonte desabilitada — endpoint removido pelo governo (404).
    Retorna [] imediatamente sem chamadas externas.
    Reabilitar quando a URL oficial for restaurada.
    """
    logger.debug("[ComprasGov] fonte desabilitada (404 permanente) — retornando []")
    return []
