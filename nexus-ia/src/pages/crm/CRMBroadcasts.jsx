/**
 * CRM Broadcasts — Campaign creation, management, and dispatch control.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import './CRM.css'

const STATUS_LABELS = {
  draft: { label: 'Rascunho', color: '#71717a', icon: '📝' },
  sending: { label: 'Enviando', color: '#3b82f6', icon: '🚀' },
  paused: { label: 'Pausada', color: '#f59e0b', icon: '⏸️' },
  completed: { label: 'Concluída', color: '#10b981', icon: '✅' },
  cancelled: { label: 'Cancelada', color: '#ef4444', icon: '❌' },
}

export default function CRMBroadcasts() {
  const [broadcasts, setBroadcasts] = useState([])
  const [total, setTotal] = useState(0)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedBc, setSelectedBc] = useState(null)
  const [logs, setLogs] = useState([])

  const [form, setForm] = useState({
    name: '',
    message_template: '',
    target_filter: { tags: [] },
  })

  const loadBroadcasts = useCallback(async () => {
    try {
      const data = await api.crm.listBroadcasts()
      setBroadcasts(data.broadcasts || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBroadcasts()
    api.crm.listTags().then(d => setTags(d.tags || [])).catch(() => {})
  }, [loadBroadcasts])

  useEffect(() => {
    if (!selectedBc) return
    api.crm.broadcastLogs(selectedBc.id).then(d => setLogs(d.logs || [])).catch(() => {})
  }, [selectedBc])

  const handleCreate = async () => {
    if (!form.name || !form.message_template) return
    try {
      const result = await api.crm.createBroadcast(form)
      alert(`✅ Campanha criada! ${result.total_targets} contatos selecionados.`)
      setShowCreate(false)
      setForm({ name: '', message_template: '', target_filter: { tags: [] } })
      loadBroadcasts()
    } catch (e) { alert(e.message) }
  }

  const handleStart = async (id) => {
    if (!confirm('Iniciar disparo da campanha?')) return
    try {
      const result = await api.crm.startBroadcast(id)
      alert(`🚀 Campanha iniciada! ${result.total_targets} contatos.`)
      loadBroadcasts()
    } catch (e) { alert(e.message) }
  }

  const handlePause = async (id) => {
    try {
      await api.crm.pauseBroadcast(id)
      loadBroadcasts()
    } catch (e) { alert(e.message) }
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="crm-broadcasts-page">
      <div className="crm-page-header">
        <div>
          <h1>📢 Campanhas</h1>
          <p className="crm-page-subtitle">Disparos em massa via WhatsApp</p>
        </div>
        <button className="crm-btn-primary" onClick={() => setShowCreate(true)}>
          + Nova Campanha
        </button>
      </div>

      <div className="crm-broadcasts-layout">
        {/* Broadcast List */}
        <div className="crm-broadcasts-list">
          {loading ? (
            <div className="crm-loading">Carregando...</div>
          ) : broadcasts.length === 0 ? (
            <div className="crm-empty-state">
              <div className="crm-empty-icon">📢</div>
              <h3>Nenhuma campanha</h3>
              <p>Crie sua primeira campanha de disparo em massa</p>
            </div>
          ) : (
            broadcasts.map(bc => {
              const status = STATUS_LABELS[bc.status] || STATUS_LABELS.draft
              const progress = bc.total_targets > 0
                ? Math.round(((bc.sent_count + bc.failed_count) / bc.total_targets) * 100)
                : 0
              return (
                <div
                  key={bc.id}
                  className={`crm-broadcast-card ${selectedBc?.id === bc.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBc(bc)}
                >
                  <div className="crm-bc-top">
                    <div className="crm-bc-name">{bc.name}</div>
                    <span className="crm-bc-status" style={{ color: status.color }}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <div className="crm-bc-meta">
                    <span>🎯 {bc.total_targets} contatos</span>
                    <span>📤 {bc.sent_count} enviados</span>
                    {bc.failed_count > 0 && <span style={{ color: '#ef4444' }}>❌ {bc.failed_count}</span>}
                  </div>
                  {bc.status === 'sending' && (
                    <div className="crm-bc-progress">
                      <div className="crm-bc-progress-bar" style={{ width: `${progress}%` }} />
                      <span>{progress}%</span>
                    </div>
                  )}
                  <div className="crm-bc-date">{formatDate(bc.created_at)}</div>
                  <div className="crm-bc-actions">
                    {(bc.status === 'draft' || bc.status === 'paused') && (
                      <button className="crm-btn-sm crm-btn-go" onClick={e => { e.stopPropagation(); handleStart(bc.id) }}>
                        ▶ Iniciar
                      </button>
                    )}
                    {bc.status === 'sending' && (
                      <button className="crm-btn-sm crm-btn-pause" onClick={e => { e.stopPropagation(); handlePause(bc.id) }}>
                        ⏸ Pausar
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedBc && (
          <div className="crm-broadcast-detail">
            <h3>{selectedBc.name}</h3>
            <div className="crm-bc-detail-stats">
              <div className="crm-stat"><span className="crm-stat-value">{selectedBc.total_targets}</span><span className="crm-stat-label">Alvos</span></div>
              <div className="crm-stat"><span className="crm-stat-value">{selectedBc.sent_count}</span><span className="crm-stat-label">Enviados</span></div>
              <div className="crm-stat"><span className="crm-stat-value">{selectedBc.delivered_count}</span><span className="crm-stat-label">Entregues</span></div>
              <div className="crm-stat"><span className="crm-stat-value">{selectedBc.failed_count}</span><span className="crm-stat-label">Falharam</span></div>
            </div>

            <div className="crm-bc-template">
              <h4>Mensagem</h4>
              <pre>{selectedBc.message_template}</pre>
            </div>

            <h4>Log de envios</h4>
            <div className="crm-bc-logs">
              {logs.length === 0 ? (
                <p className="crm-empty">Nenhum envio registrado</p>
              ) : (
                logs.map(l => (
                  <div key={l.id} className="crm-bc-log-item">
                    <span className="crm-bc-log-phone">{l.phone}</span>
                    <span className={`crm-bc-log-status ${l.status}`}>
                      {l.status === 'sent' ? '✅' : l.status === 'failed' ? '❌' : '⏳'} {l.status}
                    </span>
                    {l.error_message && <span className="crm-bc-log-error">{l.error_message}</span>}
                    <span className="crm-bc-log-time">{formatDate(l.sent_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="crm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Nova Campanha</h3>
              <button onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="crm-modal-body">
              <label>Nome da Campanha *</label>
              <input
                placeholder="Ex: Promoção Black Friday"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
              <label>Mensagem (use {'{{contact_name}}'} para personalizar)</label>
              <textarea
                className="crm-broadcast-textarea"
                placeholder="Olá {{contact_name}}! Temos uma oferta especial..."
                value={form.message_template}
                onChange={e => setForm({...form, message_template: e.target.value})}
                rows={5}
              />
              {tags.length > 0 && (
                <>
                  <label>Filtrar por Tags (vazio = todos os contatos)</label>
                  <div className="crm-tag-select">
                    {tags.map(t => (
                      <button
                        key={t.id}
                        className={`crm-tag-chip ${form.target_filter.tags.includes(t.name) ? 'active' : ''}`}
                        style={{ '--tag-color': t.color }}
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            target_filter: {
                              ...prev.target_filter,
                              tags: prev.target_filter.tags.includes(t.name)
                                ? prev.target_filter.tags.filter(x => x !== t.name)
                                : [...prev.target_filter.tags, t.name]
                            }
                          }))
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="crm-btn-primary" onClick={handleCreate}>Criar Campanha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
