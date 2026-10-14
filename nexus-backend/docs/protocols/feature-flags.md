# Feature Flags Protocol

## Objetivo
Definir como recursos de funcionalidades são controlados via feature flags, permitindo ativação/desativação por tenant e ambiente.

## Requisitos
- Definir flags para: admin panel, flow versioning, memory v2, voice, providers premium, analytics avançado.
- Flags armazenadas em tabela `feature_flags` com colunas `tenant_id` (nullable), `flag_name`, `enabled`, `created_at`, `updated_at`.
- Possibilidade de sobrescrever por ambiente (dev/test/prod) via configuração `settings.FEATURE_OVERRIDES`.
- API interna `/admin/feature-flags` para gerenciamento por administradores.
- Cache de flags em Redis para baixa latência.

## Implementação
- Modelo `FeatureFlag` em `app/models/feature_flag.py`.
- Serviço `feature_flag_service.py` com CRUD e avaliação (`is_enabled(flag, tenant_id)`).
- Middleware que injeta flags no contexto de request.

## Auditoria
- Log de alterações de flags em `audit/feature_flags/` com `correlation_id`, `tenant_id`, `user_id`.
