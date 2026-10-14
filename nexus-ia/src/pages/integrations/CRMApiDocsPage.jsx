/**
 * CRM API Docs — Complete interactive documentation for the SmartMoon Public API.
 * Covers WhatsApp connection + CRM management.
 */
import { useState } from 'react'
import '../crm/CRM.css'
import './CRMApiDocs.css'

const BASE = 'https://smartmoon.online'

const STEPS = [
  { num: '1', title: 'Criar API Key', desc: 'Acesse API Pública no painel e crie uma chave.', cmd: '' },
  { num: '2', title: 'Conectar WhatsApp', desc: 'Crie uma instância e escaneie o QR Code.', cmd: `curl -X POST "${BASE}/v1/whatsapp/instances" \\\n  -H "Authorization: Bearer sm_SUA_CHAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "vendas"}'` },
  { num: '3', title: 'Escanear QR', desc: 'Exiba o QR no seu sistema para o usuário conectar.', cmd: `curl "${BASE}/v1/whatsapp/instances/vendas/qr" \\\n  -H "Authorization: Bearer sm_SUA_CHAVE"` },
  { num: '4', title: 'Pronto!', desc: 'Mensagens recebidas criam contatos no CRM automaticamente.', cmd: '' },
]

const WHATSAPP_ENDPOINTS = [
  { method: 'POST', path: '/v1/whatsapp/instances', desc: 'Criar instância WhatsApp', body: '{ "name": "vendas", "webhook_url": "https://seu-sistema.com/webhook" }', response: '{ "instance_name": "vendas", "status": "pending", "next_step": "GET /v1/whatsapp/instances/vendas/qr" }' },
  { method: 'GET', path: '/v1/whatsapp/instances/{name}/qr', desc: 'Obter QR Code (base64)', response: '{ "status": "QR_READY", "qrCode": "data:image/png;base64,..." }' },
  { method: 'GET', path: '/v1/whatsapp/instances/{name}/status', desc: 'Status da instância', response: '{ "status": "CONNECTED", "phoneNumber": "5511999998888" }' },
  { method: 'GET', path: '/v1/whatsapp/instances', desc: 'Listar instâncias' },
  { method: 'POST', path: '/v1/whatsapp/messages/send-text', desc: 'Enviar texto direto', body: '{ "instance_name": "vendas", "phone": "5511999998888", "text": "Olá!" }' },
  { method: 'POST', path: '/v1/whatsapp/messages/send-image', desc: 'Enviar imagem', body: '{ "instance_name": "vendas", "phone": "5511999998888", "image_url": "https://...", "caption": "Confira!" }' },
  { method: 'POST', path: '/v1/whatsapp/instances/{name}/webhook', desc: 'Configurar Webhook', body: '{ "url": "https://seu-sistema.com/webhook" }' },
  { method: 'DELETE', path: '/v1/whatsapp/instances/{name}', desc: 'Remover instância' },
]

