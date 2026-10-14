import { useState } from 'react'

const BASE_URL = 'https://smartmoon.online'

const ENDPOINTS = [
  {
    group: 'Autenticação',
    color: '#6366f1',
    items: [
      {
        method: 'ALL', path: 'Authorization: Bearer sm_xxxxx',
        desc: 'Todas as requisições exigem este header com sua API Key.',
        note: 'Obtenha sua API Key no painel Admin → 🌐 API Pública → API Keys.',
        isHeader: true,
      },
    ],
  },
  {
    group: 'Instâncias WhatsApp',
    color: '#10b981',
    items: [
      {
        method: 'POST', path: '/v1/whatsapp/instances',
        desc: 'Cria uma nova instância WhatsApp para sua empresa.',
        body: JSON.stringify({ name: 'suporte', webhook_url: 'https://seu-sistema.com/webhook' }, null, 2),
        response: JSON.stringify({ instance_name: 'suporte', status: 'pending', next_step: 'GET /v1/whatsapp/instances/suporte/qr' }, null, 2),
      },
      {
        method: 'GET', path: '/v1/whatsapp/instances',
        desc: 'Lista todas as instâncias da sua empresa.',
        response: JSON.stringify([{ name: 'suporte', status: 'connected', phone: '5511999998888', webhook_url: 'https://...' }], null, 2),
      },
      {
        method: 'GET', path: '/v1/whatsapp/instances/{name}/qr',
        desc: 'Retorna QR Code para conectar o WhatsApp. Consulte a cada 5s até status CONNECTED.',
        response: JSON.stringify({ status: 'QR_READY', qrCode: 'data:image/png;base64,...' }, null, 2),
        note: 'Possíveis status: INITIALIZING | QR_READY | CONNECTING | CONNECTED | DISCONNECTED',
      },
      {
        method: 'GET', path: '/v1/whatsapp/instances/{name}/status',
        desc: 'Retorna o status atual da instância.',
        response: JSON.stringify({ status: 'CONNECTED', phone: '5511999998888' }, null, 2),
      },
      {
        method: 'POST', path: '/v1/whatsapp/instances/{name}/webhook',
        desc: 'Configura a URL que receberá as mensagens recebidas.',
        body: JSON.stringify({ url: 'https://seu-sistema.com/webhook/whatsapp' }, null, 2),
      },
      {
        method: 'DELETE', path: '/v1/whatsapp/instances/{name}',
        desc: 'Remove a instância e desconecta do WhatsApp.',
        response: JSON.stringify({ message: "Instância 'suporte' removida" }, null, 2),
      },
    ],
  },
  {
    group: 'Mensagens',
    color: '#0ea5e9',
    items: [
      {
        method: 'POST', path: '/v1/whatsapp/messages/send-text',
        desc: 'Envia mensagem de texto. A mensagem é enfileirada com delay anti-ban (2–6s).',
        body: JSON.stringify({ instance_name: 'suporte', phone: '5511999998888', text: 'Olá! Como posso ajudar?' }, null, 2),
        response: JSON.stringify({ jobId: 'abc123', queued: true, estimated_delay_ms: 3200 }, null, 2),
        note: 'phone: apenas dígitos com DDI+DDD. Ex: "5511999998888"',
      },
      {
        method: 'POST', path: '/v1/whatsapp/messages/send-image',
        desc: 'Envia imagem via base64 ou URL pública.',
        body: JSON.stringify({ instance_name: 'suporte', phone: '5511999998888', image_url: 'https://exemplo.com/foto.jpg', caption: 'Veja nossa oferta!' }, null, 2),
        response: JSON.stringify({ jobId: 'def456', queued: true }, null, 2),
      },
    ],
  },
  {
    group: 'Webhook — Mensagens Recebidas',
    color: '#f59e0b',
    items: [
      {
        method: 'POST', path: '{seu_webhook_url}',
        desc: 'Payload enviado ao seu sistema quando alguém enviar mensagem para o WhatsApp conectado.',
        isWebhook: true,
        response: JSON.stringify({
          event: 'message.received',
          instance: 'suporte',
          data: {
            phone: '5511999998888',
            name: 'João Silva',
            type: 'text',
            text: 'Olá, preciso de ajuda!',
            timestamp: 1746683400000,
          },
        }, null, 2),
        note: 'Header enviado: X-SmartMoon-Event: message.received. Responda com HTTP 200 em até 10s.',
      },
    ],
  },
  {
    group: 'Gerenciar API Keys (painel)',
    color: '#a78bfa',
    items: [
      {
        method: 'POST', path: '/api-keys/',
        desc: 'Cria nova API Key. A chave completa é exibida APENAS nesta resposta.',
        body: JSON.stringify({ name: 'Integração ERP', rate_limit_rpm: 60 }, null, 2),
        response: JSON.stringify({ id: 1, name: 'Integração ERP', key: 'sm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', warning: 'Guarde esta chave agora.' }, null, 2),
      },
      {
        method: 'GET', path: '/api-keys/',
        desc: 'Lista suas API Keys (sem exibir a chave real).',
      },
      {
        method: 'DELETE', path: '/api-keys/{id}',
        desc: 'Revoga uma API Key. Requisições com ela falham imediatamente.',
      },
      {
        method: 'GET', path: '/api-keys/{id}/usage',
        desc: 'Estatísticas de uso: total de requisições, mensagens enviadas, últimos 20 logs.',
      },
    ],
  },
]

