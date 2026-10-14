/**
 * NEXUS.IA — Open Gateway API Documentation Page (TASK 6.2)
 * 
 * Documentação interativa da API pública do Gateway de Pagamentos.
 * Acessível em /payments/api-docs
 */
import { useState, useEffect } from 'react'
import { api } from '../../api'

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icons = {
  code: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  key: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  zap: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  server: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  card: {
    background:'rgba(30,41,59,0.6)', backdropFilter:'blur(12px)',
    border:'1px solid rgba(99,102,241,0.08)', borderRadius:16, padding:24,
  },
  methodTag: (method) => {
    const colors = {GET:'#6366f1',POST:'#10b981',DELETE:'#ef4444',PATCH:'#f59e0b',PUT:'#0ea5e9'}
    const c = colors[method] || '#94a3b8'
    return {
      display:'inline-flex',alignItems:'center',justifyContent:'center',
      minWidth:56,padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:800,
      background:`${c}18`,color:c,border:`1px solid ${c}22`,fontFamily:'monospace',
    }
  },
}

function CodeBlock({code, language='bash'}) {
  const [copied, setCopied] = useState(false)
  const doCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(()=>setCopied(false),2000)
  }
  return (
    <div style={{position:'relative',background:'rgba(15,23,42,0.9)',borderRadius:10,border:'1px solid rgba(51,65,85,0.4)',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 12px',background:'rgba(30,41,59,0.6)',borderBottom:'1px solid rgba(51,65,85,0.3)'}}>
        <span style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase'}}>{language}</span>
        <button onClick={doCopy} style={{background:'none',border:'none',cursor:'pointer',color:copied?'#10b981':'#64748b',display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:600}}>
          {copied?Icons.check:Icons.copy} {copied?'Copiado':'Copiar'}
        </button>
      </div>
      <pre style={{margin:0,padding:'14px 16px',overflowX:'auto',fontSize:12,lineHeight:1.7,color:'#e2e8f0',fontFamily:'"JetBrains Mono",monospace'}}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ── Endpoints data ─────────────────────────────────────────────────────────────
const ENDPOINTS = [
  {
    method: 'GET', path: '/api/v1/gateway/health',
    title: 'Health Check',
    desc: 'Verifica se a API está online. Não requer autenticação.',
    auth: false,
    response: `{
  "status": "ok",
  "service": "nexus-gateway",
  "version": "1.0.0",
  "timestamp": "2026-01-15T10:30:00Z"
}`,
  },
  {
    method: 'POST', path: '/api/v1/gateway/charges',
    title: 'Criar Cobrança PIX',
    desc: 'Cria uma cobrança PIX e retorna o QR Code para pagamento.',
    auth: true, permission: 'charges.create',
    body: `{
  "amount": 99.90,
  "description": "Assinatura Plano Pro",
  "customer_name": "João Silva",
  "customer_email": "joao@email.com",
  "due_date": "2026-02-15",
  "metadata": {"order_id": "ORD-123"}
}`,
    response: `{
  "id": 42,
  "status": "pending",
  "amount": "99.90",
  "description": "Assinatura Plano Pro",
  "pix_qr_code": "data:image/png;base64,...",
  "pix_copy_paste_code": "00020126...",
  "payment_link": null,
  "created_at": "2026-01-15T10:30:00Z"
}`,
    curl: `curl -X POST https://api.nexus.ia/api/v1/gateway/charges \\
  -H "X-API-Key: nxs_live_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 99.90,
    "description": "Assinatura Plano Pro"
  }'`,
  },
  {
    method: 'GET', path: '/api/v1/gateway/charges/{id}',
    title: 'Consultar Cobrança',
    desc: 'Retorna o status atualizado de uma cobrança específica.',
    auth: true, permission: 'charges.read',
    response: `{
  "id": 42,
  "status": "paid",
  "amount": "99.90",
  "description": "Assinatura Plano Pro",
  "pix_qr_code": null,
  "pix_copy_paste_code": "00020126...",
  "payment_link": null,
  "created_at": "2026-01-15T10:30:00Z"
}`,
    curl: `curl https://api.nexus.ia/api/v1/gateway/charges/42 \\
  -H "X-API-Key: nxs_live_xxxx..."`,
  },
  {
    method: 'DELETE', path: '/api/v1/gateway/charges/{id}',
    title: 'Cancelar Cobrança',
    desc: 'Cancela uma cobrança pendente. Apenas cobranças com status "pending" podem ser canceladas.',
    auth: true, permission: 'charges.create',
    response: `{
  "status": "cancelled",
  "charge_id": 42
}`,
    curl: `curl -X DELETE https://api.nexus.ia/api/v1/gateway/charges/42 \\
  -H "X-API-Key: nxs_live_xxxx..."`,
  },
  {
    method: 'GET', path: '/api/v1/gateway/balance',
    title: 'Consultar Saldo',
    desc: 'Retorna o saldo atual da conta da empresa.',
    auth: true, permission: 'balance.read',
    response: `{
  "balance": "1530.00",
  "total_received": "15000.00",
  "total_withdrawn": "13470.00",
  "currency": "BRL"
}`,
    curl: `curl https://api.nexus.ia/api/v1/gateway/balance \\
  -H "X-API-Key: nxs_live_xxxx..."`,
  },
  {
    method: 'GET', path: '/api/v1/gateway/keys/info',
    title: 'Info da API Key',
    desc: 'Retorna informações da API Key usada na request.',
    auth: true,
    response: `{
  "key_prefix": "nxs_live_abc",
  "label": "Integração ERP",
  "environment": "live",
  "permissions": ["charges.create", "charges.read", "balance.read"],
  "rate_limit_rpm": 60,
  "created_at": "2026-01-15T10:30:00Z"
}`,
    curl: `curl https://api.nexus.ia/api/v1/gateway/keys/info \\
  -H "X-API-Key: nxs_live_xxxx..."`,
  },
]

// ── Status Codes ───────────────────────────────────────────────────────────────
const STATUS_CODES = [
  {code:'200',label:'OK',desc:'Requisição processada com sucesso',color:'#10b981'},
  {code:'201',label:'Created',desc:'Recurso criado (cobrança)',color:'#10b981'},
  {code:'400',label:'Bad Request',desc:'Dados inválidos no body',color:'#f59e0b'},
  {code:'401',label:'Unauthorized',desc:'API Key ausente ou inválida',color:'#ef4444'},
  {code:'403',label:'Forbidden',desc:'Sem permissão ou IP não autorizado',color:'#ef4444'},
  {code:'404',label:'Not Found',desc:'Recurso não encontrado',color:'#f59e0b'},
  {code:'422',label:'Unprocessable',desc:'Erro de validação nos dados',color:'#f59e0b'},
  {code:'429',label:'Too Many Requests',desc:'Rate limit excedido',color:'#ef4444'},
  {code:'500',label:'Internal Error',desc:'Erro interno do servidor',color:'#ef4444'},
  {code:'502',label:'Bad Gateway',desc:'Erro no provedor de pagamento',color:'#ef4444'},
]

export default function GatewayApiDocsPage() {
  const [activeEndpoint, setActiveEndpoint] = useState(null)
  const [apiBase, setApiBase] = useState('https://api.nexus.ia')

  return (
    <div style={{padding:'32px 24px',fontFamily:'Inter,sans-serif',maxWidth:1100,margin:'0 auto',color:'#e2e8f0'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        select option{background:#0f172a}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
      `}</style>

      {/* Hero */}
      <div style={{marginBottom:40,textAlign:'center'}}>
        <div style={{
          width:64,height:64,borderRadius:20,margin:'0 auto 16px',
          background:'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 8px 32px rgba(99,102,241,0.35)',
        }}>{Icons.code}</div>
        <h1 style={{
          margin:0,fontSize:32,fontWeight:900,
          background:'linear-gradient(135deg,#e2e8f0,#a78bfa)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
          marginBottom:8,
        }}>Open Gateway API</h1>
        <p style={{margin:0,color:'#64748b',fontSize:14,maxWidth:600,marginInline:'auto'}}>
          Integre pagamentos PIX no seu sistema com segurança e velocidade.
          Use API Keys para autenticação e receba cobranças em minutos.
        </p>
      </div>

      {/* Quick Start */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:16,marginBottom:32}}>
        {[
          {icon: Icons.key, title:'Autenticação', desc:'Envie o header X-API-Key em cada request', color:'#6366f1'},
          {icon: Icons.shield, title:'Segurança', desc:'HTTPS obrigatório, IP whitelist, rate limit', color:'#10b981'},
          {icon: Icons.zap, title:'PIX Instantâneo', desc:'QR Code gerado em < 1s, notificação via webhook', color:'#f59e0b'},
          {icon: Icons.server, title:'99.9% Uptime', desc:'Infraestrutura redundante com failover automático', color:'#0ea5e9'},
        ].map((f,i) => (
          <div key={i} style={{
            ...S.card,
            background:`linear-gradient(135deg, ${f.color}06, ${f.color}03)`,
            border:`1px solid ${f.color}15`,
            textAlign:'center',
          }}>
            <div style={{
              width:40,height:40,borderRadius:12,margin:'0 auto 12px',
              background:`${f.color}15`,display:'flex',alignItems:'center',justifyContent:'center',color:f.color,
            }}>{f.icon}</div>
            <div style={{fontSize:13,fontWeight:700,color:'#e2e8f0',marginBottom:4}}>{f.title}</div>
            <div style={{fontSize:11,color:'#64748b',lineHeight:1.5}}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Auth Section */}
      <div style={{...S.card,marginBottom:24}}>
        <h2 style={{margin:'0 0 12px',fontSize:16,fontWeight:800,color:'#a78bfa',display:'flex',alignItems:'center',gap:8}}>
          {Icons.key} Autenticação
        </h2>
        <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.7,margin:'0 0 16px'}}>
          Todas as requisições (exceto <code style={{color:'#a78bfa',background:'rgba(99,102,241,0.1)',padding:'2px 6px',borderRadius:4,fontSize:12}}>/health</code>) 
          requerem o header <code style={{color:'#fbbf24',background:'rgba(251,191,36,0.08)',padding:'2px 6px',borderRadius:4,fontSize:12}}>X-API-Key</code>.
        </p>
        <CodeBlock language="http" code={`GET /api/v1/gateway/balance HTTP/1.1
Host: api.nexus.ia
X-API-Key: nxs_live_a1b2c3d4e5f6g7h8i9j0k1l2`}/>
        <div style={{marginTop:16,padding:'12px 16px',background:'rgba(245,158,11,0.06)',borderRadius:10,border:'1px solid rgba(245,158,11,0.15)'}}>
          <div style={{fontSize:12,fontWeight:600,color:'#f59e0b',marginBottom:4}}>⚠️ Mantenha suas API Keys seguras</div>
          <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6}}>
            Nunca exponha suas chaves em código frontend, repositórios públicos ou logs.
            Use variáveis de ambiente e rotacione as chaves periodicamente.
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <h2 style={{fontSize:18,fontWeight:800,color:'#e2e8f0',marginBottom:16}}>Endpoints</h2>
      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:32}}>
        {ENDPOINTS.map((ep,i) => {
          const isOpen = activeEndpoint === i
          return (
            <div key={i} style={{
              ...S.card,padding:0,overflow:'hidden',
              border: isOpen ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(99,102,241,0.08)',
              transition:'border-color 0.2s',
            }}>
              {/* Header */}
              <button onClick={()=>setActiveEndpoint(isOpen?null:i)} style={{
                width:'100%',padding:'16px 20px',background:'none',border:'none',cursor:'pointer',
                display:'flex',alignItems:'center',gap:12,textAlign:'left',
              }}>
                <span style={S.methodTag(ep.method)}>{ep.method}</span>
                <code style={{fontSize:13,color:'#e2e8f0',fontWeight:600,fontFamily:'monospace'}}>{ep.path}</code>
                <span style={{fontSize:12,color:'#64748b',marginLeft:8}}>{ep.title}</span>
                {ep.auth && (
                  <span style={{marginLeft:'auto',fontSize:10,color:'#f59e0b',fontWeight:600,display:'flex',alignItems:'center',gap:3}}>
                    🔒 Auth
                  </span>
                )}
                <span style={{color:'#475569',transform:isOpen?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s',fontSize:16}}>▼</span>
              </button>

              {/* Body */}
              {isOpen && (
                <div style={{padding:'0 20px 20px',borderTop:'1px solid rgba(51,65,85,0.3)'}}>
                  <p style={{color:'#94a3b8',fontSize:13,margin:'16px 0'}}>{ep.desc}</p>
                  
                  {ep.permission && (
                    <div style={{fontSize:11,color:'#64748b',marginBottom:12}}>
                      Permissão necessária: <code style={{color:'#a78bfa',background:'rgba(99,102,241,0.1)',padding:'2px 6px',borderRadius:4}}>{ep.permission}</code>
                    </div>
                  )}

                  {ep.body && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.6px'}}>Request Body</div>
                      <CodeBlock language="json" code={ep.body}/>
                    </div>
                  )}

                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.6px'}}>Response</div>
                    <CodeBlock language="json" code={ep.response}/>
                  </div>

                  {ep.curl && (
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.6px'}}>cURL Example</div>
                      <CodeBlock language="bash" code={ep.curl}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status Codes */}
      <div style={{...S.card,marginBottom:32}}>
        <h2 style={{margin:'0 0 16px',fontSize:16,fontWeight:800,color:'#e2e8f0'}}>Códigos de Status</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:8}}>
          {STATUS_CODES.map(sc => (
            <div key={sc.code} style={{
              display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
              background:'rgba(15,23,42,0.5)',borderRadius:8,
              border:`1px solid ${sc.color}15`,
            }}>
              <span style={{
                minWidth:36,padding:'2px 0',textAlign:'center',borderRadius:4,
                fontSize:11,fontWeight:800,color:sc.color,
                background:`${sc.color}15`,fontFamily:'monospace',
              }}>{sc.code}</span>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{sc.label}</div>
                <div style={{fontSize:10,color:'#64748b'}}>{sc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limiting */}
      <div style={{...S.card,marginBottom:32}}>
        <h2 style={{margin:'0 0 12px',fontSize:16,fontWeight:800,color:'#e2e8f0'}}>Rate Limiting</h2>
        <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.7,margin:0}}>
          Cada API Key tem um limite configurável de requisições por minuto (padrão: 60 req/min).
          Ao exceder o limite, a API retorna <code style={{color:'#ef4444',background:'rgba(239,68,68,0.1)',padding:'2px 6px',borderRadius:4,fontSize:12}}>429 Too Many Requests</code>.
        </p>
        <CodeBlock language="json" code={`{
  "error": "rate_limit_exceeded",
  "message": "Rate limit: 60 requests/min. Tente novamente em breve.",
  "retry_after_seconds": 60
}`}/>
      </div>

      {/* Error Format */}
      <div style={{...S.card}}>
        <h2 style={{margin:'0 0 12px',fontSize:16,fontWeight:800,color:'#e2e8f0'}}>Formato de Erro</h2>
        <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.7,margin:'0 0 12px'}}>
          Todos os erros seguem o mesmo formato JSON para facilitar o tratamento.
        </p>
        <CodeBlock language="json" code={`{
  "error": "invalid_api_key",
  "message": "API Key inválida ou desativada."
}`}/>
      </div>

      {/* Footer */}
      <div style={{marginTop:40,textAlign:'center',color:'#475569',fontSize:11}}>
        Smart Moon Gateway API v1.0 — Suporte: suporte@smartmoon.online
      </div>
    </div>
  )
}
