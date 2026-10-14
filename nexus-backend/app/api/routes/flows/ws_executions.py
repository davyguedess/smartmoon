"""
NEXUS.IA — WebSocket endpoint para monitoramento de execuções em tempo real.

Substitui o polling de 8s em Executions.jsx por push via WebSocket.
- Autenticação: token JWT passado como query param `?token=<jwt>`
- Protocolo:   JSON frames com type = "execution_update" | "ping"
- Reconexão:   Responsabilidade do cliente (backoff exponencial sugerido)
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import text
from loguru import logger

from app.db.session import AsyncSessionLocal
from app.core.dependencies import decode_token_from_string

router = APIRouter(tags=["WebSocket"])

# Intervalo de polling interno ao banco (em segundos)
_POLL_INTERVAL = 2


@router.websocket("/ws/executions")
async def ws_executions(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket que envia atualizações de execuções em tempo real.

    Conecte-se com:
        ws://host/ws/executions?token=<jwt>

    Frames enviados ao cliente:
        {"type": "execution_update", "data": [{...execução...}]}
        {"type": "ping"}

    O cliente pode enviar qualquer frame; o servidor ignora (unidirectional push).
    """
    # 1. Autenticar via token na query string
    user = None
    if token:
        try:
            async with AsyncSessionLocal() as auth_db:
                user = await decode_token_from_string(token, auth_db)
        except Exception as e:
            logger.warning(f"WS /executions auth failed: {e}")

    if user is None:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    company_id = user.company_id
    user_id = user.id
    logger.info(f"WS /executions conectado — user={user_id} company={company_id}")

    last_snapshot: Optional[str] = None

    try:
        while True:
            # 2. Buscar execuções — sessão nova a cada ciclo (evita transação travada)
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        text("""
                            SELECT id, flow_id, status, started_at, finished_at,
                                   error_message, triggered_by
                            FROM executions
                            WHERE company_id = :cid
                            ORDER BY started_at DESC
                            LIMIT 50
                        """),
                        {"cid": company_id},
                    )
                    rows = result.mappings().all()
                    executions = [dict(r) for r in rows]

                # Serializar para comparar com snapshot anterior
                snapshot = json.dumps(executions, default=str, sort_keys=True)

                if snapshot != last_snapshot:
                    last_snapshot = snapshot
                    await websocket.send_json({
                        "type": "execution_update",
                        "data": executions,
                    })

            except Exception as db_err:
                logger.error(f"WS /executions DB error: {db_err}")

            # 3. Aguardar antes do próximo poll
            await asyncio.sleep(_POLL_INTERVAL)

    except WebSocketDisconnect:
        logger.info(f"WS /executions desconectado — user={user_id}")
    except Exception as e:
        logger.error(f"WS /executions erro inesperado: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

