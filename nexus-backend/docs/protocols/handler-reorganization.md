# Handler Reorganization Protocol

## Objective
Define a clear directory structure for engine handlers to improve modularity, maintainability, and scalability.

## New Directory Layout (`app/engine/handlers/`)
- `llm/` – Handlers that interact with LLM providers (completion, chat, embeddings).
- `audio/` – Handlers for speech‑to‑text, text‑to‑speech, audio processing.
- `comms/` – Handlers for messaging platforms (Telegram, WhatsApp, Slack).
- `payments/` – Handlers dealing with payment gateways and billing.
- `utilities/` – Miscellaneous helper handlers (validation, formatting, logging).
- `memory/` – Handlers that read/write agent memory, summarization, retention.
- `classifiers/` – Handlers that perform classification, routing, intent detection.

## Migration Steps
1. **Create subfolders** under `app/engine/handlers/` as listed above.
2. **Move existing handler files** into the appropriate subfolder.
3. **Update imports** in the codebase to reflect the new paths, e.g., `from app.engine.handlers.llm import llm_handler`.
4. **Adjust tests** to import from the new locations.
5. **Run full test suite** to ensure no breakages.
6. **Update documentation** (`docs/protocols/handler-reorganization.md`) with the new layout and migration checklist.

## Verification Checklist
- [ ] All handler files relocated.
- [ ] No import errors (`flake8` passes).
- [ ] All unit and integration tests pass.
- [ ] Documentation reflects new structure.
- [ ] CI pipeline updated to cache new paths.

## Auditing
- Log each file move operation with `correlation_id` and `user_id`.
- Store migration logs in `/audit/handler-reorg/` for 180 days.
