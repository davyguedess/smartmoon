import React, { useState, useEffect, useCallback } from 'react'
import {
  Zap, Plus, Search, X, ChevronDown, Users, Star, Lock, Globe,
  Edit2, Trash2, PowerOff, Power, Eye, BarChart2, Check, AlertCircle,
  Coins, BookOpen, Shield
} from 'lucide-react'
import { adminApi } from '../../api'

// ── Helpers ──────────────────────────────────────────────────────────────────
const badge = (text, color = '#7c3aed', bg = 'rgba(124,58,237,0.12)') => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: bg, color, textTransform: 'uppercase', letterSpacing: 1 }}>{text}</span>
)

const PriceBadge = ({ credits }) =>
  credits === 0
    ? badge('Gratuita', '#10b981', 'rgba(16,185,129,0.12)')
    : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
        <Coins size={12} /> {credits} créditos
      </span>

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

const ICONS = ['⚡', '🎯', '📧', '💬', '📅', '🎨', '📄', '💰', '🔗', '🤖', '🛠️', '📊', '🌐', '🔔', '🎙️']
const CATEGORIES = ['', 'Mensagens', 'Email', 'Agenda', 'Vendas', 'Criativo', 'Produtividade', 'Financeiro', 'Análise', 'Integração']
const ALL_PLANS = ['free', 'starter', 'pro', 'business', 'enterprise']

