"""
Ingestão de licitações por URL de portal municipal/estadual.
O usuário cola a URL do portal → o sistema tenta extrair licitações via scraping.
"""
import re
import httpx
from typing import Optional
from loguru import logger
from datetime import datetime


REQUEST_TIMEOUT = 15.0

# Padrões comuns em portais de licitação
BID_KEYWORDS = [
    "licitação", "licitacoes", "pregão", "concorrência", "objeto",
    "valor", "edital", "data", "órgão", "abertura"
]


async def ingest_from_url(
    url: str,
    company_id: int,
    source_name: str,
    db=None,  # AsyncSession opcional para salvar
) -> dict:
    """
    Extrai licitações de qualquer URL de portal municipal/estadual.
    Retorna: { success, items_found, items_saved, error }
    """
    logger.info(f"[ManualPortal] Iniciando ingestão: {url}")

    # 1. Buscar o HTML da página
    html = await _fetch_html(url)
    if not html:
        return {"success": False, "items_found": 0, "items_saved": 0, "error": "Página inacessível"}

    # 2. Extrair licitações do HTML
    items = _extract_bids(html, url, source_name)
    logger.info(f"[ManualPortal] Extraídos {len(items)} itens de {url}")

    # 3. Salvar no banco se possível
    saved = 0
    if db and items:
        saved = await _save_items(items, company_id, db)

    return {
        "success": True,
        "items_found": len(items),
        "items_saved": saved,
        "items": items[:10],  # preview dos primeiros 10
        "error": None,
    }


async def _fetch_html(url: str) -> Optional[str]:
    """Busca HTML da página com timeout."""
    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; SmartMoon/1.0; +https://smartmoon.online)",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "pt-BR,pt;q=0.9",
            },
        ) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                logger.warning(f"[ManualPortal] {url} retornou {resp.status_code}")
                return None
            return resp.text
    except Exception as e:
        logger.warning(f"[ManualPortal] Erro ao buscar {url}: {e}")
        return None


def _extract_bids(html: str, base_url: str, source_name: str) -> list[dict]:
    """
    Extrator heurístico de licitações em HTML.
    Funciona com BeautifulSoup se disponível, fallback para regex.
    """
    try:
        from bs4 import BeautifulSoup
        return _extract_with_bs4(html, base_url, source_name)
    except ImportError:
        logger.warning("[ManualPortal] BeautifulSoup não disponível — usando regex")
        return _extract_with_regex(html, base_url, source_name)


def _extract_with_bs4(html: str, base_url: str, source_name: str) -> list[dict]:
    """Extração com BeautifulSoup — mais precisa."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    items = []

    # Estratégia 1: tabelas com palavras-chave de licitação
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]
        is_bid_table = any(kw in " ".join(headers) for kw in BID_KEYWORDS)
        if not is_bid_table:
            continue
        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if not cells or len(cells) < 2:
                continue
            link = row.find("a")
            items.append({
                "source": "pcp",
                "external_bid_id": f"manual_{hash(str(cells))%999999}",
                "source_url": _absolute_url(link["href"] if link and link.get("href") else base_url, base_url),
                "organ_name": source_name,
                "title": cells[0] if cells else "Licitação",
                "object_text": " | ".join(cells[:4]),
                "municipality": "",
                "state": "",
                "scope_level": "municipal",
                "modality": _guess_modality(" ".join(cells)),
                "estimated_value": _extract_value(" ".join(cells)),
                "publication_date": _extract_date(" ".join(cells)),
                "status": "published",
                "has_edital": bool(link),
                "raw_payload_json": {"cells": cells, "source_url": base_url},
            })

    # Estratégia 2: links com texto de licitação
    if not items:
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True).lower()
            if any(kw in text for kw in ["licitação", "pregão", "edital", "concorrência"]):
                href = _absolute_url(link["href"], base_url)
                items.append({
                    "source": "pcp",
                    "external_bid_id": f"manual_{hash(href)%999999}",
                    "source_url": href,
                    "organ_name": source_name,
                    "title": link.get_text(strip=True)[:200],
                    "object_text": link.get_text(strip=True),
                    "municipality": "",
                    "state": "",
                    "scope_level": "municipal",
                    "modality": _guess_modality(text),
                    "estimated_value": None,
                    "publication_date": None,
                    "status": "published",
                    "has_edital": True,
                    "raw_payload_json": {"href": href, "source_url": base_url},
                })

    return items[:50]  # máximo 50 por run


def _extract_with_regex(html: str, base_url: str, source_name: str) -> list[dict]:
    """Fallback: extrai links de edital via regex."""
    items = []
    links = re.findall(r'href=["\']([^"\']*(?:licitacao|pregao|edital|concorrencia)[^"\']*)["\']', html, re.IGNORECASE)
    for href in links[:20]:
        url_abs = _absolute_url(href, base_url)
        items.append({
            "source": "pcp",
            "external_bid_id": f"manual_{hash(url_abs)%999999}",
            "source_url": url_abs,
            "organ_name": source_name,
            "title": f"Licitação encontrada em {source_name}",
            "object_text": href,
            "municipality": "",
            "state": "",
            "scope_level": "municipal",
            "modality": "",
            "estimated_value": None,
            "publication_date": None,
            "status": "published",
            "has_edital": True,
            "raw_payload_json": {"href": href, "source_url": base_url},
        })
    return items


def _absolute_url(href: str, base_url: str) -> str:
    if href.startswith("http"):
        return href
    from urllib.parse import urljoin
    return urljoin(base_url, href)


def _guess_modality(text: str) -> str:
    text = text.lower()
    if "pregão eletrônico" in text or "pregao eletronico" in text:
        return "Pregão Eletrônico"
    if "pregão" in text or "pregao" in text:
        return "Pregão"
    if "concorrência" in text or "concorrencia" in text:
        return "Concorrência"
    if "tomada" in text:
        return "Tomada de Preços"
    if "dispensa" in text:
        return "Dispensa"
    return ""


def _extract_value(text: str) -> Optional[float]:
    match = re.search(r"R\$\s*([\d.,]+)", text)
    if match:
        try:
            return float(match.group(1).replace(".", "").replace(",", "."))
        except Exception:
            pass
    return None


def _extract_date(text: str) -> Optional[str]:
    match = re.search(r"(\d{2}/\d{2}/\d{4})", text)
    if match:
        try:
            d = datetime.strptime(match.group(1), "%d/%m/%Y")
            return d.strftime("%Y-%m-%d")
        except Exception:
            pass
    return None


async def _save_items(items: list[dict], company_id: int, db) -> int:
    """Salva itens no banco evitando duplicatas."""
    saved = 0
    from sqlalchemy import text
    for item in items:
        try:
            await db.execute(
                text("""
                    INSERT INTO public_bids
                      (company_id, source, external_bid_id, source_url, organ_name,
                       title, object_text, municipality, state, scope_level, modality,
                       estimated_value, publication_date, has_edital, status, raw_payload_json, created_at)
                    VALUES
                      (:company_id, :source, :external_bid_id, :source_url, :organ_name,
                       :title, :object_text, :municipality, :state, :scope_level, :modality,
                       :estimated_value, :publication_date, :has_edital, :status, :raw_payload_json::jsonb, now())
                    ON CONFLICT DO NOTHING
                """),
                {**item, "company_id": company_id, "raw_payload_json": str(item.get("raw_payload_json", {}))}
            )
            saved += 1
        except Exception as e:
            logger.warning(f"[ManualPortal] Erro ao salvar item: {e}")
    await db.commit()
    return saved
