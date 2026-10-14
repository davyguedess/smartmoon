# Admin Hardening Protocol

## Objetivo
Estabelecer diretrizes para reforçar a segurança da camada administrativa da plataforma, limitando o acesso e mitigando vetores de ataque.

## Requisitos
- `ADMIN_PANEL_ENABLED = false` em ambientes de produção.
- Acesso ao admin restrito a usuários com role `owner` ou `admin_super`.
- Autenticação de dois fatores (2FA) obrigatória para contas admin.
- Lista de allow‑list de IPs confiáveis configurável via `settings.ADMIN_ALLOWLIST_IPS`.
- Desabilitar depuração (`DEBUG = false`) e exposição de stack traces.
- Mascaramento de campos sensíveis nas respostas da API admin.
- Auditoria de todas as ações admin (CRUD de usuários, permissões, segredos) em `/audit/admin/`.

## Implementação
- Middleware `admin_access_control.py` verifica role, 2FA e IP allow‑list.
- Configurações em `settings.py` (`ADMIN_PANEL_ENABLED`, `ADMIN_ALLOWLIST_IPS`).
- Decorador `@admin_audit(event_name)` registra ações em `audit_service.py`.
- UI admin oculta em produção (`if settings.ADMIN_PANEL_ENABLED`).

## Auditoria
- Log de cada chamada admin com `correlation_id`, `tenant_id`, `user_id`, `action`, `resource_id`.
- Retenção de logs de admin por 180 dias.
