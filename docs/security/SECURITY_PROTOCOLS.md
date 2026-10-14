# Protocolos de Segurança — NEXUS.IA
> Versão 1.0 · 23/03/2026

---

## Protocolo 1 — Sessão e Autenticação Segura

**Status atual:** 🔴 Parcialmente implementado — JWT em localStorage (vulnerável a XSS)

### Regras

- **Não** salvar token sensível em localStorage
- Access token curto (10–15 min)
- Refresh token rotativo (7–30 dias)
- Cookie HttpOnly + Secure + SameSite=Strict
- Logout invalida refresh token no backend
- Registrar sessão por dispositivo/IP/user-agent

### Checklist de Implementação

- [ ] Mudar de `localStorage.setItem('token', ...)` para cookie HttpOnly
- [ ] Endpoint `POST /auth/logout` — invalida refresh token no banco
- [ ] Endpoint `POST /auth/refresh` — rotação obrigatória
- [ ] Tabela `sessions` ou blacklist de refresh tokens revogados
- [ ] Access token: 15 min
- [ ] Refresh token: 30 dias com rotação
- [ ] Reautenticação para ações críticas:
  - trocar senha
  - excluir conta
  - alterar API key
  - publicar fluxo
  - exportar memória

### Patch sugerido (backend)

```python
# Hoje (vulnerável):
return {"access_token": token}  # frontend salva no localStorage

# Correto:
response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,
    secure=True,
    samesite="strict",
    max_age=900,  # 15 min
)
```

---

## Protocolo 2 — Autorização Multi-Tenant Forte

**Status atual:** 🟡 Modelo existe, mas aplicação inconsistente por rota

### Regras

Toda requisição autenticada deve validar: `user_id` + `company_id` + `role` + posse do recurso

### Política de Papéis

| Role | Permissão |
|---|---|
| `owner` | Tudo da empresa |
| `admin` | Quase tudo (exceto configurações críticas de empresa) |
| `operator` | Operar fluxos e execuções |
| `analyst` | Leitura, logs, dashboards |
| `viewer` | Somente leitura básica |

### Obrigatório

- Nenhum `flow`, `execution`, `agent_memory`, `api_key_store`, `integrations` ou `audit_logs` sem filtro por `company_id`
- `company_id` extraído **somente** do token — nunca do body/query

### Dependências FastAPI a Criar

```python
# app/core/deps.py
async def require_auth() -> TokenPayload
async def require_company(user=Depends(require_auth)) -> int
async def require_role(roles: list[str])
async def require_resource_access(resource_company_id: int)
```

---

## Protocolo 3 — Proteção de Segredos e API Keys

**Status atual:** 🟡 Fernet implementado, mas fallback inseguro em produção

### Regras

- Produção **nunca** depende de fallback para mock
- Segredo da plataforma separado do segredo do cliente
- Chave **nunca** aparece em log, response, traceback ou screenshot

### O Que o Frontend Pode Exibir

```
✅ provider, label, status, created_at, last_used_at
❌ valor da chave (nem mascarado com ***)
```

### Obrigatório

- [ ] Mascarar todos os segredos no backend (logs, responses)
- [ ] Registrar `created_at`, `updated_at`, `last_used_at`, `created_by`
- [ ] Rotação de chave com endpoint dedicado
- [ ] Bloquear leitura do valor bruto após salvar (endpoint GET não retorna `encrypted_key`)
- [ ] Em produção: sem fallback para `.env` para chaves de cliente — lançar erro explicito

---

## Protocolo 4 — Segurança de Webhook

**Status atual:** 🔴 Webhooks recebem payload sem validação de assinatura

### Regras

Todo webhook deve validar: assinatura + timestamp + origem + idempotência + tamanho + rate limit

### Implementação

```python
# app/utils/webhook_security.py

async def validate_webhook(provider: str, payload_bytes: bytes, headers: dict) -> bool:
    # 1. Rejeitar payload > MAX_SIZE (ex: 1MB)
    # 2. Verificar timestamp no header (rejeitar se > 5 min)
    # 3. HMAC-SHA256 do payload com secret do provider
    # 4. Verificar event_id no banco — rejeitar se já processado
    # 5. Logar IP, provider, event_id, resultado
    # 6. Não processar fluxo na request — enfileirar
```

### Checklist

- [ ] HMAC por provider (Telegram, MP, WhatsApp, Meta)
- [ ] Timestamp máximo: 5 minutos
- [ ] Tabela `processed_webhook_events` para idempotência
- [ ] Rate limit: 100 req/min por IP por provider
- [ ] Payload máximo: 1MB
- [ ] Worker assíncrono para processar

