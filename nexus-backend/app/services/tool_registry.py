"""
ToolRegistry — Central registry for all NEXUS.IA agent tools.

Inspired by: Claude Code's tool registration pattern with schema validation.

The ToolRegistry is the single source of truth for:
  - Which tools are available
  - Their JSON Schema definitions (for LLM function-calling)
  - Input validation
  - Permission scoping (which plans can access which tools)
  - Execution routing

Usage (register a tool):
    @tool_registry.register(
        name="search_contacts",
        description="Search for contacts in the company database.",
        schema={...},
        plans=["pro", "enterprise"],
    )
    async def search_contacts(query: str, company_id: int) -> dict:
        ...

Usage (execute a tool call from LLM):
    result = await tool_registry.execute(
        name="search_contacts",
        args={"query": "João"},
        company_id=42,
        plan="pro",
    )
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from loguru import logger


# ── Exceptions ─────────────────────────────────────────────────────────

class ToolNotFoundError(ValueError):
    """Tool name is not registered."""


class ToolPermissionError(PermissionError):
    """Company plan does not allow this tool."""


class ToolInputError(ValueError):
    """Tool input failed schema validation."""


# ── Tool descriptor ─────────────────────────────────────────────────────

@dataclass
class ToolDefinition:
    name: str
    description: str
    schema: dict            # JSON Schema for the parameters object
    handler: Callable
    plans: list[str] = field(default_factory=lambda: ["pro", "enterprise"])
    category: str = "general"
    is_async: bool = True

    def to_openai_function(self) -> dict:
        """Return the function spec for OpenAI function-calling."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.schema,
            }
        }

    def to_anthropic_tool(self) -> dict:
        """Return the tool spec for Anthropic (Claude) tool use."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.schema,
        }


# ── Registry ────────────────────────────────────────────────────────────

class ToolRegistry:
    """
    Central registry for all tools that AI agents can call.

    Thread-safe singleton — use the module-level `tool_registry` instance.
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    # ── Registration ──────────────────────────────────────────────────

    def register(
        self,
        name: str,
        description: str,
        schema: dict,
        plans: Optional[list[str]] = None,
        category: str = "general",
    ):
        """
        Decorator to register a tool handler.

        Example:
            @tool_registry.register(
                name="get_quota_status",
                description="Returns the company's current plan and quota usage.",
                schema={"type": "object", "properties": {}, "required": []},
                plans=["pro", "enterprise"],
                category="billing",
            )
            async def get_quota_status(company_id: int) -> dict:
                ...
        """
        def decorator(fn: Callable) -> Callable:
            tool = ToolDefinition(
                name=name,
                description=description,
                schema=schema,
                handler=fn,
                plans=plans or ["pro", "enterprise"],
                category=category,
                is_async=asyncio.iscoroutinefunction(fn),
            )
            self._tools[name] = tool
            logger.debug(f"🔧 Tool registered: '{name}' (plans={tool.plans})")
            return fn
        return decorator

    def add(self, tool: ToolDefinition) -> None:
        """Register a pre-built ToolDefinition."""
        self._tools[tool.name] = tool

    # ── Lookup ────────────────────────────────────────────────────────

    def get(self, name: str) -> ToolDefinition:
        tool = self._tools.get(name)
        if tool is None:
            raise ToolNotFoundError(f"Tool '{name}' is not registered.")
        return tool

    def list_for_plan(self, plan: str) -> list[ToolDefinition]:
        """Return all tools available for a given plan."""
        if plan == "enterprise":
            return list(self._tools.values())
        return [t for t in self._tools.values() if plan in t.plans]

    def openai_functions(self, plan: str) -> list[dict]:
        """Return OpenAI function specs for this plan's available tools."""
        return [t.to_openai_function() for t in self.list_for_plan(plan)]

    def anthropic_tools(self, plan: str) -> list[dict]:
        """Return Anthropic tool specs for this plan's available tools."""
        return [t.to_anthropic_tool() for t in self.list_for_plan(plan)]

    # ── Execution ─────────────────────────────────────────────────────

    async def execute(
        self,
        name: str,
        args: dict,
        company_id: int,
        plan: str = "pro",
        user_id: Optional[int] = None,
        db=None,
    ) -> Any:
        """
        Validate and execute a tool call.

        Args:
            name: Registered tool name
            args: Dict of arguments (from LLM tool call)
            company_id: Company executing the tool (for scoping & billing)
            plan: Company's plan (for permission check)
            user_id: Optional user (for audit logging)
            db: Optional AsyncSession (passed to handler if it accepts it)

        Returns:
            Tool result (dict or any JSON-serializable value)

        Raises:
            ToolNotFoundError: Tool not registered
            ToolPermissionError: Plan doesn't allow this tool
        """
        tool = self.get(name)

        # Permission check
        if plan != "enterprise" and plan not in tool.plans:
            raise ToolPermissionError(
                f"Tool '{name}' requires plan {tool.plans}. "
                f"Current plan: '{plan}'. Upgrade to access."
            )

        logger.info(f"🔧 Executing tool '{name}' for company {company_id}")

        try:
            # Inject common kwargs if the handler accepts them
            import inspect
            sig = inspect.signature(tool.handler)
            call_kwargs = dict(args)
            if "company_id" in sig.parameters:
                call_kwargs["company_id"] = company_id
            if "user_id" in sig.parameters:
                call_kwargs["user_id"] = user_id
            if "db" in sig.parameters:
                call_kwargs["db"] = db

            if tool.is_async:
                result = await tool.handler(**call_kwargs)
            else:
                result = tool.handler(**call_kwargs)

            logger.success(f"✅ Tool '{name}' executed successfully")
            return result

        except (ToolNotFoundError, ToolPermissionError):
            raise
        except Exception as exc:
            logger.error(f"❌ Tool '{name}' execution failed: {exc}")
            return {"error": str(exc), "tool": name}

    # ── Introspection ─────────────────────────────────────────────────

    def all_names(self) -> list[str]:
        return list(self._tools.keys())

    def __len__(self) -> int:
        return len(self._tools)

    def __repr__(self) -> str:
        return f"<ToolRegistry tools={self.all_names()}>"


