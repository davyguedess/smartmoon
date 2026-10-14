# Auditoria SmartMoon — 2026-10-11

Análise estática completa do código (backend, frontend, engine, Docker, Nginx).
Nada editado, nada executado na VPS. Caminhos relativos a `nexus-backend/`.

---

## CRÍTICO (7 itens)

### C1. Qualquer usuário cadastrado lê o banco inteiro e o código do servidor
- `app/api/routes/admin/admin.py` linhas 78, 104, 130, 147, 167, 177 usam `require_admin`
- `require_admin` (`app/core/dependencies.py:68`) só exige role owner/admin do tenant
- `/auth/register` público cria todo usuário como `owner`
- Resultado: qualquer pessoa que se cadastre acessa `/admin/server`, `/admin/files`, `/admin/database`
- `integrations.config_json` (tokens WhatsApp/Telegram) não está na máscara
- **Fix:** trocar por `require_superadmin` nos 6 endpoints

### C2. Endpoints WhatsApp e Telegram sem autenticação
- `whatsapp.py` sem `Depends`: PATCH connect-flow, DELETE numbers, GET messages, POST send, handoff, resume
- `telegram.py`: 9 endpoints listam/alteram conversas de todos os tenants sem login
- `voice_v2.py:98,110`: DELETE voice profile e upload sem auth
- **Fix:** adicionar `Depends(get_current_user)` + filtro por tenant

### C3. Refresh token com colisão de hash (JÁ PARCIALMENTE CORRIGIDO)
- Token JWT sem `jti` nem `iat` — dois tokens no mesmo segundo são idênticos
- `token_hash` é UNIQUE → `IntegrityError` → 500
- Login com duplo clique, register auto-login (`except: pass` = cookie sem token no banco)
- **Fix parcial aplicado:** `SELECT FOR UPDATE (skip_locked)` + catch de erro
- **Fix completo:** adicionar `jti=uuid4()` e `iat` ao payload

### C4. Logout nunca revoga tokens no servidor
- Cookie `refresh_token` tem `path="/auth/refresh"` → browser não envia para `/auth/logout`
- `auth.py:187` sempre vê `raw_refresh=None`, só limpa cookies, token válido por 30 dias
- **Fix:** mudar path do cookie para `/auth` ou aceitar via header

### C5. Segredos fracos ou padrão
- `SECRET_KEY` default `""` sem validação de arranque — permite forjar JWT de superadmin
- `.env.production` com `SECRET_KEY` e `POSTGRES_PASSWORD` previsíveis
- `CREDENTIALS_ENCRYPTION_KEY` placeholder → chaves de API de clientes decifráveis
- **Fix:** validar no startup (falhar se vazio), gerar chaves aleatórias, rotacionar

### C6. Segredos reais em arquivos do repositório
- `.env.production`: Gemini key (`AIza…`) e Groq key (`gsk_…`)
- `google_credentials.json` e `google_token.json` na raiz
- `scripts/deploy_vps.sh:2`: senha root SSH em texto puro
- `duarte_sync.py:30,33`: API keys hardcoded
- Sem `.dockerignore` — `COPY .` embute `.env`, `.env.production`, venv (318 MB)
- **Fix:** rotacionar tudo, criar `.dockerignore`

### C7. Pagamento PIX nunca ativa a assinatura
- `/auth/register` cria PIX sem gravar `PaymentCharge`
- Webhook do MercadoPago busca `PaymentCharge` por ID → `charge_not_found`
- Resultado: quem paga fica em `pending_payment` para sempre
- **Fix:** gravar `PaymentCharge` no register ou casar pela referência

### C8. Worker Celery não consome filas certas e sem beat
- Worker sem `-Q`: filas `webhooks`, `tts`, `dead_letter` ficam paradas no Redis
- Sem serviço `celery beat`: nenhuma tarefa agendada roda
- **Fix:** adicionar `-Q execution,webhooks,tts,dead_letter` e serviço beat

---

## ALTO (12 itens)

### A1. Broadcast CRM não funciona
- `tasks.py:1376` filtra `provider=="smartmoon_whatsapp"` mas o código usa `"smartmoon"`
- `datetime`/`timezone` usado antes do import → `UnboundLocalError`
- `func` sem import → `NameError`. Broadcast nunca fecha como `completed`

### A2. Frontend chama rotas inexistentes no backend
- `/crm/pipeline/*` (stages, board, assign, handoff, resume)
- `/crm/reception`, `/crm/team`, `/crm/messages/send-media`
- `/voice/v2/channel-voice`
- `/agents/profiles` (backend tem `/agent/profiles` singular)

### A3. Nginx devolve HTML do SPA para rotas de API
- Rotas não configuradas: `/projects`, `/financial`, `/analytics`, `/knowledge`, `/system`
- Frontend recebe HTML 200, interpreta como "sessão expirada" → loop de refresh

### A4. Admin APIs externas aberto para qualquer owner
- `external_apis_admin.py` usa `require_admin` (tenant) em vez de `require_superadmin`
- Risco de SSRF via endpoint `/test` com `base_url` controlada

### A5. Webhooks sem verificação quando segredo vazio
- Telegram, Z-API: nunca validam secret
- WhatsApp Cloud: só valida se `META_WHATSAPP_APP_SECRET` preenchido (default "")
- SmartMoon Engine: API key vazia = sem autenticação

### A6. Validação HMAC do MercadoPago errada
- Calcula `HMAC(secret, body)` mas formato real do MP é `ts=…,v1=…` sobre manifesto
- Webhook da Meta: `hub_mode` sem `alias="hub.mode"` → verificação nunca funciona

