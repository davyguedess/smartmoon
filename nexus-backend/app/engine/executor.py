"""
NEXUS.IA Flow Executor
Reads a flow JSON and executes each node in graph order,
saving a step record for each node processed.
"""
import time
from datetime import datetime, timezone
from typing import Optional
from loguru import logger

from app.engine.graph import FlowGraph
from app.engine.node_registry import node_registry
from app.engine.exceptions import WaitingForEvent


class FlowExecutor:
    def __init__(self, db_session, execution, flow):
        self.db = db_session
        self.execution = execution
        self.flow = flow
        # Seed context with both context_json and input_payload so all handlers
        # have access to wa_id, phone, whatsapp_provider, conversation_id, etc.
        base_context = dict(execution.context_json or {})
        payload = execution.input_payload or {}
        if isinstance(payload, str):
            import json
            payload = json.loads(payload)
        self.context = {**payload, **base_context}  # base_context takes priority
        self.graph = FlowGraph(flow.definition_json)


    async def run(self):
        from app.db.repositories.execution_repository import ExecutionRepository
        repo = ExecutionRepository(self.db)

        logger.info(f"▶ Starting execution #{self.execution.id} — flow: {self.flow.name}")
        await repo.update_status(
            self.execution, "running",
            started_at=datetime.now(timezone.utc),
            current_node_id=None,
        )

        try:
            trigger_node = self.graph.get_trigger_node()
            if not trigger_node:
                raise ValueError("Fluxo não tem nó de trigger definido")

            await self._execute_from(trigger_node["id"])
            await repo.update_status(self.execution, "success")
            logger.success(f"✅ Execution #{self.execution.id} completed successfully")

        except WaitingForEvent as e:
            await repo.update_status(
                self.execution, "waiting",
                current_node_id=e.node_id,
                context_json={**self.context, "waiting_for": e.event_name},
            )
            logger.info(f"⏳ Execution #{self.execution.id} is waiting for event: {e.event_name}")

        except Exception as exc:
            logger.exception(f"❌ Execution #{self.execution.id} failed: {exc}")
            await repo.update_status(
                self.execution, "failed",
                error_message=str(exc),
            )

    async def _execute_from(self, node_id: str):
        from app.db.repositories.execution_repository import ExecutionRepository
        repo = ExecutionRepository(self.db)

        node = self.graph.get_node(node_id)
        if not node:
            logger.warning(f"Node {node_id} not found in graph, skipping")
            return

        # Prefer subtype for handler lookup (more specific), fallback to type
        node_subtype = node.get("subtype")
        node_type = node.get("type") or "unknown"
        
        handler_class = None
        if node_subtype and node_subtype in node_registry:
            handler_class = node_registry[node_subtype]
            node_type = node_subtype # For logging/steps
        else:
            handler_class = node_registry.get(node_type)

        logger.debug(f"  → Node [{node_type}] {node_id}: {node.get('label', '')}")

        # ── CRITICAL: inject DB session + company_id so handlers can resolve API keys from DB
        self.context["_db"] = self.db
        self.context["company_id"] = self.flow.company_id

        start = time.time()
        try:
            if handler_class:
                handler = handler_class(node=node, context=self.context, settings_ref=node.get("config", {}))
                output = await handler.execute(self.execution.input_payload)
                self.context.update(output or {})
                status = "success"
                error = None
            else:
                logger.warning(f"No handler for node type '{node_type}', skipping")
                output = {"skipped": True, "reason": f"No handler for {node_type}"}
                status = "success"
                error = None

        except WaitingForEvent:
            raise
        except Exception as e:
            output = {}
            status = "failed"
            error = {"message": str(e), "type": type(e).__name__}
            logger.error(f"Node {node_id} failed: {e}")

        duration_ms = int((time.time() - start) * 1000)

        await repo.add_step(
            execution_id=self.execution.id,
            node_id=node_id,
            node_type=node_type,
            status=status,
            input_data=self.execution.input_payload,
            output_data=output if isinstance(output, dict) else {},
            error=error,
            duration_ms=duration_ms,
        )

        # Only stop if critical node types fail (triggers, AI core)
        # Messaging nodes (send_telegram, etc.) should not block downstream
        critical_failure_types = {"trigger", "telegram_trigger", "whatsapp_trigger", "webhook_trigger"}
        if status == "failed" and node_type in critical_failure_types:
            return  # Stop execution only on critical node failures


        # Move to next nodes
        next_nodes = self.graph.get_next_nodes(node_id)
        for next_node_id in next_nodes:
            await self._execute_from(next_node_id)


