import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import {
  Plus, Trash2, Mic, CheckCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Play, Pause, Edit3, Save, X,
  Volume2, Zap, BookOpen, MousePointer2, MessageSquare,
  Users, ArrowUpRight, Search
} from 'lucide-react'

const CATEGORIES = [
  { value: 'dashboard',     label: '📊 Dashboard',       color: '#8b5cf6' },
  { value: 'chat',          label: '💬 Chat IA',         color: '#00d4ff' },
  { value: 'flow_builder',  label: '⚡ Fluxos',          color: '#10b981' },
  { value: 'executions',    label: '▶️ Execuções',       color: '#f59e0b' },
  { value: 'agents',        label: '🤖 Agentes IA',      color: '#3b82f6' },
  { value: 'integrations',  label: '🔗 Integrações',     color: '#06b6d4' },
  { value: 'payments',      label: '💳 Gateway PIX',     color: '#10b981' },
  { value: 'billing',       label: '💰 Plano & Uso',     color: '#3b82f6' },
  { value: 'bids',          label: '🏦 Licitações',      color: '#f59e0b' },
  { value: 'studio',        label: '🎨 Studio',          color: '#ec4899' },
  { value: 'campaigns',     label: '📱 Campanhas IG',    color: '#e1306c' },
  { value: 'store_ia',      label: '✨ IA Store',        color: '#00d4ff' },
  { value: 'store_skills',  label: '⚙️ Skills Store',    color: '#f59e0b' },
  { value: 'store_agents',  label: '🤖 Agentes Store',   color: '#8b5cf6' },
  { value: 'voice',         label: '🎤 Voz da IA',       color: '#8b5cf6' },
  { value: 'telegram',      label: '📡 Telegram',        color: '#3b82f6' },
  { value: 'credits',       label: '🪙 Créditos',        color: '#f59e0b' },
  { value: 'geral',         label: '📝 Geral',           color: '#64748b' },
]

const TOUR_TEMPLATES = {
  dashboard: [
    { selector: "[data-tour='wallet-hero']", action: 'highlight', wait_for_click: false, label: 'Carteira' },
    { selector: "[data-tour='quick-actions']", action: 'ghost_cursor', wait_for_click: true, label: 'Ações Rápidas' },
    { selector: "[data-tour='metrics-grid']", action: 'highlight', wait_for_click: false, label: 'Métricas' },
  ],
  payments: [
    { selector: "[data-tour='quick-actions']", action: 'ghost_cursor', wait_for_click: true, label: 'PIX / Sacar' },
  ],
}

// ── Componentes base ──────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: '18px 20px', ...style,
  }}>{children}</div>
)

const Tag = ({ label, color }) => (
  <span style={{
    padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: color + '18', color, border: `1px solid ${color}30`,
    textTransform: 'uppercase', letterSpacing: 0.5,
  }}>{label}</span>
)

// ── Editor de item ────────────────────────────────────────────────────────────
function KnowledgeEditor({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    category:   item?.category || 'dashboard',
    question:   item?.question || '',
    answer:     item?.answer || '',
    sort_order: item?.sort_order || 0,
    is_active:  item?.is_active ?? true,
    tour_config: item?.tour_config || null,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const applyTemplate = () => {
    const steps = TOUR_TEMPLATES[form.category] || []
    set('tour_config', { steps })
  }

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inp = {
    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inp, flex: 1 }}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)}
          placeholder="Ordem" style={{ ...inp, width: 80 }} />
      </div>
      <input value={form.question} onChange={e => set('question', e.target.value)}
        placeholder="Pergunta / Título do passo..." style={inp} />
      <textarea value={form.answer} onChange={e => set('answer', e.target.value)}
        placeholder="Resposta que a Luna vai narrar (áudio TTS)..."
        rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />

      {/* Tour Config */}
      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>
            <MousePointer2 size={14} /> Tour Guiado (Ghost Cursor)
          </div>
          <button onClick={applyTemplate} style={{
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 8, padding: '4px 12px', color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>+ Template {form.category}</button>
        </div>
        {form.tour_config?.steps?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.tour_config.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                <span style={{ fontSize: 10, color: '#64748b', width: 20 }}>#{i+1}</span>
                <code style={{ fontSize: 10, color: '#a78bfa', flex: 1, fontFamily: 'monospace' }}>{s.selector}</code>
                <Tag label={s.action} color={s.wait_for_click ? '#10b981' : '#3b82f6'} />
                {s.wait_for_click && <Tag label="aguarda clique" color="#f59e0b" />}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '8px 0' }}>
            Nenhum passo configurado — clique em "+ Template" para começar
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '9px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
        }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '9px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
          border: 'none', color: 'white', fontWeight: 800, fontSize: 12, cursor: 'pointer',
        }}>
          {saving ? 'Salvando...' : <><Save size={13} style={{ marginRight: 6 }} />Salvar</>}
        </button>
      </div>
    </div>
  )
}