### A7. Assinatura paga sem pagar (fail-open)
- Se consulta a `subscriptions` falha → retorna `True` (allow access)
- Tabela `subscriptions` só criada via `_ensure_subscriptions_tables` em rota admin
- No register, criação da assinatura em try/except → empresa fica com plano pago

### A8. Quotas nunca aplicadas
- `quota.py:48` lê `request.state.user` que ninguém atribui
- Middleware sempre passa. Limite de tokens por plano nunca enforced

### A9. Dependências de serviços removidos (Qdrant, Kokoro, LocalAI, Ollama)
- `AgentProfile.provider` default `"ollama"` → conexão falha dentro do container
- Qdrant: `get_vector_service()` tenta conectar e loga erro em toda busca de memória
- TTS: espera timeout em `localhost:8880` antes de fallback
- `PUBLIC_API_URL` ainda aponta para VPS antiga 187.127.14.153

### A10. Vazamento de conexões no Celery
- `session.py` mantém engine por event loop, `run_async` cria loop novo por tarefa
- Cada tarefa deixa engine com conexões abertas → `too many clients`
- **Fix:** `NullPool` para Celery ou `dispose()` no finally

### A11. Import quebrado em limits_service
- `CompanyPaymentLimits` não existe em `payments/models.py`
- Limites por empresa nunca valem (except devolve defaults)

### A12. Segurança do motor Node e compose
- Engine usa `API_KEY || 'smartmoon-dev-key'`
- WebSocket `/ws/:instanceId` sem API key
- `send-image/audio/document` leem qualquer caminho do disco
- Compose dev publica Postgres 5432 e Redis 6379 sem senha em 0.0.0.0

---

## MÉDIO (7 itens)

### M1. Auth edge cases
- Login revoga TODOS os tokens → só 1 sessão por usuário (celular derruba desktop)
- Refresh não inclui `is_superadmin` no token renovado
- `/auth/ws-token` devolve JWT HttpOnly para JS → anula proteção contra XSS
- Rate limit usa email case-sensitive → variar maiúsculas contorna bloqueio
- Sem hash fictício quando usuário não existe → timing permite enumerar emails
- Register sem rate limit nem captcha, email não validado

### M2. Banco e migrações
- Alembic com 3 raízes — ordem não garantida
- `plans` não criada por migration (só por SQL avulso)
- ~15 tabelas sem DDL, criadas só via `create_all` (que exige `DEBUG=true`)
- Seed necessário: planos, superadmin, termos de uso — sem script no repo

### M3. Imports/nomes quebrados
- `send_whatsapp_handler.py:262`: `settings` não importado → envio de imagem falha
- `charge_service.py:484`: import inexistente → webhook `payment.confirmed` nunca dispara
- Dependências ausentes de requirements.txt: `fal_client`, `weasyprint`, `bs4`, `gtts`, `aioredis`

### M4. Rotas duplicadas
- `/admin/payments/withdrawals*` em 2 arquivos diferentes

### M5. Uploads perdidos no deploy
- `./uploads/brand`, `./uploads/studio`, `./storage/invoices` sem volume
- Somem a cada `docker compose up --build`

### M6. Permissões de volume
- Motor roda como UID 1001, API como root → diretório de mídia pode ficar inacessível

### M7. Outras
- Templates de marketing editáveis por qualquer owner
- `/luna/audio/{path}` público com sanitização frágil
- `_safe_path` aceita prefixo irmão

---

## BAIXO
- JSON de audit_logs montado com f-string (quebra com aspas no email)
- Dockerfiles sem HEALTHCHECK e sem usuário não-root
- `docker-compose.prod.yml` ainda tem qdrant/kokoro/localai (6 GB extra)
- `slowapi`/`global_rate_limiter` não ligados em main.py
- Mensagens de erro devolvem detalhes internos

---

## PLANO DE AÇÃO

### Onda 1 — Segurança crítica (URGENTE)
1. C1: Trocar `require_admin` por `require_superadmin` nos 6 endpoints admin
2. C2: Adicionar auth nos endpoints WhatsApp, Telegram e Voice
3. C5: Validar SECRET_KEY no startup, gerar chaves fortes
4. C6: Criar `.dockerignore`, rotacionar segredos, remover do repo
5. A5: Validar webhooks mesmo com segredo vazio (rejeitar)
6. A12: Trocar API key default do engine, proteger WebSocket

### Onda 2 — Login/Auth funcional
1. C3: Adicionar `jti=uuid4()` + `iat` no refresh token
2. C4: Corrigir path do cookie refresh para `/auth` (logout funcionar)
3. M1: Permitir múltiplas sessões, incluir `is_superadmin` no refresh
4. M1: Rate limit case-insensitive, timing-safe na busca de email

### Onda 3 — Pagamentos e worker
1. C7: Gravar PaymentCharge no register, corrigir webhook match
2. C8: Adicionar `-Q` ao worker e serviço celery beat
3. A6: Corrigir HMAC do MercadoPago e verificação Meta
4. A7: Criar migration para `subscriptions`/`transactions`, não fail-open
5. A11: Criar modelo `CompanyPaymentLimits`

### Onda 4 — Funcionalidade
1. A1: Corrigir provider filter e imports no broadcast CRM
2. A2: Criar rotas faltantes (pipeline, reception, team) ou stub
3. A3: Adicionar rotas Nginx para todos os prefixos de API
4. A9: Trocar defaults para `groq`/`gemini`, desativar serviços removidos
5. A10: NullPool para Celery, dispose no finally

### Onda 5 — Infraestrutura
1. M2: Unificar migrations, criar script de seed
2. M3: Corrigir imports quebrados
3. M5: Adicionar volumes para uploads
4. Criar `.dockerignore` e healthchecks
5. Remover serviços mortos do compose
