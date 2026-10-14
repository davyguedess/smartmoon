# Engine Guardrails Protocol

## Objective
Define safety guardrails for flow execution to prevent runaway processes, infinite loops, and resource exhaustion.

## Requirements
- **Max Steps per Flow**: `MAX_FLOW_STEPS = 500`.
- **Node Timeout**: `NODE_TIMEOUT_SECONDS = 30` (per handler execution).
- **Retry Policy**: Max 3 retries with exponential backoff for transient failures.
- **Circuit Breaker**: Trigger after 5 consecutive failures for a given provider type.
- **Loop Detection**: Detect repeated node IDs in the execution path; abort with error `LoopDetectedError`.
- **Safe Fallback Providers**: Define ordered fallback list per provider type in `settings.DEFAULT_PROVIDER_FALLBACKS`.
- **Rate Limits**: Enforce per‑tenant request quotas (`settings.PROVIDER_QUOTAS`).

## Implementation
- Add constants to `app/core/settings.py`.
- Middleware `engine_guardrails.py` wraps flow execution, checks step count, timeout, and loop detection.
- Decorator `@retry_policy` for handlers.
- Circuit‑breaker utility `circuit_breaker.py` using Redis counters.
- Update `flow_version_service` to respect `is_active` flag and prevent execution of unpublished versions.

## Auditing
- Log each guardrail violation with `correlation_id`, `tenant_id`, `flow_id`, `step_number`, `error_type`.
- Store logs in `/audit/engine-guardrails/` for 180 days.
