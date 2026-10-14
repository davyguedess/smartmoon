import React, { useState, useEffect, useCallback } from 'react'
import {
  Bot, Plus, Search, X, Users, Coins, Globe, Lock, Eye,
  Edit2, Trash2, Power, PowerOff, BarChart2, Shield, Star,
  ChevronLeft, ChevronRight, Layers
} from 'lucide-react'
import { adminApi } from '../../api'

const badge = (text, color = '#7c3aed', bg = 'rgba(124,58,237,0.12)') => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: bg, color, textTransform: 'uppercase', letterSpacing: 1 }}>{text}</span>
)

const PlanPills = ({ plans }) => {
  if (!plans || !plans.length) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const colors = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', business: '#e91e8c', enterprise: '#f59e0b' }
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {plans.map(p => (
        <span key={p} style={{ padding: '2px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700,
          background: `${colors[p] || '#6b7280'}22`, color: colors[p] || '#6b7280',
          textTransform: 'uppercase', letterSpacing: 0.5 }}>{p}</span>
      ))}
    </div>
  )
}

const ALL_PLANS = ['free', 'starter', 'pro', 'business', 'enterprise']
const CATEGORIES = ['', 'Vendas', 'Suporte', 'Marketing', 'Financeiro', 'Produtividade', 'Criativo', 'Análise']
const ICONS = ['🤖', '💼', '🎧', '✍️', '📊', '🎯', '🌐', '🔔', '📅', '💡', '🏆', '🛡️', '🚀', '🎨', '📱']
const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
const TYPES = ['conversational', 'sales', 'support', 'analytical', 'creative', 'automation']

