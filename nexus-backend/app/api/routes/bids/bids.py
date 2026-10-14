"""
Rotas do módulo Radar de Licitações IA
Prefixo: /bids
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, desc
from typing import Optional
from loguru import logger

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.licitacao import (
    PublicBid, PublicBidAnalysis, PublicBidTopic,
    PublicBidAlert, NicheProfile, PublicBidAction,
    AdherenceLevel, BidActionType,
)
from app.services.bids import bid_source_router, bid_scoring_service, bid_analysis_service
from app.services.bids import edital_analyzer
from app.integrations.bids import manual_portal_ingestion, edital_downloader

router = APIRouter(prefix="/bids", tags=["Radar de Licitações"])


# ─── DASHBOARD ─────────────────────────────────────────────────────────────

@router.get("/dashboard/overview")
async def dashboard_overview(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    cid = user.company_id
    bids_total = (await db.execute(
        text("SELECT COUNT(*) FROM public_bids WHERE company_id=:cid"), {"cid": cid}
    )).scalar_one()
    high_score = (await db.execute(
        text("SELECT COUNT(*) FROM public_bids WHERE company_id=:cid AND adherence_score >= 75"), {"cid": cid}
    )).scalar_one()
    alerts_active = (await db.execute(
        text("SELECT COUNT(*) FROM public_bid_alerts WHERE company_id=:cid AND is_active=true"), {"cid": cid}
    )).scalar_one()
    niches_total = (await db.execute(
        text("SELECT COUNT(*) FROM niche_profiles WHERE company_id=:cid"), {"cid": cid}
    )).scalar_one()
    saved = (await db.execute(
        text("SELECT COUNT(DISTINCT public_bid_id) FROM public_bid_actions WHERE company_id=:cid AND action_type='saved'"), {"cid": cid}
    )).scalar_one()
    discarded = (await db.execute(
        text("SELECT COUNT(DISTINCT public_bid_id) FROM public_bid_actions WHERE company_id=:cid AND action_type='discarded'"), {"cid": cid}
    )).scalar_one()
    # Pending = bids sem nenhuma ação (saved/discarded)
    pending = (await db.execute(
        text("""
            SELECT COUNT(*) FROM public_bids pb
            WHERE pb.company_id=:cid
            AND NOT EXISTS (
                SELECT 1 FROM public_bid_actions pba
                WHERE pba.public_bid_id = pb.id
                AND pba.company_id = :cid
                AND pba.action_type IN ('saved', 'discarded')
            )
        """), {"cid": cid}
    )).scalar_one()
    by_state_rows = (await db.execute(
        text("SELECT state, COUNT(*) as cnt FROM public_bids WHERE company_id=:cid GROUP BY state ORDER BY cnt DESC LIMIT 10"), {"cid": cid}
    )).fetchall()
    by_modality_rows = (await db.execute(
        text("SELECT modality, COUNT(*) as cnt FROM public_bids WHERE company_id=:cid GROUP BY modality ORDER BY cnt DESC LIMIT 5"), {"cid": cid}
    )).fetchall()

    return {
        "total_bids": bids_total,
        "high_score_bids": high_score,
        "alerts_active": alerts_active,
        "niches_total": niches_total,
        "saved": saved,
        "discarded": discarded,
        "pending": pending,
        "by_state": [{"state": r.state, "count": r.cnt} for r in by_state_rows],
        "by_modality": [{"modality": r.modality, "count": r.cnt} for r in by_modality_rows],
    }


# ─── STATUS DAS FONTES ─────────────────────────────────────────────────────

@router.get("/sources/status")
async def sources_status(user=Depends(get_current_user)):
    """Retorna status de cada fonte (pncp, comprasgov, pcp)."""
    health = await bid_source_router.get_source_health()
    return health  # retorna flat: {"pncp": "online", ...}


@router.post("/manual-source/ingest")
async def ingest_manual_source(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Extrai licitações de uma URL de portal municipal/estadual.
    Body: { url: str, source_name: str }
    """
    url = payload.get("url", "").strip()
    source_name = payload.get("source_name", url)
    if not url or not url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL inválida — deve começar com http")

    result = await manual_portal_ingestion.ingest_from_url(
        url=url,
        company_id=user.company_id,
        source_name=source_name,
        db=db,
    )
    return result


