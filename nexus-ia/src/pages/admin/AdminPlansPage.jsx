/**
 * AdminPlansPage — Full plan management with CRUD
 * Create, edit, toggle, delete plans with module selection + API access control
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Plus, RefreshCw, AlertCircle, X, Save,
  Eye, Edit2, Trash2, ToggleLeft, ToggleRight, Check,
  Package, Zap, Users, GitBranch, Plug2, Volume2, Mic,
  Radio, Megaphone, Target, Landmark, ShoppingBag, Crown,
  Clock, DollarSign, Infinity, ChevronDown, ChevronUp
} from 'lucide-react'
import { adminApi } from '../../api'
import { useToast } from '../../components/ui/Toast'

// ── Catálogo de integrações disponíveis na plataforma ──────────────────────────
const INTEGRATIONS_CATALOG = [
  { id: 'openai',         label: 'OpenAI (GPT-4o)',          icon: '🧠', category: 'IA' },
  { id: 'gemini',         label: 'Google Gemini',            icon: '🔷', category: 'IA' },
  { id: 'claude',         label: 'Anthropic Claude',         icon: '🟣', category: 'IA' },
  { id: 'groq',           label: 'Groq',                     icon: '⚡', category: 'IA' },
  { id: 'elevenlabs',     label: 'ElevenLabs (TTS)',         icon: '🎙️', category: 'Voz' },
  { id: 'telegram',       label: 'Telegram Bot',             icon: '✈️', category: 'Mensageria' },
  { id: 'whatsapp_evo',   label: 'WhatsApp Evolution',       icon: '💬', category: 'Mensageria' },
  { id: 'whatsapp_zapi',  label: 'WhatsApp Z-API',           icon: '📲', category: 'Mensageria' },
  { id: 'whatsapp_meta',  label: 'WhatsApp Meta Cloud',      icon: '🌐', category: 'Mensageria' },
  { id: 'google_oauth',   label: 'Google OAuth2',            icon: '🔑', category: 'Google' },
  { id: 'google_sheets',  label: 'Google Sheets',            icon: '📊', category: 'Google' },
  { id: 'gmail',          label: 'Gmail API',                icon: '📧', category: 'Google' },
  { id: 'mercadopago',    label: 'Mercado Pago',             icon: '💳', category: 'Pagamentos' },
  { id: 'stripe',         label: 'Stripe',                   icon: '💰', category: 'Pagamentos' },
  { id: 'hubspot',        label: 'HubSpot CRM',              icon: '🧡', category: 'CRM' },
  { id: 'notion',         label: 'Notion',                   icon: '📓', category: 'CRM' },
  { id: 'github',         label: 'GitHub',                   icon: '🐙', category: 'CRM' },
]

// Group by category for UI
const INT_BY_CATEGORY = INTEGRATIONS_CATALOG.reduce((acc, int) => {
  if (!acc[int.category]) acc[int.category] = []
  acc[int.category].push(int)
  return acc
}, {})

const MODULE_ICONS = {
  agentes: Package,
  skills: Zap,
  agent_store: ShoppingBag,
  flows: GitBranch,
  integracoes: Plug2,
  voz: Volume2,
  clonagem_voz: Mic,
  voice_agents: Radio,
  marketing: Megaphone,
  campanhas_ia: Target,
  licitacao: Landmark,
}

const BILLING_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'lifetime', label: 'Vitalício' },
]

const EMPTY_PLAN = {
  name: '', display_name: '', description: '', price: 0,
  currency: 'BRL', billing_cycle: 'monthly', duration_days: 30,
  max_flows: 5, max_agents: 2, max_skills: 3, max_integrations: 2,
  max_voice_profiles: 0, max_campaigns: 0,
  modules: [], free_skills: [], allowed_integrations: [],
  is_active: true, is_featured: false, sort_order: 0, color: '#6366f1',
}

/* ─── Shared Styles ───────────────────────────────────────────── */
const s = {
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: '20px 22px',
  },
  input: {
    width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.2s',
  },
  label: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)',
    marginBottom: 6, display: 'block', textTransform: 'uppercase',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', fontSize: 12, fontWeight: 700,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.2s',
    boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', fontSize: 12, fontWeight: 700,
    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: 'pointer',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    background: 'var(--bg-card)', color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer',
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease',
  },
  modalContent: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 16, width: '95%', maxWidth: 680, maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
}

