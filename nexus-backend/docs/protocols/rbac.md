# RBAC Protocol

## Objetivo
Definir políticas de Controle de Acesso Baseado em Funções (RBAC) para garantir que usuários só possam executar ações permitidas de acordo com suas funções e escopos.

## Requisitos
- **Funções Principais**: `owner`, `admin_super`, `admin`, `manager`, `user`, `guest`.
- **Escopos de Acesso**: `global`, `company`, `project`, `resource`.
- **Hierarquia de Funções**: `owner > admin_super > admin > manager > user > guest`.
- **Permissões**: Mapeamento de permissões (`read`, `write`, `delete`, `manage`) por função e escopo.
- **Validação**: Todas as rotas protegidas devem usar dependências `require_role` e `require_scope`.
- **Limitações**: Nenhum endpoint crítico deve confiar em `company_id` fornecido pelo cliente; sempre extraído do token.
- **Auditoria**: Registro de tentativas de acesso não autorizadas.

## Implementação
- Arquivo `app/core/roles.py` define enum `Role` e hierarquia.
- Arquivo `app/core/permissions.py` contém dicionário `PERMISSIONS` mapeando (`role`, `scope`) → conjunto de ações.
- Dependências em `app/core/dependencies.py`:
  - `require_role(required_role: Role)` verifica se o usuário tem função igual ou superior.
  - `require_scope(resource_company_id: str)` garante que `tenant_id` do token coincide.
- Decoradores `@has_permission(action)` aplicados nos routers.
- Middleware `rbac_audit.py` registra tentativas falhas.

## Auditoria
- Log de cada verificação de permissão com `correlation_id`, `tenant_id`, `user_id`, `action`, `resource_id`.
- Retenção de logs de RBAC por 180 dias.
