# Admin Dashboard — NEXUS.IA

> Documentação do módulo administrativo da plataforma NEXUS.IA.
> Versão 1.0 · Abril 2026

## Visão Geral

O Admin Dashboard é um painel de controle interno para operadores com role `owner` ou `admin`.
Acesso controlado pela feature flag `ADMIN_PANEL_ENABLED` (default `false` em produção).

## Funcionalidades

### 1. Servidor (`/admin/server`)
- Métricas de CPU, RAM, disco em tempo real
- Uptime do processo backend
- Serviços conectados: PostgreSQL, Redis, Ollama

### 2. Explorador de Arquivos (`/admin/files`)
- Navegação pelo filesystem do servidor
- Leitura de arquivos de texto (max 500KB)
- Bloqueio automático de `.env`, `.pem`, `.key`, `node_modules`, `.git`

### 3. Banco de Dados (`/admin/database`)
- Listagem de tabelas com contagem de registros
- Visualização de dados com máscara automática de colunas sensíveis
- Stats de tamanho e conexões ativas

## Segurança

- **Autenticação**: Todas as rotas exigem role `admin` ou `owner`
- **Feature flag**: `ADMIN_PANEL_ENABLED=true` obrigatório
- **Mascaramento**: Colunas `password_hash`, `encrypted_key`, `token_hash` etc. → `***MASKED***`
- **Bloqueio de paths**: Arquivos `.env`, certificados, `__pycache__` nunca retornados
- **SQL Injection**: Validação de nome de tabela antes de queries dinâmicas

## Rotas Frontend

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/admin` | `AdminServer.jsx` | Shell com tabs |
| Tab: Servidor | `ServerTab` | Métricas do servidor |
| Tab: Arquivos | `FilesTab` | Explorador de arquivos |
| Tab: Banco | `DatabaseTab` | Inspetor de banco de dados |

## Rotas Backend

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/admin/server` | GET | Métricas do servidor |
| `/admin/files` | GET | Lista arquivos/diretórios |
| `/admin/files/content` | GET | Conteúdo de arquivo |
| `/admin/database` | GET | Tabelas com schemas |
| `/admin/database/{table}` | GET | Dados de uma tabela |
| `/admin/database/stats/overview` | GET | Stats do banco |

## Expansão Planejada

- `GET /admin/users` — listagem de usuários do sistema
- `GET /admin/agents` — listagem de agentes por empresa
- `GET /admin/billing` — visão de billing/MRR
- `GET /admin/audit-logs` — logs de auditoria completos
- `POST /admin/users/{id}/toggle` — ativar/desativar usuário