/* ─── Module Chip ─────────────────────────────────────────────── */
function ModuleChip({ mod, selected, onClick, small }) {
  const Icon = MODULE_ICONS[mod.key] || Package
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: small ? 4 : 6,
        padding: small ? '3px 8px' : '6px 12px',
        borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 600,
        background: selected ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)',
        color: selected ? '#818cf8' : 'var(--text-muted)',
        border: `1px solid ${selected ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={small ? 10 : 12} />
      {mod.label}
      {selected && onClick && <Check size={10} />}
    </button>
  )
}

/* ─── Integration Chip ────────────────────────────────────────── */
function IntegrationChip({ integration, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: selected ? 'rgba(14,165,233,0.15)' : 'var(--bg-elevated)',
        color: selected ? '#38bdf8' : 'var(--text-muted)',
        border: `1px solid ${selected ? 'rgba(14,165,233,0.3)' : 'var(--border-subtle)'}`,
        cursor: 'pointer', transition: 'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: 13 }}>{integration.icon}</span>
      {integration.label}
      {selected && <Check size={10} />}
    </button>
  )
}

/* ─── Limit Badge ─────────────────────────────────────────────── */
function LimitBadge({ label, value, icon: Icon }) {
  const isUnlimited = value === -1
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8,
      background: 'var(--bg-elevated)', fontSize: 11,
    }}>
      <Icon size={11} color="var(--text-muted)" />
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontWeight: 700, color: isUnlimited ? '#10b981' : 'var(--text-primary)' }}>
        {isUnlimited ? '∞' : value}
      </span>
    </div>
  )
}

/* ─── Plan Form Modal ─────────────────────────────────────────── */
function PlanFormModal({ plan, modules, onSave, onClose, isNew }) {
  const toast = useToast()
  const [form, setForm] = useState(plan || { ...EMPTY_PLAN })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const toggleModule = (key) => {
    const mods = form.modules || []
    set('modules', mods.includes(key) ? mods.filter(m => m !== key) : [...mods, key])
  }

  const handleSave = async () => {
    if (!form.display_name?.trim()) {
      toast.warning('Nome do plano é obrigatório')
      return
    }
    setSaving(true)
    try {
      const data = {
        ...form,
        name: isNew ? form.display_name.trim().toLowerCase().replace(/\s+/g, '_') : undefined,
      }
      if (isNew) {
        data.name = form.display_name.trim().toLowerCase().replace(/\s+/g, '_')
      }
      await onSave(data)
      toast.success(isNew ? `Plano "${form.display_name}" criado!` : `Plano "${form.display_name}" atualizado!`)
      onClose()
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modalContent}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isNew ? <Plus size={18} color="#6366f1" /> : <Edit2 size={18} color="#f59e0b" />}
            <span style={{ fontSize: 16, fontWeight: 800 }}>
              {isNew ? 'Criar Novo Plano' : `Editar — ${form.display_name}`}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Row 1: Name + Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 14 }}>
            <div>
              <label style={s.label}>Nome do Plano</label>
              <input
                style={s.input} value={form.display_name || ''}
                onChange={e => set('display_name', e.target.value)}
                placeholder="Ex: Professional"
              />
            </div>
            <div>
              <label style={s.label}>Cor</label>
              <input
                type="color" value={form.color || '#6366f1'}
                onChange={e => set('color', e.target.value)}
                style={{ ...s.input, padding: 4, height: 42, cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={s.label}>Descrição</label>
            <textarea
              style={{ ...s.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Breve descrição do plano..."
            />
          </div>

          {/* Row 2: Price + Billing + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={s.label}>Valor (R$)</label>
              <input
                type="number" step="0.01" min="0"
                style={s.input} value={form.price || 0}
                onChange={e => set('price', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label style={s.label}>Ciclo de Cobrança</label>
              <select
                style={s.input}
                value={form.billing_cycle || 'monthly'}
                onChange={e => set('billing_cycle', e.target.value)}
              >
                {BILLING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.label}>Duração (dias)</label>
              <input
                type="number" min="1"
                style={s.input} value={form.duration_days || 30}
                onChange={e => set('duration_days', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          {/* Limits Section */}
          <div>
            <label style={{ ...s.label, marginBottom: 10 }}>Limites do Plano</label>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '-4px 0 10px', fontStyle: 'italic' }}>
              Use -1 para ilimitado
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { key: 'max_flows', label: 'Fluxos', icon: GitBranch },
                { key: 'max_agents', label: 'Agentes', icon: Package },
                { key: 'max_skills', label: 'Skills', icon: Zap },
                { key: 'max_integrations', label: 'Integrações', icon: Plug2 },
                { key: 'max_voice_profiles', label: 'Perfis de Voz', icon: Volume2 },
                { key: 'max_campaigns', label: 'Campanhas', icon: Target },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Icon size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                  <input
                    type="number" min="-1"
                    style={{ ...s.input, padding: '8px 10px', fontSize: 12 }}
                    value={form[key] ?? 0}
                    onChange={e => set(key, parseInt(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Modules Selection */}
          <div>
            <label style={{ ...s.label, marginBottom: 10 }}>Módulos de Navegação Disponíveis</label>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '-4px 0 10px', fontStyle: 'italic' }}>
              Controla quais seções aparecem no menu lateral do usuário
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(modules || []).map(mod => (
                <ModuleChip
                  key={mod.key} mod={mod}
                  selected={(form.modules || []).includes(mod.key)}
                  onClick={() => toggleModule(mod.key)}
                />
              ))}
            </div>
          </div>

          {/* APIs / Integrations Selection */}
          <div style={{
            paddingTop: 16, borderTop: '1px solid var(--border-subtle)'
          }}>
            <label style={{ ...s.label, marginBottom: 4 }}>APIs Incluídas no Plano</label>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
              Define quais integrações os usuários deste plano podem configurar no Perfil &amp; APIs
            </p>
            {Object.entries(INT_BY_CATEGORY).map(([cat, ints]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase',
                }}>{cat}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ints.map(int => (
                    <IntegrationChip
                      key={int.id}
                      integration={int}
                      selected={(form.allowed_integrations || []).includes(int.id)}
                      onClick={() => {
                        const curr = form.allowed_integrations || []
                        set('allowed_integrations',
                          curr.includes(int.id)
                            ? curr.filter(i => i !== int.id)
                            : [...curr, int.id]
                        )
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)',
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              💡 <strong style={{ color: '#38bdf8' }}>{(form.allowed_integrations || []).length}</strong> APIs selecionadas
              — usuários deste plano verão apenas estas opções no Perfil
            </div>
          </div>

          {/* Flags */}
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '8px 16px', borderRadius: 8,
              background: form.is_featured ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)',
              border: `1px solid ${form.is_featured ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
            }}>
              <input
                type="checkbox" checked={form.is_featured || false}
                onChange={e => set('is_featured', e.target.checked)}
              />
              <Crown size={12} color={form.is_featured ? '#f59e0b' : 'var(--text-muted)'} />
              <span style={{ fontSize: 12, fontWeight: 600, color: form.is_featured ? '#f59e0b' : 'var(--text-muted)' }}>
                Plano Destaque
              </span>
            </label>
            <div>
              <label style={s.label}>Ordem</label>
              <input
                type="number" min="0"
                style={{ ...s.input, width: 70, padding: '6px 10px' }}
                value={form.sort_order || 0}
                onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
        }}>
          <button onClick={onClose} style={s.btnOutline}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            ...s.btnPrimary,
            opacity: saving ? 0.6 : 1,
          }}>
            <Save size={13} />
            {saving ? 'Salvando...' : isNew ? 'Criar Plano' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── View Plan Modal ─────────────────────────────────────────── */
function PlanViewModal({ plan, modules, onClose }) {
  if (!plan) return null
  const mods = plan.modules || []
  return (
    <div style={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.modalContent, maxWidth: 560 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 4,
              background: plan.color || '#6366f1',
            }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>
              {plan.display_name}
              {plan.is_featured && <Crown size={14} color="#f59e0b" style={{ marginLeft: 6 }} />}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 10,
              background: plan.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: plan.is_active ? '#10b981' : '#ef4444',
            }}>
              {plan.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
            {plan.description || 'Sem descrição'}
          </p>

          {/* Price & Billing */}
          <div style={{
            display: 'flex', gap: 16, marginBottom: 20, padding: '16px 20px',
            background: 'var(--bg-elevated)', borderRadius: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>VALOR</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: plan.color || '#6366f1' }}>
                R$ {(plan.price || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>CICLO</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                {BILLING_OPTIONS.find(b => b.value === plan.billing_cycle)?.label || plan.billing_cycle}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>DURAÇÃO</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{plan.duration_days} dias</div>
            </div>
          </div>

          {/* Subscribers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ ...s.card, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nexus-blue)' }}>{plan.subscriber_companies || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Empresas</div>
            </div>
            <div style={{ ...s.card, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nexus-cyan)' }}>{plan.subscriber_users || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Usuários</div>
            </div>
          </div>

          {/* Limits */}
          <label style={{ ...s.label, marginBottom: 10 }}>Limites</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <LimitBadge label="Fluxos" value={plan.max_flows} icon={GitBranch} />
            <LimitBadge label="Agentes" value={plan.max_agents} icon={Package} />
            <LimitBadge label="Skills" value={plan.max_skills} icon={Zap} />
            <LimitBadge label="Integrações" value={plan.max_integrations} icon={Plug2} />
            <LimitBadge label="Voz" value={plan.max_voice_profiles} icon={Volume2} />
            <LimitBadge label="Campanhas" value={plan.max_campaigns} icon={Target} />
          </div>

          {/* Modules */}
          <label style={{ ...s.label, marginBottom: 10 }}>Módulos Inclusos</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(modules || []).map(mod => (
              <ModuleChip key={mod.key} mod={mod} selected={mods.includes(mod.key)} small />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Confirm Modal ───────────────────────────────────────────── */
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const handleConfirm = async () => {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false); onClose() }
  }
  return (
    <div style={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.modalContent, maxWidth: 420 }}>
        <div style={{ padding: '24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>{title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px', borderTop: '1px solid var(--border-subtle)',
        }}>
          <button onClick={onClose} style={s.btnOutline}>Cancelar</button>
          <button onClick={handleConfirm} disabled={loading} style={danger ? s.btnDanger : s.btnPrimary}>
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Plan Row ────────────────────────────────────────────────── */
function PlanRow({ plan, modules, onView, onEdit, onToggle, onDelete }) {
  const mods = plan.modules || []
  const limitStr = (v) => v === -1 ? '∞' : v

  return (
    <div style={{
      ...s.card, display: 'flex', alignItems: 'center', gap: 16,
      opacity: plan.is_active ? 1 : 0.55,
      transition: 'opacity 0.2s',
    }}>
      {/* Color bar */}
      <div style={{
        width: 4, height: 60, borderRadius: 4,
        background: plan.color || '#6366f1', flexShrink: 0,
      }} />

      {/* Name + Description */}
      <div style={{ minWidth: 160, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{plan.display_name}</span>
          {plan.is_featured && <Crown size={13} color="#f59e0b" />}
          {!plan.is_active && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
            }}>INATIVO</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plan.description || '—'}
        </div>
      </div>

      {/* Price */}
      <div style={{ minWidth: 100, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: plan.color || '#6366f1' }}>
          {plan.price === 0 ? 'Grátis' : `R$${plan.price}`}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
          /{BILLING_OPTIONS.find(b => b.value === plan.billing_cycle)?.label || plan.billing_cycle}
        </div>
      </div>

      {/* Limits mini */}
      <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { l: 'Fluxos', v: plan.max_flows },
          { l: 'Agentes', v: plan.max_agents },
          { l: 'Skills', v: plan.max_skills },
        ].map(({ l, v }) => (
          <div key={l} style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: v === -1 ? '#10b981' : 'var(--text-primary)' }}>
              {limitStr(v)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Modules count */}
      <div style={{ textAlign: 'center', minWidth: 60, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nexus-cyan)' }}>{mods.length}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Módulos</div>
      </div>

      {/* Subscribers */}
      <div style={{ textAlign: 'center', minWidth: 60, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nexus-blue)' }}>{plan.subscriber_companies || 0}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Empresas</div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={onView} title="Ver detalhes" style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s',
        }}><Eye size={13} /></button>
        <button onClick={onEdit} title="Editar" style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s',
        }}><Edit2 size={13} /></button>
        <button onClick={onToggle} title={plan.is_active ? 'Desativar' : 'Ativar'} style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: plan.is_active ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${plan.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
          cursor: 'pointer', color: plan.is_active ? '#f59e0b' : '#10b981', transition: 'all 0.15s',
        }}>{plan.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}</button>
        <button onClick={onDelete} title="Excluir" style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
          cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s',
        }}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                     */