# ── Singleton ──────────────────────────────────────────────────────────

tool_registry = ToolRegistry()


# ── Built-in Tools (registered at import time) ─────────────────────────
# These are the core system tools. Domain-specific tools (CRM, payments, etc.)
# are registered from their respective service modules.

@tool_registry.register(
    name="get_quota_status",
    description=(
        "Retorna o status atual de uso e limites do plano da empresa. "
        "Use quando o usuário perguntar sobre seu plano, cota, ou limites."
    ),
    schema={
        "type": "object",
        "properties": {},
        "required": [],
    },
    plans=["free", "pro", "enterprise"],
    category="billing",
)
async def _tool_get_quota_status(company_id: int, db=None) -> dict:
    if db is None:
        return {"error": "Database session not available"}
    from app.services.billing_service import get_quota_status
    return await get_quota_status(company_id, db)


@tool_registry.register(
    name="search_agent_memory",
    description=(
        "Busca na memória do agente por sessões e fatos relevantes. "
        "Use quando o usuário perguntar sobre conversas anteriores."
    ),
    schema={
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "ID da sessão de chat a buscar"
            },
        },
        "required": ["session_id"],
    },
    plans=["pro", "enterprise"],
    category="memory",
)
async def _tool_search_memory(session_id: str, company_id: int, db=None) -> dict:
    if db is None:
        return {"error": "Database session not available"}
    from app.services.memory_service import build_context
    context = await build_context(db, company_id, session_id, max_tokens=2000)
    return {"entries": len(context), "context": context[:10]}


@tool_registry.register(
    name="list_active_flows",
    description="Lista os fluxos de automação ativos da empresa.",
    schema={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Número máximo de fluxos a retornar",
                "default": 10,
            }
        },
        "required": [],
    },
    plans=["pro", "enterprise"],
    category="flows",
)
async def _tool_list_flows(company_id: int, limit: int = 10, db=None) -> dict:
    if db is None:
        return {"error": "Database session not available"}
    from sqlalchemy import select
    from app.models import Flow
    result = await db.execute(
        select(Flow.id, Flow.name, Flow.status)
        .where(Flow.company_id == company_id, Flow.status == "active")
        .limit(limit)
    )
    flows = [{"id": r[0], "name": r[1], "status": r[2]} for r in result.fetchall()]
    return {"flows": flows, "count": len(flows)}


@tool_registry.register(
    name="query_knowledge_base",
    description=(
        "Busca informações na base de conhecimento da empresa. "
        "Use para responder perguntas técnicas, FAQ, ou buscar fatos específicos "
        "que não estão no histórico recente da conversa."
    ),
    schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "A pergunta ou termo de busca"
            },
            "category_id": {
                "type": "integer",
                "description": "ID opcional da categoria de conhecimento para restringir a busca"
            },
            "limit": {
                "type": "integer",
                "description": "Número de resultados",
                "default": 3
            }
        },
        "required": ["query"],
    },
    plans=["pro", "enterprise"],
    category="knowledge",
)
async def _tool_query_knowledge(
    query: str,
    company_id: int,
    category_id: Optional[int] = None,
    limit: int = 3,
    db=None
) -> dict:
    from app.services.vector_service import get_vector_service
    vector_service = get_vector_service()
    
    results = await vector_service.search(
        query_text=query,
        company_id=company_id,
        category_id=category_id,
        limit=limit
    )
    
    if not results:
        return {"message": "Nenhuma informação relevante encontrada na base de conhecimento."}
        
    return {
        "results": [
            {"content": r["content"], "relevance": round(r["score"] * 100, 1)}
            for r in results
        ]
    }


@tool_registry.register(
    name="save_to_knowledge_base",
    description=(
        "Salva um fato ou informação importante na base de conhecimento da empresa. "
        "Use quando o usuário fornecer uma informação que deve ser lembrada permanentemente."
    ),
    schema={
        "type": "object",
        "properties": {
            "fact": {
                "type": "string",
                "description": "A informação a ser salva"
            },
            "category_id": {
                "type": "integer",
                "description": "ID da categoria onde salvar a informação"
            }
        },
        "required": ["fact", "category_id"],
    },
    plans=["pro", "enterprise"],
    category="knowledge",
)
async def _tool_save_knowledge(
    fact: str,
    company_id: int,
    category_id: int,
    db=None
) -> dict:
    from app.services.vector_service import get_vector_service
    vector_service = get_vector_service()
    
    point_id = await vector_service.upsert_text(
        text=fact,
        company_id=company_id,
        category_id=category_id
    )
    
    return {
        "success": True,
        "message": "Informação salva com sucesso na base de conhecimento.",
        "id": point_id
    }
