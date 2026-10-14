import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import {
  Activity, Zap, GitBranch, CheckCircle, XCircle, Clock,
  RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight, CreditCard,
  QrCode, Send, X, Copy, Check, TrendingUp,
  ChevronRight, Eye, EyeOff, Bot, Link2, Sparkles,
  ShoppingCart, BarChart2,
} from 'lucide-react'

const BuyCreditsModal = lazy(() => import('../../components/credits/BuyCreditsModal'))

/* ─────────────────────────────────────────────────────────────
   GLOBAL STYLES  (injected once)
───────────────────────────────────────────────────────────── */
const STYLE_ID = 'nexus-dash-v3'
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
    @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
    @keyframes pulse2   { 0%,100%{opacity:1} 50%{opacity:0.45} }
    @keyframes spin     { to{transform:rotate(360deg)} }
    @keyframes glow     { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,.25)} 50%{box-shadow:0 0 40px rgba(99,102,241,.55)} }
    @keyframes countup  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes barIn    { from{transform:scaleX(0)} to{transform:scaleX(1)} }
    @keyframes slideRight { from{transform:translateX(-10px);opacity:0} to{transform:none;opacity:1} }

    .ndash-hero-btn {
      flex:1; padding:12px 0; border-radius:14px; border:none;
      font-weight:800; font-size:13px; cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:7px;
      transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
    }
    .ndash-hero-btn:hover { transform:translateY(-2px); filter:brightness(1.12); }
    .ndash-hero-btn:active { transform:scale(0.97); }

    .ndash-action-pill {
      display:flex; flex-direction:column; align-items:center; gap:7px;
      flex:1; padding:14px 8px; border-radius:18px; border:none;
      cursor:pointer; transition:transform 0.15s, box-shadow 0.15s;
    }
    .ndash-action-pill:hover { transform:translateY(-3px); }
    .ndash-action-pill:active { transform:scale(0.96); }

    .ndash-metric-tile {
      background:var(--bg-card);
      border:1px solid var(--border-subtle);
      border-radius:18px; padding:16px;
      position:relative; overflow:hidden;
      transition:transform 0.2s, box-shadow 0.2s, border-color 0.2s;
      cursor:default;
    }
    .ndash-metric-tile:hover {
      transform:translateY(-3px);
      box-shadow:0 12px 36px rgba(0,0,0,.25);
    }

    .ndash-list-row {
      display:flex; align-items:center; gap:12px;
      padding:11px 16px;
      border-bottom:1px solid var(--border-subtle);
      transition:background 0.15s;
      animation:slideRight 0.3s ease both;
    }
    .ndash-list-row:last-child { border-bottom:none; }
    .ndash-list-row:hover { background:rgba(255,255,255,0.03); }

    .ndash-section-card {
      background:var(--bg-card);
      border:1px solid var(--border-subtle);
      border-radius:20px; overflow:hidden;
      animation:fadeUp 0.45s ease both;
    }

    .ndash-section-hdr {
      padding:14px 18px;
      border-bottom:1px solid var(--border-subtle);
      display:flex; align-items:center; justify-content:space-between;
    }

    .ndash-skel {
      background: linear-gradient(90deg,var(--border-subtle) 25%,rgba(255,255,255,0.06) 50%,var(--border-subtle) 75%);
      background-size:200% 100%;
      animation:shimmer 1.6s infinite;
      border-radius:8px;
    }

    .ndash-badge {
      font-size:9px; font-weight:800; padding:2px 8px; border-radius:20px;
      text-transform:uppercase; letter-spacing:.6px;
    }

    .ndash-chart-bar {
      background:var(--bar-color,#6366f1);
      border-radius:4px 4px 0 0;
      transform-origin:bottom;
      animation:barIn 0.6s ease both;
      transition:opacity 0.2s;
    }
    .ndash-chart-bar:hover { opacity:0.75; }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtK = v => { if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(1)}k`; return String(v ?? 0) }
const fmtTime = d => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

const STATUS_COLOR = {
  success:'#10b981', failed:'#ef4444', running:'#3b82f6',
  queued:'#f59e0b', waiting:'#f59e0b', canceled:'#6b7280',
  paid:'#10b981', pending:'#f59e0b', sent:'#3b82f6',
  waiting_payment:'#8b5cf6', expired:'#6b7280', cancelled:'#6b7280', draft:'#6b7280',
}
const STATUS_LABEL = {
  success:'Sucesso', failed:'Falhou', running:'Rodando',
  queued:'Na fila', waiting:'Aguard.', canceled:'Cancelado',
  paid:'Pago', pending:'Pendente', sent:'Enviado',
  waiting_payment:'Aguard. Pag.', expired:'Expirado', cancelled:'Cancelado', draft:'Rascunho',
}

/* ─────────────────────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────────────────────── */
function Sk({ w = '100%', h = 18 }) {
  return <div className="ndash-skel" style={{ width: w, height: h }} />
}

/* ─────────────────────────────────────────────────────────────
   BAR CHART (últimos 30 dias de receita)
───────────────────────────────────────────────────────────── */
function RevenueBarChart({ data = [], loading }) {
  const [tooltip, setTooltip] = useState(null)
  const max = Math.max(...(data.map(d => d.revenue || 0)), 1)
  // mostrar apenas os últimos 14 pontos em mobile
  const visible = data.slice(-14)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, padding: '0 2px' }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="ndash-skel" style={{ flex: 1, height: `${20 + Math.random() * 50}%`, borderRadius: '4px 4px 0 0' }} />
      ))}
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, padding: '0 2px' }}>
        {visible.map((d, i) => {
          const pct = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 8 : 2)
          const isActive = tooltip?.i === i
          return (
            <div
              key={i}
              className="ndash-chart-bar"
              style={{
                flex: 1,
                height: `${pct}%`,
                '--bar-color': d.revenue > 0 ? '#6366f1' : 'rgba(99,102,241,0.18)',
                animationDelay: `${i * 0.03}s`,
                position: 'relative',
                opacity: tooltip && !isActive ? 0.5 : 1,
              }}
              onMouseEnter={() => setTooltip({ i, ...d })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
      </div>
      {tooltip && (
        <div style={{
          position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700,
          color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
        }}>
          {tooltip.date} · {fmt(tooltip.revenue)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{visible[0]?.date}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{visible[visible.length-1]?.date}</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HERO WALLET CARD
───────────────────────────────────────────────────────────── */
function HeroWallet({ wallet, loading, onDeposit, onCharge, onWithdraw, hideBalance, setHideBalance, payMetrics, chart30d }) {
  return (
    <div data-tour="wallet-hero" style={{
      background: 'linear-gradient(140deg, #0a0a1a 0%, #0f0e2e 40%, #0d1927 100%)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 24,
      padding: '22px 20px 18px',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 24px 80px rgba(99,102,241,0.18), 0 4px 16px rgba(0,0,0,0.4)',
      animation: 'fadeUp 0.4s ease both, glow 4s ease infinite',
    }}>
      {/* Decorative glows */}
      <div style={{ position:'absolute', top:-60, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.22),transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-40, left:-30, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(6,182,212,0.12),transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'30%', left:'45%', width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%)', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'rgba(99,102,241,0.22)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 12px rgba(99,102,241,0.3)' }}>
              <Wallet size={16} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:1.5 }}>GATEWAY</div>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)' }}>Smart Moon</div>
            </div>
          </div>
          <button
            onClick={() => setHideBalance(h => !h)}
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, cursor:'pointer', color:'rgba(255,255,255,0.4)', padding:'5px 7px', display:'flex', alignItems:'center' }}
          >
            {hideBalance ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        {/* Balance */}
        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:5, letterSpacing:0.5 }}>Saldo disponível</div>
          {loading
            ? <Sk h={44} w="60%" />
            : (
              <div key={wallet?.balance ?? 'k'} style={{ fontSize:38, fontWeight:900, color:'#fff', letterSpacing:-2, lineHeight:1, animation:'countup 0.4s ease' }}>
                {hideBalance ? '••••••' : fmt(wallet?.balance_available ?? wallet?.balance ?? 0)}
              </div>
            )
          }
        </div>

        {/* Sub-balances */}
        <div style={{ display:'flex', gap:16, marginBottom:20 }}>
          <div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:0.5 }}>Recebido</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#34d399' }}>{loading ? '...' : (hideBalance ? '••••' : fmt(wallet?.total_received ?? 0))}</div>
          </div>
          <div style={{ width:1, background:'rgba(255,255,255,0.08)' }} />
          <div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:0.5 }}>Sacado</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#f87171' }}>{loading ? '...' : (hideBalance ? '••••' : fmt(wallet?.total_withdrawn ?? 0))}</div>
          </div>
          <div style={{ width:1, background:'rgba(255,255,255,0.08)' }} />
          <div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:0.5 }}>Pendente</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fbbf24' }}>{loading ? '...' : (hideBalance ? '••••' : fmt(payMetrics?.total_pending ?? 0))}</div>
          </div>
        </div>

        {/* CTA Buttons — 3 ações paralelas */}
        <div style={{ display:'flex', gap:8 }}>
          <button
            className="ndash-hero-btn"
            onClick={onDeposit}
            style={{ background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', boxShadow:'0 4px 16px rgba(16,185,129,0.35)', fontSize:12 }}
          >
            <ArrowDownLeft size={14} /> PIX Rápido
          </button>
          <button
            className="ndash-hero-btn"
            onClick={onCharge}
            style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', boxShadow:'0 4px 16px rgba(99,102,241,0.35)', fontSize:12 }}
          >
            <CreditCard size={14} /> Cobrar
          </button>
          <button
            className="ndash-hero-btn"
            onClick={onWithdraw}
            style={{ background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.75)', border:'1px solid rgba(255,255,255,0.12)', fontSize:12 }}
          >
            <ArrowUpRight size={14} /> Sacar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   METRIC TILE
───────────────────────────────────────────────────────────── */
function MetricTile({ icon: Icon, label, value, sub, color, loading, onClick, delay = 0 }) {
  return (
    <div
      className="ndash-metric-tile"
      style={{
        animationDelay: `${delay}ms`,
        animation: 'fadeUp 0.4s ease both',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* Accent top border */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color}, transparent)`, borderRadius:'18px 18px 0 0' }} />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} color={color} />
        </div>
        {sub && <span style={{ fontSize:9, fontWeight:800, color, background:`${color}15`, padding:'2px 7px', borderRadius:20, textTransform:'uppercase', letterSpacing:0.5 }}>{sub}</span>}
      </div>

      {loading
        ? <Sk h={28} w="55%" />
        : <div style={{ fontSize:26, fontWeight:900, color:'var(--text-primary)', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{value}</div>
      }
      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:5, fontWeight:500 }}>{label}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   QUICK PIX MODAL – só pede o valor e gera o QR
