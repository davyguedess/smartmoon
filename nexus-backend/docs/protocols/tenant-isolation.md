# Tenant Isolation Protocol

## Objetivo
Garantir que dados e recursos de cada tenant (empresa) estejam completamente isolados, impedindo acesso cruzado.

## Requisitos
- `company_id` nunca vem do cliente; sempre extraído do token.
- Todas as queries filtram por `company_id` na camada de serviço.
- Validação de escopo em endpoints críticos.
- Auditoria de acesso a recursos multi‑tenant.

## Implementação
- Dependência `require_company_scope` em `app/core/dependencies.py`.
- Middleware que adiciona `tenant_id` ao `request.state`.
- Testes de isolamento (cross‑tenant) em `tests/security/test_tenant_isolation.py`.

## Auditoria
- Log de acesso com `tenant_id` e `resource_id`.
