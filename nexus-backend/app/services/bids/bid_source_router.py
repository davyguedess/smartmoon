"""
Orquestrador de fontes de licitações.
Fontes automáticas: apenas PNCP (único com API JSON funcional em 2026-03)
Fontes desabilitadas: ComprasGov (404), PCP (manual_only)
"""
import asyncio
import time
import httpx
from typing import Optional
from loguru import logger

from app.integrations.bids import pncp_connector, comprasgov_connector, pcp_connector

SOURCE_TIMEOUT = 8.0  # segundos por fonte

# Fontes ativas no fluxo automático
AUTO_SOURCES = ["pncp"]


async def _run_source(name: str, coro, timeout: float) -> tuple[str, list[dict], str]:
    """Executa uma fonte com timeout. Retorna (name, results, status)."""
    t0 = time.monotonic()
    try:
        results = await asyncio.wait_for(coro, timeout=timeout)
        elapsed = int((time.monotonic() - t0) * 1000)
        status = "ok" if results else "empty"
        logger.info(f"[SourceRouter] {name}: {len(results)} resultados em {elapsed}ms | status={status}")
        return name, results or [], status
    except asyncio.TimeoutError:
        elapsed = int((time.monotonic() - t0) * 1000)
        logger.warning(f"[SourceRouter] {name}: TIMEOUT após {elapsed}ms")
        return name, [], "timeout"
    except Exception as e:
        elapsed = int((time.monotonic() - t0) * 1000)
        logger.warning(f"[SourceRouter] {name}: ERRO após {elapsed}ms — {type(e).__name__}: {e}")
        return name, [], "error"


async def search_all_sources(
    keywords: Optional[str] = None,
    uf: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    sources: Optional[list[str]] = None,
) -> dict:
    """
    Busca em todas as fontes automáticas em paralelo.
    Usa asyncio.gather com return_exceptions=True para tolerância a falhas.
    Retorna resultado parcial se pelo menos uma fonte responde.
    """
    t_global = time.monotonic()
    active = sources or AUTO_SOURCES

    # Montar coroutines apenas para fontes ativas
    tasks = []
    task_names = []
    for src in active:
        if src == "pncp":
            coro = pncp_connector.search(keywords, uf, data_inicio, data_fim, page, page_size)
        elif src == "comprasgov":
            coro = comprasgov_connector.search(keywords, uf, data_inicio, data_fim, page, page_size)
        elif src == "pcp":
            coro = pcp_connector.search(keywords, uf, data_inicio, data_fim, page, page_size)
        else:
            continue
        tasks.append(_run_source(src, coro, SOURCE_TIMEOUT))
        task_names.append(src)

    # Executar em paralelo — return_exceptions garante que erro numa fonte não cancela as outras
    raw = await asyncio.gather(*tasks, return_exceptions=True)

    all_results: list[dict] = []
    sources_status: dict[str, str] = {}
    partial = False

    # Fontes não-automáticas aparecem no status com their known status
    sources_status["comprasgov"] = comprasgov_connector.get_status()
    sources_status["pcp"] = pcp_connector.get_status()

    for item in raw:
        if isinstance(item, Exception):
            logger.error(f"[SourceRouter] exceção não capturada: {item}")
            partial = True
            continue
        name, results, status = item
        sources_status[name] = status
        all_results.extend(results)
        if status not in ("ok", "empty"):
            partial = True

    # Deduplicar por external_bid_id
    seen_ids: set[str] = set()
    deduped: list[dict] = []
    for bid in all_results:
        bid_id = bid.get("external_bid_id", "")
        key = f"{bid.get('source', '')}:{bid_id}"
        if key not in seen_ids:
            seen_ids.add(key)
            deduped.append(bid)

    total_ms = int((time.monotonic() - t_global) * 1000)
    logger.info(
        f"[SourceRouter] Finalizado: {len(deduped)} únicos em {total_ms}ms | "
        f"partial={partial} | sources={sources_status}"
    )

    return {
        "results": deduped,
        "sources_status": sources_status,
        "partial": partial,
        "total_ms": total_ms,
    }


async def get_source_health() -> dict:
    """
    Health check rápido de cada fonte com ping de 4s.
    Retorna dict flat: { pncp: 'online'|'degraded'|'offline', ... }
    """
    health: dict[str, str] = {
        "comprasgov": comprasgov_connector.get_status(),  # disabled_404
        "pcp": pcp_connector.get_status(),               # manual_only
    }

    # Testar PNCP com ping mínimo
    from datetime import date, timedelta
    hoje = date.today()
    d_ini = (hoje - timedelta(days=3)).strftime("%Y%m%d")
    d_fim = hoje.strftime("%Y%m%d")
    pncp_url = (
        f"https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"
        f"?dataInicial={d_ini}&dataFinal={d_fim}"
        f"&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10"
    )
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            r = await client.get(pncp_url, headers={"Accept": "application/json"})
            if r.status_code in (200, 201):
                health["pncp"] = "online"
            elif r.status_code == 400:
                # 400 com body = API online mas parâmetro diferente
                health["pncp"] = "degraded"
                logger.warning(f"[HealthCheck] PNCP 400: {r.text[:200]}")
            elif r.status_code == 403:
                health["pncp"] = "blocked"
            else:
                health["pncp"] = f"http_{r.status_code}"
    except asyncio.TimeoutError:
        health["pncp"] = "timeout"
    except Exception as e:
        health["pncp"] = "offline"
        logger.warning(f"[HealthCheck] PNCP erro: {e}")

    logger.info(f"[HealthCheck] Resultado: {health}")
    return health
