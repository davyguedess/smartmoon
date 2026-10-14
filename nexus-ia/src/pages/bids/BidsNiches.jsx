import { useState, useEffect } from 'react'
import { Plus, Trash2, X, Edit3, Target, CheckCircle, XCircle, DollarSign, Save, Loader } from 'lucide-react'
import { api } from '../../api'

export default function BidsNiches() {
  const [niches, setNiches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm())
  const [kwInput, setKwInput] = useState({ pos: '', neg: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/bids/niches').then(r => setNiches(r || [])).catch(() => setNiches([])).finally(() => setLoading(false))
  }, [])

  function defaultForm() {
    return { name: '', positive_keywords_json: [], negative_keywords_json: [], preferred_regions_json: [], cnaes_json: [], ideal_value_min: '', ideal_value_max: '' }
  }

  const openEdit = (niche) => {
    setEditing(niche)
    setForm({ ...niche, ideal_value_min: niche.ideal_value_min || '', ideal_value_max: niche.ideal_value_max || '' })
    setShowForm(true)
  }

  const addKw = (type) => {
    const val = kwInput[type].trim()
    if (!val) return
    const field = type === 'pos' ? 'positive_keywords_json' : 'negative_keywords_json'
    setForm(f => ({ ...f, [field]: [...(f[field] || []), val] }))
    setKwInput(k => ({ ...k, [type]: '' }))
  }

  const removeKw = (type, idx) => {
    const field = type === 'pos' ? 'positive_keywords_json' : 'negative_keywords_json'
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))
  }

  const save = async () => {
    const payload = {
      ...form,
      ideal_value_min: form.ideal_value_min ? parseFloat(form.ideal_value_min) : null,
      ideal_value_max: form.ideal_value_max ? parseFloat(form.ideal_value_max) : null,
    }
    if (editing) {
      await api.patch(`/bids/niches/${editing.id}`, payload)
      setNiches(n => n.map(x => x.id === editing.id ? { ...x, ...payload } : x))
    } else {
      const r = await api.post('/bids/niches', payload)
      setNiches(n => [...n, r])
    }
    setShowForm(false); setEditing(null); setForm(defaultForm())
  }

  const remove = async (id) => {
    await api.delete(`/bids/niches/${id}`)
    setNiches(n => n.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Perfis de Nicho
          </h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>Configure palavras-chave e preferências para score personalizado de aderência</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(defaultForm()) }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Novo Nicho
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 16, padding: '1.5rem', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: '#60a5fa', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            {editing ? <><Edit3 size={14} /> Editar Nicho</> : <><Plus size={14} /> Criar Nicho</>}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Nome do Nicho *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tecnologia da Informação" style={inputStyle} />
            </div>

            {/* Positive Keywords */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} color="#22c55e" /> Palavras Positivas</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={kwInput.pos} onChange={e => setKwInput(k => ({ ...k, pos: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addKw('pos')} placeholder="Ex: software, sistema..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => addKw('pos')} style={addBtn('#22c55e')}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(form.positive_keywords_json || []).map((kw, i) => (
                  <span key={i} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 13, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {kw} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeKw('pos', i)} />
                  </span>
                ))}
              </div>
            </div>

            {/* Negative Keywords */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12} color="#ef4444" /> Palavras Negativas (Penalidade)</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={kwInput.neg} onChange={e => setKwInput(k => ({ ...k, neg: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addKw('neg')} placeholder="Ex: obras civis, limpeza..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => addKw('neg')} style={addBtn('#ef4444')}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(form.negative_keywords_json || []).map((kw, i) => (
                  <span key={i} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {kw} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeKw('neg', i)} />
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={12} /> Valor Mínimo (R$)</label>
              <input type='number' value={form.ideal_value_min} onChange={e => setForm(f => ({ ...f, ideal_value_min: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={12} /> Valor Máximo (R$)</label>
              <input type='number' value={form.ideal_value_max} onChange={e => setForm(f => ({ ...f, ideal_value_max: e.target.value }))} placeholder="Sem limite" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={!form.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              <Save size={14} /> Salvar Nicho
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 16px', color: '#94a3b8', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Niches List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando nichos...
        </div>
      ) : (
        niches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
            <Target size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Nenhum nicho cadastrado ainda. Crie seu perfil de nicho para receber scores personalizados.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
            {niches.map(niche => (
              <div key={niche.id} style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={14} /> {niche.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(niche)} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '4px 8px', color: '#a5b4fc', cursor: 'pointer' }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => remove(niche.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '4px 8px', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {(niche.positive_keywords_json || []).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={10} /> Positivas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {niche.positive_keywords_json.slice(0, 6).map((kw, i) => (
                        <span key={i} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '2px 8px', fontSize: 12, color: '#22c55e' }}>{kw}</span>
                      ))}
                      {niche.positive_keywords_json.length > 6 && <span style={{ fontSize: 12, color: '#6b7280' }}>+{niche.positive_keywords_json.length - 6}</span>}
                    </div>
                  </div>
                )}

                {(niche.negative_keywords_json || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={10} /> Negativas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {niche.negative_keywords_json.slice(0, 4).map((kw, i) => (
                        <span key={i} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '2px 8px', fontSize: 12, color: '#ef4444' }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(niche.ideal_value_min || niche.ideal_value_max) && (
                  <div style={{ marginTop: 10, fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DollarSign size={12} /> R$ {niche.ideal_value_min?.toLocaleString('pt-BR') || '0'} — {niche.ideal_value_max?.toLocaleString('pt-BR') || '∞'}
                  </div>
                )}
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
const addBtn = (color) => ({ background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 8, padding: '6px 10px', color, cursor: 'pointer' })
