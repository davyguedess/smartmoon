# Engine Versioning Protocol

## Objetivo
Definir como as versões de fluxos (flows) são versionadas, armazenadas e publicadas, garantindo imutabilidade e capacidade de rollback.

## Requisitos
- Entidade `flow` representa a lógica atual; entidade `flow_version` armazena snapshots.
- Cada versão tem `version_int`, `definition_json`, `published_at`, `published_by`, `is_active`.
- Publicação só ocorre para versões marcadas como `is_active = true`.
- Rollback ativa versão anterior.
- Histórico de versões imutável.

## Implementação
- Modelo `FlowVersion` em `app/models/flow_version.py`.
- Serviço `flow_version_service.py` com funções `create_version`, `publish_version`, `rollback_version`.
- Endpoint `/flows/{flow_id}/versions/` para gerenciamento.
- Validação de schema JSON antes de salvar.

## Auditoria
- Log de criação, publicação e rollback em `/audit/flow-versions/` com `correlation_id`, `tenant_id`, `user_id`.
- Retenção de logs por 180 dias.