// ── Create/Edit Skill Modal ───────────────────────────────────────────────────
function SkillModal({ skill, onClose, onSave, companies }) {
  const isEdit = !!skill?.id
  const [form, setForm] = useState({
    name: skill?.name || '', slug: skill?.slug || '', icon: skill?.icon || '⚡',
    category: skill?.category || 'geral', description: skill?.description || '',
    prompt_patch: skill?.prompt_patch || '', tools_enabled: (skill?.tools_enabled || []).join(', '),
    is_active: skill?.is_active !== false, is_exclusive: skill?.is_exclusive || false,
    exclusive_company_id: skill?.exclusive_company_id || '',
    price_credits: skill?.price_credits ?? 0,
    plan_access: skill?.plan_access || ALL_PLANS,
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
        tools_enabled: form.tools_enabled.split(',').map(s => s.trim()).filter(Boolean),
        exclusive_company_id: form.is_exclusive && form.exclusive_company_id ? parseInt(form.exclusive_company_id) : null,
        price_credits: parseInt(form.price_credits) || 0,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      }
      if (isEdit) await adminApi.updateSkill(skill.id, data)
      else await adminApi.createSkill(data)
      onSave()
      onClose()
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
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
              {isEdit ? 'Editar Skill' : 'Nova Skill'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Skills disponíveis na Smart Moon platform
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Nome */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Nome da Skill *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: WhatsApp Sender" style={inputStyle} />
          </div>

          {/* Ícone */}
          <div>
            <label style={lblStyle}>Ícone</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
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

          {/* Categoria */}
          <div>
            <label style={lblStyle}>Categoria</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
              {CATEGORIES.filter(c => c).map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>
          </div>

          {/* Preço em créditos */}
          <div>
            <label style={lblStyle}>Preço (créditos) — 0 = gratuita</label>
            <input type="number" min="0" value={form.price_credits} onChange={e => set('price_credits', e.target.value)} style={inputStyle} />
          </div>

          {/* Status */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 20 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Ativa
            </label>
          </div>

          {/* Exclusiva */}
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '14px 16px' }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_exclusive} onChange={e => set('is_exclusive', e.target.checked)} />
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Shield size={14} color="#a855f7" /> Esta skill é exclusiva
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                    Se marcada, ficará disponível apenas para um cliente específico
                  </div>
                </div>
              </label>
              {form.is_exclusive && (
                <div style={{ marginTop: 12 }}>
                  <label style={lblStyle}>Cliente exclusivo</label>
                  <select value={form.exclusive_company_id} onChange={e => set('exclusive_company_id', e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.plan})</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Planos */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Planos com acesso a esta skill</label>
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

          {/* Descrição */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="O que essa skill faz?" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Prompt Patch */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Prompt Patch — texto injetado no system prompt do agente</label>
            <textarea value={form.prompt_patch} onChange={e => set('prompt_patch', e.target.value)}
              rows={3} placeholder="Quando esta skill estiver ativa, o agente receberá este texto no system prompt..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Tools */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lblStyle}>Tools habilitadas (separadas por vírgula)</label>
            <input value={form.tools_enabled} onChange={e => set('tools_enabled', e.target.value)}
              placeholder="send_whatsapp_message, send_whatsapp_voice" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Skill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skill Detail Modal ────────────────────────────────────────────────────────
function SkillDetailModal({ skill, onClose, onEdit, onDelete, onToggle }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('users')
  const [delConfirm, setDelConfirm] = useState(false)

  useEffect(() => {
    adminApi.getSkill(skill.id).then(setDetail).catch(console.error).finally(() => setLoading(false))
  }, [skill.id])

  const handleDelete = async () => {
    try { await adminApi.deleteSkill(skill.id); onDelete(skill.id); onClose() }
    catch (e) { alert(e?.message || 'Erro ao excluir') }
  }

  const handleToggle = async () => {
    try { await adminApi.updateSkill(skill.id, { is_active: !skill.is_active }); onToggle() }
    catch (e) { alert(e?.message || 'Erro') }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16,
        width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                {skill.icon}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>{skill.name}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  {badge(skill.category, '#7c3aed')}
                  {skill.is_exclusive && badge('Exclusiva', '#f59e0b', 'rgba(245,158,11,0.1)')}
                  <PriceBadge credits={skill.price_credits} />
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* KPIs */}
          {!loading && detail && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
              {[
                { label: 'Instalações', value: detail.total_installs, icon: <Users size={14} /> },
                { label: 'Uso total', value: detail.total_usage || 0, icon: <BarChart2 size={14} /> },
                { label: 'Status', value: skill.is_active ? 'Ativa' : 'Inativa', icon: <Power size={14} /> },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>
                    {kpi.icon} {kpi.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => { onEdit(skill); onClose() }} style={actionBtn('#3b82f6')}>
              <Edit2 size={13} /> Editar
            </button>
            <button onClick={handleToggle} style={actionBtn(skill.is_active ? '#f59e0b' : '#10b981')}>
              {skill.is_active ? <><PowerOff size={13} /> Desativar</> : <><Power size={13} /> Ativar</>}
            </button>
            {!delConfirm
              ? <button onClick={() => setDelConfirm(true)} style={actionBtn('#ef4444')}>
                  <Trash2 size={13} /> Excluir
                </button>
              : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#f87171' }}>Confirmar exclusão?</span>
                  <button onClick={handleDelete} style={actionBtn('#ef4444')}>Sim</button>
                  <button onClick={() => setDelConfirm(false)} style={actionBtn('#6b7280')}>Não</button>
                </div>
            }
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px' }}>
          {[{ id: 'users', label: 'Usuários instalados', icon: <Users size={13} /> },
            { id: 'config', label: 'Configuração', icon: <BookOpen size={13} /> }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', gap: 6, alignItems: 'center', padding: '12px 16px', border: 'none',
              background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: tab === t.id ? '#a855f7' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid #a855f7' : '2px solid transparent'
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        <div style={{ padding: '20px 28px', minHeight: 200 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</div>
          ) : tab === 'users' ? (
            detail?.installs?.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40, fontSize: 13 }}>
                Nenhum usuário instalou esta skill ainda
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Empresa', 'Usuário', 'Email', 'Uso', 'Status', 'Instalado'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detail?.installs || []).map((ins, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{ins.company}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{ins.user || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{ins.email || '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#a855f7' }}>{ins.usage_count}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>usos</span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                          background: ins.is_active ? '#10b981' : '#6b7280', marginRight: 6 }} />
                        <span style={{ fontSize: 11, color: ins.is_active ? '#10b981' : '#6b7280' }}>
                          {ins.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {ins.installed_at ? new Date(ins.installed_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <InfoRow label="Slug" value={`/${detail?.skill?.slug}`} />
              <InfoRow label="Prompt Patch" value={detail?.skill?.prompt_patch || '—'} mono />
              <InfoRow label="Tools Habilitadas" value={(detail?.skill?.tools_enabled || []).join(', ') || '—'} mono />
              <InfoRow label="Planos com acesso" value={<PlanPills plans={detail?.skill?.plan_access} />} />
              <InfoRow label="Descrição" value={detail?.skill?.description || '—'} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const InfoRow = ({ label, value, mono }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 14px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.5 }}>{value}</div>
  </div>
)

const lblStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const actionBtn = (color) => ({ display: 'flex', gap: 5, alignItems: 'center', padding: '7px 14px', borderRadius: 8,
  border: `1px solid ${color}44`, background: `${color}15`, color, fontSize: 12, fontWeight: 600, cursor: 'pointer' })

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSkillsPage() {
  const [skills, setSkills] = useState([])
  const [kpis, setKpis] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
      const res = await adminApi.listSkills({ page, search, category: catFilter })
      setSkills(res.skills || [])
      setTotal(res.total || 0)
      setKpis(res.kpis || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, search, catFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { adminApi.listCompanies().then(setCompanies).catch(() => {}) }, [])

  const KPIS = [
    { label: 'Total Skills', value: total, icon: <Zap size={16} />, color: '#7c3aed' },
    { label: 'Ativas', value: kpis.active || 0, icon: <Power size={16} />, color: '#10b981' },
    { label: 'Pagas', value: kpis.paid || 0, icon: <Coins size={16} />, color: '#f59e0b' },
    { label: 'Gratuitas', value: kpis.free || 0, icon: <Globe size={16} />, color: '#3b82f6' },
    { label: 'Exclusivas', value: kpis.exclusive || 0, icon: <Lock size={16} />, color: '#ef4444' },
  ]

  return (
    <div style={{ padding: 28, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#a855f7" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>Skills Store</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Gerencie todas as skills da plataforma Smart Moon
          </p>
        </div>
        <button onClick={() => setCreateModal(true)} style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '10px 20px', borderRadius: 10,
          border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={16} /> Nova Skill
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
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
            placeholder="Buscar skill, slug ou categoria..."
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
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
              {['Skill', 'Categoria', 'Tipo', 'Planos', 'Instalações', 'Uso total', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : skills.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma skill encontrada</td></tr>
            ) : skills.map(sk => (
              <tr key={sk.id} onClick={() => setDetailTarget(sk)}
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{sk.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>{sk.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{sk.slug}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>{badge(sk.category, '#7c3aed')}</td>
                <td style={{ padding: '12px 16px' }}>
                  {sk.is_exclusive
                    ? <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#f59e0b', fontWeight: 700 }}><Lock size={11} /> Exclusiva<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sk.exclusive_company || ''}</span></span>
                    : <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#3b82f6', fontWeight: 700 }}><Globe size={11} /> Pública</span>
                  }
                </td>
                <td style={{ padding: '12px 16px' }}><PlanPills plans={sk.plan_access} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#a855f7' }}>{sk.install_count}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>empresas</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>{sk.total_usage}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>usos</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sk.is_active ? '#10b981' : '#6b7280' }} />
                    <span style={{ fontSize: 11, color: sk.is_active ? '#10b981' : '#6b7280' }}>
                      {sk.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDetailTarget(sk)} title="Ver detalhe" style={iconBtn}>
                      <Eye size={13} />
                    </button>
                    <button onClick={() => setEditTarget(sk)} title="Editar" style={iconBtn}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={async () => {
                      await adminApi.updateSkill(sk.id, { is_active: !sk.is_active })
                      load()
                    }} title={sk.is_active ? 'Desativar' : 'Ativar'} style={iconBtn}>
                      {sk.is_active ? <PowerOff size={13} color="#f59e0b" /> : <Power size={13} color="#10b981" />}
                    </button>
                    <button onClick={async () => {
                      if (window.confirm(`Excluir "${sk.name}"?`)) {
                        await adminApi.deleteSkill(sk.id)
                        load()
                      }
                    }} title="Excluir" style={iconBtn}>
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={iconBtn}>‹</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Pág. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={skills.length < 50} style={iconBtn}>›</button>
        </div>
      )}

      {/* Modals */}
      {createModal && <SkillModal companies={companies} onClose={() => setCreateModal(false)} onSave={load} />}
      {editTarget && <SkillModal skill={editTarget} companies={companies} onClose={() => setEditTarget(null)} onSave={load} />}
      {detailTarget && (
        <SkillDetailModal
          skill={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={sk => { setDetailTarget(null); setEditTarget(sk) }}
          onDelete={id => { setSkills(prev => prev.filter(s => s.id !== id)) }}
          onToggle={load}
        />
      )}
    </div>
  )
}

const iconBtn = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