const CRM_ENDPOINTS = [
  {
    group: 'Contatos', icon: '👥',
    items: [
      { method: 'GET', path: '/v1/crm/contacts', desc: 'Listar contatos', params: 'search, tag, status, page, per_page', response: '{ "total": 150, "page": 1, "contacts": [{ "id": 1, "name": "João", "phone": "5511999998888", "tags": ["vip"], "status": "active" }] }' },
      { method: 'POST', path: '/v1/crm/contacts', desc: 'Criar contato', body: '{\n  "name": "João Silva",\n  "phone": "5511999998888",\n  "email": "joao@email.com",\n  "tags": ["cliente"],\n  "source": "api",\n  "notes": "Lead via landing page"\n}', response: '{ "id": 42, "name": "João Silva", "phone": "5511999998888", ... }' },
      { method: 'GET', path: '/v1/crm/contacts/{id}', desc: 'Detalhe do contato' },
      { method: 'PUT', path: '/v1/crm/contacts/{id}', desc: 'Atualizar contato', body: '{ "name": "João Silva", "tags": ["vip", "cliente"], "status": "active" }' },
      { method: 'DELETE', path: '/v1/crm/contacts/{id}', desc: 'Remover contato' },
      { method: 'POST', path: '/v1/crm/contacts/import-csv', desc: 'Importar CSV', body: 'FormData: file (CSV com colunas: name, phone, email, tags)', response: '{ "created": 45, "skipped": 3, "errors": ["Linha 12: telefone inválido"] }' },
    ],
  },
  {
    group: 'Tags', icon: '🏷️',
    items: [
      { method: 'GET', path: '/v1/crm/tags', desc: 'Listar tags', response: '{ "tags": [{ "id": 1, "name": "VIP", "color": "#10b981" }] }' },
      { method: 'POST', path: '/v1/crm/tags', desc: 'Criar tag', body: '{ "name": "VIP", "color": "#10b981" }' },
      { method: 'DELETE', path: '/v1/crm/tags/{id}', desc: 'Remover tag' },
    ],
  },
  {
    group: 'Respostas Rápidas', icon: '⚡',
    items: [
      { method: 'GET', path: '/v1/crm/quick-replies', desc: 'Listar respostas', response: '{ "quick_replies": [{ "id": 1, "title": "Saudação", "shortcut": "/ola", "content": "Olá! Como posso ajudar?" }] }' },
      { method: 'POST', path: '/v1/crm/quick-replies', desc: 'Criar resposta', body: '{\n  "title": "Saudação",\n  "shortcut": "/ola",\n  "content": "Olá {{contact_name}}! Como posso ajudar?"\n}' },
    ],
  },
  {
    group: 'Mensagens', icon: '💬',
    items: [
      { method: 'POST', path: '/v1/crm/messages/send', desc: 'Enviar mensagem a contato', body: '{\n  "contact_id": 42,\n  "message": "Olá! Tudo bem?",\n  "operator_name": "Maria"\n}', response: '{ "key": { "id": "BAE5..." }, "status": "PENDING" }' },
      { method: 'GET', path: '/v1/crm/messages/history/{contact_id}', desc: 'Histórico de chat', params: 'page, per_page', response: '{ "contact_id": 42, "messages": [\n  { "id": 1, "direction": "inbound", "content": "Oi!", "operator": null, "created_at": "..." },\n  { "id": 2, "direction": "outbound", "content": "Olá!", "operator": "Maria", "created_at": "..." }\n] }' },
    ],
  },
  {
    group: 'Campanhas (Broadcasts)', icon: '📢',
    items: [
      { method: 'GET', path: '/v1/crm/broadcasts', desc: 'Listar campanhas', params: 'status' },
      { method: 'POST', path: '/v1/crm/broadcasts', desc: 'Criar campanha', body: '{\n  "name": "Promoção Maio",\n  "message_template": "Olá {{contact_name}}, aproveite 30% OFF!",\n  "target_filter": { "tags": ["cliente"] }\n}', response: '{ "id": 5, "name": "Promoção Maio", "total_targets": 120 }' },
      { method: 'POST', path: '/v1/crm/broadcasts/{id}/start', desc: 'Iniciar disparo' },
      { method: 'POST', path: '/v1/crm/broadcasts/{id}/pause', desc: 'Pausar disparo' },
    ],
  },
  {
    group: 'Métricas', icon: '📊',
    items: [
      { method: 'GET', path: '/v1/crm/metrics/overview', desc: 'KPIs do CRM', params: 'days (padrão: 30)', response: '{\n  "period_days": 30,\n  "total_contacts": 340,\n  "new_contacts": 28,\n  "messages_sent": 1250,\n  "total_sales": 15,\n  "total_revenue": 4500.00\n}' },
    ],
  },
]

const ERRORS = [
  { code: '401', desc: 'API Key inválida, revogada ou expirada', fix: 'Verifique o header Authorization' },
  { code: '404', desc: 'Recurso não encontrado (contato, tag, campanha)', fix: 'Confirme o ID na URL' },
  { code: '409', desc: 'Conflito — contato com mesmo telefone já existe', fix: 'Use PUT para atualizar' },
  { code: '429', desc: 'Rate limit excedido (60 req/min por chave)', fix: 'Aguarde 60s e reenvie' },
  { code: '502', desc: 'Erro ao comunicar com o WhatsApp', fix: 'Verifique se a instância está conectada' },
]