───────────────────────────────────────────────────────────── */
function QuickPIXModal({ onClose, onDone }) {
  const [amount, setAmount] = useState('')
  const [charge, setCharge] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150) }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true); setErr('')
    try {
      const res = await api.post('/payments/charges', {
        amount: parseFloat(amount),
        description: 'Depósito PIX',
      })
      // QR Code já vem no retorno do POST — não precisamos chamar /send
      setCharge(res)
    } catch (e) { setErr(typeof e.message === 'string' ? e.message.replace(/^\[object Object\]$/, 'Erro ao gerar PIX') : 'Erro ao gerar PIX') }
    setLoading(false)
  }

  const copy = txt => { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2500) }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(12px)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg-card)', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, padding:'24px 20px 36px', boxShadow:'0 -28px 80px rgba(0,0,0,0.55)', animation:'fadeUp 0.3s ease' }}>
        <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.14)', margin:'0 auto 22px' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:26 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:42, height:42, borderRadius:13, background:'rgba(16,185,129,0.14)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 18px rgba(16,185,129,0.22)' }}>
              <QrCode size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:900 }}>PIX Rápido</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Digite o valor e gere na hora</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer', color:'var(--text-muted)', padding:'7px 9px', display:'flex' }}><X size={16} /></button>
        </div>

        {!charge ? (
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:10, textTransform:'uppercase', letterSpacing:1.2 }}>Valor a receber</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:20, color:'rgba(255,255,255,0.3)', fontWeight:800 }}>R$</span>
                <input
                  ref={inputRef}
                  type="number" step="0.01" min="0.01" required placeholder="0,00"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ width:'100%', padding:'18px 18px 18px 52px', borderRadius:16, fontSize:32, fontWeight:900, background:'rgba(16,185,129,0.06)', border:'2px solid rgba(16,185,129,0.25)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box', fontVariantNumeric:'tabular-nums', caretColor:'#10b981' }}
                />
              </div>
            </div>
            {err && <div style={{ fontSize:12, color:'#ef4444', padding:'10px 12px', background:'rgba(239,68,68,0.09)', borderRadius:10, marginBottom:14 }}>{err}</div>}
            <button type="submit" disabled={loading || !amount} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background: amount ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,0.07)', color: amount ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight:900, fontSize:15, cursor: loading || !amount ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow: amount ? '0 6px 24px rgba(16,185,129,0.35)' : 'none', transition:'all 0.2s' }}>
              {loading ? <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} /> : <QrCode size={16} />}
              {loading ? 'Gerando QR Code...' : 'Gerar QR Code PIX'}
            </button>
          </form>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', textAlign:'center' }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 28px rgba(16,185,129,0.35)', animation:'fadeUp 0.3s ease' }}>
              <CheckCircle size={28} color="#10b981" />
            </div>
            <div style={{ fontSize:30, fontWeight:900, color:'#10b981', letterSpacing:-1 }}>{fmt(charge?.amount)}</div>
            {charge?.pix_qr_code && (
              <img src={`data:image/png;base64,${charge.pix_qr_code}`} alt="QR PIX" style={{ width:200, height:200, borderRadius:18, border:'3px solid rgba(16,185,129,0.3)' }} />
            )}
            <div style={{ width:'100%', padding:'11px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-subtle)', fontSize:9, wordBreak:'break-all', color:'var(--text-muted)', maxHeight:65, overflow:'hidden' }}>{charge?.pix_copy_paste_code || 'Código não disponível'}</div>
            <button onClick={() => copy(charge?.pix_copy_paste_code || '')} style={{ width:'100%', padding:'13px', borderRadius:12, border:'1px solid rgba(16,185,129,0.3)', background: copied ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.09)', color:'#10b981', fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}>
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar código PIX</>}
            </button>
            <button onClick={() => { onClose(); if (onDone) onDone() }} style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontWeight:600, fontSize:13, cursor:'pointer' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   CHARGE MODAL – formulário completo (nome, telefone, descrição)
