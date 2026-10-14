# AI Governance Rules — NEXUS.IA
> Versão 1.0 · 23/03/2026 · Documento vivo — atualizar a cada sprint

---

## Regras de Ouro

| # | Regra |
|---|---|
| 1 | Nenhum código gerado por IA entra direto em produção |
| 2 | Todo arquivo gerado por IA começa em `sandbox/ai-generated/` |
| 3 | Toda migration gerada por IA vai primeiro para `sandbox/draft-migrations/` |
| 4 | Alterações em auth, billing, webhooks, api keys ou tenant isolation **exigem revisão humana** |
| 5 | Nenhum segredo pode aparecer em prompt, log, screenshot ou resposta da IA |
| 6 | Toda rota nova precisa de: autenticação, autorização, auditoria |
| 7 | Toda query nova precisa de filtro por `company_id` quando aplicável |
| 8 | Todo output que aciona fluxo externo precisa de validação de schema |
| 9 | Todo patch gerado deve incluir: risco, impacto e rollback |
| 10 | Código de IA sem teste ou revisão não sobe para produção |

---

## Fluxo de Promoção de Código

```
IA gera arquivo
       ↓
sandbox/ai-generated/
       ↓
Revisão técnica (ou SKILL_AI_AUDITOR)
       ↓
Teste local validado
       ↓
Ajustes e refinamentos
       ↓
Promoção para pasta oficial (app/, src/, migrations/)
       ↓
Commit com descrição clara
       ↓
Deploy (com rollback plan)
```

---

## Política de Expiração do Sandbox

| Pasta | Política |
|---|---|
| `sandbox/disposable/` | Apagar em até 48h |
| `sandbox/ai-generated/` | Revisão em até 7 dias ou apagar |
| `sandbox/draft-migrations/` | Nunca subir sem revisão — apagar se não aprovada |
| `sandbox/experiments/` | Manter até spike concluído |
| `sandbox/scratch/` | Limpar a cada sprint |

---

## Áreas de Alto Risco — Revisão Humana Obrigatória

Qualquer alteração nas seguintes áreas exige revisão humana antes de merge:

- `app/core/auth.py` — autenticação
- `app/api/routes/auth.py` — login, logout, refresh
- `app/models/__init__.py` — schema do banco
- `app/engine/executor.py` — motor de execução
- `app/engine/handlers/key_resolver.py` — resolução de chaves
- `migrations/versions/` — migrations de produção
- qualquer arquivo que toque `company_id`, `user_id`, `encrypted_key`

---

## O que a IA PODE fazer sem revisão prévia

- Criar componentes React de UI sem lógica de negócio
- Criar utilitários de formatação e display
- Adicionar rotas de leitura (GET) não sensíveis
- Criar documentação e comentários
- Refatorar formatação e nomes sem mudar lógica
- Criar testes unitários

---

## O que a IA NUNCA pode fazer sem revisão

- Alterar fluxo de autenticação ou sessão
- Alterar lógica de company_id
- Alterar criptografia ou resolução de segredos
- Criar migration de produção
- Alterar webhooks
- Modificar executor de fluxos
- Adicionar dependências npm/pip sem análise de segurança

---

## Convenções de Commit para Código de IA

```
feat(ai-gen): [descrição] — revisado
fix(ai-gen): [descrição] — auditado
refactor(ai-gen): [descrição]

# Prefixo "[AI]" indica que o patch veio da IA e passou por revisão
```

---

## Contato para Dúvidas de Segurança

Antes de aplicar qualquer mudança em área sensível, consulte:
1. `docs/security/SKILL_BACKEND.md`
2. `docs/security/SKILL_AI_AUDITOR.md`
3. `audit/security-scans/` — relatórios anteriores