/* ═══════════════════════════════════════════════════════════════ */
export default function AdminPlansPage() {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal state
  const [viewPlan, setViewPlan] = useState(null)
  const [editPlan, setEditPlan] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.getPlans()
      setPlans(res.plans || [])
      setModules(res.available_modules || [])
    } catch (e) {
      setPlans([])
      setError(e?.message || 'Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalPlans = plans.length
  const activePlans = plans.filter(p => p.is_active).length
  const totalSubscribers = plans.reduce((a, p) => a + (p.subscriber_companies || 0), 0)
  const totalRevenue = plans.reduce((a, p) => a + ((p.price || 0) * (p.subscriber_companies || 0)), 0)

  const handleCreate = async (data) => {
    await adminApi.createPlan(data)
    await load()
  }

  const handleUpdate = async (data) => {
    const id = editPlan?.id
    if (!id) return
    const { name, id: _id, created_at, updated_at, subscriber_companies, subscriber_users, ...rest } = data
    await adminApi.updatePlan(id, rest)
    await load()
  }

  const handleToggle = (plan) => {
    setConfirmAction({
      title: plan.is_active ? '⏸ Desativar Plano' : '▶ Ativar Plano',
      message: plan.is_active
        ? `Desativar "${plan.display_name}"? Novos cadastros não poderão selecionar este plano. Clientes atuais mantêm acesso.`
        : `Ativar "${plan.display_name}"? Este plano ficará disponível para novos cadastros.`,
      confirmLabel: plan.is_active ? 'Desativar' : 'Ativar',
      danger: plan.is_active,
      action: async () => {
        await adminApi.togglePlan(plan.id)
        await load()
        toast.success(`Plano "${plan.display_name}" ${plan.is_active ? 'desativado' : 'ativado'}!`)
      },
    })
  }

  const handleDelete = (plan) => {
    setConfirmAction({
      title: '🗑 Excluir Plano',
      message: `Tem certeza que deseja excluir "${plan.display_name}"? ${
        (plan.subscriber_companies || 0) > 0
          ? `⚠️ ${plan.subscriber_companies} empresa(s) usam este plano. Não será possível excluir.`
          : 'Esta ação é irreversível.'
      }`,
      confirmLabel: 'Excluir Permanentemente',
      danger: true,
      action: async () => {
        await adminApi.deletePlan(plan.id)
        await load()
        toast.success(`Plano "${plan.display_name}" excluído.`)
      },
    })
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Gerenciar Planos</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {totalPlans} planos · {activePlans} ativos · {totalSubscribers} assinantes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCreateOpen(true)} style={s.btnPrimary}>
            <Plus size={13} /> Novo Plano
          </button>
          <button onClick={load} style={s.btnOutline}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16,
        }}>
          <AlertCircle size={14} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{ marginLeft: 'auto', ...s.btnOutline, padding: '4px 12px', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total de Planos', value: loading ? '—' : totalPlans, icon: CreditCard, color: '--nexus-violet' },
          { label: 'Planos Ativos', value: loading ? '—' : activePlans, icon: Check, color: '--nexus-green' },
          { label: 'Empresas Assinantes', value: loading ? '—' : totalSubscribers, icon: Users, color: '--nexus-blue' },
          { label: 'Receita Estimada/Mês', value: loading ? '—' : `R$${totalRevenue.toFixed(0)}`, icon: DollarSign, color: '--nexus-amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Icon size={18} color={`var(${color})`} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Plans List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Carregando planos...</div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, ...s.card }}>
          <CreditCard size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Nenhum plano cadastrado</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Crie seu primeiro plano para começar</div>
          <button onClick={() => setCreateOpen(true)} style={s.btnPrimary}>
            <Plus size={13} /> Criar Primeiro Plano
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map(p => (
            <PlanRow
              key={p.id} plan={p} modules={modules}
              onView={() => setViewPlan(p)}
              onEdit={() => setEditPlan(p)}
              onToggle={() => handleToggle(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {viewPlan && <PlanViewModal plan={viewPlan} modules={modules} onClose={() => setViewPlan(null)} />}
      {editPlan && (
        <PlanFormModal
          plan={editPlan} modules={modules} isNew={false}
          onSave={handleUpdate} onClose={() => setEditPlan(null)}
        />
      )}
      {createOpen && (
        <PlanFormModal
          plan={{ ...EMPTY_PLAN }} modules={modules} isNew
          onSave={handleCreate} onClose={() => setCreateOpen(false)}
        />
      )}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title} message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel} danger={confirmAction.danger}
          onConfirm={confirmAction.action} onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
