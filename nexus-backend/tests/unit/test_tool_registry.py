"""
Tests for ToolRegistry — registration, permission gating, execution routing.
"""
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.tool_registry import ToolRegistry, ToolNotFoundError, ToolPermissionError



# ── Fixture: isolated registry per test ────────────────────

@pytest.fixture()
def registry():
    """Fresh ToolRegistry per test (does not affect the global singleton)."""
    return ToolRegistry()


# ── Registration ─────────────────────────────────────────

def test_register_via_decorator(registry):
    @registry.register(
        name="echo",
        description="Returns the input unchanged.",
        schema={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
        plans=["free", "pro", "enterprise"],
        category="test",
    )
    async def echo(text: str) -> dict:
        return {"echo": text}

    assert "echo" in registry.all_names()
    assert len(registry) == 1


def test_register_multiple(registry):
    for name in ["tool_a", "tool_b", "tool_c"]:
        @registry.register(name=name, description="", schema={}, plans=["pro"], category="test")
        async def _handler():
            return {}

    assert len(registry) == 3


def test_get_tool_raises_for_unknown(registry):
    with pytest.raises(ToolNotFoundError):
        registry.get("nonexistent_tool")


# ── Permission gating ─────────────────────────────────────

def test_list_for_plan_free_sees_free_tools(registry):
    @registry.register(name="free_tool", description="", schema={}, plans=["free", "pro", "enterprise"])
    async def _(): return {}

    @registry.register(name="pro_tool", description="", schema={}, plans=["pro", "enterprise"])
    async def __(): return {}

    free_tools = [t.name for t in registry.list_for_plan("free")]
    assert "free_tool" in free_tools
    assert "pro_tool" not in free_tools


def test_list_for_plan_enterprise_sees_all(registry):
    @registry.register(name="t1", description="", schema={}, plans=["pro"])
    async def _(): return {}

    @registry.register(name="t2", description="", schema={}, plans=["enterprise"])
    async def __(): return {}

    enterprise_tools = [t.name for t in registry.list_for_plan("enterprise")]
    assert "t1" in enterprise_tools
    assert "t2" in enterprise_tools


# ── Execution ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_returns_result(registry):
    @registry.register(name="add", description="", schema={}, plans=["pro", "enterprise"])
    async def add(a: int, b: int) -> dict:
        return {"sum": a + b}

    result = await registry.execute("add", {"a": 2, "b": 3}, company_id=1, plan="pro")
    assert result == {"sum": 5}


@pytest.mark.asyncio
async def test_execute_injects_company_id(registry):
    received = {}

    @registry.register(name="capture_company", description="", schema={}, plans=["pro"])
    async def capture_company(company_id: int) -> dict:
        received["company_id"] = company_id
        return {}

    await registry.execute("capture_company", {}, company_id=42, plan="pro")
    assert received["company_id"] == 42


@pytest.mark.asyncio
async def test_execute_raises_for_wrong_plan(registry):
    @registry.register(name="enterprise_only", description="", schema={}, plans=["enterprise"])
    async def _() -> dict:
        return {}

    with pytest.raises(ToolPermissionError):
        await registry.execute("enterprise_only", {}, company_id=1, plan="free")


@pytest.mark.asyncio
async def test_execute_returns_error_dict_on_handler_exception(registry):
    @registry.register(name="broken", description="", schema={}, plans=["pro"])
    async def broken() -> dict:
        raise ValueError("handler exploded")

    result = await registry.execute("broken", {}, company_id=1, plan="pro")
    assert "error" in result
    assert result["tool"] == "broken"


# ── OpenAI / Anthropic spec generation ───────────────────

def test_openai_functions_format(registry):
    @registry.register(
        name="search",
        description="Search for something.",
        schema={"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]},
        plans=["pro"],
    )
    async def _(): return {}

    specs = registry.openai_functions("pro")
    assert len(specs) == 1
    assert specs[0]["type"] == "function"
    assert specs[0]["function"]["name"] == "search"


def test_anthropic_tools_format(registry):
    @registry.register(
        name="lookup",
        description="Lookup something.",
        schema={"type": "object", "properties": {}, "required": []},
        plans=["pro"],
    )
    async def _(): return {}

    tools = registry.anthropic_tools("pro")
    assert len(tools) == 1
    assert tools[0]["name"] == "lookup"
    assert "input_schema" in tools[0]