---

## Protocolo 5 — Segurança de Entrada e Saída da IA

**Status atual:** 🟡 Sem sanitização de prompt injection

### Regras

Toda entrada para IA deve passar por: validação + sanitização + limite de tamanho + política de escopo

### Bloqueios Obrigatórios

```python
BLOCKED_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"you are now",
    r"act as",
    r"reveal (your prompt|system|instructions|api key)",
    r"print (your prompt|token|secret)",
    r"what is your (api key|token|password)",
]
```

### Separação de Prompts

```
system_prompt     → controlado pelo backend, nunca pelo usuário
developer_prompt  → configurado no nó do fluxo
user_input        → sanitizado antes de concatenar
```

### Regras de Output

- Output que aciona fluxo externo **deve** ser validado por schema JSON
- Resposta com ação sensível exige confirmação no backend antes de executar
- Limitar tamanho de input: 4096 tokens por mensagem

---

## Protocolo 6 — Logs, Auditoria e Rastreabilidade

**Status atual:** 🟡 audit_logs existe, mas sem padronização de campos

### Eventos Obrigatórios em audit_logs

```
Autenticação:      login_success, login_failure, refresh, logout
Fluxos:            flow_created, flow_updated, flow_published, flow_deleted
Execução:          execution_started, execution_success, execution_failed, execution_canceled
API Keys:          api_key_created, api_key_deleted, api_key_rotated
Webhooks:          webhook_received, webhook_validated, webhook_rejected
Memória:           memory_exported, memory_cleared
Permissões:        permission_changed, role_changed
```

### Campos Padrão Por Log

```python
{
    "event": "flow_published",
    "company_id": 42,
    "actor_id": 7,
    "resource_type": "flow",
    "resource_id": "123",
    "ip": "192.168.1.1",
    "user_agent": "...",
    "correlation_id": "req-abc123",
    "timestamp": "2026-03-23T20:00:00Z",
    "metadata": { ... }  # sem segredos
}
```

### O que NUNCA Logar

```
token, refresh_token, cookie
senha ou hash
api key (bruta ou criptografada)
payload bruto de webhook
dados pessoais completos
```

---

## Protocolo 7 — Execução Segura de Fluxos

**Status atual:** 🔴 Execuções síncronas sem timeout, sem fila

### Regras

Cada execução deve ter: timeout + retry controlado + circuit breaker + cancelamento real + isolamento por empresa

### Implementação Mínima

```python
# Por nó de IA (handlers):
TIMEOUT_PER_NODE = {
    "openai": 60,
    "gemini": 60,
    "claude": 90,
    "groq": 30,
    "ollama": 120,
    "elevenlabs": 30,
    "whisper": 60,
}

MAX_STEPS_PER_FLOW = 50
MAX_CONCURRENT_PER_TENANT = 5
MAX_AI_CALLS_PER_FLOW = 10

# Snapshot imutável ao publicar:
flow.published_snapshot = deepcopy(flow.definition_json)
```

### Checklist

- [ ] Redis + Celery/RQ para jobs longos
- [ ] Limite de concorrência por tenant
- [ ] Limite de steps por fluxo
- [ ] Timeout por tipo de nó
- [ ] Circuit breaker para providers externos
- [ ] Cancelamento real com `execution.status = "canceled"`
- [ ] Snapshot imutável ao publicar
- [ ] Dead-letter queue para falhas repetidas

---

## Roadmap de Implementação

### Fase 1 — Segurança e Base (Imediato)
1. [ ] Protocolo 1: cookie HttpOnly para JWT
2. [ ] Protocolo 2: dependências RBAC em todas as rotas
3. [ ] Protocolo 4: validação de assinatura em webhooks
4. [ ] Protocolo 6: padronizar campos de audit_logs
5. [ ] Protocolo 3: bloquear leitura de chave bruta no GET

### Fase 2 — Estabilidade (Próximo sprint)
6. [ ] Protocolo 7: Redis + fila + timeout por nó
7. [ ] Protocolo 5: sanitização de prompt injection
8. [ ] Protocolo 3: rotação de chaves + registro de uso

### Fase 3 — Maturidade
9. [ ] Protocolo 1: registro de sessão por device
10. [ ] Protocolo 6: alertas automáticos em eventos críticos
11. [ ] Protocolo 7: snapshot imutável de fluxo publicado