// ── Create/Edit Modal ─────────────────────────────────────────────────────────
function AgentModal({ agent, onClose, onSave, companies }) {
  const isEdit = !!agent?.id && agent?.source === 'platform'
  const [form, setForm] = useState({
    name: agent?.name || '', slug: agent?.slug || '', icon: agent?.icon || '🤖',
    category: agent?.category || 'geral', description: agent?.description || '',
    system_prompt: agent?.system_prompt || 'Você é um assistente inteligente da Smart Moon.',
    model: agent?.model || 'gpt-4o-mini', provider: agent?.provider || 'openai',
    temperature: agent?.temperature || '0.7', agent_type: agent?.agent_type || 'conversational',
    is_active: agent?.is_active !== false, is_exclusive: agent?.is_exclusive || false,
    exclusive_company_id: agent?.exclusive_company_id || '',
    price_credits: agent?.price_credits ?? 0, plan_access: agent?.plan_access || ALL_PLANS.slice(1),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name) return setError('Nome é obrigatório')
    setSaving(true); setError(null)
    try {
      const data = {
        ...form,
        exclusive_company_id: form.is_exclusive && form.exclusive_company_id ? parseInt(form.exclusive_company_id) : null,
        price_credits: parseInt(form.price_credits) || 0,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      }
      if (isEdit) await adminApi.updateAgentStore(agent.id, data)
      else await adminApi.createAgentStore(data)
      onSave(); onClose()
    } catch (e) { setError(e?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const togglePlan = (plan) => {
    const cur = form.plan_access || []
    set('plan_access', cur.includes(plan) ? cur.filter(p => p !== plan) : [...cur, plan])
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16,
        width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {isEdit ? 'Editar Agente' : 'Novo Agente de Plataforma'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Ícone */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Ícone</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => set('icon', ic)}
                  style={{ fontSize: 20, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                    background: form.icon === ic ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                    border: form.icon === ic ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lblStyle}>Nome *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Assistente de Vendas" style={inputStyle} />
          </div>

          <div>
            <label style={lblStyle}>Categoria</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
              {CATEGORIES.filter(c => c).map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={lblStyle}>Modelo de IA</label>
            <select value={form.model} onChange={e => set('model', e.target.value)} style={inputStyle}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={lblStyle}>Tipo de Agente</label>
            <select value={form.agent_type} onChange={e => set('agent_type', e.target.value)} style={inputStyle}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={lblStyle}>Temperatura (0 = preciso, 1 = criativo)</label>
            <input type="number" min="0" max="2" step="0.1" value={form.temperature}
              onChange={e => set('temperature', e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={lblStyle}>Preço (créditos) — 0 = gratuito</label>
            <input type="number" min="0" value={form.price_credits}
              onChange={e => set('price_credits', e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 18 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Ativo
            </label>
          </div>

          {/* Exclusivo */}
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '12px 16px' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_exclusive} onChange={e => set('is_exclusive', e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Shield size={14} color="#a855f7" /> Agente exclusivo para cliente específico
                </span>
              </label>
              {form.is_exclusive && (
                <div style={{ marginTop: 10 }}>
                  <select value={form.exclusive_company_id} onChange={e => set('exclusive_company_id', e.target.value)} style={inputStyle}>
                    <option value="">Selecione o cliente...</option>
                    {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name} — {c.plan}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Planos */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Planos com acesso</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {ALL_PLANS.map(p => (
                <button key={p} onClick={() => togglePlan(p)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: 1,
                    background: (form.plan_access || []).includes(p) ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                    color: (form.plan_access || []).includes(p) ? '#a855f7' : 'var(--text-muted)',
                    border: (form.plan_access || []).includes(p) ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Descreva o que esse agente faz..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>System Prompt</label>
            <textarea value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)}
              rows={4} placeholder="Instruções do agente..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Agente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Agent Detail Modal ────────────────────────────────────────────────────────
function AgentDetailModal({ agent, onClose, onEdit, onDelete, onToggle }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [delConfirm, setDelConfirm] = useState(false)

  useEffect(() => {
    const src = agent.source || 'platform'
    const fn = src === 'user' ? adminApi.getAgentStore(agent.id, 'user') : adminApi.getAgentStore(agent.id, 'platform')
    fn.then(setDetail).catch(console.error).finally(() => setLoading(false))
  }, [agent.id, agent.source])

  const handleDelete = async () => {
    if (agent.source !== 'platform') return
    try { await adminApi.deleteAgentStore(agent.id); onDelete(agent.id); onClose() }
    catch (e) { alert(e?.message || 'Erro ao excluir') }
  }

  const handleToggle = async () => {
    if (agent.source !== 'platform') return
    try { await adminApi.updateAgentStore(agent.id, { is_active: !agent.is_active }); onToggle() }
    catch (e) { alert(e?.message || 'Erro') }
  }

  const isUserAgent = agent.source === 'user'

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16,
        width: '100%', maxWidth: 740, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: isUserAgent ? 'rgba(59,130,246,0.15)' : 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {agent.icon}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>{agent.name}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {badge(agent.category || agent.agent_type || 'geral')}
                  {badge(isUserAgent ? 'Agente de Usuário' : 'Smart Moon', isUserAgent ? '#3b82f6' : '#a855f7', isUserAgent ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)')}
                  {agent.price_credits > 0 && (
                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <Coins size={12} />{agent.price_credits} cr.
                    </span>
                  )}
                </div>
                {isUserAgent && detail?.company && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Empresa: <strong style={{ color: 'var(--text-secondary)' }}>{detail.company.name}</strong> •
                    Plano: <strong>{detail.company.plan}</strong>
                    {detail.creator?.name && ` • Criador: ${detail.creator.name}`}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {!isUserAgent && !loading && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { onEdit(agent); onClose() }} style={actionBtn('#3b82f6')}><Edit2 size={13} /> Editar</button>
              <button onClick={handleToggle} style={actionBtn(agent.is_active ? '#f59e0b' : '#10b981')}>
                {agent.is_active ? <><PowerOff size={13} /> Desativar</> : <><Power size={13} /> Ativar</>}
              </button>
              {!delConfirm
                ? <button onClick={() => setDelConfirm(true)} style={actionBtn('#ef4444')}><Trash2 size={13} /> Excluir</button>
                : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#f87171' }}>Confirmar?</span>
                    <button onClick={handleDelete} style={actionBtn('#ef4444')}>Sim</button>
                    <button onClick={() => setDelConfirm(false)} style={actionBtn('#6b7280')}>Não</button>
                  </div>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px' }}>
          {[
            { id: 'info', label: 'System Prompt' },
            ...(!isUserAgent ? [{ id: 'installs', label: `Instalações (${detail?.total_installs || 0})` }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: tab === t.id ? '#a855f7' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid #a855f7' : '2px solid transparent'
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '20px 28px', minHeight: 200 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</div>
          ) : tab === 'info' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>SYSTEM PROMPT</div>
                <pre style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace' }}>
                  {detail?.agent?.system_prompt || '—'}
                </pre>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Modelo', value: detail?.agent?.model },
                  { label: 'Provider', value: detail?.agent?.provider },
                  { label: 'Temperatura', value: detail?.agent?.temperature },
                  { label: 'Tipo', value: detail?.agent?.agent_type },
                  { label: 'Slug', value: `/${detail?.agent?.slug}` },
                  { label: 'Criado', value: detail?.agent?.created_at ? new Date(detail.agent.created_at).toLocaleDateString('pt-BR') : '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb' }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>PLANOS COM ACESSO</div>
                <PlanPills plans={detail?.agent?.plan_access} />
              </div>
            </div>
          ) : (
            detail?.installs?.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                Nenhum usuário instalou este agente
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Empresa', 'Usuário', 'Agente Criado', 'Status', 'Instalado'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(detail?.installs || []).map((ins, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{ins.company}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{ins.user || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{ins.agent_name || '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', marginRight: 6,
                          background: ins.is_active ? '#10b981' : '#6b7280' }} />
                        <span style={{ fontSize: 11, color: ins.is_active ? '#10b981' : '#6b7280' }}>{ins.is_active ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {ins.installed_at ? new Date(ins.installed_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  )
}

const lblStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const actionBtn = (color) => ({ display: 'flex', gap: 5, alignItems: 'center', padding: '7px 14px', borderRadius: 8,
  border: `1px solid ${color}44`, background: `${color}15`, color, fontSize: 12, fontWeight: 600, cursor: 'pointer' })
const iconBtn = { width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center' }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminAgentStorePage() {
  const [agents, setAgents] = useState([])
  const [kpis, setKpis] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [companies, setCompanies] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listAgentStore({ page, search, category: catFilter, source })
      setAgents(res.agents || [])
      setTotal(res.total || 0)
      setKpis(res.kpis || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, search, catFilter, source])

  useEffect(() => { load() }, [load])
  useEffect(() => { adminApi.listCompanies().then(setCompanies).catch(() => {}) }, [])

  const KPIS = [
    { label: 'Agentes Smart Moon', value: kpis.platform_active || 0, icon: <Bot size={16} />, color: '#7c3aed' },
    { label: 'Pagos', value: kpis.platform_paid || 0, icon: <Coins size={16} />, color: '#f59e0b' },
    { label: 'Criados por Usuários', value: kpis.user_agents || 0, icon: <Users size={16} />, color: '#3b82f6' },
    { label: 'Instalações', value: kpis.total_installs || 0, icon: <Layers size={16} />, color: '#10b981' },
  ]

  return (
    <div style={{ padding: 28, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} color="#3b82f6" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>Agent Store</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Gerencie agentes-template da plataforma e visualize agentes criados por usuários
          </p>
        </div>
        <button onClick={() => setCreateModal(true)} style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '10px 20px', borderRadius: 10,
          border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={16} /> Novo Agente
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {KPIS.map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, color: k.color }}>
              {k.icon}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar agente, categoria..." style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }} style={{ ...inputStyle, width: 200 }}>
          <option value="">Todos os agentes</option>
          <option value="platform">Smart Moon (plataforma)</option>
          <option value="user">Criados por usuários</option>
        </select>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }} style={{ ...inputStyle, width: 180 }}>
          <option value="">Todas categorias</option>
          {CATEGORIES.filter(c => c).map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              {['Agente', 'Fonte', 'Tipo', 'Modelo', 'Planos / Empresa', 'Preço', 'Instalações', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum agente encontrado</td></tr>
            ) : agents.map(ag => (
              <tr key={`${ag.source}-${ag.id}`} onClick={() => setDetailTarget(ag)}
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{ag.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>{ag.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{ag.slug || '—'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {ag.source === 'platform'
                    ? badge('Smart Moon', '#a855f7', 'rgba(168,85,247,0.1)')
                    : <div>
                        {badge('Usuário', '#3b82f6', 'rgba(59,130,246,0.1)')}
                        {ag.plan && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{ag.exclusive_company}</div>}
                      </div>
                  }
                </td>
                <td style={{ padding: '12px 14px' }}>{badge(ag.agent_type || 'geral', '#6b7280', 'rgba(107,114,128,0.1)')}</td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{ag.model}</td>
                <td style={{ padding: '12px 14px' }}>
                  {ag.source === 'platform'
                    ? <PlanPills plans={ag.plan_access} />
                    : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ag.exclusive_company}</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {ag.price_credits > 0
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', display: 'flex', gap: 4, alignItems: 'center' }}><Coins size={11} />{ag.price_credits}</span>
                    : <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Grátis</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#a855f7' }}>{ag.install_count}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: ag.is_active ? '#10b981' : '#6b7280' }} />
                    <span style={{ fontSize: 11, color: ag.is_active ? '#10b981' : '#6b7280' }}>{ag.is_active ? 'Ativo' : 'Inativo'}</span>
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDetailTarget(ag)} style={iconBtn}><Eye size={13} /></button>
                    {ag.source === 'platform' && <>
                      <button onClick={() => setEditTarget(ag)} style={iconBtn}><Edit2 size={13} /></button>
                      <button onClick={async () => {
                        await adminApi.updateAgentStore(ag.id, { is_active: !ag.is_active }); load()
                      }} style={iconBtn}>
                        {ag.is_active ? <PowerOff size={13} color="#f59e0b" /> : <Power size={13} color="#10b981" />}
                      </button>
                      <button onClick={async () => {
                        if (window.confirm(`Excluir "${ag.name}"?`)) { await adminApi.deleteAgentStore(ag.id); load() }
                      }} style={iconBtn}><Trash2 size={13} color="#ef4444" /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={iconBtn}><ChevronLeft size={14} /></button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Pág. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={agents.length < 50} style={iconBtn}><ChevronRight size={14} /></button>
        </div>
      )}

      {createModal && <AgentModal companies={companies} onClose={() => setCreateModal(false)} onSave={load} />}
      {editTarget && <AgentModal agent={editTarget} companies={companies} onClose={() => setEditTarget(null)} onSave={load} />}
      {detailTarget && (
        <AgentDetailModal
          agent={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={ag => { setDetailTarget(null); setEditTarget(ag) }}
          onDelete={id => setAgents(prev => prev.filter(a => !(a.id === id && a.source === 'platform')))}
          onToggle={load}
        />
      )}
    </div>
  )
}
