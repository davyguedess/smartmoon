"""
Conector PNCP — Portal Nacional de Contratações Públicas
Endpoint: /api/consulta/v1/contratacoes/publicacao
Parâmetros obrigatórios (atualizado 2026-03):
  - dataInicial / dataFinal (YYYYMMDD)
  - codigoModalidadeContratacao (1-13)
  - pagina / tamanhoPagina

Modalidades mais comuns:
  6 = Pregão Eletrônico (mais comum)
  4 = Concorrência
  8 = Dispensa de Licitação
"""
import asyncio
import httpx
import time
from datetime import date, timedelta
from typing import Optional
from loguru import logger

PNCP_BASE = "https://pncp.gov.br/api/consulta/v1"
REQUEST_TIMEOUT = 5.0

# Modalidades a consultar em busca genérica (do mais ao menos comum)
DEFAULT_MODALIDADES = [6, 8, 4]  # Pregão Eletrônico, Dispensa, Concorrência


async def search(
    keywords: Optional[str] = None,
    uf: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict]:
    """
    Busca licitações no PNCP.
    Tenta Pregão Eletrônico (6) primeiro; se vazio, tenta Dispensa (8).
    """
    hoje = date.today()
    d_fim = hoje
    d_ini = hoje - timedelta(days=7)
    fmt_ini = d_ini.strftime("%Y%m%d")
    fmt_fim = d_fim.strftime("%Y%m%d")

    all_results: list[dict] = []

    for modalidade in DEFAULT_MODALIDADES:
        params: dict = {
            "dataInicial": fmt_ini,
            "dataFinal": fmt_fim,
            "codigoModalidadeContratacao": modalidade,
            "pagina": page,
            "tamanhoPagina": max(10, min(page_size, 20)),
        }
        if uf:
            params["uf"] = uf.upper()

        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True,
                headers={"Accept": "application/json", "User-Agent": "SmartMoon/1.0"},
            ) as client:
                resp = await client.get(f"{PNCP_BASE}/contratacoes/publicacao", params=params)
                elapsed = int((time.monotonic() - t0) * 1000)
                logger.info(
                    f"[PNCP] modalidade={modalidade} | status={resp.status_code} | {elapsed}ms | uf={uf} | params={params}"
                )

                if resp.status_code == 400:
                    body = resp.text[:300]
                    logger.warning(f"[PNCP] 400 Bad Request — body: {body}")
                    continue  # tenta próxima modalidade

                if resp.status_code == 404:
                    logger.warning(f"[PNCP] 404 — endpoint indisponível")
                    break

                if resp.status_code not in (200, 201):
                    logger.warning(f"[PNCP] status inesperado: {resp.status_code}")
                    continue

                data = resp.json()

        except asyncio.TimeoutError:
            elapsed = int((time.monotonic() - t0) * 1000)
            logger.warning(f"[PNCP] TIMEOUT após {elapsed}ms (modalidade={modalidade})")
            break  # timeout já esgotou o budget — para
        except httpx.HTTPError as e:
            logger.warning(f"[PNCP] HTTP error: {e}")
            continue
        except Exception as e:
            logger.error(f"[PNCP] Erro inesperado: {e}")
            continue

        items = (
            data if isinstance(data, list)
            else data.get("data", data.get("items", data.get("content", [])))
        )
        if not items:
            logger.info(f"[PNCP] modalidade={modalidade}: 0 itens")
            continue

        # Filtro client-side por keyword
        if keywords:
            kws = [k.lower() for k in keywords.split() if len(k) > 2]
            if kws:
                filtered = [
                    item for item in items
                    if any(k in (
                        str(item.get("objetoCompra", "")) + str(item.get("descricao", ""))
                    ).lower() for k in kws)
                ]
                items = filtered or items

        normalized = [_normalize(item) for item in items if item]
        all_results.extend(normalized)
        logger.info(f"[PNCP] modalidade={modalidade}: {len(normalized)} resultados acumulados")

        # Se já tem resultados suficientes, não precisa buscar mais modalidades
        if len(all_results) >= page_size:
            break

    return all_results[:page_size]


def _normalize(raw: dict) -> dict:
    return {
        "source": "pncp",
        "external_bid_id": str(
            raw.get("numeroControlePNCP") or raw.get("id", "")
        ),
        "source_url": f"https://pncp.gov.br/app/editais/{raw.get('numeroControlePNCP', '')}",
        "raw_payload_json": raw,
        "organ_name": (
            raw.get("unidadeOrgao", {}).get("nomeUnidade")
            or raw.get("orgaoEntidade", {}).get("razaoSocial", "")
        ),
        "municipality": (
            raw.get("municipioNome")
            or raw.get("unidadeOrgao", {}).get("municipioNome", "")
        ),
        "state": (
            raw.get("uf")
            or raw.get("unidadeOrgao", {}).get("ufSigla", "")
        ),
        "scope_level": "municipal",
        "title": raw.get("objetoCompra") or raw.get("titulo", ""),
        "object_text": raw.get("objetoCompra") or raw.get("descricao", ""),
        "modality": raw.get("modalidadeNome") or str(raw.get("modalidade", "")),
        "estimated_value": _parse_float(
            raw.get("valorTotalEstimado") or raw.get("valor")
        ),
        "publication_date": _parse_date(raw.get("dataPublicacaoPncp") or raw.get("dataPublicacao")),
        "deadline_date": _parse_date(raw.get("dataEncerramentoProposta") or raw.get("dataLimite")),
        "status": "published",
        "has_edital": bool(raw.get("linkEdital") or raw.get("existeEdital")),
    }


def _parse_float(val) -> Optional[float]:
    try:
        return float(str(val).replace(",", ".").replace("R$", "").strip())
    except Exception:
        return None


def _parse_date(val):
    """Convert ISO date string to datetime object (SQLAlchemy expects datetime, not str)."""
    if val is None:
        return None
    if isinstance(val, (date,)):
        return val
    try:
        from datetime import datetime
        # Handle ISO formats: "2026-03-20T00:00:03", "2026-03-20"
        s = str(val).strip()
        if "T" in s:
            return datetime.fromisoformat(s)
        return datetime.strptime(s, "%Y-%m-%d")
    except Exception:
        return None
