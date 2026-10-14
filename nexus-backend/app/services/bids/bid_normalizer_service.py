"""
Serviço de normalização e deduplicação de licitações de múltiplas fontes.
"""
from typing import Any, Optional
from datetime import datetime
from loguru import logger


SOURCE_PRIORITY = ["pncp", "comprasgov", "pcp"]


def normalize_and_deduplicate(raw_results: list[list[dict]]) -> list[dict]:
    """
    Recebe listas de resultados por fonte (na ordem SOURCE_PRIORITY),
    normaliza campos e remove duplicatas por objeto semântico similar.
    Retorna lista única consolidada.
    """
    seen: dict[str, dict] = {}  # key = (source, external_bid_id)

    for source_idx, source_items in enumerate(raw_results):
        source_name = SOURCE_PRIORITY[source_idx] if source_idx < len(SOURCE_PRIORITY) else f"source_{source_idx}"
        for item in source_items:
            if not item:
                continue
            bid_id = str(item.get("external_bid_id") or "")
            source = item.get("source") or source_name
            key = f"{source}::{bid_id}"

            if key not in seen:
                normalized = _parse_dates(item)
                normalized = _validate_required(normalized)
                if normalized:
                    seen[key] = normalized
                    logger.debug(f"[Normalizer] Ingested {key}")
                else:
                    logger.debug(f"[Normalizer] Dropped invalid bid from {source}: {bid_id}")

    return list(seen.values())


def _parse_dates(item: dict) -> dict:
    """Converte strings de data para datetime quando possível."""
    for field in ("publication_date", "deadline_date"):
        val = item.get(field)
        if isinstance(val, str) and val:
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y%m%d", "%d/%m/%Y"):
                try:
                    item[field] = datetime.strptime(val[:19], fmt)
                    break
                except ValueError:
                    continue
    return item


def _validate_required(item: dict) -> Optional[dict]:
    """Garante que campos mínimos existam. Retorna None se inválido."""
    if not item.get("external_bid_id"):
        return None
    # Garante title não seja None
    if not item.get("title"):
        item["title"] = item.get("object_text", "Objeto não informado")[:300]
    return item


def enrich_with_score_placeholder(item: dict) -> dict:
    """Adiciona placeholders de score para exibição antes da análise completa."""
    item.setdefault("adherence_score", None)
    item.setdefault("adherence_level", None)
    return item
