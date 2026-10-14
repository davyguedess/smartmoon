# NEXUS.IA — Documentação de Segurança e Governança

## Índice

### Skills (Instruções para IA)
- [SKILL_FRONTEND.md](security/SKILL_FRONTEND.md) — Regras de frontend seguro e UX
- [SKILL_BACKEND.md](security/SKILL_BACKEND.md) — Regras de backend seguro e multi-tenant
- [SKILL_AI_AUDITOR.md](security/SKILL_AI_AUDITOR.md) — Como auditar código gerado por IA

### Governança
- [AI_GOVERNANCE.md](security/AI_GOVERNANCE.md) — Regras de ouro e fluxo de promoção de código
- [SECURITY_PROTOCOLS.md](security/SECURITY_PROTOCOLS.md) — 7 protocolos de segurança com status e checklist

### Arquitetura
- [PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md) — Estrutura de diretórios e política de governança

---

## Status dos Protocolos

| Protocolo | Status | Prioridade |
|---|---|---|
| 1 — Sessão e Autenticação | 🔴 JWT em localStorage | Urgente |
| 2 — Autorização Multi-Tenant | 🟡 Modelo existe, aplicação inconsistente | Alta |
| 3 — Proteção de Segredos | 🟡 Fernet ok, fallback inseguro em prod | Alta |
| 4 — Segurança de Webhook | 🔴 Sem validação de assinatura | Urgente |
| 5 — Segurança de IA | 🟡 Sem sanitização de prompt injection | Média |
| 6 — Logs e Auditoria | 🟡 audit_logs existe, sem padronização | Média |
| 7 — Execução de Fluxos | 🔴 Síncrono sem timeout ou fila | Urgente |

---

## Como Usar as Skills

1. Copie o conteúdo da skill relevante
2. Cole no início da conversa com a IA como contexto
3. A IA seguirá as regras definidas como se fossem instruções de sistema

Exemplo:
```
[Cole SKILL_BACKEND.md aqui]

Agora implemente um endpoint para...
```
