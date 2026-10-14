# Providers Protocol

## Objetivo
Definir como provedores de serviços externos (LLM, storage, email, SMS, pagamentos) são configurados, autenticados e utilizados de forma segura e resiliente.

## Requisitos
- Cada provedor tem um registro em tabela `provider` com campos `name`, `type`, `config_json`, `enabled`, `created_at`, `updated_at`.
- Credenciais armazenadas via secret‑management e nunca em código ou `.env` em produção.
- Failover configurável: lista ordenada de providers alternativos por tipo.
- Rate‑limit e quota por tenant configuráveis (`settings.PROVIDER_QUOTAS`).
- Monitoramento de latência e erros por provedor.

## Implementação
- Modelo `Provider` em `app/models/provider.py`.
- Serviço `provider_service.py` que resolve o provedor ativo (`get_provider(type, tenant_id)`) aplicando fallback e quota.
- Decorador `@provider_rate_limit(provider_type)` para limitar chamadas.
- Configurações em `settings.py` (`PROVIDERS`, `DEFAULT_PROVIDER`, `PROVIDER_QUOTAS`).

## Auditoria
- Log de cada chamada ao provedor com `correlation_id`, `tenant_id`, `provider_name`, `endpoint`, `status_code`, `duration_ms`.
- Retenção de logs de provedor por 180 dias.