// ── Linha de item ─────────────────────────────────────────────────────────────
function KnowledgeRow({ item, onEdit, onDelete, onGenerateAudio }) {
  const [open, setOpen]         = useState(false)
  const [generating, setGen]    = useState(false)
  const [audioPlayer]           = useState(() => new Audio())
  const [playing, setPlaying]   = useState(false)
  const cat = CATEGORIES.find(c => c.value === item.category) || CATEGORIES[0]

  const handleGenerate = async (e) => {
    e.stopPropagation()
    setGen(true)
    await onGenerateAudio(item.id)
    setGen(false)
  }

  const handlePlay = (e) => {
    e.stopPropagation()
    if (!item.audio_path) return
    const url = `/audio/${item.audio_path}`
    if (playing) { audioPlayer.pause(); setPlaying(false) }
    else {
      audioPlayer.src = url
      audioPlayer.play()
      setPlaying(true)
      audioPlayer.onended = () => setPlaying(false)
    }
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 6, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
        <Tag label={cat.label} color={cat.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.question}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {item.audio_ready ? (
            <button onClick={handlePlay} title="Ouvir áudio" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '5px 10px', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? 'Pausar' : 'Ouvir'}
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={generating} title="Gerar áudio TTS" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '5px 10px', color: '#a78bfa', cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
              {generating ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={12} />}
              {generating ? 'Gerando...' : 'Gerar Áudio'}
            </button>
          )}
          {item.tour_config?.steps?.length > 0 && (
            <Tag label={`${item.tour_config.steps.length} passos`} color="#06b6d4" />
          )}
          {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>

      {/* ── Modal de Detalhes ── */}
      {open && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(139,92,246,0.03)',
          padding: '16px 20px',
        }}>
          {/* Resposta */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>📝 Resposta</div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.04)', maxHeight: 160, overflowY: 'auto',
            }}>
              {item.answer}
            </div>
          </div>

          {/* Grid de info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {/* Áudio */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🔊 Áudio</div>
              <div style={{ fontSize: 11, color: item.audio_ready ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
                {item.audio_ready ? '✅ Gerado' : '❌ Pendente'}
              </div>
              {item.audio_path && (
                <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', marginTop: 4, wordBreak: 'break-all' }}>
                  {item.audio_path}
                </div>
              )}
            </div>

            {/* Tour */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Tour Config</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {item.tour_config?.steps?.length > 0 ? (
                  item.tour_config.steps.map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, fontFamily: 'monospace' }}>
                      {i + 1}. {s.selector}
                    </div>
                  ))
                ) : (
                  <span style={{ color: '#64748b', fontSize: 11 }}>Sem tour configurado</span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 10, color: '#64748b' }}>
            <span>📋 ID: <b>{item.id}</b></span>
            <span>📊 Ordem: <b>{item.sort_order}</b></span>
            <span>{item.is_active ? '🟢 Ativo' : '🔴 Inativo'}</span>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={e => { e.stopPropagation(); onEdit(item) }} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            }}>
              <Edit3 size={12} /> Editar
            </button>
            {item.audio_ready ? (
              <button onClick={handleGenerate} disabled={generating} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                color: '#fbbf24', cursor: generating ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700,
              }}>
                <RefreshCw size={12} style={generating ? { animation: 'spin 1s linear infinite' } : {}} /> Regenerar Áudio
              </button>
            ) : (
              <button onClick={handleGenerate} disabled={generating} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#a78bfa', cursor: generating ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700,
              }}>
                <Mic size={12} /> Gerar Áudio
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(item.id) }} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginLeft: 'auto',
            }}>
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function AdminLunaPage() {
  const [tab, setTab]             = useState('knowledge') // 'knowledge' | 'logs'
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [filterCat, setFilter]    = useState('')
  const [editing, setEditing]     = useState(null)
  const [genAll, setGenAll]       = useState(false)
  const [stats, setStats]         = useState({ total: 0, with_audio: 0, with_tour: 0 })
  // Logs state
  const [logs, setLogs]           = useState(null)
  const [logHours, setLogHours]   = useState(72)
  const [logSearch, setLogSearch] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)

  // Toast notification system
  const [toasts, setToasts] = useState([])
  const showToast = (msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterCat ? `/admin/luna/knowledge?category=${filterCat}` : '/admin/luna/knowledge'
      const data = await api.request(url)
      setItems(data)
      setStats({
        total:      data.length,
        with_audio: data.filter(i => i.audio_ready).length,
        with_tour:  data.filter(i => i.tour_config?.steps?.length > 0).length,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filterCat])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    try {
      if (editing === 'new') {
        await api.request('/admin/luna/knowledge', { method: 'POST', body: JSON.stringify(form) })
      } else {
        await api.request(`/admin/luna/knowledge/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
      }
      setEditing(null)
      load()
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remover este item?')) return
    await api.request(`/admin/luna/knowledge/${id}`, { method: 'DELETE' })
    load()
  }

  const handleGenerateAudio = async (id) => {
    try {
      await api.request(`/admin/luna/knowledge/${id}/generate-audio`, { method: 'POST' })
      load()
    } catch (e) { showToast('Erro ao gerar áudio: ' + e.message, 'error') }
  }

  const handleGenerateAll = async () => {
    setGenAll(true)
    try {
      const res = await api.request('/admin/luna/knowledge/generate-all', { method: 'POST' })
      showToast(`Gerados: ${res.generated} | Falhas: ${res.failed}`, res.failed > 0 ? 'warning' : 'success')
      load()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setGenAll(false) }
  }

  // ── Logs ──
  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const q = logSearch ? `&search=${encodeURIComponent(logSearch)}` : ''
      const data = await api.request(`/admin/luna/chat-logs?hours=${logHours}${q}`)
      setLogs(data)
    } catch (e) { console.error(e) }
    finally { setLogsLoading(false) }
  }, [logHours, logSearch])

  useEffect(() => { if (tab === 'logs') loadLogs() }, [tab, loadLogs])

  const handlePromote = async (logId, category = 'geral') => {
    try {
      const res = await api.request(`/admin/luna/chat-logs/${logId}/promote?category=${category}`, { method: 'POST' })
      showToast(res.message, 'success')
      loadLogs()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 1000 }}>
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            backdropFilter: 'blur(20px)', pointerEvents: 'auto', maxWidth: 380,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'slideInRight 0.3s ease-out',
            border: '1px solid',
            ...(t.type === 'error' ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }
              : t.type === 'warning' ? { background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }
              : t.type === 'success' ? { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)', color: '#86efac' }
              : { background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)', color: '#93c5fd' }),
          }}>
            {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : t.type === 'warning' ? '⚠️ ' : 'ℹ️ '}
            {t.msg}
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{
              marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: 16
            }}>×</button>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌙</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Luna — Base de Conhecimento</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Gerencie Q&A, áudios pré-gerados e tours guiados</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleGenerateAll} disabled={genAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            {genAll ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
            {genAll ? 'Gerando...' : 'Gerar Todos os Áudios'}
          </button>
          <button onClick={() => setEditing('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', color: 'white', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            <Plus size={14} /> Novo Item
          </button>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 4 }}>
        {[{ id: 'knowledge', label: '🧠 Base de Conhecimento' }, { id: 'logs', label: '💬 Logs de Dúvidas' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : 'transparent',
            color: tab === t.id ? 'white' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'knowledge' && (<>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Itens', value: stats.total, color: '#a78bfa', icon: BookOpen },
          { label: 'Com Áudio', value: stats.with_audio, color: '#10b981', icon: Volume2 },
          { label: 'Com Tour', value: stats.with_tour, color: '#06b6d4', icon: MousePointer2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Editor */}
      {editing && (
        <Card style={{ marginBottom: 20, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa', marginBottom: 16 }}>
            {editing === 'new' ? '+ Novo Item de Conhecimento' : '✏️ Editando Item'}
          </div>
          <KnowledgeEditor
            item={editing === 'new' ? null : editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      {/* Filtros + Lista */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
          <div style={{
            display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1,
          }}>
            <button onClick={() => setFilter('')} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', fontWeight: 600,
              fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap',
              background: !filterCat ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
              color: !filterCat ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>Todos</button>
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setFilter(c.value)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', fontWeight: 600,
                fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap',
                background: filterCat === c.value ? c.color : 'rgba(255,255,255,0.06)',
                color: filterCat === c.value ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
                {c.label}
              </button>
            ))}
          </div>
          <button onClick={load} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? '⏳ Carregando...' : 'Nenhum item cadastrado. Clique em "Novo Item" para começar!'}
          </div>
        ) : (
          items.map(item => (
            <KnowledgeRow
              key={item.id}
              item={item}
              onEdit={setEditing}
              onDelete={handleDelete}
              onGenerateAudio={handleGenerateAudio}
            />
          ))
        )}
      </Card>
      </>)}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Mensagens', value: logs?.stats?.total || 0, color: '#a78bfa', icon: MessageSquare },
              { label: 'Usuários Únicos', value: logs?.stats?.unique_users || 0, color: '#3b82f6', icon: Users },
              { label: 'Módulos Usados', value: logs?.stats?.modules_used || 0, color: '#10b981', icon: BookOpen },
            ].map(({ label, value, color, icon: Icon }) => (
              <Card key={label} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Top perguntas repetidas */}
          {logs?.top_questions?.length > 0 && (
            <Card style={{ marginBottom: 16, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 10 }}>⚠ Perguntas Mais Frequentes (candidatas a FAQ)</div>
              {logs.top_questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', width: 30, textAlign: 'center' }}>{q.count}x</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{q.question}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <select value={logHours} onChange={e => setLogHours(+e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
              {[24, 48, 72, 168, 720].map(h => <option key={h} value={h}>{h < 168 ? `${h}h` : h < 720 ? '1 semana' : '1 mês'}</option>)}
            </select>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 12px' }}>
              <Search size={13} color="#64748b" />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Buscar nas mensagens..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, padding: '8px 0', width: '100%' }} />
            </div>
            <button onClick={loadLogs} style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Filtrar</button>
          </div>

          {/* Logs list */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              💬 Conversas dos Usuários — {logs?.logs?.length || 0} registros
            </div>
            {!logs?.logs?.length ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                {logsLoading ? '⏳ Carregando...' : 'Nenhuma conversa no período selecionado'}
              </div>
            ) : (
              logs.logs.map(log => (
                <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{log.user_name || `User #${log.user_id}`}</span>
                    {log.module && <Tag label={log.module} color="#06b6d4" />}
                    <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>👤 {log.user_message}</div>
                  {log.luna_response && (
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, paddingLeft: 16, borderLeft: '2px solid rgba(139,92,246,0.3)' }}>🌙 {log.luna_response}</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => handlePromote(log.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      <ArrowUpRight size={11} /> Promover para FAQ
                    </button>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
