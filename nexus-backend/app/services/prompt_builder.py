"""
PromptBuilder — Token-aware system prompt + context assembler.


Ensures the final messages list always fits within the model's context window
by trimming the oldest history first while always preserving:
  1. System prompt (non-negotiable)
  2. Facts and summaries (compressed memory)
  3. The most recent N user messages

Usage:
    builder = PromptBuilder(max_tokens=8192)
    messages = builder.build(
        system_prompt="Você é ...",
        memory_context=[...],      # from memory_service.build_context()
        request_messages=[...],    # ChatMessage list from the request
        reserve_for_output=1024,   # tokens to reserve for the model's reply
    )
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PromptBuilder:
    """
    Assembles and trims messages to fit within a token budget.

    Token estimation: 1 token ≈ 4 chars (rough but fast, no tiktoken dependency).
    For accuracy with OpenAI, swap _estimate_tokens with tiktoken.
    """
    max_tokens: int = 8192
    tokens_per_char: float = 0.25  # 4 chars per token

    def _estimate_tokens(self, text: str) -> int:
        return max(1, int(len(text) * self.tokens_per_char))

    def _msg_tokens(self, msg: dict) -> int:
        # +4 overhead per message for role/format tokens
        return self._estimate_tokens(msg.get("content", "")) + 4

    def build(
        self,
        system_prompt: str,
        memory_context: List[dict],
        request_messages: List[dict],
        reserve_for_output: int = 1024,
    ) -> List[dict]:
        """
        Build the final messages list within the token budget.

        Priority (highest to lowest priority for keeping):
            1. System prompt (always kept)
            2. Memory facts/summaries (always kept, capped at 30% of budget)
            3. New request messages (always kept in full)
            4. Historical messages (trimmed oldest-first if needed)

        Args:
            system_prompt: The LLM system instruction string
            memory_context: Enriched context from memory_service.build_context()
            request_messages: Raw messages from the current chat request (dicts)
            reserve_for_output: Tokens reserved for the model's reply

        Returns:
            Final list of message dicts ready to pass to the AI provider.
        """
        budget = self.max_tokens - reserve_for_output

        # ── 1. System prompt ──────────────────────────────
        system_msg = {"role": "system", "content": system_prompt}
        system_tokens = self._msg_tokens(system_msg)
        budget -= system_tokens

        # ── 2. Split memory context: facts+summaries vs history ──
        fixed_memory: List[dict] = []   # facts + summaries (keep always)
        history_memory: List[dict] = [] # past messages (trimmable)

        for m in memory_context:
            content = m.get("content", "")
            if content.startswith("[FACT]") or content.startswith("[SUMMARY]"):
                fixed_memory.append(m)
            else:
                history_memory.append(m)

        # Cap memory budget at 30% of remaining tokens
        memory_budget = int(budget * 0.30)
        fixed_tokens = sum(self._msg_tokens(m) for m in fixed_memory)
        if fixed_tokens > memory_budget:
            # Trim facts/summaries from the end (least recent)
            trimmed: List[dict] = []
            used = 0
            for m in fixed_memory:
                t = self._msg_tokens(m)
                if used + t > memory_budget:
                    break
                trimmed.append(m)
                used += t
            fixed_memory = trimmed
            fixed_tokens = used

        budget -= fixed_tokens

        # ── 3. Always include request messages ───────────
        req_tokens = sum(self._msg_tokens(m) for m in request_messages)
        budget -= req_tokens  # These are always included

        # ── 4. Fill remaining budget with history ─────────
        # Add history from newest to oldest, then reverse
        selected_history: List[dict] = []
        used_history = 0
        for m in reversed(history_memory):
            t = self._msg_tokens(m)
            if used_history + t > budget:
                break
            selected_history.insert(0, m)
            used_history += t

        # ── Assemble final messages ───────────────────────
        messages: List[dict] = [system_msg]
        messages.extend(fixed_memory)
        messages.extend(selected_history)
        messages.extend(request_messages)

        return messages

    def estimate_total_tokens(self, messages: List[dict]) -> int:
        """Estimate total token count of an assembled messages list."""
        return sum(self._msg_tokens(m) for m in messages)

    def would_exceed_budget(
        self,
        messages: List[dict],
        reserve_for_output: int = 1024,
    ) -> bool:
        """Check if an assembled messages list fits within the token budget."""
        total = self.estimate_total_tokens(messages) + reserve_for_output
        return total > self.max_tokens


# ── Model-specific presets ─────────────────────────────────────────────

MODEL_CONTEXT_SIZES: dict[str, int] = {
    # OpenAI
    "gpt-4o":               128_000,
    "gpt-4o-mini":          128_000,
    "gpt-4-turbo":          128_000,
    "gpt-3.5-turbo":        16_384,
    # Gemini
    "gemini-1.5-pro":       1_000_000,
    "gemini-1.5-flash":     1_000_000,
    "gemini-2.0-flash":     1_000_000,
    "gemini-2.5-flash":     1_000_000,
    "gemini-2.5-pro":       1_000_000,
    # Claude
    "claude-3-5-sonnet-20241022": 200_000,
    "claude-3-5-haiku-20241022":  200_000,
    "claude-3-opus-20240229":     200_000,
    # Groq (Llama)
    "llama3-70b-8192":      8_192,
    "llama3-8b-8192":       8_192,
    "llama-3.3-70b-versatile": 131_072,
    "mixtral-8x7b-32768":   32_768,
    # Ollama (conservative defaults)
    "llama3.2":             8_192,
    "llama3":               8_192,
    "mistral":              8_192,
    "gemma3:4b":            8_192,
}

# Safe default for unknown models
_DEFAULT_CONTEXT = 8_192
# Always reserve this many tokens for the model's reply
_DEFAULT_OUTPUT_RESERVE = 1_024


def get_prompt_builder(model: str) -> PromptBuilder:
    """
    Return a PromptBuilder configured for the given model's context window.

    Usage in chat.py:
        builder = get_prompt_builder(req.model)
        messages = builder.build(system_prompt, memory_context, request_messages)
    """
    max_tokens = MODEL_CONTEXT_SIZES.get(model, _DEFAULT_CONTEXT)
    return PromptBuilder(max_tokens=max_tokens)
