# Retention Policy Protocol

## Objetivo
Definir políticas de retenção de dados para diferentes tipos de artefatos da plataforma, garantindo conformidade e otimização de armazenamento.

## Requisitos
- Logs de auditoria: retenção mínima 90 dias, máximo 1 ano.
- Mensagens de memória de agente: retenção configurável por escopo (ex.: 30 dias para `session_only`, 180 dias para `company_shared`).
- Arquivos de áudio/TTS: retenção de 7 dias, com limpeza automática.
- Dados de webhook events: retenção de 30 dias.
- Backups de banco de dados seguem política de retenção de 30 dias.
- Configurações de retenção devem ser definidas por tenant via `settings.RETENTION_POLICY`.

## Implementação
- Serviço `retention_service.py` que agenda jobs Celery para limpeza baseada nas regras acima.
- Configurações em `settings.py` (`RETENTION_DAYS_LOGS`, `RETENTION_DAYS_AGENT_MEMORY`, etc.).
- Endpoint `/admin/retention` para visualização e ajuste de políticas por admin.

## Auditoria
- Log de execuções de jobs de limpeza em `audit/retention/` com `correlation_id` e `tenant_id`.
