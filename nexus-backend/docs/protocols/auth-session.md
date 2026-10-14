# Auth and Session Protocol

## Objetivo
Definir políticas de autenticação, gerenciamento de sessões e rotação de tokens para garantir segurança e usabilidade.

## Requisitos
- **Access Token**: validade curta (`ACCESS_TOKEN_EXPIRE_MINUTES = 15`).
- **Refresh Token**: armazenado em banco com campos `created_at`, `last_used_at`, `expires_at`, `revoked`, `device_info`, `ip_address`.
- **Rotação**: refresh só via endpoint `/auth/refresh`; revoga token antigo.
- **Logout**: invalida refresh token corrente.
- **Limite de Tentativas**: bloqueio temporário após 5 falhas de login em 15 min.
- **Reautenticação**: para ações críticas (ex.: alteração de senha, acesso admin).
- **Proteção CSRF**: tokens anti‑CSRF para endpoints de estado.

## Implementação
- Modelo `RefreshToken` em `app/models/refresh_token.py`.
- Serviço `auth_service.py` com funções `login`, `refresh`, `logout`.
- Dependência `require_active_user` que verifica token, revogação e limites.
- Job Celery `cleanup_expired_tokens` rodando diariamente.
- Configurações em `settings.py` (`ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`).

## Auditoria
- Log de login, refresh, logout e bloqueios de conta com `correlation_id`, `tenant_id`, `user_id`.
- Retenção de logs de auth por 180 dias.
