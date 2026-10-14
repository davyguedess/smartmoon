# Agent Memory Governance Protocol

## Objetivo
Definir como a memória dos agentes é gerenciada, armazenada e acessada, garantindo isolamento por escopo e retenção adequada.

## Requisitos
- Escopos de memória: `session_only`, `agent_private`, `user_private`, `company_shared`.
- Tipos de memória: `message`, `summary`, `fact`, `tool_state`, `knowledge_ref`.
- Limite de tamanho por escopo; retenção configurável.
- Resumo automático após N mensagens.
- Auditoria de leitura/escrita de memória.

## Implementação
- Modelo `AgentMemory` em `app/models/agent_memory.py`.
- Serviço `memory_service.py` com regras de escopo e resumo.
- Middleware que injeta `tenant_id` e `agent_id` no contexto.

## Auditoria
- Log de operações de memória com `correlation_id`, `tenant_id`, `agent_id`.
