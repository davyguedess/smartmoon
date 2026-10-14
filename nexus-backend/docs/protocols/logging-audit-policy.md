# Logging and Audit Policy

## Objetivo
Definir padrões de logging estruturado e auditoria para todas as operações críticas da plataforma.

## Requisitos
- Utilizar `loguru` com contexto (`correlation_id`, `tenant_id`, `user_id`).
- Níveis de log: DEBUG, INFO, WARNING, ERROR, CRITICAL.
- Mascaramento automático de segredos em mensagens de log.
- Auditoria de eventos sensíveis: login, logout, refresh, alteração de role, acesso a segredos, publicação de flows.
- Retenção de logs: 90 dias (configurável).

## Implementação
- Wrapper `logger.py` que adiciona contexto via `structlog`.
- Decorador `@audit_event(event_name)` para funções críticas.
- Configuração em `settings.py` (`LOG_LEVEL`, `LOG_RETENTION_DAYS`).

## Auditoria
- Logs enviados para `audit/logs/` e para Sentry.
