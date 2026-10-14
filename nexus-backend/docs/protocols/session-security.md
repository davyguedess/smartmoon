# Session Security Protocol

## Objetivo
Definir as regras de segurança para sessões de usuário, incluindo criação, validade, rotação e revogação de tokens.

## Requisitos
- Access token TTL: 15 minutos.
- Refresh token TTL: 30 dias, rotação obrigatória via `/auth/refresh`.
- Limite de tentativas de login: 5 falhas em 15 minutos.
- Logout invalida refresh token.
- Revogação por sessão (logout ou comprometimento).

## Implementação
- Configurações em `settings.py`.
- Middleware `login_rate_limit.py`.
- Endpoint `/auth/logout`.
- Job Celery `rotate_refresh_tokens` para rotação e limpeza.

## Auditoria
- Log de login/logout com `correlation_id` e `tenant_id`.
- Auditoria de revogação em `audit/logs/`.