───────────────────────────────────────────────────────────── */
function ChargeModal({ onClose, onDone }) {
  const [step, setStep] = useState('form')
  const [form, setForm] = useState({ amount: '', description: '', client_name: '', client_phone: '' })
  const [charge, setCharge] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const res = await api.post('/payments/charges', {
        amount: parseFloat(form.amount),
        description: form.description || 'Cobrança PIX',
        client_name: form.client_name,
        client_phone: form.client_phone,
      })
      // QR Code já vem no retorno do POST — marca como manual em background
      setCharge(res); setStep('qr')
      api.post(`/payments/charges/${res.id}/send`, { via: 'manual' }).catch(() => {})
    } catch (e) { setErr(typeof e.message === 'string' ? e.message.replace(/^\[object Object\]$/, 'Erro ao gerar cobrança') : 'Erro ao gerar cobrança') }
    setLoading(false)
  }

  const copy = txt => { navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg-card)', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, maxHeight:'92vh', overflow:'auto', padding:'24px 20px 32px', boxShadow:'0 -24px 80px rgba(0,0,0,0.5)', animation:'fadeUp 0.3s ease' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 20px' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(99,102,241,0.2)' }}>
              <CreditCard size={19} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:900 }}>Nova Cobrança</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>PIX com dados do pagador</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:'pointer', color:'var(--text-muted)', padding:'6px 8px', display:'flex' }}><X size={16} /></button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Valor</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--text-muted)', fontWeight:700 }}>R$</span>
                <input type="number" step="0.01" min="0.01" required placeholder="0,00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width:'100%', padding:'13px 14px 13px 40px', borderRadius:14, fontSize:22, fontWeight:900, background:'rgba(16,185,129,0.06)', border:'1.5px solid rgba(16,185,129,0.22)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box', fontVariantNumeric:'tabular-nums' }} />
              </div>
            </div>
            {[
              { k:'description', label:'Descrição', ph:'Ex: Serviço mensal' },
              { k:'client_name', label:'Nome do pagador', ph:'Nome completo' },
              { k:'client_phone', label:'WhatsApp', ph:'(11) 99999-9999' },
            ].map(({ k, label, ph }) => (
              <div key={k}>
                <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>{label}</label>
                <input placeholder={ph} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  style={{ width:'100%', padding:'11px 14px', borderRadius:12, fontSize:14, background:'var(--bg-input,rgba(255,255,255,0.05))', border:'1px solid var(--border-default)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            {err && <div style={{ fontSize:12, color:'#ef4444', padding:'10px 12px', background:'rgba(239,68,68,0.09)', borderRadius:10 }}>{err}</div>}
            <button type="submit" disabled={loading} style={{ padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', fontWeight:900, fontSize:14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(99,102,241,0.3)', marginTop:4 }}>
              {loading ? <RefreshCw size={15} style={{ animation:'spin 1s linear infinite' }} /> : <CreditCard size={15} />}
              {loading ? 'Gerando cobrança...' : 'Gerar Cobrança PIX'}
            </button>
          </form>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px rgba(16,185,129,0.3)' }}>
              <CheckCircle size={30} color="#10b981" />
            </div>
            <div style={{ fontSize:28, fontWeight:900, color:'#10b981' }}>{fmt(charge?.amount)}</div>
            {charge?.pix_qr_code && (
              <img src={`data:image/png;base64,${charge.pix_qr_code}`} alt="QR PIX" style={{ width:190, height:190, borderRadius:16, border:'3px solid rgba(16,185,129,0.3)' }} />
            )}
            <div style={{ width:'100%', padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-subtle)', fontSize:9, wordBreak:'break-all', color:'var(--text-muted)', maxHeight:70, overflow:'hidden' }}>{charge?.pix_copy_paste_code || 'Código não disponível'}</div>
            <button onClick={() => copy(charge?.pix_copy_paste_code || '')} style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.09)', color:'#10b981', fontWeight:800, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background 0.2s' }}>
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar código PIX</>}
            </button>
            <button onClick={onClose} style={{ width:'100%', padding:'11px', borderRadius:12, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontWeight:600, fontSize:13, cursor:'pointer' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   WITHDRAW MODAL
───────────────────────────────────────────────────────────── */
function WithdrawModal({ balance, onClose, onDone }) {
  const [form, setForm] = useState({ amount: '', pix_key: '', pix_key_type: 'cpf', notes: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      await api.post('/payments/wallet/withdrawals', {
        amount: parseFloat(form.amount),
        pix_key: form.pix_key,
        pix_key_type: form.pix_key_type,
        notes: form.notes,
      })
      setDone(true)
      setTimeout(() => { onClose(); if (onDone) onDone() }, 2500)
    } catch (e) { setErr(typeof e.message === 'string' ? e.message.replace(/^\[object Object\]$/, 'Erro ao solicitar saque') : 'Erro ao solicitar saque') }
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg-card)', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, padding:'24px 20px 32px', boxShadow:'0 -24px 80px rgba(0,0,0,0.5)', animation:'fadeUp 0.3s ease' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 20px' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(239,68,68,0.2)' }}>
              <ArrowUpRight size={19} color="#f87171" />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:900 }}>Solicitar Saque</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Saldo: {fmt(balance)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:'pointer', color:'var(--text-muted)', padding:'6px 8px', display:'flex' }}><X size={16} /></button>
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:'28px 0' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 24px rgba(16,185,129,0.3)' }}>
              <CheckCircle size={30} color="#10b981" />
            </div>
            <div style={{ fontSize:17, fontWeight:900, color:'#10b981' }}>Solicitação enviada!</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>Seu saque está em análise</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Valor (R$)</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--text-muted)', fontWeight:700 }}>R$</span>
                <input type="number" step="0.01" min="1" required placeholder="0,00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width:'100%', padding:'13px 14px 13px 40px', borderRadius:14, fontSize:22, fontWeight:900, background:'rgba(239,68,68,0.06)', border:'1.5px solid rgba(239,68,68,0.22)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box', fontVariantNumeric:'tabular-nums' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Tipo de Chave PIX</label>
              <select value={form.pix_key_type} onChange={e => setForm(f => ({ ...f, pix_key_type: e.target.value }))}
                style={{ width:'100%', padding:'11px 14px', borderRadius:12, fontSize:14, background:'var(--bg-input,rgba(255,255,255,0.05))', border:'1px solid var(--border-default)', color:'var(--text-primary)', outline:'none' }}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave aleatória</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:1 }}>Chave PIX</label>
              <input required placeholder="Informe sua chave PIX" value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))}
                style={{ width:'100%', padding:'11px 14px', borderRadius:12, fontSize:14, background:'var(--bg-input,rgba(255,255,255,0.05))', border:'1px solid var(--border-default)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }} />
            </div>
            {err && <div style={{ fontSize:12, color:'#ef4444', padding:'10px 12px', background:'rgba(239,68,68,0.09)', borderRadius:10 }}>{err}</div>}
            <button type="submit" disabled={loading} style={{ padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:900, fontSize:14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(239,68,68,0.25)', marginTop:4 }}>
              {loading ? <RefreshCw size={15} style={{ animation:'spin 1s linear infinite' }} /> : <ArrowUpRight size={15} />}
              {loading ? 'Enviando...' : 'Solicitar Saque'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#6b7280'
  const label = STATUS_LABEL[status] || status
  return (
    <span className="ndash-badge" style={{ background:`${color}18`, color, border:`1px solid ${color}30` }}>
      {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   SECTION CARD
───────────────────────────────────────────────────────────── */
function SectionCard({ icon: Icon, iconColor, title, seeAllLabel, onSeeAll, children, loading, delay = 0 }) {
  return (
    <div className="ndash-section-card" style={{ animationDelay:`${delay}ms` }}>
      <div className="ndash-section-hdr">
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`${iconColor}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon size={13} color={iconColor} />
          </div>
          <span style={{ fontSize:13, fontWeight:800 }}>{title}</span>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:iconColor, fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
            {seeAllLabel || 'Ver todos'} <ChevronRight size={11} />
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <Sk key={i} h={48} />)}
        </div>
      ) : children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()

  // Data
  const [apiOk, setApiOk] = useState(null)
  const [executions, setExecutions] = useState([])
  const [flows, setFlows] = useState([])
  const [wallet, setWallet] = useState(null)
  const [charges, setCharges] = useState([])
  const [payMetrics, setPayMetrics] = useState({})
  const [chart30d, setChart30d] = useState([])
  const [smBalance, setSmBalance] = useState(null)
  const [connections, setConnections] = useState({})
  const [agents, setAgents] = useState([])

  // UI
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [showPIX, setShowPIX] = useState(false)
  const [showCharge, setShowCharge] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showBuyCredits, setShowBuyCredits] = useState(false)

  /* ── Fetch ─────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    const [healthR, execR, flowR, payDashR, smR, connR, agentsR] = await Promise.allSettled([
      api.health(),
      api.listExecutions(20),
      api.listFlows(),
      api.get('/payments/dashboard'),
      api.get('/billing/credit-packs/my-balance'),
      api.get('/connections/status'),
      api.get('/agents/profiles?limit=100'),
    ])
    setApiOk(healthR.value?.status === 'ok')
    setExecutions(execR.value || [])
    setFlows(flowR.value || [])
    const pd = payDashR.value
    if (pd) {
      setWallet(pd.wallet || null)
      setCharges(pd.recent_charges || [])
      setPayMetrics(pd.metrics || {})
      setChart30d(pd.chart_30d || [])
    }
    setSmBalance(smR.value?.balance ?? null)
    setConnections(connR.value || {})
    setAgents(Array.isArray(agentsR.value) ? agentsR.value : [])
    setLastRefresh(new Date())
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 30000)
    return () => clearInterval(t)
  }, [fetchAll])

  /* ── Derived stats ─────────────────────────────────────── */
  const stats = {
    totalExecs: executions.length,
    success: executions.filter(e => e.status === 'success').length,
    failed: executions.filter(e => e.status === 'failed').length,
    running: executions.filter(e => ['running','queued','waiting'].includes(e.status)).length,
    flows: flows.length,
    published: flows.filter(f => f.status === 'published').length,
    pendingCharges: payMetrics.pending_charges ?? 0,
    paidCharges: payMetrics.paid_charges ?? 0,
    totalCharges: payMetrics.total_charges ?? 0,
    totalRevenue: payMetrics.total_revenue ?? 0,
    totalPending: payMetrics.total_pending ?? 0,
    activeAgents: agents.filter(a => a.is_active).length,
    connectedChannels: Object.values(connections).filter(v => v === 'connected' || v?.status === 'connected').length,
  }

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div style={{ padding:'16px 16px 40px', maxWidth:700, margin:'0 auto' }}>

      {/* ── Top Bar ── */}
      <div data-tour="global-status" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, animation:'fadeUp 0.3s ease' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: apiOk ? '#10b981' : '#ef4444', boxShadow: apiOk ? '0 0 6px #10b981' : 'none', animation: apiOk ? 'pulse2 2s infinite' : 'none' }} />
            <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
              {apiOk ? 'Sistema Online' : 'Verificando...'}
            </span>
          </div>
          <h1 style={{ fontSize:22, fontWeight:900, margin:0, letterSpacing:-0.5, color:'var(--text-primary)' }}>Dashboard</h1>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
            Gateway · Smart Moon · Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
        <button
          onClick={fetchAll}
          style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'8px 10px', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600 }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? '' : 'Atualizar'}
        </button>
      </div>

      {/* ── HERO: Wallet ── */}
      <div style={{ marginBottom:16 }}>
        <HeroWallet
          wallet={wallet}
          loading={loading}
          onDeposit={() => setShowPIX(true)}
          onCharge={() => setShowCharge(true)}
          onWithdraw={() => setShowWithdraw(true)}
          hideBalance={hideBalance}
          setHideBalance={setHideBalance}
          payMetrics={payMetrics}
          chart30d={chart30d}
        />
      </div>

      {/* ── Revenue Chart ── */}
      <div data-tour="main-chart" className="ndash-section-card" style={{ marginBottom:16, padding:'18px 18px 14px', animationDelay:'50ms' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
              <BarChart2 size={11} color="#6366f1" /> Receita — 30 dias
            </div>
            <div style={{ fontSize:28, fontWeight:900, color:'var(--text-primary)', letterSpacing:-1, fontVariantNumeric:'tabular-nums' }}>
              {loading ? <Sk w={120} h={28} /> : fmt(stats.totalRevenue)}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:3 }}>Pendente</div>
            <div style={{ fontSize:18, fontWeight:800, color:'#f59e0b', fontVariantNumeric:'tabular-nums' }}>
              {loading ? '...' : fmt(stats.totalPending)}
            </div>
          </div>
        </div>
        <RevenueBarChart data={chart30d} loading={loading} />
        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          {[
            { label:'Pagas', value:stats.paidCharges, color:'#10b981' },
            { label:'Pendentes', value:stats.pendingCharges, color:'#f59e0b' },
            { label:'Total', value:stats.totalCharges, color:'#6366f1' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex:1, background:`${color}0d`, border:`1px solid ${color}22`, borderRadius:12, padding:'9px 12px' }}>
              <div style={{ fontSize:9, color, textTransform:'uppercase', letterSpacing:0.8, marginBottom:3, fontWeight:800 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:900, color }}>{loading ? '...' : value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div data-tour="quick-actions" style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:20, animation:'fadeUp 0.4s ease both', animationDelay:'80ms' }}>
        {[
          { icon: QrCode, label:'PIX Rápido', color:'#10b981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.25)', action: () => setShowPIX(true) },
          { icon: CreditCard, label:'Cobrar', color:'#818cf8', bg:'rgba(99,102,241,0.1)', border:'rgba(99,102,241,0.25)', action: () => setShowCharge(true) },
          { icon: ArrowUpRight, label:'Sacar', color:'#f87171', bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.2)', action: () => setShowWithdraw(true) },
          { icon: ShoppingCart, label:'Créditos SM', color:'#a78bfa', bg:'rgba(139,92,246,0.1)', border:'rgba(139,92,246,0.25)', action: () => setShowBuyCredits(true) },
          { icon: TrendingUp, label:'Gateway', color:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.22)', action: () => navigate('/payments') },
        ].map(({ icon: Icon, label, color, bg, border, action }) => (
          <button key={label} className="ndash-action-pill" onClick={action}
            style={{ background:bg, border:`1px solid ${border}`, color, boxShadow:`0 4px 14px ${color}18` }}>
            <Icon size={18} />
            <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ── AI Metrics Grid ── */}
      <div data-tour="metrics-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
        <MetricTile icon={Activity} label="Execuções" value={fmtK(stats.totalExecs)} sub={`${stats.success}✓ ${stats.failed}✗`} color="#3b82f6" loading={loading} delay={100} onClick={() => navigate('/executions')} />
        <MetricTile icon={GitBranch} label="Fluxos" value={stats.flows} sub={`${stats.published} publicados`} color="#8b5cf6" loading={loading} delay={130} onClick={() => navigate('/flows')} />
        <MetricTile icon={Bot} label="Agentes IA" value={stats.activeAgents} sub="ativos" color="#10b981" loading={loading} delay={160} onClick={() => navigate('/agents')} />
        <MetricTile icon={Link2} label="Canais" value={stats.connectedChannels} sub="conectados" color="#06b6d4" loading={loading} delay={190} onClick={() => navigate('/integrations')} />
      </div>

      {/* ── Credits SM ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', marginBottom:20, background:'linear-gradient(135deg,rgba(167,139,250,0.08),rgba(99,102,241,0.05))', border:'1px solid rgba(167,139,250,0.2)', borderRadius:18, animation:'fadeUp 0.4s ease both', animationDelay:'200ms', cursor:'pointer' }}
        onClick={() => setShowBuyCredits(true)}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(167,139,250,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Sparkles size={16} color="#a78bfa" />
          </div>
          <div>
            <div style={{ fontSize:10, color:'rgba(167,139,250,0.7)', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Créditos SM</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#a78bfa', fontVariantNumeric:'tabular-nums' }}>
              {loading ? '...' : (smBalance !== null ? fmtK(smBalance) : '—')}
            </div>
          </div>
        </div>
        <button style={{ background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:10, padding:'7px 14px', color:'#a78bfa', fontWeight:800, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          + Recarregar <ChevronRight size={12} />
        </button>
      </div>

      {/* ── Recent Charges ── */}
      <div style={{ marginBottom:16 }}>
        <SectionCard icon={CreditCard} iconColor="#f59e0b" title="Cobranças PIX" onSeeAll={() => navigate('/payments')} loading={loading} delay={220}>
          {charges.length === 0
            ? <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Nenhuma cobrança recente</div>
            : charges.slice(0, 5).map((c, i) => (
              <div key={c.id} className="ndash-list-row" style={{ animationDelay:`${i * 50}ms` }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${STATUS_COLOR[c.status] || '#6b7280'}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <DollarSign size={15} color={STATUS_COLOR[c.status] || '#6b7280'} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.description || 'Cobrança'}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{fmtTime(c.created_at)}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:STATUS_COLOR[c.status] || 'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{fmt(c.amount)}</div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))
          }
        </SectionCard>
      </div>

      {/* ── Recent Executions ── */}
      <div style={{ marginBottom:16 }}>
        <SectionCard icon={Zap} iconColor="#3b82f6" title="Execuções Recentes" onSeeAll={() => navigate('/executions')} loading={loading} delay={260}>
          {executions.length === 0
            ? <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Nenhuma execução recente</div>
            : executions.slice(0, 5).map((ex, i) => (
              <div key={ex.id} className="ndash-list-row" style={{ animationDelay:`${i * 50}ms` }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${STATUS_COLOR[ex.status] || '#6b7280'}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Zap size={14} color={STATUS_COLOR[ex.status] || '#6b7280'} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Exec #{ex.id} · {ex.flow_name || 'Flow'}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{ex.trigger_type} · {fmtTime(ex.started_at)}</div>
                </div>
                <StatusBadge status={ex.status} />
              </div>
            ))
          }
        </SectionCard>
      </div>

      {/* ── Active Flows ── */}
      <SectionCard icon={GitBranch} iconColor="#8b5cf6" title="Fluxos Ativos" onSeeAll={() => navigate('/flows')} seeAllLabel="Gerenciar" loading={loading} delay={300}>
        {flows.filter(f => f.status === 'published').length === 0
          ? <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Nenhum fluxo publicado</div>
          : flows.filter(f => f.status === 'published').slice(0, 4).map((f, i) => (
            <div key={f.id} className="ndash-list-row" style={{ animationDelay:`${i * 50}ms` }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(139,92,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <GitBranch size={14} color="#8b5cf6" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{f.name}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)' }}>{f.trigger_type || 'sem gatilho'}</div>
              </div>
              <span className="ndash-badge" style={{ background:'rgba(139,92,246,0.15)', color:'#8b5cf6', border:'1px solid rgba(139,92,246,0.25)' }}>ATIVO</span>
            </div>
          ))
        }
      </SectionCard>

      {/* Modals */}
      {showPIX && <QuickPIXModal onClose={() => setShowPIX(false)} onDone={() => { setShowPIX(false); fetchAll() }} />}
      {showCharge && <ChargeModal onClose={() => setShowCharge(false)} onDone={() => { setShowCharge(false); fetchAll() }} />}
      {showWithdraw && <WithdrawModal balance={wallet?.balance_available || 0} onClose={() => setShowWithdraw(false)} onDone={fetchAll} />}
      {showBuyCredits && (
        <Suspense fallback={null}>
          <BuyCreditsModal onClose={() => setShowBuyCredits(false)} onCredited={fetchAll} />
        </Suspense>
      )}
    </div>
  )
}

// alias para import named
const DollarSign = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)