const MC = { GET: '#10b981', POST: '#3b82f6', PUT: '#f59e0b', DELETE: '#ef4444' }

export default function CRMApiDocsPage() {
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(null)
  const [tab, setTab] = useState('quickstart')

  const copy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const curl = (ep) => {
    let cmd = `curl -X ${ep.method} "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer sm_SUA_CHAVE"`
    if (ep.body && !ep.body.startsWith('FormData')) {
      cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body}'`
    }
    return cmd
  }

  const toggle = (id) => setExpanded(expanded === id ? null : id)

  const renderEndpoint = (ep, groupKey, i) => {
    const id = `${groupKey}-${i}`
    const isOpen = expanded === id
    return (
      <div key={id} className={`crm-api-endpoint ${isOpen ? 'open' : ''}`}>
        <div className="crm-api-ep-header" onClick={() => toggle(id)}>
          <span className="crm-api-method" style={{ background: MC[ep.method] }}>{ep.method}</span>
          <code className="crm-api-path">{ep.path}</code>
          <span className="crm-api-desc">{ep.desc}</span>
          <span className="crm-api-chevron">{isOpen ? '▾' : '▸'}</span>
        </div>
        {isOpen && (
          <div className="crm-api-ep-detail">
            {ep.params && <div className="crm-api-params"><strong>Query Params:</strong> {ep.params}</div>}
            {ep.body && <div className="crm-api-body"><strong>Request Body:</strong><pre>{ep.body}</pre></div>}
            {ep.response && <div className="crm-api-body"><strong>Resposta:</strong><pre>{ep.response}</pre></div>}
            <div className="crm-api-curl">
              <div className="crm-api-curl-header">
                <strong>cURL</strong>
                <button className="crm-api-copy" onClick={() => copy(curl(ep), id)}>
                  {copied === id ? '✅ Copiado' : '📋 Copiar'}
                </button>
              </div>
              <pre>{curl(ep)}</pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="crm-api-docs">
      <div className="crm-api-header">
        <div>
          <h1>🔌 SmartMoon API</h1>
          <p className="crm-api-subtitle">Documentação completa — WhatsApp + CRM</p>
        </div>
        <div className="crm-api-version">v1.0</div>
      </div>

      {/* Tabs */}
      <div className="crm-api-tabs">
        {[
          { key: 'quickstart', label: '🚀 Quick Start' },
          { key: 'whatsapp', label: '📱 WhatsApp API' },
          { key: 'crm', label: '👥 CRM API' },
          { key: 'errors', label: '⚠️ Erros' },
        ].map(t => (
          <button
            key={t.key}
            className={`crm-api-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Quick Start ── */}
      {tab === 'quickstart' && (
        <>
          <div className="crm-api-card crm-api-auth">
            <h3>🔑 Autenticação</h3>
            <p>Todas as requisições exigem uma API Key no header:</p>
            <div className="crm-api-code-block">
              <code>Authorization: Bearer sm_SUA_CHAVE_AQUI</code>
              <button className="crm-api-copy" onClick={() => copy('Authorization: Bearer sm_SUA_CHAVE_AQUI', 'auth')}>
                {copied === 'auth' ? '✅' : '📋'}
              </button>
            </div>
            <p className="crm-api-hint">
              Crie sua API Key em <strong>API Pública</strong> no painel SmartMoon.
              Base URL: <code>{BASE}</code>
            </p>
          </div>

          <div className="crm-api-card">
            <h3>📋 Passo a Passo</h3>
            <div className="crm-api-steps">
              {STEPS.map((s, i) => (
                <div key={i} className="crm-api-step">
                  <div className="crm-api-step-num">{s.num}</div>
                  <div className="crm-api-step-content">
                    <strong>{s.title}</strong>
                    <p>{s.desc}</p>
                    {s.cmd && (
                      <div className="crm-api-curl">
                        <pre>{s.cmd}</pre>
                        <button className="crm-api-copy crm-api-copy-inline" onClick={() => copy(s.cmd, `step-${i}`)}>
                          {copied === `step-${i}` ? '✅' : '📋'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-api-card">
            <h3>🔄 Fluxo Automático</h3>
            <div className="crm-api-flow">
              <div className="crm-api-flow-step">📲 Cliente manda mensagem no WhatsApp</div>
              <div className="crm-api-flow-arrow">↓</div>
              <div className="crm-api-flow-step">📡 SmartMoon Engine recebe</div>
              <div className="crm-api-flow-arrow">↓</div>
              <div className="crm-api-flow-step highlight">📇 Auto-cria contato no CRM</div>
              <div className="crm-api-flow-arrow">↓</div>
              <div className="crm-api-flow-step highlight">💬 Registra mensagem no histórico</div>
              <div className="crm-api-flow-arrow">↓</div>
              <div className="crm-api-flow-step">🔔 Envia pro seu Webhook (se configurado)</div>
            </div>
          </div>

          <div className="crm-api-card">
            <h3>⏱️ Rate Limiting</h3>
            <p><strong>60 requisições/minuto</strong> por API Key. Retorna HTTP <code>429</code> se exceder.</p>
            <p className="crm-api-hint">O header <code>Retry-After: 60</code> indica quando retomar.</p>
          </div>

          <div className="crm-api-card">
            <h3>📦 Webhook — Receber Mensagens</h3>
            <p>Configure o webhook para receber mensagens em tempo real no seu sistema:</p>
            <pre className="crm-api-response-example">{`POST seu-sistema.com/webhook

{
  "event": "message.received",
  "instance": "vendas",
  "data": {
    "phone": "5511999998888",
    "name": "João Silva",
    "type": "text",
    "text": "Olá, quero agendar!",
    "timestamp": 1715590000000
  }
}`}</pre>
          </div>
        </>
      )}

      {/* ── WhatsApp API ── */}
      {tab === 'whatsapp' && (
        <div className="crm-api-card">
          <h3>📱 WhatsApp API — Conexão + Mensagens</h3>
          <p className="crm-api-hint">Gerencie instâncias WhatsApp, conecte via QR Code e envie mensagens.</p>
          <div className="crm-api-endpoints">
            {WHATSAPP_ENDPOINTS.map((ep, i) => renderEndpoint(ep, 'wa', i))}
          </div>
        </div>
      )}

      {/* ── CRM API ── */}
      {tab === 'crm' && (
        <>
          {CRM_ENDPOINTS.map(group => (
            <div key={group.group} className="crm-api-card">
              <h3>{group.icon} {group.group}</h3>
              <div className="crm-api-endpoints">
                {group.items.map((ep, i) => renderEndpoint(ep, group.group, i))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Errors ── */}
      {tab === 'errors' && (
        <div className="crm-api-card">
          <h3>⚠️ Códigos de Erro</h3>
          <p className="crm-api-hint">Todas as respostas de erro seguem o formato: <code>{`{ "detail": "mensagem" }`}</code></p>
          <table className="crm-api-error-table">
            <thead>
              <tr><th>HTTP</th><th>Descrição</th><th>Solução</th></tr>
            </thead>
            <tbody>
              {ERRORS.map(e => (
                <tr key={e.code}>
                  <td><code>{e.code}</code></td>
                  <td>{e.desc}</td>
                  <td>{e.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 24 }}>📋 Formato de Resposta Padrão</h3>
          <pre className="crm-api-response-example">{`// Sucesso — Listagem
{
  "total": 150,
  "page": 1,
  "contacts": [{ "id": 1, "name": "João", ... }]
}

// Sucesso — Criação (201)
{ "id": 42, "name": "João Silva", "phone": "5511999998888" }

// Sucesso — Ação
{ "success": true }

// Erro (4xx / 5xx)
{ "detail": "Contato não encontrado" }`}</pre>
        </div>
      )}
    </div>
  )
}
