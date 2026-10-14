import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

const fmtDate = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'

const S = {
  card: { background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(99,102,241,0.08)', borderRadius: 16, padding: 24 },
  input: { width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' },
  btn: (c = '#6366f1') => ({ padding: '10px 20px', background: c, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }),
  btnSm: (c = '#6366f1') => ({ padding: '6px 14px', background: c, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }),
  tag: (c = '#6366f1') => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', background: c + '18', color: c, borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${c}22` }),
}


const STATUS_MAP = {
  pending: { label: '⏳ Pendente', color: '#f59e0b', desc: 'Aguardando análise do admin' },
  approved: { label: '✅ Aprovada', color: '#10b981', desc: 'API Key criada! Verifique abaixo.' },
  rejected: { label: '❌ Rejeitada', color: '#ef4444', desc: 'Veja os motivos abaixo.' },
}

export default function ApiPublicRequestPage() {
  const [requests, setRequests] = useState([])
  const [keys, setKeys] = useState([])
  const [instances, setInstances] = useState([])
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ name: '', system_name: '', reason: '' })
  const [revealedKeys, setRevealedKeys] = useState({})
  const showToast = () => {}


  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqData, keyData, instData, flowData] = await Promise.all([
        api.get('/api-keys/requests'),
        api.get('/api-keys/my-keys'),
        api.get('/api-keys/my-instances').catch(() => []),
        api.get('/api-keys/my-flows').catch(() => []),
      ])
      setRequests(Array.isArray(reqData) ? reqData : [])
      setKeys(Array.isArray(keyData) ? keyData : [])
      setInstances(Array.isArray(instData) ? instData : [])
      setFlows(Array.isArray(flowData) ? flowData : [])
    } catch { showToast('Erro ao carregar dados', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const hasPending = requests.some(r => r.status === 'pending')

  const handleAttachFlow = async (instanceId, flowId) => {
    try {
      await api.post(`/api-keys/my-instances/${instanceId}/flow`, { flow_id: flowId || null })
      showToast(flowId ? 'Bot de IA vinculado!' : 'Bot desvinculado')
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const handleRegenerate = async (keyId) => {
    try {
      const res = await api.post(`/api-keys/my-keys/${keyId}/regenerate`)
      // Salva a chave diretamente no state para exibir imediatamente
      setRevealedKeys(p => ({ ...p, [`key-${keyId}`]: res.key }))
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const handleSetWebhook = async (instanceId, url) => {
    try {
      await api.post(`/api-keys/my-instances/${instanceId}/webhook`, { webhook_url: url || null })
      showToast(url ? 'Webhook configurado!' : 'Webhook removido')
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast('Nome da integração obrigatório', 'warn'); return }
    setSending(true)
    try {
      await api.post('/api-keys/request', form)
      showToast('Solicitação enviada com sucesso!')
      setShowForm(false)
      setForm({ name: '', system_name: '', reason: '' })
      load()
    } catch (e) { showToast(e.response?.data?.detail || e.message || 'Erro', 'error') }
    finally { setSending(false) }
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 900 }}>


      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🌐</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>API Pública SmartMoon</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Integre seu sistema com o motor WhatsApp da Smart Moon</p>
        </div>
      </div>

      {/* Info box */}
      <div style={{ ...S.card, marginBottom: 20, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>📋 O que é a API Pública?</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
          A API permite que seu ERP, CRM ou qualquer sistema externo <strong style={{ color: '#e2e8f0' }}>envie e receba mensagens WhatsApp</strong> automaticamente através da sua conta Smart Moon.
          <br />
          Para começar, solicite uma <strong style={{ color: '#e2e8f0' }}>API Key</strong> abaixo. Após aprovação pelo admin, você receberá a chave de acesso.
        </div>
      </div>

      {/* Minhas API Keys */}
      {keys.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 14 }}>🔑 Suas API Keys</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {keys.map(k => {
              const matchReq = requests.find(r => r.status === 'approved' && r.generated_key)
              const storedKey = matchReq?.generated_key
              const localKey = revealedKeys[`key-${k.id}`]  // string da chave ou false/undefined
              const visibleKey = typeof localKey === 'string' ? localKey : (localKey ? storedKey : null)
              return (
                <div key={k.id} style={{ padding: 14, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{k.name}</span>
                      <span style={S.tag(k.is_active ? '#10b981' : '#6b7280')}>{k.is_active ? 'Ativa' : 'Revogada'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{k.rate_limit_rpm} req/min</span>
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    {visibleKey ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>🔑 Sua API Key:</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#fbbf24', background: 'rgba(15,23,42,0.8)', padding: '10px 14px', borderRadius: 8, wordBreak: 'break-all', marginBottom: 8 }}>
                          {visibleKey}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { navigator.clipboard.writeText(visibleKey); showToast('Chave copiada!') }} style={S.btnSm('#10b981')}>📋 Copiar</button>
                          <button onClick={() => setRevealedKeys(p => ({ ...p, [`key-${k.id}`]: false }))} style={S.btnSm('rgba(51,65,85,0.6)')}>Ocultar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Chave:</span>
                        <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#a78bfa' }}>{k.key_prefix}••••••••</code>
                        {storedKey ? (
                          <button onClick={() => setRevealedKeys(p => ({ ...p, [`key-${k.id}`]: storedKey }))} style={S.btnSm('#6366f1')}>👁️ Ver chave</button>
                        ) : (
                          <button onClick={() => handleRegenerate(k.id)} style={S.btnSm('#f59e0b')}>🔄 Gerar nova chave</button>
                        )}
                      </div>
                    )}
                  </div>

                  {k.last_used_at && <div style={{ fontSize: 11, color: '#64748b' }}>Último uso: {fmtDate(k.last_used_at)}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Minhas Instâncias + Bot IA */}
      {instances.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0ea5e9', marginBottom: 6 }}>📡 Suas Instâncias WhatsApp</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>Vincule um Bot de IA para respostas automáticas nas mensagens recebidas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {instances.map(inst => (
              <div key={inst.id} style={{ padding: 14, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid rgba(14,165,233,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>{inst.instance_name}</span>
                    <span style={S.tag(inst.status === 'connected' ? '#10b981' : inst.status === 'pending' ? '#f59e0b' : '#6b7280')}>{inst.status}</span>
                    {inst.display_phone && <span style={{ fontSize: 11, color: '#64748b' }}>{inst.display_phone}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>🤖 Bot:</span>
                    <select
                      style={{ ...S.input, width: 200, padding: '6px 10px', fontSize: 12 }}
                      value={inst.flow_id || ''}
                      onChange={e => handleAttachFlow(inst.id, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value=''>Sem bot (apenas API)</option>
                      {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
                {inst.flow_name && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✅ Bot ativo: <strong>{inst.flow_name}</strong> — mensagens recebidas são processadas por IA automaticamente</span>
                  </div>
                )}

                {/* Webhook URL */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>🔗 Webhook:</span>
                  <input
                    style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 12 }}
                    placeholder='https://seu-sistema.com/webhook/smartmoon'
                    defaultValue={inst.external_webhook_url || ''}
                    onBlur={e => {
                      const val = e.target.value.trim()
                      if (val !== (inst.external_webhook_url || '')) handleSetWebhook(inst.id, val)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão solicitar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Solicitações</div>
        <button
          onClick={() => setShowForm(s => !s)}
          disabled={hasPending}
          style={{
            ...S.btn(hasPending ? '#475569' : '#6366f1'),
            opacity: hasPending ? 0.5 : 1,
            cursor: hasPending ? 'not-allowed' : 'pointer',
          }}
        >
          {hasPending ? '⏳ Solicitação pendente' : '+ Solicitar API Key'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: 18, border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 14 }}>Nova Solicitação de API Key</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Nome da integração *</label>
              <input style={S.input} placeholder='Ex: Meu ERP Principal' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Sistema que vai integrar</label>
              <input style={S.input} placeholder='Ex: ERPNext, Salesforce, Custom' value={form.system_name} onChange={e => setForm(p => ({ ...p, system_name: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Motivo / O que pretende fazer</label>
            <textarea
              style={{ ...S.input, minHeight: 70, resize: 'vertical' }}
              placeholder='Ex: Quero automatizar envio de notificações de pedido via WhatsApp...'
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={handleSubmit} disabled={sending} style={S.btn()}>
              {sending ? 'Enviando...' : '📨 Enviar Solicitação'}
            </button>
            <button onClick={() => setShowForm(false)} style={S.btnSm('rgba(51,65,85,0.6)')}>Cancelar</button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>Será analisada pelo admin</span>
          </div>
        </div>
      )}

      {/* Lista de solicitações */}
      <div style={S.card}>
        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Carregando...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div>Nenhuma solicitação ainda. Clique em "Solicitar API Key" para começar.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending
              return (
                <div key={r.id} style={{ padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: `1px solid ${st.color}15` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{r.name}</span>
                      {r.system_name && <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(51,65,85,0.5)', padding: '2px 8px', borderRadius: 6 }}>{r.system_name}</span>}
                    </div>
                    <span style={S.tag(st.color)}>{st.label}</span>
                  </div>
                  {r.reason && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{r.reason}</div>}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
                    <span>📅 Solicitado: {fmtDate(r.created_at)}</span>
                    {r.reviewed_at && <span>✅ Revisado: {fmtDate(r.reviewed_at)}</span>}
                  </div>
                  {r.admin_notes && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: '#a78bfa' }}>
                      💬 Admin: {r.admin_notes}
                    </div>
                  )}
                  {r.status === 'approved' && r.generated_key && (
                    <div style={{ marginTop: 10 }}>
                      {revealedKeys[r.id] ? (
                        <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>🔑 Sua API Key:</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#fbbf24', background: 'rgba(15,23,42,0.8)', padding: '10px 14px', borderRadius: 8, wordBreak: 'break-all', marginBottom: 8 }}>
                            {r.generated_key}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={() => { navigator.clipboard.writeText(r.generated_key); showToast('Chave copiada!') }} style={S.btnSm('#10b981')}>📋 Copiar</button>
                            <button onClick={() => setRevealedKeys(p => ({ ...p, [r.id]: false }))} style={S.btnSm('rgba(51,65,85,0.6)')}>Ocultar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setRevealedKeys(p => ({ ...p, [r.id]: true }))} style={S.btnSm('#6366f1')}>🔑 Ver Chave</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