@router.get("/manual-source/history")
async def manual_source_history(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista portais adicionados manualmente."""
    rows = (await db.execute(
        text("SELECT * FROM manual_bid_sources WHERE company_id=:cid ORDER BY created_at DESC LIMIT 20"),
        {"cid": user.company_id},
    )).fetchall()
    return [{"id": r.id, "source_name": r.source_name, "url": r.source_url, "status": r.status, "last_result_count": r.last_result_count} for r in rows]


@router.post("/sources/{source}/sync")
async def sync_source(
    source: str,
    keywords: Optional[str] = Query(None),
    uf: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Dispara sincronização manual de uma fonte específica."""
    enabled = [source] if source in ("pncp", "comprasgov", "pcp") else None
    if not enabled:
        raise HTTPException(400, f"Fonte '{source}' não reconhecida")
    results = await bid_source_router.search_all_sources(keywords=keywords, uf=uf, sources=enabled)
    saved = await _persist_bids(results, user.company_id, db)
    return {"source": source, "fetched": len(results), "saved_new": saved}


# ─── ALERTAS (ANTES de /{bid_id} para evitar conflito) ────────────────────

@router.get("/alerts")
async def list_alerts(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    q = select(PublicBidAlert).where(PublicBidAlert.company_id == user.company_id)
    rows = (await db.execute(q)).scalars().all()
    return [_alert_to_dict(a) for a in rows]


@router.post("/alerts")
async def create_alert(payload: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    alert = PublicBidAlert(
        company_id=user.company_id,
        created_by=user.id,
        **{k: v for k, v in payload.items() if k not in ("id", "company_id", "created_by")},
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _alert_to_dict(alert)


@router.patch("/alerts/{alert_id}")
async def update_alert(alert_id: int, payload: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    alert = await db.get(PublicBidAlert, alert_id)
    if not alert or alert.company_id != user.company_id:
        raise HTTPException(404, "Alerta não encontrado")
    for k, v in payload.items():
        if hasattr(alert, k) and k not in ("id", "company_id"):
            setattr(alert, k, v)
    await db.commit()
    return _alert_to_dict(alert)


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    alert = await db.get(PublicBidAlert, alert_id)
    if not alert or alert.company_id != user.company_id:
        raise HTTPException(404, "Alerta não encontrado")
    await db.delete(alert)
    await db.commit()
    return {"ok": True}


# ─── NICHOS (ANTES de /{bid_id} para evitar conflito) ─────────────────────

@router.get("/niches")
async def list_niches(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    q = select(NicheProfile).where(NicheProfile.company_id == user.company_id)
    rows = (await db.execute(q)).scalars().all()
    return [_niche_to_dict(n) for n in rows]


@router.post("/niches")
async def create_niche(payload: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    niche = NicheProfile(
        company_id=user.company_id,
        **{k: v for k, v in payload.items() if k not in ("id", "company_id")},
    )
    db.add(niche)
    await db.commit()
    await db.refresh(niche)
    return _niche_to_dict(niche)


@router.patch("/niches/{niche_id}")
async def update_niche(niche_id: int, payload: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    niche = await db.get(NicheProfile, niche_id)
    if not niche or niche.company_id != user.company_id:
        raise HTTPException(404, "Nicho não encontrado")
    for k, v in payload.items():
        if hasattr(niche, k) and k not in ("id", "company_id"):
            setattr(niche, k, v)
    await db.commit()
    return _niche_to_dict(niche)


@router.delete("/niches/{niche_id}")
async def delete_niche(niche_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    niche = await db.get(NicheProfile, niche_id)
    if not niche or niche.company_id != user.company_id:
        raise HTTPException(404, "Nicho não encontrado")
    await db.delete(niche)
    await db.commit()
    return {"ok": True}


# ─── BUSCA E LISTAGEM ──────────────────────────────────────────────────────

@router.get("/search-results")
async def list_bids(
    source: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    modality: Optional[str] = Query(None),
    score_min: Optional[float] = Query(None),
    with_edital: Optional[bool] = Query(None),
    action: Optional[str] = Query(None, description="Filter: saved, discarded, pending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Lista licitações já importadas no banco com filtros."""
    cid = user.company_id
    q = select(PublicBid).where(PublicBid.company_id == cid)
    if source:
        q = q.where(PublicBid.source == source)
    if state:
        q = q.where(PublicBid.state == state.upper())
    if modality:
        q = q.where(PublicBid.modality.ilike(f"%{modality}%"))
    if score_min is not None:
        q = q.where(PublicBid.adherence_score >= score_min)
    if with_edital is not None:
        q = q.where(PublicBid.has_edital == with_edital)
    # Filtro por ação do usuário
    if action == 'saved':
        q = q.where(PublicBid.id.in_(
            select(PublicBidAction.public_bid_id).where(
                PublicBidAction.company_id == cid,
                PublicBidAction.action_type == 'saved',
            )
        ))
    elif action == 'discarded':
        q = q.where(PublicBid.id.in_(
            select(PublicBidAction.public_bid_id).where(
                PublicBidAction.company_id == cid,
                PublicBidAction.action_type == 'discarded',
            )
        ))
    elif action == 'pending':
        q = q.where(~PublicBid.id.in_(
            select(PublicBidAction.public_bid_id).where(
                PublicBidAction.company_id == cid,
                PublicBidAction.action_type.in_(['saved', 'discarded']),
            )
        ))
    q = q.order_by(desc(PublicBid.adherence_score), desc(PublicBid.created_at))
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    # Enrich with action status
    bid_dicts = [_bid_to_dict(b) for b in rows]
    if bid_dicts:
        bid_ids = [b['id'] for b in bid_dicts]
        actions_rows = (await db.execute(
            text("""
                SELECT DISTINCT ON (public_bid_id) public_bid_id, action_type
                FROM public_bid_actions
                WHERE company_id = :cid AND public_bid_id = ANY(:ids)
                AND action_type IN ('saved', 'discarded')
                ORDER BY public_bid_id, created_at DESC
            """),
            {"cid": cid, "ids": bid_ids},
        )).fetchall()
        action_map = {r.public_bid_id: r.action_type for r in actions_rows}
        for b in bid_dicts:
            b['user_action'] = action_map.get(b['id'])
    return bid_dicts


@router.post("/search")
async def search_bids(
    keywords: Optional[str] = Body(None),
    uf: Optional[str] = Body(None),
    data_inicio: Optional[str] = Body(None),
    data_fim: Optional[str] = Body(None),
    page: int = Body(1),
    page_size: int = Body(20),
    save_results: bool = Body(False),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Busca ao vivo nas fontes e opcionalmente salva no banco."""
    search_result = await bid_source_router.search_all_sources(
        keywords=keywords, uf=uf,
        data_inicio=data_inicio, data_fim=data_fim,
        page=page, page_size=page_size,
    )
    results = search_result.get("results", [])
    sources_status = search_result.get("sources_status", {})
    partial = search_result.get("partial", False)
    total_ms = search_result.get("total_ms", 0)

    # Persist and score — wrapped in try/catch so DB errors don't kill the response
    try:
        if save_results and results:
            await _persist_bids(results, user.company_id, db)
    except Exception as e:
        from loguru import logger
        logger.warning(f"[BidsSearch] Erro ao persistir resultados: {e}")
        # rollback para limpar a sessão
        await db.rollback()

    try:
        niche = await _get_first_niche(user.company_id, db)
        for r in results:
            scored = bid_scoring_service.calculate_score(r, niche)
            r["adherence_score"] = scored["score"]
            r["adherence_level"] = scored["level"]
    except Exception as e:
        from loguru import logger
        logger.warning(f"[BidsSearch] Erro ao calcular scores: {e}")

    return {
        "total": len(results),
        "results": results,
        "sources_status": sources_status,
        "partial": partial,
        "total_ms": total_ms,
    }


# ─── DETALHE (rotas dinâmicas /{bid_id} SEMPRE por último) ─────────────────

@router.get("/{bid_id}")
async def get_bid(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")
    return _bid_to_dict(bid)


# ─── EDITAL: DOWNLOAD + ANÁLISE PROFUNDA ───────────────────────────────────

@router.post("/{bid_id}/download-edital")
async def download_edital(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Baixa o edital PDF do PNCP e extrai o texto."""
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")

    bid_data = _bid_to_dict(bid)
    result = await edital_downloader.download_for_bid(bid_data)
    if not result:
        raise HTTPException(404, "Não foi possível baixar o edital desta licitação")
    if result.get("error"):
        raise HTTPException(400, result["error"])

    # Salva texto no banco para reutilização
    try:
        await db.execute(
            text("UPDATE public_bids SET edital_text = :txt WHERE id = :bid_id"),
            {"txt": (result.get("text_content") or "")[:500000], "bid_id": bid_id},
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"[Edital] Erro ao salvar texto no banco: {e}")
        await db.rollback()

    return {
        "bid_id": bid_id,
        "filename": result.get("filename"),
        "file_size": result.get("file_size"),
        "text_length": result.get("text_length", 0),
        "text_preview": (result.get("text_content") or "")[:2000],
        "arquivos_disponiveis": result.get("arquivos_disponiveis", []),
        "status": "downloaded",
    }


@router.get("/{bid_id}/edital")
async def get_edital_text(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Retorna o texto do edital já baixado."""
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")

    # Busca texto salvo no banco
    row = await db.execute(
        text("SELECT edital_text FROM public_bids WHERE id = :bid_id"),
        {"bid_id": bid_id}
    )
    edital_text = row.scalar_one_or_none()
    if not edital_text:
        raise HTTPException(404, "Edital ainda não foi baixado — clique em 'Baixar Edital' primeiro")

    return {
        "bid_id": bid_id,
        "text_content": edital_text,
        "text_length": len(edital_text),
    }


@router.post("/{bid_id}/edital/analyze")
async def analyze_edital_route(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Análise profunda do edital com IA — retorna checklist de exigências."""
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")

    # Busca texto do edital
    row = await db.execute(
        text("SELECT edital_text FROM public_bids WHERE id = :bid_id"),
        {"bid_id": bid_id}
    )
    edital_text = row.scalar_one_or_none()
    if not edital_text:
        raise HTTPException(400, "Baixe o edital primeiro antes de analisar")

    # Analisa com IA
    bid_info = _bid_to_dict(bid)
    result = await edital_analyzer.analyze_edital(edital_text, bid_info)

    # Registra ação
    try:
        db.add(PublicBidAction(
            public_bid_id=bid_id, company_id=user.company_id,
            action_type="analyzed", created_by=user.id,
            note="edital_deep_analysis",
        ))
        await db.commit()
    except Exception:
        await db.rollback()

    return {
        "bid_id": bid_id,
        "analysis": result,
    }


# ─── ANÁLISE IA (BÁSICA) ───────────────────────────────────────────────────

@router.post("/{bid_id}/analyze")
async def analyze_bid(
    bid_id: int,
    analysis_level: str = Body("preliminar", embed=True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")

    result = await bid_analysis_service.analyze_bid(_bid_to_dict(bid), analysis_level)

    analysis = PublicBidAnalysis(
        company_id=user.company_id,
        public_bid_id=bid_id,
        analysis_level=analysis_level,
        executive_summary=result.get("executive_summary"),
        adherence_score=result.get("adherence_score"),
        commercial_potential=result.get("commercial_potential"),
        participation_complexity=result.get("participation_complexity"),
        main_requirements=result.get("main_requirements", []),
        main_risks=result.get("main_risks", []),
        documents_needed=result.get("documents_needed", []),
        recommendation=result.get("recommendation"),
        justification=result.get("justification"),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    db.add(PublicBidAction(
        public_bid_id=bid_id, company_id=user.company_id,
        action_type="analyzed", created_by=user.id,
    ))
    await db.commit()
    return _analysis_to_dict(analysis)


@router.get("/{bid_id}/analysis")
async def get_bid_analysis(
    bid_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = (
        select(PublicBidAnalysis)
        .where(PublicBidAnalysis.public_bid_id == bid_id)
        .where(PublicBidAnalysis.company_id == user.company_id)
        .order_by(desc(PublicBidAnalysis.created_at))
    )
    analysis = (await db.execute(q)).scalars().first()
    if not analysis:
        raise HTTPException(404, "Análise não encontrada — clique em 'Analisar com IA'")
    return _analysis_to_dict(analysis)


@router.post("/{bid_id}/score")
async def score_bid(
    bid_id: int,
    niche_id: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")
    niche = None
    if niche_id:
        niche_obj = await db.get(NicheProfile, niche_id)
        if niche_obj and niche_obj.company_id == user.company_id:
            niche = _niche_to_dict(niche_obj)
    else:
        niche = await _get_first_niche(user.company_id, db)

    result = bid_scoring_service.calculate_score(_bid_to_dict(bid), niche)
    bid.adherence_score = result["score"]
    bid.adherence_level = result["level"]
    await db.commit()
    return result


# ─── AÇÕES INTERNAS ────────────────────────────────────────────────────────

@router.post("/{bid_id}/save")
async def save_bid(bid_id: int, payload: dict = Body(default={}), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    return await _record_action(bid_id, "saved", payload.get("note"), db, user)


@router.post("/{bid_id}/discard")
async def discard_bid(bid_id: int, payload: dict = Body(default={}), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    return await _record_action(bid_id, "discarded", payload.get("note"), db, user)


@router.post("/{bid_id}/mark-for-review")
async def mark_for_review(bid_id: int, payload: dict = Body(default={}), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    return await _record_action(bid_id, "assigned", payload.get("note"), db, user)


# ─── HELPERS ──────────────────────────────────────────────────────────────

async def _persist_bids(results: list[dict], company_id: int, db: AsyncSession) -> int:
    saved = 0
    for item in results:
        existing = (await db.execute(
            text("SELECT id FROM public_bids WHERE company_id=:cid AND source=:src AND external_bid_id=:eid"),
            {"cid": company_id, "src": item.get("source"), "eid": item.get("external_bid_id")},
        )).fetchone()
        if existing:
            # Injeta o ID existente no resultado para navegação no frontend
            item["id"] = existing.id
            continue
        bid = PublicBid(company_id=company_id, **{
            k: v for k, v in item.items()
            if hasattr(PublicBid, k) and k not in ("id",)
        })
        db.add(bid)
        saved += 1
    if saved:
        await db.commit()
        # Injeta IDs dos novos bids salvos
        for item in results:
            if "id" not in item or item.get("id") is None:
                row = (await db.execute(
                    text("SELECT id FROM public_bids WHERE company_id=:cid AND source=:src AND external_bid_id=:eid"),
                    {"cid": company_id, "src": item.get("source"), "eid": item.get("external_bid_id")},
                )).fetchone()
                if row:
                    item["id"] = row.id
    return saved


async def _get_first_niche(company_id: int, db: AsyncSession) -> Optional[dict]:
    q = select(NicheProfile).where(NicheProfile.company_id == company_id).limit(1)
    niche = (await db.execute(q)).scalars().first()
    return _niche_to_dict(niche) if niche else None


async def _record_action(bid_id: int, action_type: str, note: Optional[str], db: AsyncSession, user) -> dict:
    bid = await db.get(PublicBid, bid_id)
    if not bid or bid.company_id != user.company_id:
        raise HTTPException(404, "Licitação não encontrada")
    action = PublicBidAction(
        public_bid_id=bid_id, company_id=user.company_id,
        action_type=action_type, note=note, created_by=user.id,
    )
    db.add(action)
    await db.commit()
    return {"ok": True, "action": action_type, "bid_id": bid_id}


def _bid_to_dict(b: PublicBid) -> dict:
    return {
        "id": b.id,
        "source": b.source,
        "external_bid_id": b.external_bid_id,
        "source_url": b.source_url,
        "organ_name": b.organ_name,
        "municipality": b.municipality,
        "state": b.state,
        "scope_level": b.scope_level,
        "title": b.title,
        "object_text": b.object_text,
        "modality": b.modality,
        "estimated_value": b.estimated_value,
        "publication_date": str(b.publication_date) if b.publication_date else None,
        "deadline_date": str(b.deadline_date) if b.deadline_date else None,
        "status": b.status,
        "has_edital": b.has_edital,
        "adherence_score": b.adherence_score,
        "adherence_level": b.adherence_level,
        "created_at": str(b.created_at) if b.created_at else None,
    }


def _analysis_to_dict(a: PublicBidAnalysis) -> dict:
    return {
        "id": a.id,
        "public_bid_id": a.public_bid_id,
        "analysis_level": a.analysis_level,
        "executive_summary": a.executive_summary,
        "adherence_score": a.adherence_score,
        "adherence_level": a.adherence_level,
        "commercial_potential": a.commercial_potential,
        "participation_complexity": a.participation_complexity,
        "main_requirements": a.main_requirements,
        "main_risks": a.main_risks,
        "documents_needed": a.documents_needed,
        "recommendation": a.recommendation,
        "justification": a.justification,
        "created_at": str(a.created_at) if a.created_at else None,
    }


def _alert_to_dict(a: PublicBidAlert) -> dict:
    return {
        "id": a.id, "name": a.name, "niche_id": a.niche_id,
        "state": a.state, "municipality": a.municipality, "modality": a.modality,
        "min_value": a.min_value, "max_value": a.max_value, "score_min": a.score_min,
        "only_with_edital": a.only_with_edital, "keywords": a.keywords,
        "delivery_channel": a.delivery_channel, "is_active": a.is_active,
        "created_at": str(a.created_at) if a.created_at else None,
    }


def _niche_to_dict(n: NicheProfile) -> dict:
    return {
        "id": n.id, "name": n.name,
        "positive_keywords_json": n.positive_keywords_json or [],
        "negative_keywords_json": n.negative_keywords_json or [],
        "cnaes_json": n.cnaes_json or [],
        "preferred_organs_json": n.preferred_organs_json or [],
        "preferred_regions_json": n.preferred_regions_json or [],
        "ideal_value_min": n.ideal_value_min,
        "ideal_value_max": n.ideal_value_max,
        "created_at": str(n.created_at) if n.created_at else None,
    }
