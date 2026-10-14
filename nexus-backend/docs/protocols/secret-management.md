# Secret Management Protocol

## Objetivo
Definir como segredos (API keys, credenciais, tokens) são armazenados, acessados e rotacionados de forma segura.

## Requisitos
- Estrutura única `Secret` com campos `scope`, `company_id` (nullable), `provider`, `secret_type`, `created_by`, `created_at`, `updated_at`, `last_used_at`.
- `ALLOW_ENV_PROVIDER_FALLBACK=false` em produção; fallback permitido apenas em dev/teste.
- Segredos de tenant nunca são lidos de `.env` em produção.
- Rotação automática via job Celery.

## Implementação
- Modelo `Secret` em `app/models/secret.py`.
- Serviço `secret_service.py` para CRUD com auditoria.
- Middleware de validação de acesso a segredos.

## Auditoria
- Log de criação, leitura e atualização de segredos com `correlation_id` e `tenant_id`.
