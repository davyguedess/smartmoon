# AI Code Governance Protocol

## Objetivo
Estabelecer diretrizes para código gerado por IA, garantindo que somente código revisado e testado seja promovido para produção.

## Requisitos
- Todo código gerado deve ser salvo em `/sandbox/ai-generated/`.
- Passar por **AI Code Sweeper** (lint, análise estática).
- Passar por **Security Reviewer** (scans de vulnerabilidade).
- Passar por **Migration Reviewer** se houver alterações de banco.
- Cobertura de testes mínima 80% (100% para módulos críticos).
- Aprovação manual ou automática via política de promoção.

## Implementação
- Script `ai_code_sweeper.py` executado como job Celery.
- Serviço `ai_code_review_service.py` orquestra revisões.
- Endpoint `/ai/publish` para promover código após aprovação.

## Auditoria
- Log de geração, revisão e promoção em `/audit/ai-reviews/` com `correlation_id` e `tenant_id`.
