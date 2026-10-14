"""
Duarte Price Sync — Sincroniza preços da API Duarte Estética com o system_prompt do AgentProfile.

Endpoint: POST /agents/duarte/sync-prices
Autenticação: Bearer token (superadmin) OU X-Sync-Secret header para crons internos

Fluxo:
  1. Chama GET https://esteticaduarte.com/booking/api_bookings/services
  2. Monta bloco CATÁLOGO atualizado (tabela markdown)
  3. Substitui a seção ##CATALOGO no system_prompt do AgentProfile id=DUARTE_AGENT_ID
  4. Salva no banco e retorna resumo

Também expõe: GET /agents/duarte/sync-prices (verifica status da última sync)
"""
import os
import re
import httpx
from datetime import datetime, timezone, timedelta
from loguru import logger
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.dependencies import get_db
from app.models import AgentProfile

router = APIRouter(prefix="/agents/duarte", tags=["duarte-sync"])

# ── Config ──────────────────────────────────────────────────────────────────
DUARTE_API_BASE  = os.getenv("DUARTE_API_BASE", "https://esteticaduarte.com/booking/api_bookings")
DUARTE_API_KEY   = os.getenv("DUARTE_API_KEY", "")   # definir no .env da VPS
DUARTE_HEADERS   = {"X-API-Key": DUARTE_API_KEY, "Content-Type": "application/json"}
DUARTE_AGENT_ID  = int(os.getenv("DUARTE_AGENT_ID", "2"))   # agent_profiles.id da Lari (Duarte)
SYNC_SECRET      = os.getenv("DUARTE_SYNC_SECRET", "")   # mesma chave dos crons PHP; definir no .env

# Marcadores que delimitam o bloco de catálogo dentro do system_prompt
CATALOG_START = "## CATÁLOGO DE SERVIÇOS"
CATALOG_END   = "## FIM CATÁLOGO"


def _build_catalog_block(services: list) -> str:
    """Monta o bloco markdown do catálogo com preços atuais."""
    brt_now = datetime.now(timezone(timedelta(hours=-3)))
    lines = [
        f"{CATALOG_START}",
        f"_Atualizado em: {brt_now.strftime('%d/%m/%Y %H:%M')} BRT_",
        "",
    ]

    # Agrupar por categoria
    by_cat: dict[str, list] = {}
    for s in services:
        cat = s.get("categoria") or "Outros"
        by_cat.setdefault(cat, []).append(s)

    for cat, items in sorted(by_cat.items()):
        lines.append(f"### {cat}")
        for s in items:
            preco = s.get("preco", 0)
            nome  = s.get("nome", "")
            sid   = s.get("service_id", 0)
            dur   = s.get("duracao_min", 0)
            desc  = s.get("descricao", "")
            preco_fmt = f"R$ {preco:.2f}".replace(".", ",")
            dur_txt   = f" ({dur} min)" if dur else ""
            desc_txt  = f" — {desc}" if desc else ""
            lines.append(f"- **{nome}** | id:{sid} | {preco_fmt}{dur_txt}{desc_txt}")
        lines.append("")

    lines.append(CATALOG_END)
    return "\n".join(lines)


def _inject_catalog(system_prompt: str, catalog_block: str) -> str:
    """
    Substitui o bloco de catálogo existente no system_prompt,
    ou appenda ao final se não existir.
    """
    pattern = re.compile(
        rf"{re.escape(CATALOG_START)}.*?{re.escape(CATALOG_END)}",
        re.DOTALL
    )
    if pattern.search(system_prompt):
        return pattern.sub(catalog_block, system_prompt)
    # Não existe ainda — appenda
    return system_prompt.rstrip() + "\n\n" + catalog_block + "\n"


