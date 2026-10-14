# Flow Versioning Protocol

## Objetivo
Definir como os fluxos (flows) são versionados, publicados e gerenciados, garantindo imutabilidade dos fluxos em produção.

## Requisitos
- Cada fluxo possui um `flow_id` e múltiplas `flow_versions`.
- `flow_versions` contém `version_int`, `definition_json`, `published_at`, `published_by`, `is_active`.
- Publicação gera snapshot imutável; execução usa a versão ativa.
- Rollback ativa versão anterior.
- Drafts podem ser testados via flag explícita, mas não alteram snapshots publicados.

## Implementação
- Modelo `FlowVersion` em `app/models/flow_version.py`.
- Serviço `flow_service.py` com métodos `publish_flow`, `rollback_flow`, `get_active_version`.
- Endpoint `/flows/{id}/publish` e `/flows/{id}/rollback`.

## Auditoria
- Log de publicação/rollback com `correlation_id`, `tenant_id` e `user_id`.
