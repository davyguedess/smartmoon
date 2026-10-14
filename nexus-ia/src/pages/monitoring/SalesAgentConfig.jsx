import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, User, Package, Users, Shield, HelpCircle, Building2,
  Instagram, Plus, Trash2, RefreshCw, Sparkles, MessageSquare, Send,
  ChevronDown, ChevronRight, Globe, Phone, Mail, AlertTriangle, Check,
  Target, Hash, Calendar, Lightbulb, TrendingUp, Eye, EyeOff
} from 'lucide-react'
import { api } from '../../api'

// ── Shared Components ────────────────────────────────
const SectionCard = ({ title, icon: Icon, iconColor, children, collapsible, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div
        onClick={() => collapsible && setOpen(o => !o)}
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: collapsible ? 'pointer' : 'default',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${iconColor}15`, flexShrink: 0,
        }}>
          <Icon size={16} color={iconColor} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{title}</span>
        {collapsible && (open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />)}
      </div>
      {open && <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>}
    </div>
  )
}

const Field = ({ label, value, onChange, placeholder, textarea, rows, type = 'text', hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</label>
    {textarea ? (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows || 3}
        placeholder={placeholder}
        style={{
          padding: '10px 12px', borderRadius: 9, resize: 'vertical',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          color: 'var(--text-primary)', fontSize: 12, fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
        }} />
    ) : (
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '10px 12px', borderRadius: 9,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          color: 'var(--text-primary)', fontSize: 13,
        }} />
    )}
    {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -2 }}>{hint}</div>}
  </div>
)

const Pill = ({ children, color = '#8B5CF6' }) => (
  <span style={{
    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: `${color}18`, color, border: `1px solid ${color}30`,
  }}>{children}</span>
)

// ── Identity Tab ────────────────────────────────────
function IdentityTab({ config, setConfig }) {
  const id = config.identity || {}
  const set = (k, v) => setConfig(c => ({ ...c, identity: { ...c.identity, [k]: v } }))

  return (
    <SectionCard title="Identidade do Agente" icon={User} iconColor="#8B5CF6">
      <Field label="Nome de Apresentação" value={id.display_name} onChange={v => set('display_name', v)}
        placeholder="Ex: Sofia, Ana, Carlos" hint="Como o agente se apresenta ao cliente" />
      <Field label="Saudação Padrão" value={id.greeting} onChange={v => set('greeting', v)} textarea rows={2}
        placeholder="Olá! Sou a Sofia, consultora virtual da Clínica Duarte. Como posso ajudar?" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Tom de Voz</label>
          <select value={id.tone || 'profissional_amigavel'} onChange={e => set('tone', e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
            <option value="profissional">Profissional</option>
            <option value="amigavel">Amigável</option>
            <option value="profissional_amigavel">Profissional & Amigável</option>
            <option value="formal">Formal</option>
            <option value="descontraido">Descontraído</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Idioma</label>
          <select value={id.language || 'pt-BR'} onChange={e => set('language', e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
            <option value="pt-BR">Português (BR)</option>
            <option value="en-US">English (US)</option>
            <option value="es-ES">Español</option>
          </select>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Products Tab ────────────────────────────────────
function ProductsTab({ config, setConfig }) {
  const products = config.products || []
  const add = () => setConfig(c => ({ ...c, products: [...(c.products || []), { name: '', price: '', description: '', link: '', category: '' }] }))
  const remove = (i) => setConfig(c => ({ ...c, products: c.products.filter((_, idx) => idx !== i) }))
  const update = (i, k, v) => setConfig(c => ({ ...c, products: c.products.map((p, idx) => idx === i ? { ...p, [k]: v } : p) }))

  return (
    <SectionCard title="Produtos & Serviços" icon={Package} iconColor="#10B981">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Cadastre todos os produtos/serviços que o agente pode oferecer. O agente usará essas informações para responder sobre preços, disponibilidade e detalhes.
      </div>
      {products.map((p, i) => (
        <div key={i} style={{
          padding: '14px', borderRadius: 10, background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Produto #{i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nexus-red)', padding: 4 }}>
              <Trash2 size={13} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Nome do produto/serviço"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
            <input value={p.price} onChange={e => update(i, 'price', e.target.value)} placeholder="Preço (R$)"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
          <input value={p.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Descrição breve"
            style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={p.link} onChange={e => update(i, 'link', e.target.value)} placeholder="Link (opcional)"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
            <input value={p.category} onChange={e => update(i, 'category', e.target.value)} placeholder="Categoria"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
        </div>
      ))}
      <button onClick={add} style={{
        padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)', color: '#10B981',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}><Plus size={14} /> Adicionar Produto</button>
    </SectionCard>
  )
}

// ── Team Tab ────────────────────────────────────────
function TeamTab({ config, setConfig }) {
  const team = config.team || []
  const add = () => setConfig(c => ({ ...c, team: [...(c.team || []), { name: '', role: '', phone: '', email: '' }] }))
  const remove = (i) => setConfig(c => ({ ...c, team: c.team.filter((_, idx) => idx !== i) }))
  const update = (i, k, v) => setConfig(c => ({ ...c, team: c.team.map((t, idx) => idx === i ? { ...t, [k]: v } : t) }))

  const ROLES = ['Vendas', 'Suporte', 'Financeiro', 'Técnico', 'Gerente', 'Diretor', 'Responsável Técnico', 'Atendimento', 'Marketing']

  return (
    <SectionCard title="Equipe & Responsáveis" icon={Users} iconColor="#3B82F6">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Defina os responsáveis de cada área. O agente pode direcionar clientes para a pessoa certa quando necessário.
      </div>
      {team.map((t, i) => (
        <div key={i} style={{
          padding: '12px', borderRadius: 10, background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={t.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Nome"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
            <select value={t.role} onChange={e => update(i, 'role', e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
              <option value="">Função...</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={t.phone} onChange={e => update(i, 'phone', e.target.value)} placeholder="Telefone"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
            <input value={t.email} onChange={e => update(i, 'email', e.target.value)} placeholder="Email"
              style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nexus-red)', padding: 4 }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button onClick={add} style={{
        padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.3)', color: '#3B82F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}><Plus size={14} /> Adicionar Membro</button>
    </SectionCard>
  )
}

// ── Behavior Rules Tab ──────────────────────────────
function RulesTab({ config, setConfig }) {
  const rules = config.behavior_rules || { allowed: [], forbidden: [], escalation_triggers: [] }
  const setRules = (k, v) => setConfig(c => ({ ...c, behavior_rules: { ...(c.behavior_rules || {}), [k]: v } }))

  const addItem = (k) => setRules(k, [...(rules[k] || []), ''])
  const removeItem = (k, i) => setRules(k, (rules[k] || []).filter((_, idx) => idx !== i))
  const updateItem = (k, i, v) => setRules(k, (rules[k] || []).map((item, idx) => idx === i ? v : item))

  const RuleList = ({ label, color, icon, items, listKey }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {label}
      </div>
      {(items || []).map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={item} onChange={e => updateItem(listKey, i, e.target.value)}
            placeholder={`${label}...`}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)', border: `1px solid ${color}30`, color: 'var(--text-primary)', fontSize: 12 }} />
          <button onClick={() => removeItem(listKey, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nexus-red)', padding: 4 }}>
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <button onClick={() => addItem(listKey)} style={{
        padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        background: `${color}10`, border: `1px dashed ${color}30`, color,
      }}>+ Adicionar</button>
    </div>
  )

  return (
    <SectionCard title="Regras de Comportamento" icon={Shield} iconColor="#F59E0B">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Defina o que o agente pode e não pode fazer. Regras de escalação determinam quando transferir para um humano.
      </div>
      <RuleList label="Permitido" color="#10B981" icon="✅" items={rules.allowed} listKey="allowed" />
      <RuleList label="Proibido" color="#EF4444" icon="🚫" items={rules.forbidden} listKey="forbidden" />
      <RuleList label="Escalar para Humano" color="#F59E0B" icon="⚠️" items={rules.escalation_triggers} listKey="escalation_triggers" />
    </SectionCard>
  )
}

// ── FAQ Tab ─────────────────────────────────────────
function FAQTab({ config, setConfig }) {
  const faqs = config.faqs || []
  const add = () => setConfig(c => ({ ...c, faqs: [...(c.faqs || []), { question: '', answer: '', category: '' }] }))
  const remove = (i) => setConfig(c => ({ ...c, faqs: c.faqs.filter((_, idx) => idx !== i) }))
  const update = (i, k, v) => setConfig(c => ({ ...c, faqs: c.faqs.map((f, idx) => idx === i ? { ...f, [k]: v } : f) }))

  return (
    <SectionCard title="Perguntas Frequentes (FAQ)" icon={HelpCircle} iconColor="#EC4899">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Adicione as dúvidas mais comuns dos clientes. O agente usará essas respostas para atender rapidamente.
      </div>
      {faqs.map((f, i) => (
        <div key={i} style={{
          padding: '12px', borderRadius: 10, background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#EC4899' }}>FAQ #{i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nexus-red)', padding: 4 }}>
              <Trash2 size={13} />
            </button>
          </div>
          <input value={f.question} onChange={e => update(i, 'question', e.target.value)} placeholder="Pergunta do cliente"
            style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }} />
          <textarea value={f.answer} onChange={e => update(i, 'answer', e.target.value)} rows={2} placeholder="Resposta do agente"
            style={{ padding: '8px 10px', borderRadius: 7, resize: 'vertical', background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5 }} />
          <input value={f.category} onChange={e => update(i, 'category', e.target.value)} placeholder="Categoria (ex: Preço, Horário, Pagamento)"
            style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11 }} />
        </div>
      ))}
      <button onClick={add} style={{
        padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: 'rgba(236,72,153,0.08)', border: '1px dashed rgba(236,72,153,0.3)', color: '#EC4899',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}><Plus size={14} /> Adicionar FAQ</button>
    </SectionCard>
  )
}

// ── Business Tab ────────────────────────────────────
function BusinessTab({ config, setConfig }) {
  const biz = config.business || {}
  const social = biz.social_media || {}
  const set = (k, v) => setConfig(c => ({ ...c, business: { ...(c.business || {}), [k]: v } }))
  const setSocial = (k, v) => setConfig(c => ({
    ...c, business: { ...(c.business || {}), social_media: { ...((c.business || {}).social_media || {}), [k]: v } }
  }))

  return (
    <SectionCard title="Empresa & Nicho" icon={Building2} iconColor="#6366F1">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Nome da Empresa" value={biz.company_name} onChange={v => set('company_name', v)} placeholder="Clínica Duarte Estética" />
        <Field label="Nicho / Segmento" value={biz.niche} onChange={v => set('niche', v)} placeholder="Estética Facial, Fitness, Odontologia..." />
      </div>
      <Field label="Website" value={biz.website} onChange={v => set('website', v)} placeholder="https://www.exemplo.com.br" />

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Globe size={13} /> Redes Sociais
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Instagram size={14} color="#E1306C" />
          <input value={social.instagram || ''} onChange={e => setSocial('instagram', e.target.value)} placeholder="@perfil"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={14} color="#25D366" />
          <input value={social.whatsapp || ''} onChange={e => setSocial('whatsapp', e.target.value)} placeholder="+55 11 99999-0000"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={14} color="#1877F2" />
          <input value={social.facebook || ''} onChange={e => setSocial('facebook', e.target.value)} placeholder="facebook.com/pagina"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={14} color="#000" />
          <input value={social.tiktok || ''} onChange={e => setSocial('tiktok', e.target.value)} placeholder="@tiktok"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
      </div>
    </SectionCard>
  )
}

// ── Niche Intelligence Tab ──────────────────────────
function NicheIntelligenceTab({ agentId, config }) {
  const [insights, setInsights] = useState(config.niche_insights || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.agentNicheIntelligence(agentId)
      if (res.insights) setInsights(res.insights)
      else if (res.insights_raw) setInsights({ raw: res.insights_raw })
      else setError('Nenhum insight gerado')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <SectionCard title="Inteligência de Nicho & Instagram" icon={Instagram} iconColor="#E1306C">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        A IA analisa seu nicho e gera estratégias de conteúdo para Instagram: pilares de conteúdo, hashtags, calendário de posts, sugestões de bio e ganchos de venda. <strong>Salve a configuração primeiro</strong> para que a IA tenha contexto completo.
      </div>

      <button onClick={generate} disabled={loading} style={{
        padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
        background: 'linear-gradient(135deg, #E1306C, #833AB4)', border: 'none', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {loading ? <><RefreshCw size={14} className="spin" /> Analisando nicho com IA...</> : <><Sparkles size={14} /> Gerar Inteligência de Nicho</>}
      </button>

      {error && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}><AlertTriangle size={13} /> {error}</div>}

      {insights && !insights.raw && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Niche Analysis */}
          {insights.niche_analysis && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={13} /> Análise do Nicho</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{insights.niche_analysis}</div>
            </div>
          )}

          {/* Target Audience */}
          {insights.target_audience?.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#EC4899', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> Público-Alvo</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {insights.target_audience.map((p, i) => <Pill key={i} color="#EC4899">{p}</Pill>)}
              </div>
            </div>
          )}

          {/* Content Pillars */}
          {insights.content_pillars?.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb size={13} /> Pilares de Conteúdo</div>
              {insights.content_pillars.map((pillar, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{pillar.pillar}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{pillar.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(pillar.post_ideas || []).map((idea, j) => (
                      <span key={j} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{idea}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hashtag Groups */}
          {insights.hashtag_groups?.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Hash size={13} /> Grupos de Hashtags</div>
              {insights.hashtag_groups.map((g, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{g.group_name}</div>
                  <div style={{ fontSize: 11, color: '#3B82F6', lineHeight: 1.6 }}>{(g.hashtags || []).join(' ')}</div>
                </div>
              ))}
            </div>
          )}

          {/* Content Calendar */}
          {insights.content_calendar?.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Calendário de Conteúdo</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {insights.content_calendar.map((day, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>{day.day}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{day.type}: {day.idea}</div>
                      {day.caption_example && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>"{day.caption_example}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bio Suggestion */}
          {insights.bio_suggestion && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6', marginBottom: 6 }}>📝 Sugestão de Bio</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>"{insights.bio_suggestion}"</div>
            </div>
          )}

          {/* Sales Hooks */}
          {insights.sales_hooks?.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>🎣 Ganchos de Venda</div>
              {insights.sales_hooks.map((h, i) => (
                <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>💡 {h}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {insights?.raw && (
        <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {insights.raw}
        </div>
      )}
    </SectionCard>
  )
}

// ── Training Notes Tab ──────────────────────────────
function TrainingNotesTab({ config, setConfig }) {
  return (
    <SectionCard title="Notas de Treinamento" icon={MessageSquare} iconColor="#06B6D4">
      <Field label="Observações Adicionais" value={config.training_notes} textarea rows={5}
        onChange={v => setConfig(c => ({ ...c, training_notes: v }))}
        placeholder="Qualquer informação adicional que o agente precisa saber. Ex: 'Promoção de natal: 20% off em todos os serviços até 31/12' ou 'Não atendemos aos domingos'" />
    </SectionCard>
  )
}

// ── Prompt Preview ──────────────────────────────────
function PromptPreview({ prompt }) {
  const [visible, setVisible] = useState(false)
  if (!prompt) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div onClick={() => setVisible(v => !v)} style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.12)' }}>
          {visible ? <EyeOff size={16} color="#8B5CF6" /> : <Eye size={16} color="#8B5CF6" />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>System Prompt Gerado</span>
        <Pill color="#8B5CF6">Auto-gerado</Pill>
      </div>
      {visible && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border-subtle)' }}>
          <pre style={{
            fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
            fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', margin: 0,
            padding: '14px', borderRadius: 9, background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)', maxHeight: 400, overflowY: 'auto',
          }}>{prompt}</pre>
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────
const TABS = [
  { id: 'identity', label: 'Identidade', icon: User, color: '#8B5CF6' },
  { id: 'products', label: 'Produtos', icon: Package, color: '#10B981' },
  { id: 'team', label: 'Equipe', icon: Users, color: '#3B82F6' },
  { id: 'rules', label: 'Regras', icon: Shield, color: '#F59E0B' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, color: '#EC4899' },
  { id: 'business', label: 'Negócio', icon: Building2, color: '#6366F1' },
  { id: 'niche', label: 'Nicho & IG', icon: Instagram, color: '#E1306C' },
  { id: 'notes', label: 'Notas', icon: MessageSquare, color: '#06B6D4' },
]

export default function SalesAgentConfig() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agentName, setAgentName] = useState('')
  const [config, setConfig] = useState({})
  const [prompt, setPrompt] = useState('')
  const [tab, setTab] = useState('identity')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.agentGetSalesConfig(id)
        setAgentName(res.agent_name || '')
        setConfig(res.sales_config || {})
        setPrompt(res.system_prompt || '')
      } catch (e) { setError(e.message) }
      setLoading(false)
    }
    load()
  }, [id])

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await api.agentSaveSalesConfig(id, config)
      setPrompt(res.system_prompt || '')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
      Carregando configuração...
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/agents')} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex',
        }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚙️ {agentName}
            <Pill color="#8B5CF6">Agente de Vendas</Pill>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Configure identidade, produtos, equipe, regras e inteligência de nicho</div>
        </div>
        <button onClick={save} disabled={saving} style={{
          padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: saved ? '#10B981' : 'linear-gradient(135deg, #8B5CF6, #6366F1)',
          border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.3s',
        }}>
          {saved ? <><Check size={14} /> Salvo!</> : saving ? <><RefreshCw size={14} /> Salvando...</> : <><Save size={14} /> Salvar & Gerar Prompt</>}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Side Tabs */}
        <div style={{
          width: 170, flexShrink: 0, padding: '12px 8px', overflowY: 'auto',
          borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9,
                background: active ? `${t.color}12` : 'transparent',
                border: active ? `1px solid ${t.color}30` : '1px solid transparent',
                color: active ? t.color : 'var(--text-muted)', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 700 : 500, textAlign: 'left',
                transition: 'all 0.15s',
              }}>
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}

          {/* Completion meter */}
          <div style={{ marginTop: 'auto', padding: '10px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>PREENCHIMENTO</div>
            {(() => {
              const checks = [
                config.identity?.display_name,
                (config.products || []).length > 0,
                (config.team || []).length > 0,
                (config.behavior_rules?.allowed || []).length > 0 || (config.behavior_rules?.forbidden || []).length > 0,
                (config.faqs || []).length > 0,
                config.business?.company_name,
                config.business?.niche,
                config.training_notes,
              ]
              const filled = checks.filter(Boolean).length
              const pct = Math.round((filled / checks.length) * 100)
              return (
                <>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct === 100 ? '#10B981' : 'linear-gradient(90deg, #8B5CF6, #6366F1)', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#10B981' : 'var(--text-muted)', marginTop: 4 }}>{pct}% completo</div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {tab === 'identity' && <IdentityTab config={config} setConfig={setConfig} />}
          {tab === 'products' && <ProductsTab config={config} setConfig={setConfig} />}
          {tab === 'team' && <TeamTab config={config} setConfig={setConfig} />}
          {tab === 'rules' && <RulesTab config={config} setConfig={setConfig} />}
          {tab === 'faq' && <FAQTab config={config} setConfig={setConfig} />}
          {tab === 'business' && <BusinessTab config={config} setConfig={setConfig} />}
          {tab === 'niche' && <NicheIntelligenceTab agentId={id} config={config} />}
          {tab === 'notes' && <TrainingNotesTab config={config} setConfig={setConfig} />}

          {/* Always show prompt preview at bottom */}
          <PromptPreview prompt={prompt} />
        </div>
      </div>
    </div>
  )
}