@router.post("/sync-prices")
async def sync_duarte_prices(
    x_sync_secret: str | None = Header(default=None, alias="X-Sync-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """
    Busca os serviços/preços da API Duarte e atualiza o system_prompt da Lari.
    Pode ser chamado por:
    - Cron PHP via header X-Sync-Secret
    - Admin via Swagger/Postman (sem autenticação adicional — protegido pelo header secret)
    """
    # Autenticação simples via secret header
    if x_sync_secret != SYNC_SECRET:
        raise HTTPException(status_code=401, detail="X-Sync-Secret inválido ou ausente")

    # 1. Buscar serviços na API Duarte
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{DUARTE_API_BASE}/services", headers=DUARTE_HEADERS)
            resp.raise_for_status()
            api_data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"[duarte_sync] HTTP error ao buscar serviços: {e}")
        raise HTTPException(status_code=502, detail=f"API Duarte retornou {e.response.status_code}")
    except Exception as e:
        logger.error(f"[duarte_sync] Erro ao chamar API Duarte: {e}")
        raise HTTPException(status_code=502, detail=f"Falha na conexão com API Duarte: {e}")

    services = api_data.get("services", [])
    if not services:
        raise HTTPException(status_code=404, detail="API Duarte não retornou serviços")

    logger.info(f"[duarte_sync] {len(services)} serviços recebidos da API Duarte")

    # 2. Buscar AgentProfile da Lari
    result = await db.execute(
        select(AgentProfile).where(AgentProfile.id == DUARTE_AGENT_ID)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"AgentProfile id={DUARTE_AGENT_ID} não encontrado no banco"
        )

    # 3. Montar catálogo e injetar no system_prompt
    catalog_block    = _build_catalog_block(services)
    old_prompt       = profile.system_prompt or ""
    new_prompt       = _inject_catalog(old_prompt, catalog_block)

    # 4. Salvar no banco
    await db.execute(
        update(AgentProfile)
        .where(AgentProfile.id == DUARTE_AGENT_ID)
        .values(
            system_prompt=new_prompt,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()

    brt_now = datetime.now(timezone(timedelta(hours=-3)))
    logger.info(
        f"[duarte_sync] system_prompt do AgentProfile id={DUARTE_AGENT_ID} "
        f"atualizado com {len(services)} serviços em {brt_now.strftime('%d/%m/%Y %H:%M')} BRT"
    )

    return {
        "ok": True,
        "agent_id": DUARTE_AGENT_ID,
        "agent_name": profile.name,
        "services_synced": len(services),
        "synced_at": brt_now.isoformat(),
        "catalog_preview": [
            {
                "id": s.get("service_id"),
                "nome": s.get("nome"),
                "preco": s.get("preco"),
                "categoria": s.get("categoria"),
            }
            for s in services[:5]
        ],
    }


@router.get("/sync-prices/status")
async def duarte_sync_status(
    x_sync_secret: str | None = Header(default=None, alias="X-Sync-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna o estado atual do system_prompt da Lari:
    - Quando foi a última sync (extraído do bloco de catálogo)
    - Quantos serviços estão no prompt
    - Primeiros serviços listados
    """
    if x_sync_secret != SYNC_SECRET:
        raise HTTPException(status_code=401, detail="X-Sync-Secret inválido")

    result = await db.execute(
        select(AgentProfile).where(AgentProfile.id == DUARTE_AGENT_ID)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail=f"AgentProfile id={DUARTE_AGENT_ID} não encontrado")

    prompt = profile.system_prompt or ""

    # Detectar se há catálogo no prompt
    has_catalog = CATALOG_START in prompt and CATALOG_END in prompt

    last_sync = None
    if has_catalog:
        match = re.search(r"Atualizado em: (.+?) BRT", prompt)
        if match:
            last_sync = match.group(1)

    # Contar serviços no catálogo (linhas que começam com "- **")
    service_count = len(re.findall(r"^- \*\*", prompt, re.MULTILINE))

    return {
        "ok": True,
        "agent_id": DUARTE_AGENT_ID,
        "agent_name": profile.name,
        "has_catalog": has_catalog,
        "last_sync": last_sync,
        "services_in_prompt": service_count,
        "prompt_length_chars": len(prompt),
    }
