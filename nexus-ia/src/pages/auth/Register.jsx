/**
 * Register — Smart Moon Platform
 * 3-step flow: Plan Selection → Personal Data → Security & Terms
 * Desktop: cards side-by-side | Mobile: swipe carousel
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getPublicPlans } from '../../api'

// ── Masks ──────────────────────────────────────────────────
function maskCPF(v) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
}
function maskCNPJ(v) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
function detectDocType(raw) { return raw.replace(/\D/g,'').length <= 11 ? 'cpf' : 'cnpj' }
function maskDocument(v) { return v.replace(/\D/g,'').length <= 11 ? maskCPF(v) : maskCNPJ(v) }

const inputStyle = {
  width:'100%', padding:'12px 14px', borderRadius:10,
  border:'1px solid rgba(139,92,246,0.2)',
  background:'rgba(8,8,18,0.9)', color:'#e2e8f0', fontSize:14,
  outline:'none', transition:'border-color 0.25s', boxSizing:'border-box',
}
const labelStyle = {
  fontSize:10, fontWeight:700, color:'#64748b',
  letterSpacing:1, display:'block', marginBottom:6, textTransform:'uppercase',
}

// ── Plan themes ────────────────────────────────────────────
const THEMES = {
  free:       { color:'#94a3b8', glow:'rgba(148,163,184,0.3)', icon:'🆓', badge:null,        desc:'Comece de graça' },
  starter:    { color:'#38bdf8', glow:'rgba(56,189,248,0.35)', icon:'🚀', badge:null,        desc:'Para quem está começando' },
  pro:        { color:'#a78bfa', glow:'rgba(167,139,250,0.4)', icon:'⚡', badge:'POPULAR',   desc:'Para crescer rápido' },
  business:   { color:'#fbbf24', glow:'rgba(251,191,36,0.35)', icon:'💼', badge:'RECOMENDADO', desc:'Para equipes sérias' },
  enterprise: { color:'#f472b6', glow:'rgba(244,114,182,0.4)', icon:'👑', badge:'PREMIUM',   desc:'Para empresas líderes' },
}

function getTheme(plan) {
  const n = (plan.name || plan.display_name || '').toLowerCase()
  for (const k of Object.keys(THEMES)) if (n.includes(k)) return { key: k, ...THEMES[k] }
  if (plan.price === 0)   return { key:'free', ...THEMES.free }
  if (plan.price < 150)   return { key:'starter', ...THEMES.starter }
  if (plan.price < 350)   return { key:'pro', ...THEMES.pro }
  if (plan.price < 650)   return { key:'business', ...THEMES.business }
  return { key:'enterprise', ...THEMES.enterprise }
}
function formatPrice(plan) {
  if (plan.price === 0) return { main:'Grátis', sub:null }
  const cycle = plan.billing_cycle === 'monthly' ? '/mês' : plan.billing_cycle === 'yearly' ? '/ano' : `/${plan.duration_days}d`
  return { main:`R$${plan.price.toFixed(0)}`, sub: cycle }
}
function getFeatures(plan) {
  const f = []
  if (plan.max_agents != null)       f.push([plan.max_agents === -1 ? '∞' : plan.max_agents, `agente${plan.max_agents !== 1 ? 's' : ''}`])
  if (plan.max_flows != null)        f.push([plan.max_flows === -1 ? '∞' : plan.max_flows, `fluxo${plan.max_flows !== 1 ? 's' : ''}`])
  if (plan.max_skills != null)       f.push([plan.max_skills === -1 ? '∞' : plan.max_skills, `skill${plan.max_skills !== 1 ? 's' : ''}`])
  if (plan.max_integrations != null) f.push([plan.max_integrations === -1 ? '∞' : plan.max_integrations, `integraç${plan.max_integrations !== 1 ? 'ões' : 'ão'}`])
  if (plan.price === 0)  f.push(['✓', 'Sem cartão'])
  if (plan.price >= 200) f.push(['✓', 'Suporte prioritário'])
  if (plan.price >= 500) f.push(['✓', 'Multi-workspace'])
  return f
}

// ── useWindowWidth ─────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Stars generator ────────────────────────────────────────
function useStars(count = 80) {
  return useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.2 + 0.4,
    delay: Math.random() * 6,
    duration: Math.random() * 4 + 3,
    opacity: Math.random() * 0.6 + 0.2,
  })), [count])
}

// ── Background scene ───────────────────────────────────────
function SpaceBackground() {
  const stars = useStars(90)
  return (
    <>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: var(--op,0.3); transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes floatOrb {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity:0.08; }
          33% { transform: translate(-48%,-53%) scale(1.05); opacity:0.13; }
          66% { transform: translate(-52%,-47%) scale(0.97); opacity:0.07; }
        }
        @keyframes auroraShift {
          0%,100% { transform: translate(-50%,-50%) rotate(0deg) scale(1); }
          50% { transform: translate(-50%,-50%) rotate(180deg) scale(1.1); }
        }
        @keyframes moonPulse {
          0%,100% { box-shadow: 0 0 30px rgba(167,139,250,0.4), 0 0 60px rgba(167,139,250,0.15); }
          50%      { box-shadow: 0 0 50px rgba(167,139,250,0.7), 0 0 100px rgba(167,139,250,0.3); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes cardGlow {
          0%,100% { box-shadow: 0 0 20px var(--glow,rgba(167,139,250,0.3)), 0 16px 40px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 40px var(--glow,rgba(167,139,250,0.5)), 0 20px 50px rgba(0,0,0,0.6); }
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes meteor {
          0%   { transform: translate(0,0) rotate(-35deg); opacity:1; }
          100% { transform: translate(300px,200px) rotate(-35deg); opacity:0; }
        }
      `}</style>

      {/* Deep space base */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, overflow:'hidden',
        background:'radial-gradient(ellipse at 20% 30%, #0f0720 0%, #060612 40%, #030208 100%)',
        pointerEvents:'none',
      }}>
        {/* Stars */}
        {stars.map(s => (
          <div key={s.id} style={{
            position:'absolute',
            left:`${s.x}%`, top:`${s.y}%`,
            width:s.size, height:s.size,
            borderRadius:'50%',
            background:'white',
            '--op': s.opacity,
            opacity: s.opacity,
            animation:`twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }} />
        ))}

        {/* Meteors */}
        {[
          { top:'15%', left:'10%', delay:'4s', dur:'6s' },
          { top:'40%', left:'60%', delay:'11s', dur:'7s' },
          { top:'70%', left:'25%', delay:'18s', dur:'5s' },
        ].map((m,i) => (
          <div key={i} style={{
            position:'absolute', top:m.top, left:m.left,
            width:80, height:1,
            background:'linear-gradient(90deg, white, transparent)',
            opacity:0,
            animation:`meteor ${m.dur} ${m.delay} ease-in infinite`,
            borderRadius:1,
          }} />
        ))}

        {/* Aurora blob 1 — purple */}
        <div style={{
          position:'absolute', top:'30%', left:'25%',
          width:700, height:500, borderRadius:'60% 40% 50% 60%',
          background:'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)',
          filter:'blur(60px)',
          animation:`auroraShift 22s ease-in-out infinite`,
          transform:'translate(-50%,-50%)',
        }} />

        {/* Aurora blob 2 — cyan */}
        <div style={{
          position:'absolute', top:'65%', left:'75%',
          width:600, height:400, borderRadius:'40% 60% 30% 70%',
          background:'radial-gradient(ellipse, rgba(6,182,212,0.09) 0%, transparent 70%)',
          filter:'blur(70px)',
          animation:`auroraShift 28s 6s ease-in-out infinite`,
          transform:'translate(-50%,-50%)',
        }} />

        {/* Aurora blob 3 — pink accent */}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          width:900, height:600,
          background:'radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 65%)',
          filter:'blur(80px)',
          animation:`floatOrb 18s ease-in-out infinite`,
          transform:'translate(-50%,-50%)',
        }} />

        {/* Grid overlay */}
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:`
            linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize:'60px 60px',
        }} />
      </div>
    </>
  )
}

// ── Desktop Plan Card ──────────────────────────────────────
function DesktopPlanCard({ plan, active, onSelect }) {
  const theme = getTheme(plan)
  const { main, sub } = formatPrice(plan)
  const features = getFeatures(plan)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => onSelect(plan)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:'1 1 150px', maxWidth:185, minWidth:138,
        padding:'20px 16px 18px',
        borderRadius:18,
        border: active
          ? `1.5px solid ${theme.color}70`
          : hovered
            ? `1px solid ${theme.color}30`
            : '1px solid rgba(255,255,255,0.05)',
        background: active
          ? `linear-gradient(160deg, rgba(${hexRgb(theme.color)},0.14) 0%, rgba(6,4,16,0.96) 100%)`
          : `rgba(8,6,20,0.7)`,
        cursor:'pointer',
        position:'relative', overflow:'hidden',
        transition:'all 0.3s ease',
        transform: active ? 'translateY(-4px)' : hovered ? 'translateY(-2px)' : 'none',
        boxShadow: active
          ? `0 0 32px ${theme.glow}, 0 12px 40px rgba(0,0,0,0.6)`
          : hovered
            ? `0 8px 24px rgba(0,0,0,0.4)`
            : '0 2px 12px rgba(0,0,0,0.3)',
        animation: active ? 'none' : 'none',
        '--glow': theme.glow,
      }}
    >
      {/* Shimmer on active */}
      {active && (
        <div style={{
          position:'absolute', inset:0, borderRadius:18,
          background:`linear-gradient(105deg, transparent 40%, ${theme.color}18 50%, transparent 60%)`,
          backgroundSize:'200% 100%',
          animation:'shimmer 3s ease infinite',
          pointerEvents:'none',
        }} />
      )}

      {/* Badge */}
      {theme.badge && (
        <div style={{
          position:'absolute', top:0, right:14,
          fontSize:8, fontWeight:900, letterSpacing:1, color:'white',
          padding:'3px 8px', borderRadius:'0 0 8px 8px',
          background:`linear-gradient(135deg, ${theme.color}, ${theme.color}99)`,
          boxShadow:`0 2px 10px ${theme.glow}`,
        }}>{theme.badge}</div>
      )}

      {/* Icon */}
      <div style={{ fontSize:24, marginBottom:10 }}>{theme.icon}</div>

      {/* Name */}
      <div style={{
        fontSize:14, fontWeight:800, color: active ? '#f1f5f9' : '#64748b',
        marginBottom:4, transition:'color 0.2s',
      }}>{plan.display_name}</div>

      {/* Desc */}
      <div style={{
        fontSize:10, color: active ? theme.color + 'cc' : '#334155',
        marginBottom:12, fontWeight:500, transition:'color 0.2s',
      }}>{theme.desc}</div>

      {/* Price */}
      <div style={{ marginBottom:14 }}>
        <span style={{
          fontSize: plan.price === 0 ? 18 : 24, fontWeight:900,
          color: active ? theme.color : '#475569',
          transition:'color 0.2s',
        }}>{main}</span>
        {sub && <span style={{ fontSize:10, color:'#334155', fontWeight:600 }}>{sub}</span>}
      </div>

      {/* Divider */}
      <div style={{
        height:1, marginBottom:12,
        background: active
          ? `linear-gradient(90deg, transparent, ${theme.color}60, transparent)`
          : 'rgba(255,255,255,0.04)',
        transition:'background 0.3s',
      }} />

      {/* Features */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {features.slice(0,4).map(([val,label], i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:7,
            fontSize:10, color: active ? '#94a3b8' : '#334155',
            transition:'color 0.2s',
          }}>
            <span style={{
              fontWeight:800, fontSize:11,
              color: active ? theme.color : '#1e293b',
              minWidth:16, textAlign:'center',
              transition:'color 0.2s',
            }}>{val}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mobile Carousel Card ────────────────────────────────────
function MobileCarousel({ plans, selected, onSelect }) {
  const [idx, setIdx] = useState(() => {
    const i = plans.findIndex(p => p.id === selected?.id)
    return i >= 0 ? i : 0
  })
  const touchX = useRef(null)

  useEffect(() => {
    const i = plans.findIndex(p => p.id === selected?.id)
    if (i >= 0) setIdx(i)
  }, [selected, plans])

  const goTo = useCallback((i) => {
    const c = Math.max(0, Math.min(plans.length-1, i))
    setIdx(c)
    onSelect(plans[c])
  }, [plans, onSelect])

  const plan = plans[idx]
  if (!plan) return null
  const theme = getTheme(plan)
  const { main, sub } = formatPrice(plan)
  const features = getFeatures(plan)

  return (
    <div
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const diff = touchX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 40) diff > 0 ? goTo(idx+1) : goTo(idx-1)
        touchX.current = null
      }}
    >
      <div style={{
        borderRadius:20, padding:'24px 22px',
        border:`1.5px solid ${theme.color}50`,
        background:`linear-gradient(160deg, rgba(${hexRgb(theme.color)},0.12) 0%, rgba(6,4,16,0.97) 100%)`,
        boxShadow:`0 0 50px ${theme.glow}, 0 20px 60px rgba(0,0,0,0.6)`,
        position:'relative', overflow:'hidden',
        animation:'cardGlow 3s ease-in-out infinite',
        '--glow': theme.glow,
        marginBottom:14,
        transition:'all 0.35s ease',
      }}>
        <div style={{
          position:'absolute', inset:0, borderRadius:20,
          background:`linear-gradient(105deg, transparent 40%, ${theme.color}15 50%, transparent 60%)`,
          backgroundSize:'200% 100%',
          animation:'shimmer 2.5s ease infinite',
          pointerEvents:'none',
        }} />

        {theme.badge && (
          <div style={{
            position:'absolute', top:14, right:14,
            fontSize:9, fontWeight:900, letterSpacing:1,
            color:'white', padding:'4px 12px', borderRadius:20,
            background:`linear-gradient(135deg, ${theme.color}, ${theme.color}aa)`,
            boxShadow:`0 4px 16px ${theme.glow}`,
          }}>{theme.badge}</div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
          <div style={{
            width:48, height:48, borderRadius:14, fontSize:22,
            background:`linear-gradient(135deg, ${theme.color}25, ${theme.color}10)`,
            border:`1px solid ${theme.color}30`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 4px 16px ${theme.glow}`,
          }}>{theme.icon}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#f1f5f9' }}>{plan.display_name}</div>
            <div style={{ fontSize:11, color:theme.color + 'cc', marginTop:2 }}>{theme.desc}</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'baseline', gap:3, marginBottom:18 }}>
          <span style={{ fontSize: plan.price === 0 ? 28 : 36, fontWeight:900, color:theme.color }}>{main}</span>
          {sub && <span style={{ fontSize:13, color:'#475569', fontWeight:600 }}>{sub}</span>}
        </div>

        <div style={{
          height:1, marginBottom:16,
          background:`linear-gradient(90deg, transparent, ${theme.color}60, transparent)`,
        }} />

        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {features.slice(0,5).map(([val,label], i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#94a3b8' }}>
              <span style={{
                fontWeight:900, fontSize:13, color:theme.color, minWidth:20, textAlign:'center',
              }}>{val}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Dots nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginBottom:14 }}>
        <button onClick={() => goTo(idx-1)} disabled={idx===0}
          style={{
            background:'none', border:'none',
            fontSize:24, color: idx===0 ? '#1e293b' : '#475569',
            cursor: idx===0 ? 'default' : 'pointer', lineHeight:1, padding:'0 4px',
            transition:'color 0.2s',
          }}>‹</button>
        <div style={{ display:'flex', gap:6 }}>
          {plans.map((p,i) => {
            const t = getTheme(p)
            return (
              <div key={i} onClick={() => goTo(i)} style={{
                width: i===idx ? 20 : 5, height:5, borderRadius:3,
                background: i===idx ? t.color : 'rgba(255,255,255,0.1)',
                transition:'all 0.3s ease', cursor:'pointer',
              }} />
            )
          })}
        </div>
        <button onClick={() => goTo(idx+1)} disabled={idx===plans.length-1}
          style={{
            background:'none', border:'none',
            fontSize:24, color: idx===plans.length-1 ? '#1e293b' : '#475569',
            cursor: idx===plans.length-1 ? 'default' : 'pointer', lineHeight:1, padding:'0 4px',
            transition:'color 0.2s',
          }}>›</button>
      </div>
    </div>
  )
}

// helper
function hexRgb(hex) {
  const h = hex.replace('#','')
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}

// ── Social proof bar ───────────────────────────────────────
function SocialProof({ compact = false }) {
  const stats = [
    { n:'2.400+', label:'agentes ativos' },
    { n:'98%',   label:'de satisfação' },
    { n:'14x',   label:'mais produtivo' },
  ]
  return (
    <div style={{
      display:'flex', gap:0, justifyContent:'center',
      marginBottom: compact ? 10 : 20,
    }}>
      {stats.map((s,i) => (
        <div key={i} style={{
          textAlign:'center', padding: compact ? '0 12px' : '0 20px',
          borderRight: i < stats.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{
            fontSize: compact ? 14 : 18, fontWeight:900,
            background:'linear-gradient(135deg, #a78bfa, #38bdf8)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>{s.n}</div>
          <div style={{ fontSize: compact ? 9 : 10, color:'#475569', fontWeight:600 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const width = useWindowWidth()
  const isDesktop = width >= 720

  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [plansLoading, setPlansLoading] = useState(true)
  const [form, setForm] = useState({
    full_name:'', document:'', birth_date:'',
    email:'', company_name:'', password:'', confirm_password:'',
    accepted_terms:false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [termsText, setTermsText] = useState('')
  const [privacyText, setPrivacyText] = useState('')
  const [step, setStep] = useState(0)

  const docType = detectDocType(form.document)
  const isCNPJ = docType === 'cnpj'

  useEffect(() => {
    getPublicPlans()
      .then(d => {
        const p = d.plans || []
        setPlans(p)
        const free = p.find(x => x.price === 0)
        if (free) setSelectedPlan(free)
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false))
  }, [])

  useEffect(() => {
    fetch('/auth/terms', { headers:{ Accept:'application/json' } })
      .then(r => r.json())
      .then(d => { setTermsText(d.terms_of_service||''); setPrivacyText(d.privacy_policy||'') })
      .catch(() => {})
  }, [])

  const updateField = (f, v) => {
    if (f === 'document') v = maskDocument(v)
    setForm(p => ({ ...p, [f]:v }))
  }
  const validateStep1 = () => {
    if (!form.full_name.trim() || form.full_name.trim().length < 3) return 'Nome completo deve ter no mínimo 3 caracteres'
    if (form.document.replace(/\D/g,'').length < 11) return 'CPF/CNPJ inválido'
    if (!form.birth_date) return 'Data de nascimento é obrigatória'
    if (!form.email.includes('@')) return 'E-mail inválido'
    if (isCNPJ && !form.company_name.trim()) return 'Nome da empresa é obrigatório para CNPJ'
    const age = (new Date() - new Date(form.birth_date)) / (365.25*24*60*60*1000)
    if (age < 18) return 'Você deve ter no mínimo 18 anos'
    return null
  }
  const validateStep2 = () => {
    if (form.password.length < 8) return 'Senha deve ter no mínimo 8 caracteres'
    if (form.password !== form.confirm_password) return 'As senhas não coincidem'
    if (!form.accepted_terms) return 'Você deve aceitar os termos de uso'
    return null
  }
  const handlePlanNext = () => {
    if (!selectedPlan) { setError('Selecione um plano para continuar'); return }
    setError(''); setStep(1)
  }
  const handleNext = () => {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError(''); setStep(2)
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validateStep2()
    if (err) { setError(err); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/auth/register', {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json', Accept:'application/json' },
        body: JSON.stringify({
          full_name:form.full_name, email:form.email, password:form.password,
          document:form.document, document_type:docType, birth_date:form.birth_date,
          company_name:form.company_name, accepted_terms:form.accepted_terms,
          plan_id: selectedPlan?.id || 0,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Erro ao criar conta')
      }
      const data = await res.json()
      await api.login(form.email, form.password)

      // Paid plan with PIX checkout → redirect to checkout page
      if (data.payment_required && data.checkout) {
        sessionStorage.setItem('checkout_data', JSON.stringify(data.checkout))
        navigate('/checkout')
      } else {
        navigate('/')
      }
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const focusStyle = e => e.target.style.borderColor = '#a78bfa'
  const blurStyle  = e => e.target.style.borderColor = 'rgba(139,92,246,0.2)'

  const activeTheme = selectedPlan ? getTheme(selectedPlan) : THEMES.pro
  const containerMaxW = step === 0
    ? (isDesktop ? Math.min(width - 80, 1000) : 420)
    : 460

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Inter", "SF Pro Display", system-ui, sans-serif',
      padding:'24px 16px', position:'relative',
    }}>
      <SpaceBackground />

      {/* Terms modal */}
      {showTerms && (
        <div onClick={() => setShowTerms(false)} style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:560, maxHeight:'80vh', overflowY:'auto',
            background:'rgba(10,8,24,0.98)', border:'1px solid rgba(167,139,250,0.2)',
            borderRadius:18, padding:30,
          }}>
            <h2 style={{ color:'#e2e8f0', fontSize:17, fontWeight:800, marginBottom:16 }}>📜 Termos & Privacidade</h2>
            <h3 style={{ color:'#a78bfa', fontSize:13, fontWeight:700, marginBottom:8 }}>Termos de Uso</h3>
            <p style={{ color:'#64748b', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:20 }}>
              {termsText || 'Termos de uso não configurados.'}
            </p>
            <h3 style={{ color:'#38bdf8', fontSize:13, fontWeight:700, marginBottom:8 }}>Política de Privacidade</h3>
            <p style={{ color:'#64748b', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:20 }}>
              {privacyText || 'Política de privacidade não configurada.'}
            </p>
            <button onClick={() => setShowTerms(false)} style={{
              width:'100%', padding:12, borderRadius:10, border:'none',
              background:'linear-gradient(135deg, #a78bfa, #38bdf8)',
              color:'white', fontSize:14, fontWeight:700, cursor:'pointer',
            }}>Fechar</button>
          </div>
        </div>
      )}

      {/* Main panel */}
      <div style={{
        width: containerMaxW, maxWidth:'100%', position:'relative', zIndex:10,
        padding: step === 0 ? (isDesktop ? '36px 40px' : '28px 20px') : '36px 34px',
        borderRadius:24,
        background:'rgba(8,6,20,0.88)',
        border:'1px solid rgba(255,255,255,0.06)',
        backdropFilter:'blur(28px)',
        boxShadow:'0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.05)',
        transition:'all 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        animation:'fadeInUp 0.6s ease both',
      }}>

        {/* ── Logo ── */}
        <div style={{ textAlign:'center', marginBottom: step === 0 ? (isDesktop ? 12 : 6) : (isDesktop ? 20 : 10) }}>
          {/* Moon logo */}
          <div style={{
            width: isDesktop ? 54 : 42, height: isDesktop ? 54 : 42, borderRadius:'50%', margin:`0 auto ${isDesktop ? 12 : 6}px`,
            background:'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #38bdf8 100%)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: isDesktop ? 26 : 20,
            animation:'moonPulse 4s ease-in-out infinite',
            position:'relative',
          }}>
            🌙
            {/* Orbit ring */}
            <div style={{
              position:'absolute', inset:-8,
              border:'1px solid rgba(167,139,250,0.2)',
              borderRadius:'50%',
              animation:'spinSlow 12s linear infinite',
            }}>
              <div style={{
                position:'absolute', top:-3, left:'50%', transform:'translateX(-50%)',
                width:6, height:6, borderRadius:'50%',
                background:'#38bdf8', boxShadow:'0 0 8px #38bdf8',
              }} />
            </div>
          </div>

          <h1 style={{
            fontSize: isDesktop ? 22 : 18, fontWeight:900, margin:0,
            background:'linear-gradient(135deg, #f1f5f9 30%, #a78bfa 70%, #38bdf8 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            letterSpacing:-0.5,
          }}>
            Smart Moon
          </h1>

          {step === 0 ? (
            <>
              <p style={{
                fontSize: isDesktop ? 15 : 13, fontWeight:700, marginTop: isDesktop ? 8 : 4, marginBottom:2,
                background:'linear-gradient(135deg, #e2e8f0, #94a3b8)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              }}>
                Automatize. Escale. Domine.
              </p>
              {isDesktop && (
                <p style={{ fontSize:12, color:'#334155', marginTop:4 }}>
                  O sistema de agentes IA mais completo do Brasil
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize:12, color:'#475569', marginTop:6 }}>
              Complete seu cadastro para começar
            </p>
          )}
        </div>

        {/* ── Social proof (only step 0) ── */}
        {step === 0 && <SocialProof compact={!isDesktop} />}

        {/* ── Step indicator ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          gap:0, marginBottom: isDesktop ? 22 : 12, width:'100%', padding:'0 4px',
        }}>
          {['Escolha o Plano','Dados Pessoais','Segurança'].map((label, s) => (
            <div key={s} style={{ display:'flex', alignItems:'center', flex: s < 2 ? '1' : 'none' }}>
              {/* Circle + label */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', flexShrink:0,
                  background: step >= s
                    ? 'linear-gradient(135deg, #a78bfa, #38bdf8)'
                    : 'rgba(20,16,40,0.9)',
                  border: step >= s ? 'none' : '1px solid rgba(167,139,250,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:800, color: step >= s ? 'white' : '#334155',
                  transition:'all 0.35s',
                  boxShadow: step >= s ? '0 0 14px rgba(167,139,250,0.45)' : 'none',
                }}>{s+1}</div>
                {/* Label only on desktop (hidden on narrow screens via width check) */}
                {isDesktop && (
                  <span style={{
                    fontSize:9, fontWeight:700, letterSpacing:0.3,
                    color: step >= s ? '#94a3b8' : '#334155',
                    whiteSpace:'nowrap', transition:'color 0.3s',
                  }}>{label}</span>
                )}
              </div>
              {/* Connector line (between steps) */}
              {s < 2 && (
                <div style={{
                  flex:1, height:1.5, margin:'0 6px',
                  marginBottom: isDesktop ? 14 : 0,
                  background: step > s
                    ? 'linear-gradient(90deg, #a78bfa, #38bdf8)'
                    : 'rgba(167,139,250,0.1)',
                  borderRadius:1, transition:'background 0.4s',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding:'10px 14px', borderRadius:10, marginBottom:16,
            background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.18)',
            color:'#f87171', fontSize:12, fontWeight:600,
          }}>⚠️ {error}</div>
        )}

        {/* ── Step 0: Plans ── */}
        {step === 0 && (
          <div>
            {plansLoading ? (
              <div style={{ textAlign:'center', padding:50, color:'#334155' }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%', margin:'0 auto 14px',
                  border:'2px solid rgba(167,139,250,0.2)',
                  borderTop:'2px solid #a78bfa',
                  animation:'spinSlow 0.9s linear infinite',
                }} />
                Carregando planos...
              </div>
            ) : plans.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#334155' }}>
                Nenhum plano disponível. Entre em contato com o suporte.
              </div>
            ) : isDesktop ? (
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
                {plans.map(plan => (
                  <DesktopPlanCard
                    key={plan.id}
                    plan={plan}
                    active={selectedPlan?.id === plan.id}
                    onSelect={setSelectedPlan}
                  />
                ))}
              </div>
            ) : (
              <MobileCarousel plans={plans} selected={selectedPlan} onSelect={setSelectedPlan} />
            )}

            {/* Selected plan bar */}
            {selectedPlan && (() => {
              const t = getTheme(selectedPlan)
              return (
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'12px 16px', borderRadius:12, marginTop:16, marginBottom:12,
                  background:`rgba(${hexRgb(t.color)},0.07)`,
                  border:`1px solid rgba(${hexRgb(t.color)},0.15)`,
                  transition:'all 0.4s ease',
                }}>
                  <div>
                    <div style={{ fontSize:9, color:'#334155', fontWeight:700, letterSpacing:1, marginBottom:3 }}>
                      PLANO SELECIONADO
                    </div>
                    <div style={{ fontSize:15, fontWeight:800, color:'#f1f5f9' }}>
                      {selectedPlan.display_name}
                    </div>
                  </div>
                  <div style={{ fontSize:20, fontWeight:900, color:t.color }}>
                    {selectedPlan.price === 0 ? 'Grátis' : `R$${selectedPlan.price.toFixed(0)}/mês`}
                  </div>
                </div>
              )
            })()}

            <button
              onClick={handlePlanNext}
              disabled={!selectedPlan}
              style={{
                width:'100%', padding:'14px', borderRadius:12, border:'none',
                background: selectedPlan
                  ? `linear-gradient(135deg, ${getTheme(selectedPlan).color}, ${getTheme(selectedPlan).color}bb)`
                  : 'rgba(20,16,40,0.8)',
                color: selectedPlan ? 'white' : '#1e293b',
                fontSize:15, fontWeight:700,
                cursor: selectedPlan ? 'pointer' : 'not-allowed',
                boxShadow: selectedPlan ? `0 8px 30px ${getTheme(selectedPlan).glow}` : 'none',
                transition:'all 0.35s ease',
                letterSpacing:0.2,
              }}
            >
              {selectedPlan ? `Começar com ${selectedPlan.display_name} →` : 'Selecione um plano'}
            </button>

            {/* Trust signals */}
            <div style={{
              display:'flex', justifyContent:'center', alignItems:'center', gap:16,
              marginTop:14,
            }}>
              {['🔒 Seguro', '⚡ Rápido', '🛡️ Sem compromisso'].map((t,i) => (
                <span key={i} style={{ fontSize:10, color:'#1e293b', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Personal Data ── */}
        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext() } : handleSubmit}>
          {step === 1 && (
            <>
              {selectedPlan && (
                <div style={{
                  padding:'8px 12px', borderRadius:8, marginBottom:16,
                  background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.08)',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <span style={{ fontSize:11, color:'#475569' }}>
                    🌙 Plano: <strong style={{ color:'#a78bfa' }}>{selectedPlan.display_name}</strong>
                  </span>
                  <button type="button" onClick={() => { setStep(0); setError('') }}
                    style={{ background:'none', border:'none', color:'#38bdf8', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Alterar
                  </button>
                </div>
              )}
              {[
                { field:'full_name', label:'NOME COMPLETO', placeholder:'Seu nome completo', type:'text' },
                { field:'birth_date', label:'DATA DE NASCIMENTO', placeholder:'', type:'date' },
                { field:'email', label:'E-MAIL', placeholder:'seu@email.com', type:'email' },
              ].map(({ field, label, placeholder, type }) => (
                <div key={field} style={{ marginBottom:14 }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type} value={form[field]}
                    onChange={e => updateField(field, e.target.value)}
                    placeholder={placeholder} required
                    style={{ ...inputStyle, colorScheme: type === 'date' ? 'dark' : undefined }}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>
              ))}
              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>
                  CPF OU CNPJ
                  {form.document && (
                    <span style={{
                      marginLeft:8, padding:'2px 8px', borderRadius:6,
                      background: isCNPJ ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)',
                      color: isCNPJ ? '#38bdf8' : '#a78bfa', fontSize:9, fontWeight:800,
                    }}>{isCNPJ ? 'CNPJ' : 'CPF'}</span>
                  )}
                </label>
                <input value={form.document} onChange={e => updateField('document',e.target.value)}
                  placeholder="000.000.000-00" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              {isCNPJ && (
                <div style={{ marginBottom:14 }}>
                  <label style={labelStyle}>
                    NOME DA EMPRESA
                    <span style={{ color:'#38bdf8', marginLeft:4, fontSize:8 }}>OBRIGATÓRIO PARA CNPJ</span>
                  </label>
                  <input value={form.company_name} onChange={e => updateField('company_name',e.target.value)}
                    placeholder="Nome da sua empresa" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
              )}
              <button type="submit" style={{
                width:'100%', padding:'13px', borderRadius:11, border:'none', marginTop:6,
                background:'linear-gradient(135deg, #a78bfa, #38bdf8)',
                color:'white', fontSize:14, fontWeight:700, cursor:'pointer',
                boxShadow:'0 6px 24px rgba(167,139,250,0.3)',
              }}>Próximo →</button>
            </>
          )}

          {/* ── Step 2: Security ── */}
          {step === 2 && (
            <>
              <div style={{
                padding:'12px 14px', borderRadius:10, marginBottom:16,
                background:'rgba(167,139,250,0.05)', border:'1px solid rgba(167,139,250,0.08)',
              }}>
                <div style={{ fontSize:9, color:'#a78bfa', fontWeight:700, marginBottom:6, letterSpacing:1 }}>RESUMO</div>
                <div style={{ fontSize:12, color:'#64748b', lineHeight:1.7 }}>
                  <strong style={{ color:'#e2e8f0' }}>{form.full_name}</strong> · {form.email}<br />
                  {form.document} · {isCNPJ && form.company_name ? form.company_name : 'Pessoa Física'}<br />
                  <span style={{ color:'#a78bfa', fontWeight:700 }}>
                    🌙 {selectedPlan?.display_name || 'Free'}
                    {selectedPlan?.price > 0 && ` — R$${selectedPlan.price.toFixed(2)}/mês`}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>SENHA</label>
                <input type="password" value={form.password} onChange={e => updateField('password',e.target.value)}
                  placeholder="Mínimo 8 caracteres" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
                {form.password && (
                  <div style={{
                    marginTop:6, height:2.5, borderRadius:2, transition:'all 0.3s',
                    background: form.password.length >= 12 ? '#4ade80' : form.password.length >= 8 ? '#fbbf24' : '#f87171',
                    width:`${Math.min(100,(form.password.length/12)*100)}%`,
                  }} />
                )}
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>CONFIRMAR SENHA</label>
                <input type="password" value={form.confirm_password} onChange={e => updateField('confirm_password',e.target.value)}
                  placeholder="Repita sua senha" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
                {form.confirm_password && form.password !== form.confirm_password && (
                  <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>❌ Senhas não coincidem</div>
                )}
                {form.confirm_password && form.password === form.confirm_password && (
                  <div style={{ fontSize:11, color:'#4ade80', marginTop:4 }}>✅ Senhas coincidem</div>
                )}
              </div>

              <div style={{
                display:'flex', alignItems:'flex-start', gap:10, marginBottom:20,
                padding:'12px 14px', borderRadius:10,
                background:'rgba(6,4,16,0.7)', border:'1px solid rgba(255,255,255,0.04)',
              }}>
                <input type="checkbox" checked={form.accepted_terms} onChange={e => updateField('accepted_terms',e.target.checked)}
                  style={{ marginTop:2, accentColor:'#a78bfa', width:15, height:15, cursor:'pointer' }} />
                <label style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>
                  Li e aceito os{' '}
                  <button type="button" onClick={() => setShowTerms(true)}
                    style={{ background:'none', border:'none', color:'#a78bfa', fontWeight:700, cursor:'pointer', fontSize:12, textDecoration:'underline', padding:0 }}>
                    Termos de Uso
                  </button>{' '}e a{' '}
                  <button type="button" onClick={() => setShowTerms(true)}
                    style={{ background:'none', border:'none', color:'#38bdf8', fontWeight:700, cursor:'pointer', fontSize:12, textDecoration:'underline', padding:0 }}>
                    Política de Privacidade
                  </button>
                  {' '}da plataforma Smart Moon
                </label>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={() => { setStep(1); setError('') }} style={{
                  flex:1, padding:'13px', borderRadius:11,
                  border:'1px solid rgba(167,139,250,0.12)', background:'transparent',
                  color:'#475569', fontSize:14, fontWeight:600, cursor:'pointer',
                }}>← Voltar</button>
                <button type="submit" disabled={loading} style={{
                  flex:2, padding:'13px', borderRadius:11, border:'none',
                  background: loading ? 'rgba(20,16,40,0.8)' : 'linear-gradient(135deg, #a78bfa, #38bdf8)',
                  color: loading ? '#334155' : 'white',
                  fontSize:14, fontWeight:700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 24px rgba(167,139,250,0.35)',
                }}>
                  {loading ? '⏳ Criando conta...' : '🚀 Entrar na Smart Moon'}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Login link */}
        <div style={{ textAlign:'center', marginTop:18 }}>
          <Link to="/login" style={{ color:'#38bdf8', fontSize:12, fontWeight:600, textDecoration:'none' }}>
            ← Já tenho conta
          </Link>
        </div>
        <div style={{ textAlign:'center', marginTop:12, fontSize:9, color:'#1e293b', letterSpacing:1 }}>
          SMART MOON · BETA v1.0
        </div>
      </div>
    </div>
  )
}
