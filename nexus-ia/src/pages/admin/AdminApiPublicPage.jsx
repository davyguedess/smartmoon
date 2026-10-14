import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

const fmtDate = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR')

const S = {
  card: { background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(99,102,241,0.08)', borderRadius: 16, padding: 24 },
  input: { width: '100%', padding: '10px 14px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' },
  btn: (c = '#6366f1') => ({ padding: '10px 20px', background: c, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }),
  btnSm: (c = '#6366f1') => ({ padding: '6px 14px', background: c, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }),
  tag: (c = '#6366f1') => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', background: c + '18', color: c, borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${c}22` }),
  mono: { fontFamily: 'monospace', fontSize: 12 },
}

function Toast({ toast }) {
  if (!toast) return null
  const bg = toast.type === 'error' ? '#ef4444' : toast.type === 'warn' ? '#f59e0b' : '#10b981'
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: bg, color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {toast.msg}
    </div>
  )
}

function KPI({ label, value, sub, color = '#6366f1', icon }) {
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 140, background: `linear-gradient(135deg,${color}08,${color}04)`, border: `1px solid ${color}15` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 16 }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditKeyModal({ k, companies, onClose, onDone, showToast }) {
  const [name, setName] = useState(k.name)
  const [rpm, setRpm] = useState(k.rate_limit_rpm)
  const [companyId, setCompanyId] = useState(k.company_id)
  const [instance, setInstance] = useState('')
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const selectedCompany = companies.find(c => c.id === Number(companyId))

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { name, rate_limit_rpm: rpm }
      if (Number(companyId) !== k.company_id) body.company_id = Number(companyId)
      if (instance.trim()) body.instance_name = instance.trim()
      await api.patch(`/admin/smartmoon/api-keys/${k.id}`, body)
      showToast('✅ API Key atualizada!')
      onDone()
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const handleRotate = async () => {
    if (!window.confirm('Gerar nova chave? A anterior será invalidada imediatamente.')) return
    setRotating(true)
    try {
      const data = await api.post(`/admin/smartmoon/api-keys/${k.id}/rotate`, {})
      setNewKey(data.key)
      showToast('Nova chave gerada!')
      onDone()
    } catch { showToast('Erro ao rotacionar', 'error') }
    finally { setRotating(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Excluir PERMANENTEMENTE a key "${k.name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    try {
      await api.delete(`/admin/smartmoon/api-keys/${k.id}/delete`)
      showToast('Key excluída')
      onDone(); onClose()
    } catch { showToast('Erro ao excluir', 'error') }
    finally { setDeleting(false) }
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const modal = { background: 'linear-gradient(145deg, #0f172a, #1e293b)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: 0, width: 520, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✏️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>Editar API Key</div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{k.key_prefix}••••</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(51,65,85,0.4)', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Nova key gerada */}
          {newKey && (
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>🔑 Nova chave gerada — copie agora!</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#fbbf24', wordBreak: 'break-all', marginBottom: 8, background: 'rgba(15,23,42,0.6)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.15)' }}>{newKey}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { navigator.clipboard.writeText(newKey); showToast('Copiado!') }} style={S.btnSm('#10b981')}>📋 Copiar</button>
                <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠️ Não será exibida novamente.</span>
              </div>
            </div>
          )}

          {/* ── Empresa ── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🏢</span> Empresa Vinculada
            </label>
            <select
              style={{ ...S.input, cursor: 'pointer', borderColor: Number(companyId) !== k.company_id ? 'rgba(251,191,36,0.5)' : undefined }}
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {Number(companyId) !== k.company_id && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                ⚠️ A empresa será alterada de "{k.company_name || `#${k.company_id}`}" para "{selectedCompany?.name || `#${companyId}`}"
              </div>
            )}
          </div>

          {/* ── Nome + Rate Limit ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Nome da integração</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Rate Limit</label>
              <input style={S.input} type='number' value={rpm} onChange={e => setRpm(+e.target.value)} />
            </div>
          </div>

          {/* ── Instância ── */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Trocar nome da instância (opcional)</label>
            <input style={S.input} placeholder='Deixe vazio para não alterar...' value={instance} onChange={e => setInstance(e.target.value)} />
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Altera o instance_id vinculado à empresa nesta integração.</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(15,23,42,0.4)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), fontSize: 12 }}>{saving ? '⏳ Salvando...' : '💾 Salvar'}</button>
          <button onClick={handleRotate} disabled={rotating} style={{ ...S.btn('#f59e0b'), fontSize: 12 }}>{rotating ? '⏳ Gerando...' : '🔄 Nova Key'}</button>
          <button onClick={handleDelete} disabled={deleting} style={{ ...S.btn('#ef4444'), fontSize: 12, marginLeft: 'auto' }}>{deleting ? '⏳ Excluindo...' : '🗑 Excluir'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: API Keys ─────────────────────────────────────────────
function TabApiKeys() {
  const [keys, setKeys] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyRaw, setNewKeyRaw] = useState(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const [editKey, setEditKey] = useState(null)
  const [form, setForm] = useState({ company_id: '', name: '', rate_limit_rpm: 60 })
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [keysData, companiesData] = await Promise.all([
        api.get('/admin/smartmoon/api-keys'),
        api.get('/admin/smartmoon/companies'),
      ])
      setKeys(Array.isArray(keysData) ? keysData : keysData.keys || [])
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
    } catch { showToast('Erro ao carregar dados', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.company_id) { showToast('Selecione uma empresa', 'warn'); return }
    if (!form.name.trim()) { showToast('Nome obrigatório', 'warn'); return }
    setCreating(true)
    try {
      const data = await api.post('/admin/smartmoon/api-keys', {
        company_id: Number(form.company_id),
        name: form.name,
        rate_limit_rpm: form.rate_limit_rpm,
      })
      setNewKeyRaw(data.key)
      setShowCreate(false)
      setForm({ company_id: '', name: '', rate_limit_rpm: 60 })
      showToast('API Key criada!')
      load()
    } catch (e) { showToast(e.message || 'Erro ao criar', 'error') }
    finally { setCreating(false) }
  }

  const handleRevoke = async (id, name) => {
    if (!window.confirm(`Revogar a key "${name}"? Requisições com ela falharão imediatamente.`)) return
    try {
      await api.delete(`/admin/smartmoon/api-keys/${id}`)
      showToast('API Key revogada')
      load()
    } catch { showToast('Erro', 'error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Toast toast={toast} />

      {editKey && (
        <EditKeyModal
          k={editKey}
          companies={companies}
          onClose={() => setEditKey(null)}
          onDone={load}
          showToast={showToast}
        />
      )}

      {newKeyRaw && (
        <div style={{ ...S.card, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>🔑 Nova API Key — copie agora!</div>
          <div style={{ background: 'rgba(15,23,42,0.8)', borderRadius: 10, padding: '14px 18px', fontFamily: 'monospace', fontSize: 13, color: '#fbbf24', wordBreak: 'break-all', border: '1px solid rgba(251,191,36,0.15)', marginBottom: 12 }}>
            {newKeyRaw}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => { navigator.clipboard.writeText(newKeyRaw); showToast('Copiado!') }} style={S.btnSm('#10b981')}>📋 Copiar</button>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>⚠️ Esta chave NÃO será exibida novamente.</span>
          </div>
          <button onClick={() => setNewKeyRaw(null)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11 }}>Entendi, fechar</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>API Keys ({keys.length})</div>
        <button onClick={() => setShowCreate(s => !s)} style={S.btn()}>+ Nova Key</button>
      </div>

      {showCreate && (
        <div style={{ ...S.card, border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Empresa / Cliente</label>
              <select style={S.input} value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}>
                <option value=''>Selecione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Nome da integração</label>
              <input style={S.input} placeholder='Ex: ERP Principal' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Rate Limit</label>
              <input style={S.input} type='number' value={form.rate_limit_rpm} onChange={e => setForm(p => ({ ...p, rate_limit_rpm: +e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={handleCreate} disabled={creating} style={S.btn()}>{creating ? 'Criando...' : '🔑 Criar API Key'}</button>
            <button onClick={() => setShowCreate(false)} style={S.btnSm('rgba(51,65,85,0.6)')}>Cancelar</button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>A chave será exibida apenas 1 vez após criação</span>
          </div>
        </div>
      )}

      <div style={S.card}>
        {loading ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Carregando...</div> : keys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Nenhuma API Key criada ainda</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#64748b' }}>
                {['Nome / Integração', 'Prefixo', 'Empresa', 'Rate Limit', 'Último uso', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ borderTop: '1px solid rgba(15,23,42,0.8)' }}>
                  <td style={{ padding: '10px 8px', color: '#e2e8f0', fontWeight: 600 }}>{k.name}</td>
                  <td style={{ padding: '10px 8px', ...S.mono, color: '#a78bfa' }}>{k.key_prefix}••••</td>
                  <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{k.company_name || `#${k.company_id}`}</td>
                  <td style={{ padding: '10px 8px', color: '#64748b' }}>{k.rate_limit_rpm} req/min</td>
                  <td style={{ padding: '10px 8px', color: '#64748b' }}>{fmtDate(k.last_used_at)}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={S.tag(k.is_active ? '#10b981' : '#6b7280')}>{k.is_active ? 'Ativa' : 'Revogada'}</span>
                  </td>
                  <td style={{ padding: '10px 8px', display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditKey(k)} style={S.btnSm('#6366f1')}>✏️ Editar</button>
                    {k.is_active && <button onClick={() => handleRevoke(k.id, k.name)} style={S.btnSm('#ef4444')}>Revogar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Tab: Conexões ─────────────────────────────────────────────
function TabConnections() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [flowsCache, setFlowsCache] = useState({}) // instanceId → [flows]
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/smartmoon/api-connections')
      setData(Array.isArray(res) ? res : res.connections || [])
    } catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const loadFlows = async (instanceId) => {
    if (flowsCache[instanceId]) return
    try {
      const flows = await api.get(`/admin/smartmoon/api-connections/${instanceId}/flows`)
      setFlowsCache(p => ({ ...p, [instanceId]: Array.isArray(flows) ? flows : [] }))
    } catch { setFlowsCache(p => ({ ...p, [instanceId]: [] })) }
  }

  const handleAttachFlow = async (instanceId, flowId) => {
    try {
      const res = await api.post(`/admin/smartmoon/api-connections/${instanceId}/flow`, {
        flow_id: flowId ? Number(flowId) : null
      })
      showToast(res.message || (flowId ? '✅ Bot vinculado!' : 'Bot desvinculado'))
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const filtered = filter ? data.filter(d => d.status === filter) : data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Toast toast={toast} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'connected', 'pending', 'disconnected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...S.btnSm(filter === s ? '#6366f1' : 'rgba(51,65,85,0.5)'), borderRadius: 20 }}>
            {s === 'connected' ? '🟢 Conectadas' : s === 'pending' ? '🟡 Pendentes' : s === 'disconnected' ? '🔴 Desconectadas' : 'Todas'}
          </button>
        ))}
        <button onClick={load} style={{ ...S.btnSm('rgba(51,65,85,0.5)'), marginLeft: 'auto' }}>↻ Atualizar</button>
      </div>
      <div style={S.card}>
        {loading ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Carregando...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Nenhuma conexão encontrada</div>
            )}
            {filtered.map((c, i) => (
              <div key={i} style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: `1px solid ${c.status === 'connected' ? 'rgba(16,185,129,0.15)' : 'rgba(51,65,85,0.3)'}` }}>
                {/* Row principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <code style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>{c.instance_id}</code>
                  <span style={S.tag(c.status === 'connected' ? '#10b981' : c.status === 'pending' ? '#f59e0b' : '#6b7280')}>{c.status}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{c.company_name || `#${c.company_id}`}</span>
                  {c.display_phone && <span style={{ fontSize: 11, color: '#64748b' }}>{c.display_phone}</span>}
                  {c.key_prefix && <code style={{ fontSize: 11, color: '#64748b' }}>{c.key_prefix}••••</code>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>{fmtDate(c.created_at)}</span>
                </div>

                {/* Seletor de bot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>🤖 Bot / Fluxo:</span>
                  <select
                    style={{ ...S.input, width: 220, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                    value={c.flow_id || ''}
                    onFocus={() => loadFlows(c.id)}
                    onChange={e => handleAttachFlow(c.id, e.target.value)}
                  >
                    <option value=''>Sem bot (apenas API)</option>
                    {(flowsCache[c.id] || (c.flow_id ? [{ id: c.flow_id, name: c.flow_name || `Flow #${c.flow_id}` }] : [])).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {c.flow_name && (
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ {c.flow_name}</span>
                  )}
                  {c.external_webhook_url && (
                    <a href={c.external_webhook_url} target='_blank' rel='noreferrer' style={{ fontSize: 11, color: '#38bdf8', marginLeft: 8 }}>
                      🔗 webhook
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Fluxo de Uso ─────────────────────────────────────────
function TabUsageLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [endpoint, setEndpoint] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/smartmoon/api-usage?hours=${hours}&endpoint=${endpoint}`)
      setLogs(Array.isArray(res) ? res : res.logs || [])
    } catch { }
    finally { setLoading(false) }
  }, [hours, endpoint])

  useEffect(() => { load() }, [load])

  const statusColor = (code) => code < 300 ? '#10b981' : code < 400 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={hours} onChange={e => setHours(+e.target.value)} style={{ ...S.input, width: 120 }}>
          {[1, 6, 12, 24, 72, 168].map(h => <option key={h} value={h}>{h}h</option>)}
        </select>
        <input placeholder='Filtrar endpoint...' value={endpoint} onChange={e => setEndpoint(e.target.value)} style={{ ...S.input, width: 220 }} />
        <button onClick={load} style={S.btn()}>Filtrar</button>
        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto' }}>{logs.length} registros</span>
      </div>
      <div style={{ ...S.card, overflowX: 'auto' }}>
        {loading ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Carregando...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#64748b' }}>
                {['Hora', 'Empresa', 'API Key', 'Método', 'Endpoint', 'Instância', 'Status', 'Msgs'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(15,23,42,0.8)' }}>
                  <td style={{ padding: '8px', color: '#64748b', whiteSpace: 'nowrap', ...S.mono }}>{fmtDate(l.created_at)}</td>
                  <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 600 }}>{l.company_name || `#${l.company_id}`}</td>
                  <td style={{ padding: '8px', ...S.mono, color: '#a78bfa' }}>{l.key_prefix ? `${l.key_prefix}••••` : '—'}</td>
                  <td style={{ padding: '8px' }}><span style={S.tag(l.method === 'GET' ? '#0ea5e9' : '#a78bfa')}>{l.method}</span></td>
                  <td style={{ padding: '8px', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.endpoint}</td>
                  <td style={{ padding: '8px', ...S.mono, color: '#64748b' }}>{l.instance_id || '—'}</td>
                  <td style={{ padding: '8px' }}>{l.status_code && <span style={S.tag(statusColor(l.status_code))}>{l.status_code}</span>}</td>
                  <td style={{ padding: '8px', color: l.msgs_sent > 0 ? '#10b981' : '#64748b', fontWeight: l.msgs_sent > 0 ? 700 : 400 }}>
                    {l.msgs_sent > 0 ? `+${l.msgs_sent}` : '—'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Nenhum log no período</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Tab: Solicitações ─────────────────────────────────────────
function TabRequests() {
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [approvedKey, setApprovedKey] = useState(null)
  const [filter, setFilter] = useState('')
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/smartmoon/api-requests${filter ? `?status_filter=${filter}` : ''}`)
      setReqs(Array.isArray(data) ? data : [])
    } catch { }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id) => {
    const notes = prompt('Observação (opcional):')
    try {
      const data = await api.post(`/admin/smartmoon/api-requests/${id}/approve`, { admin_notes: notes, rate_limit_rpm: 60 })
      setApprovedKey(data.key)
      showToast('Solicitação aprovada! Key criada.')
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const handleReject = async (id) => {
    const notes = prompt('Motivo da rejeição:')
    if (notes === null) return
    try {
      await api.post(`/admin/smartmoon/api-requests/${id}/reject`, { admin_notes: notes })
      showToast('Solicitação rejeitada')
      load()
    } catch (e) { showToast(e.message || 'Erro', 'error') }
  }

  const stColor = (s) => s === 'approved' ? '#10b981' : s === 'rejected' ? '#ef4444' : '#f59e0b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Toast toast={toast} />

      {approvedKey && (
        <div style={{ ...S.card, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>🔑 Key gerada — envie ao usuário!</div>
          <div style={{ background: 'rgba(15,23,42,0.8)', borderRadius: 10, padding: '14px 18px', fontFamily: 'monospace', fontSize: 13, color: '#fbbf24', wordBreak: 'break-all', border: '1px solid rgba(251,191,36,0.15)', marginBottom: 12 }}>
            {approvedKey}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => { navigator.clipboard.writeText(approvedKey); showToast('Copiado!') }} style={S.btnSm('#10b981')}>📋 Copiar</button>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>⚠️ Esta chave NÃO será exibida novamente.</span>
          </div>
          <button onClick={() => setApprovedKey(null)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11 }}>Fechar</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...S.btnSm(filter === s ? '#6366f1' : 'rgba(51,65,85,0.5)'), borderRadius: 20 }}>
            {s === 'pending' ? '⏳ Pendentes' : s === 'approved' ? '✅ Aprovadas' : s === 'rejected' ? '❌ Rejeitadas' : 'Todas'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>{reqs.length} solicitações</span>
      </div>

      <div style={S.card}>
        {loading ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Carregando...</div> : reqs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Nenhuma solicitação</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reqs.map(r => (
              <div key={r.id} style={{ padding: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: `1px solid ${stColor(r.status)}15` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{r.name}</span>
                    <span style={S.tag(stColor(r.status))}>{r.status}</span>
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleApprove(r.id)} style={S.btnSm('#10b981')}>✅ Aprovar</button>
                      <button onClick={() => handleReject(r.id)} style={S.btnSm('#ef4444')}>❌ Rejeitar</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span>🏢 {r.company_name || `#${r.company_id}`}</span>
                  <span>👤 {r.user_name} ({r.user_email})</span>
                  {r.system_name && <span>💻 {r.system_name}</span>}
                  <span>📅 {fmtDate(r.created_at)}</span>
                </div>
                {r.reason && <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>📝 {r.reason}</div>}
                {r.admin_notes && <div style={{ marginTop: 6, fontSize: 12, color: '#a78bfa' }}>💬 Nota: {r.admin_notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────
export default function AdminApiPublicPage() {
  const [tab, setTab] = useState('keys')
  const [stats, setStats] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    api.get('/admin/smartmoon/api-stats').then(setStats).catch(() => { })
    api.get('/admin/smartmoon/api-requests?status_filter=pending')
      .then(d => setPendingCount(Array.isArray(d) ? d.length : 0))
      .catch(() => { })
  }, [])

  const TABS = [
    { id: 'keys', label: '🔑 API Keys', desc: 'Gerenciar chaves' },
    { id: 'requests', label: '📨 Solicitações', desc: pendingCount > 0 ? `${pendingCount} pendente(s)` : 'Pedidos de acesso' },
    { id: 'connections', label: '🔌 Conexões', desc: 'Instâncias ativas' },
    { id: 'logs', label: '📋 Fluxo de Uso', desc: 'Log de requisições' },
  ]

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#6366f1,#a78bfa)', fontSize: 20 }}>🌐</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>API Pública SmartMoon</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Gerenciamento de integrações externas via WhatsApp</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pendingCount > 0 && (
            <span style={{ padding: '3px 10px', background: '#f59e0b18', color: '#f59e0b', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #f59e0b22', marginRight: 8 }}>
              {pendingCount} pendente(s)
            </span>
          )}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: stats?.api_enabled ? '#10b981' : '#6b7280', display: 'inline-block', boxShadow: stats?.api_enabled ? '0 0 6px #10b981' : 'none' }} />
          <span style={{ fontSize: 11, color: stats?.api_enabled ? '#10b981' : '#6b7280', fontWeight: 700 }}>
            {stats?.api_enabled ? 'API ATIVA' : 'API INATIVA (flag off)'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <KPI label='API Keys Ativas' value={fmt(stats?.total_keys)} icon='🔑' color='#6366f1' sub={`${stats?.revoked_keys || 0} revogadas`} />
        <KPI label='Conexões Ativas' value={fmt(stats?.total_connections)} icon='🔌' color='#10b981' sub={`${stats?.pending_connections || 0} pendentes`} />
        <KPI label='Req Hoje' value={fmt(stats?.requests_today)} icon='📊' color='#0ea5e9' sub={`${fmt(stats?.requests_hour)} na última hora`} />
        <KPI label='Msgs Enviadas Hoje' value={fmt(stats?.msgs_sent_today)} icon='💬' color='#a78bfa' />
        <KPI label='Sistemas Externos' value={fmt(stats?.unique_companies)} icon='🏢' color='#f59e0b' sub='empresas integradas' />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.08)', borderRadius: 12, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg,#6366f1,#a78bfa)' : 'transparent',
            color: tab === t.id ? 'white' : '#64748b',
            fontSize: 12, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            transition: 'all 0.2s',
            position: 'relative',
          }}>
            <span>{t.label}</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>{t.desc}</span>
            {t.id === 'requests' && pendingCount > 0 && tab !== 'requests' && (
              <span style={{ position: 'absolute', top: 4, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'keys' && <TabApiKeys />}
      {tab === 'requests' && <TabRequests />}
      {tab === 'connections' && <TabConnections />}
      {tab === 'logs' && <TabUsageLogs />}
    </div>
  )
}
