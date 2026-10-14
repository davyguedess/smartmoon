# PROJECT_STRUCTURE — NEXUS.IA
> Versão 1.0 · 23/03/2026

## Estrutura de Diretórios

```
/BETA1
├── nexus-backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/routes/     # Endpoints (auth, flows, executions, webhooks...)
│   │   ├── core/           # Config, logging, exceptions, deps
│   │   ├── db/             # Session, repositories
│   │   ├── engine/         # FlowExecutor, handlers, node_registry
│   │   ├── models/         # SQLAlchemy models (10 tabelas)
│   │   ├── schemas/        # Pydantic request/response
│   │   ├── services/       # Regras de negócio
│   │   └── utils/          # Helpers, webhook_security, masks
│   ├── alembic/            # Migrations de produção
│   └── venv/               # Dependências Python
│
├── nexus-ia/               # React frontend
│   └── src/
│       ├── api/            # Client HTTP centralizado
│       ├── components/     # Componentes reutilizáveis
│       ├── guards/         # PrivateRoute, RoleGuard
│       ├── hooks/          # useAuth, usePermission
│       ├── pages/          # Dashboard, Chat, Flows...
│       ├── schemas/        # Validação de formulário
│       └── services/       # Lógica de negócio
│
├── docs/
│   ├── architecture/       # Diagramas e decisões de arquitetura
│   ├── security/           # Skills, protocolos, AI governance
│   │   ├── SKILL_FRONTEND.md
│   │   ├── SKILL_BACKEND.md
│   │   ├── SKILL_AI_AUDITOR.md
│   │   ├── AI_GOVERNANCE.md
│   │   └── SECURITY_PROTOCOLS.md
│   ├── api/                # Documentação de endpoints
│   ├── flows/              # Documentação de fluxos
│   └── runbooks/           # Procedimentos operacionais
│
├── tests/
│   ├── unit/               # Testes de handlers, utils
│   ├── integration/        # Testes de rotas com DB real
│   ├── e2e/                # Playwright ou Cypress
│   ├── fixtures/           # Dados de teste
│   ├── factories/          # Factories de objetos de teste
│   └── security/           # Testes de segurança (pentest automatizado)
│
├── migrations/
│   ├── versions/           # Migrations aprovadas de produção
│   ├── seeds/              # Dados iniciais
│   └── rollback/           # Scripts de rollback
│
├── sandbox/                # "Quarentenário técnico" — tudo que a IA gera
│   ├── ai-generated/       # Código gerado por IA ainda não revisado
│   ├── experiments/        # Testes técnicos e provas de conceito
│   ├── spike/              # Spikes de arquitetura
│   ├── scratch/            # Rascunhos rápidos
│   ├── draft-migrations/   # Migrations NÃO aprovadas — nunca para produção
│   └── disposable/         # Arquivos temporários (expiram em 48h)
│
├── audit/
│   ├── ai-reviews/         # Relatórios do SKILL_AI_AUDITOR
│   ├── security-scans/     # Resultados de análise de segurança
│   ├── architecture-reviews/ # Revisões de arquitetura por sprint
│   └── remediation-plans/  # Planos de correção de problemas
│
├── requests/
│   ├── product/            # Solicitações de produto
│   ├── technical/          # Débitos e RFC técnicas
│   ├── bug_reports/        # Issues encontradas
│   ├── ai_prompts/         # Prompts utilizados com a IA
│   └── change_requests/    # Pedidos de mudança formais
│
└── scripts/
    ├── dev/                # Scripts de ambiente local
    ├── ops/                # Scripts de operação
    ├── migrations/         # Scripts auxiliares de migration
    └── cleanup/            # Limpeza de dados e recursos
```

---

## Regra de Ouro

> **Nenhum arquivo de `sandbox/` pode ser importado pelo código principal.**

A única direção possível é:
```
sandbox/ → revisão → promoção para pasta oficial → commit
```

## Política de Limpeza do Sandbox

- `sandbox/disposable/` → limpar em 48h
- `sandbox/ai-generated/` → revisar ou apagar em 7 dias
- `sandbox/scratch/` → limpar a cada sprint
- `sandbox/draft-migrations/` → nunca subir sem revisão humana