const METHOD_COLORS = {
  GET: '#10b981', POST: '#6366f1', DELETE: '#ef4444', ALL: '#64748b',
}

const S = {
  card: { background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 12 },
  mono: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12 },
}

function Badge({ method }) {
  const c = METHOD_COLORS[method] || '#64748b'
  return (
    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: c + '20', color: c, border: `1px solid ${c}30`, flexShrink: 0 }}>
      {method}
    </span>
  )
}

function EndpointCard({ item }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ ...S.card, marginBottom: 8, overflow: 'hidden' }}>
      <div
        onClick={() => !item.isHeader && setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: item.isHeader ? 'default' : 'pointer' }}
      >
        <Badge method={item.isWebhook ? 'POST' : item.method} />
        <code style={{ ...S.mono, color: item.isWebhook ? '#f59e0b' : '#e2e8f0', flex: 1, fontSize: 13 }}>
          {item.isWebhook ? '📨 ' : ''}{item.path}
        </code>
        <span style={{ fontSize: 12, color: '#64748b', maxWidth: 320, textAlign: 'right' }}>{item.desc}</span>
        {!item.isHeader && <span style={{ color: '#475569', fontSize: 14 }}>{open ? '▲' : '▼'}</span>}
      </div>

      {item.isHeader && (
        <div style={{ padding: '0 16px 14px', color: '#94a3b8', fontSize: 12 }}>{item.note}</div>
      )}

      {open && (
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {item.note && (
            <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: '#fbbf24', fontSize: 12 }}>
              ℹ️ {item.note}
            </div>
          )}
          {item.body && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Request Body</div>
              <pre style={{ ...S.mono, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: 14, color: '#a78bfa', margin: 0, overflowX: 'auto' }}>
                {item.body}
              </pre>
            </div>
          )}
          {item.response && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                {item.isWebhook ? 'Payload Recebido' : 'Response'}
              </div>
              <pre style={{ ...S.mono, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: 14, color: '#34d399', margin: 0, overflowX: 'auto' }}>
                {item.response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RateLimit() {
  return (
    <div style={{ ...S.card, padding: 20, marginBottom: 24, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>📋 Limites e Boas Práticas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { icon: '⚡', label: 'Rate Limit padrão', value: '60 req/min por API Key' },
          { icon: '💬', label: 'Anti-ban WhatsApp', value: '8 msgs/min por instância' },
          { icon: '⏱️', label: 'Delay entre mensagens', value: '2 a 6 segundos (humanizado)' },
          { icon: '🔁', label: 'Retry webhook', value: '5 tentativas (0s→10s→20s→40s→80s)' },
          { icon: '🔒', label: 'Autenticação', value: 'SHA-256 hash — nunca armazenamos a chave' },
          { icon: '🌐', label: 'Base URL', value: BASE_URL },
        ].map(i => (
          <div key={i.label} style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{i.icon} {i.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', ...S.mono }}>{i.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickStart() {
  const [copied, setCopied] = useState(false)
  const code = `# 1. Criar instância
curl -X POST ${BASE_URL}/v1/whatsapp/instances \\
  -H "Authorization: Bearer sm_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "suporte", "webhook_url": "https://seu-sistema.com/webhook"}'

# 2. Buscar QR Code (repetir até status=CONNECTED)
curl ${BASE_URL}/v1/whatsapp/instances/suporte/qr \\
  -H "Authorization: Bearer sm_SUA_CHAVE"

# 3. Enviar mensagem
curl -X POST ${BASE_URL}/v1/whatsapp/messages/send-text \\
  -H "Authorization: Bearer sm_SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"instance_name": "suporte", "phone": "5511999998888", "text": "Olá!"}'`

  return (
    <div style={{ ...S.card, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>🚀 Quick Start (curl)</div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          {copied ? '✅ Copiado!' : '📋 Copiar'}
        </button>
      </div>
      <pre style={{ ...S.mono, background: 'rgba(15,23,42,0.8)', borderRadius: 8, padding: 16, color: '#94a3b8', margin: 0, overflowX: 'auto', lineHeight: 1.7 }}>
        {code}
      </pre>
    </div>
  )
}

export default function AdminApiDocsPage() {
  const [activeGroup, setActiveGroup] = useState(null)

  const filtered = activeGroup ? ENDPOINTS.filter(g => g.group === activeGroup) : ENDPOINTS

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📄</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SmartMoon API — Documentação
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>REST API · Versão 1.0 · Base: {BASE_URL}/v1/whatsapp</p>
        </div>
        <div style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 700 }}>
          v1.0 STABLE
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => setActiveGroup(null)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: !activeGroup ? '#6366f1' : 'rgba(51,65,85,0.5)', color: !activeGroup ? 'white' : '#94a3b8', fontSize: 12, fontWeight: 700 }}>
          Todos
        </button>
        {ENDPOINTS.map(g => (
          <button key={g.group} onClick={() => setActiveGroup(g.group === activeGroup ? null : g.group)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: activeGroup === g.group ? g.color : 'rgba(51,65,85,0.5)', color: activeGroup === g.group ? 'white' : '#94a3b8', fontSize: 12, fontWeight: 700 }}>
            {g.group}
          </button>
        ))}
      </div>

      <QuickStart />
      <RateLimit />

      {/* Endpoints */}
      {filtered.map(group => (
        <div key={group.group} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: group.color, flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>{group.group}</div>
            <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.1)' }} />
          </div>
          {group.items.map((item, i) => <EndpointCard key={i} item={item} />)}
        </div>
      ))}

      {/* Errors */}
      <div style={{ ...S.card, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>⚠️ Códigos de Erro</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#64748b' }}>
              {['Código', 'Significado', 'Ação'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['401', 'API Key inválida ou ausente', 'Verifique o header Authorization: Bearer sm_...'],
              ['429', 'Rate limit excedido', 'Aguarde 60s ou solicite aumento do limite'],
              ['502', 'Engine WhatsApp indisponível', 'Tente novamente em 30s'],
              ['503', 'Instância não conectada', 'Verifique o status em GET /instances/{name}/status'],
              ['404', 'Instância não encontrada', 'Crie com POST /instances antes de usar'],
            ].map(([code, meaning, action]) => (
              <tr key={code} style={{ borderTop: '1px solid rgba(15,23,42,0.8)' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#ef4444', fontWeight: 700 }}>{code}</td>
                <td style={{ padding: '8px', color: '#e2e8f0' }}>{meaning}</td>
                <td style={{ padding: '8px', color: '#64748b' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
