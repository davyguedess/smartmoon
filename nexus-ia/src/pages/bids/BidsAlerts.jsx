import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader, Save, MapPin, Radio, Target, DollarSign } from 'lucide-react'
import { api } from '../../api'

const CHANNELS = ['dashboard', 'email', 'whatsapp', 'telegram']
const STATES = ['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function BidsAlerts() {
  const [alerts, setAlerts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', state: '', modality: '', min_value: '', max_value: '', score_min: 50, delivery_channel: 'dashboard', is_active: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/bids/alerts').then(r => setAlerts(r || [])).catch(() => setAlerts([])).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        min_value: form.min_value ? parseFloat(form.min_value) : null,
        max_value: form.max_value ? parseFloat(form.max_value) : null,
        score_min: parseFloat(form.score_min),
      }
      const r = await api.post('/bids/alerts', payload)
      setAlerts(a => [r, ...a])
      setShowForm(false)
      setForm({ name: '', state: '', modality: '', min_value: '', max_value: '', score_min: 50, delivery_channel: 'dashboard', is_active: true })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (alert) => {
    await api.patch(`/bids/alerts/${alert.id}`, { is_active: !alert.is_active })
    setAlerts(a => a.map(x => x.id === alert.id ? { ...x, is_active: !x.is_active } : x))
  }

  const remove = async (id) => {
    await api.delete(`/bids/alerts/${id}`)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Alertas de Licitações
          </h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>Monitore oportunidades automaticamente e seja notificado</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Novo Alerta
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '1.5rem', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: '#f59e0b', fontSize: 15 }}>Criar Novo Alerta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Nome do Alerta *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tecnologia SP" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={inputStyle}>
                {STATES.map(s => <option key={s} value={s}>{s || 'Todos'}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Canal de Entrega</label>
              <select value={form.delivery_channel} onChange={e => setForm(f => ({ ...f, delivery_channel: e.target.value }))} style={inputStyle}>
                {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Valor Mínimo (R$)</label>
              <input type='number' value={form.min_value} onChange={e => setForm(f => ({ ...f, min_value: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Valor Máximo (R$)</label>
              <input type='number' value={form.max_value} onChange={e => setForm(f => ({ ...f, max_value: e.target.value }))} placeholder="Sem limite" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Score Mínimo: {form.score_min}</label>
              <input type='range' min={0} max={100} value={form.score_min} onChange={e => setForm(f => ({ ...f, score_min: e.target.value }))} style={{ width: '100%', accentColor: '#f59e0b' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={!form.name || saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {saving ? <><Loader size={14} className="spin" /> Salvando...</> : <><Save size={14} /> Salvar Alerta</>}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px', color: '#94a3b8', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando alertas...
        </div>
      ) : (
        alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
            <Bell size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Nenhum alerta cadastrado. Crie seu primeiro alerta para começar o monitoramento automático.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map(alert => (
              <div key={alert.id} style={{ background: 'rgba(15,23,42,0.7)', border: `1px solid ${alert.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{alert.name}</h3>
                    <span style={{ background: alert.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: alert.is_active ? '#22c55e' : '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                      {alert.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {alert.state && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {alert.state}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Radio size={12} /> {alert.delivery_channel}</span>
                    {alert.score_min > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Target size={12} /> Score ≥ {alert.score_min}</span>}
                    {alert.min_value && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><DollarSign size={12} /> Mín: R$ {parseFloat(alert.min_value).toLocaleString('pt-BR')}</span>}
                    {alert.max_value && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><DollarSign size={12} /> Máx: R$ {parseFloat(alert.max_value).toLocaleString('pt-BR')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggle(alert)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: alert.is_active ? '#22c55e' : '#6b7280' }}>
                    {alert.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button onClick={() => remove(alert.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 10px', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }
const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }
