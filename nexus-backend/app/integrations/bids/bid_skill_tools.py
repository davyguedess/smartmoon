"""
NEXUS.IA — Bid Skill Tools
Ferramentas reais para a skill 'bid_analyzer' dos agentes.
Permite que agentes busquem, analisem e reportem licitações.
"""
import json
from typing import Optional
from loguru import logger

from app.services.bids import bid_source_router, bid_analysis_service
from app.services.bids.pncp_connector import PNCPConnector


async def search_bids(keywords: str = "", uf: str = "", modality: str = "", page_size: int = 10) -> dict:
    """Busca licitações por palavras-chave, UF e/ou modalidade."""
    try:
        connector = PNCPConnector()
        results = await connector.search(
            keywords=keywords,
            uf=uf,
            modality=modality,
            page_size=min(page_size, 20),
        )
        # Formatação resumida para o agente
        bids_summary = []
        for bid in results:
            bids_summary.append({
                "id": bid.get("id"),
                "titulo": bid.get("title", "")[:120],
                "orgao": bid.get("organ_name", ""),
                "estado": bid.get("state", ""),
                "municipio": bid.get("municipality", ""),
                "modalidade": bid.get("modality", ""),
                "valor_estimado": bid.get("estimated_value"),
                "prazo": str(bid.get("deadline_date", "")),
                "link_portal": bid.get("source_url", ""),
            })
        return {
            "total_encontrado": len(bids_summary),
            "licitacoes": bids_summary,
            "fonte": "PNCP",
        }
    except Exception as e:
        logger.error(f"[BidSkillTools] search_bids error: {e}")
        return {"error": str(e), "licitacoes": []}


async def get_bid_details(bid_id: int, db=None) -> dict:
    """Retorna detalhes completos de uma licitação pelo ID."""
    try:
        if db:
            from sqlalchemy import select
            from app.models import Bid
            result = await db.execute(select(Bid).where(Bid.id == bid_id))
            bid = result.scalar_one_or_none()
            if bid:
                return {
                    "id": bid.id,
                    "titulo": bid.title,
                    "orgao": bid.organ_name,
                    "estado": bid.state,
                    "municipio": bid.municipality,
                    "modalidade": bid.modality,
                    "objeto": bid.object_text[:500] if bid.object_text else "",
                    "valor_estimado": float(bid.estimated_value) if bid.estimated_value else None,
                    "prazo": str(bid.deadline_date) if bid.deadline_date else "",
                    "publicacao": str(bid.publication_date) if bid.publication_date else "",
                    "link_portal": bid.source_url or "",
                    "score_aderencia": bid.adherence_score,
                    "nivel_aderencia": bid.adherence_level,
                    "has_edital": bid.has_edital,
                }
        return {"error": f"Licitação {bid_id} não encontrada"}
    except Exception as e:
        logger.error(f"[BidSkillTools] get_bid_details error: {e}")
        return {"error": str(e)}


async def analyze_bid_ia(bid_id: int, db=None) -> dict:
    """Executa análise IA de uma licitação e retorna resultado estruturado."""
    try:
        bid_data = await get_bid_details(bid_id, db=db)
        if "error" in bid_data:
            return bid_data

        result = await bid_analysis_service.analyze_bid(bid_data, analysis_level="profunda")
        return {
            "licitacao_id": bid_id,
            "resumo_executivo": result.get("executive_summary", ""),
            "potencial_comercial": result.get("commercial_potential", ""),
            "complexidade": result.get("participation_complexity", ""),
            "requisitos": result.get("main_requirements", []),
            "riscos": result.get("main_risks", []),
            "documentos_necessarios": result.get("documents_needed", []),
            "recomendacao": result.get("recommendation", ""),
            "justificativa": result.get("justification", ""),
        }
    except Exception as e:
        logger.error(f"[BidSkillTools] analyze_bid_ia error: {e}")
        return {"error": str(e)}


async def list_bid_states(db=None) -> dict:
    """Lista estados com licitações e contagem."""
    try:
        if db:
            from sqlalchemy import func, select
            from app.models import Bid
            result = await db.execute(
                select(Bid.state, func.count(Bid.id).label("count"))
                .where(Bid.state.isnot(None))
                .group_by(Bid.state)
                .order_by(func.count(Bid.id).desc())
            )
            states = [{"estado": r.state, "quantidade": r.count} for r in result.all()]
            return {"estados": states, "total_estados": len(states)}
        return {"error": "Database não disponível"}
    except Exception as e:
        logger.error(f"[BidSkillTools] list_bid_states error: {e}")
        return {"error": str(e)}


# Registry — mapa de tool_name → função executora
BID_SKILL_TOOLS = {
    "search_bids": search_bids,
    "get_bid_details": get_bid_details,
    "analyze_bid_ia": analyze_bid_ia,
    "list_bid_states": list_bid_states,
}
