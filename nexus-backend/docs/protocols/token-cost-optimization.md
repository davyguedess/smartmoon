# Token Cost Optimization Protocol

## Objetivo
Estabelecer diretrizes para otimização de uso de tokens e custos associados aos provedores de LLM.

## Requisitos
- Definir limites de tokens por fluxo e por tenant.
- Roteamento inteligente de providers baseado em custo e capacidade.
- Aplicar compressão de prompt (remover informações redundantes).
- Cache de respostas para prompts idênticos.
- Monitoramento de consumo via tabela `token_usage`.

## Implementação
- Serviço `cost_optimizer.py` que calcula custo estimado antes da chamada ao provider.
- Middleware que verifica limites configurados em `PLAN_LIMITS`.
- Utilização de Redis para cache de prompts/respostas.

## Auditoria
- Registro de cada chamada ao provider em `audit/token_costs/` com `tenant_id`, `agent_id`, `flow_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `estimated_cost`.
