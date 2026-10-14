/**
 * Login — Smart Moon Platform
 * Background: rotating galaxy + satellite passing every 20s
 * Responsive: desktop card + mobile full-screen
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getPublicBrand } from '../../api'

// ── Responsive hook ────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Star generator ─────────────────────────────────────────
function useStars(count) {
  return useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.2 + 0.3,
    delay: Math.random() * 10,
    duration: Math.random() * 5 + 3,
    opacity: Math.random() * 0.75 + 0.15,
    bright: Math.random() > 0.88,
  })), [])
}

// ── Space background with rotating galaxy ─────────────────
function GalaxyBackground() {
  const stars = useStars(120)

  return (
    <>
      <style>{`
        /* ── Keyframes ─────────────────────────────────────── */
        @keyframes twinkle {
          0%,100% { opacity: var(--op, .3); transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.7); }
        }
        @keyframes galaxyRotate {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes galaxyRotateRev {
          from { transform: translate(-50%,-50%) rotate(0deg) scale(1.1); }
          to   { transform: translate(-50%,-50%) rotate(-360deg) scale(1.1); }
        }
        @keyframes coreBreath {
          0%,100% { opacity:.55; transform:translate(-50%,-50%) scale(1); }
          50%      { opacity:.75; transform:translate(-50%,-50%) scale(1.06); }
        }
        @keyframes auroraDrift {
          0%,100% { transform:translate(-50%,-50%) scale(1) rotate(0deg); opacity:.07; }
          33%      { transform:translate(-50%,-50%) scale(1.07) rotate(60deg); opacity:.11; }
          66%      { transform:translate(-50%,-50%) scale(.95) rotate(120deg); opacity:.06; }
        }
        /* ── Satellite — 20s cycle: 3s cross + 17s invisible ── */
        @keyframes satellitePass {
          0%   { left:-120px; top:18%; opacity:0; transform:rotate(-15deg); }
          2%   { opacity:1; }
          13%  { left:110%; top:42%; opacity:.9; transform:rotate(-15deg); }
          14%  { opacity:0; left:110%; top:42%; }
          14.1%{ left:-120px; top:18%; opacity:0; }
          100% { left:-120px; top:18%; opacity:0; transform:rotate(-15deg); }
        }
        @keyframes satelliteTrail {
          0%  { opacity:0; width:0; }
          2%  { opacity:.6; width:60px; }
          13% { opacity:0; width:40px; }
          100%{ opacity:0; width:0; }
        }
        @keyframes moonPulse {
          0%,100% { box-shadow:0 0 24px rgba(167,139,250,.45), 0 0 50px rgba(167,139,250,.15); }
          50%      { box-shadow:0 0 45px rgba(167,139,250,.75), 0 0 90px rgba(167,139,250,.3); }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmerCard {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
      `}</style>

      {/* ── Deep space base ──────────────────────────────── */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, overflow:'hidden',
        background:'radial-gradient(ellipse at 35% 40%, #0c0520 0%, #060412 45%, #020108 100%)',
        pointerEvents:'none',
      }}>

        {/* ── Stars ─────────────────────────────────────── */}
        {stars.map(s => (
          <div key={s.id} style={{
            position:'absolute', left:`${s.x}%`, top:`${s.y}%`,
            width: s.bright ? s.size * 1.8 : s.size,
            height: s.bright ? s.size * 1.8 : s.size,
            borderRadius:'50%',
            background: s.bright
              ? 'radial-gradient(circle, #fff 30%, rgba(167,139,250,0.6) 100%)'
              : 'white',
            '--op': s.opacity, opacity: s.opacity,
            boxShadow: s.bright ? `0 0 ${s.size * 4}px rgba(167,139,250,0.8)` : 'none',
            animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }} />
        ))}

        {/* ── Galaxy outer halo ─────────────────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:700, height:700, borderRadius:'50%',
          background:'radial-gradient(ellipse, rgba(88,28,135,0.18) 0%, rgba(30,10,60,0.12) 40%, transparent 75%)',
          filter:'blur(30px)',
          animation:'auroraDrift 30s ease-in-out infinite',
          transform:'translate(-50%,-50%)',
        }} />

        {/* ── Galaxy arm 1 (wide clockwise) ─────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:560, height:560,
          animation:'galaxyRotate 90s linear infinite',
          transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }}>
          <div style={{
            width:'100%', height:'100%', borderRadius:'50%',
            background:`conic-gradient(
              from 0deg,
              transparent 0%,
              rgba(139,92,246,0.18) 8%,
              rgba(167,139,250,0.28) 14%,
              transparent 22%,
              transparent 50%,
              rgba(56,189,248,0.12) 58%,
              rgba(125,211,252,0.22) 64%,
              transparent 72%
            )`,
            filter:'blur(8px)',
          }} />
        </div>

        {/* ── Galaxy arm 2 (inner counter-clockwise) ────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:340, height:340,
          animation:'galaxyRotateRev 60s linear infinite',
          transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }}>
          <div style={{
            width:'100%', height:'100%', borderRadius:'50%',
            background:`conic-gradient(
              from 90deg,
              transparent 0%,
              rgba(244,114,182,0.12) 10%,
              rgba(248,113,113,0.16) 17%,
              transparent 26%,
              transparent 55%,
              rgba(139,92,246,0.20) 63%,
              rgba(167,139,250,0.28) 70%,
              transparent 78%
            )`,
            filter:'blur(5px)',
          }} />
        </div>

        {/* ── Galaxy ring 1 ─────────────────────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:480, height:280,
          animation:'galaxyRotate 110s linear infinite',
          transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }}>
          <div style={{
            width:'100%', height:'100%', borderRadius:'50%',
            border:'1px solid rgba(139,92,246,0.08)',
            boxShadow:'0 0 30px rgba(139,92,246,0.06) inset',
          }} />
        </div>

        {/* ── Galaxy ring 2 ─────────────────────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:620, height:360,
          animation:'galaxyRotateRev 80s linear infinite',
          transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }}>
          <div style={{
            width:'100%', height:'100%', borderRadius:'50%',
            border:'1px solid rgba(56,189,248,0.05)',
          }} />
        </div>

        {/* ── Galaxy core ───────────────────────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:180, height:180, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(196,167,255,0.4) 0%, rgba(139,92,246,0.25) 35%, rgba(88,28,135,0.1) 65%, transparent 100%)',
          filter:'blur(18px)',
          animation:'coreBreath 8s ease-in-out infinite',
          transform:'translate(-50%,-50%)',
        }} />

        {/* ── Galaxy nucleus ────────────────────────────── */}
        <div style={{
          position:'absolute', top:'48%', left:'38%',
          width:60, height:60, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(196,167,255,0.5) 50%, transparent 100%)',
          filter:'blur(6px)',
          animation:'coreBreath 5s ease-in-out infinite',
          transform:'translate(-50%,-50%)',
        }} />

        {/* ── Nebula cyan blob ──────────────────────────── */}
        <div style={{
          position:'absolute', top:'70%', left:'65%',
          width:400, height:280, borderRadius:'40% 60% 50% 70%',
          background:'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 70%)',
          filter:'blur(40px)',
          animation:'auroraDrift 25s 5s ease-in-out infinite',
          transform:'translate(-50%,-50%)',
        }} />

        {/* ── Nebula pink blob ──────────────────────────── */}
        <div style={{
          position:'absolute', top:'20%', left:'70%',
          width:300, height:200, borderRadius:'60% 40% 70% 30%',
          background:'radial-gradient(ellipse, rgba(244,114,182,0.06) 0%, transparent 70%)',
          filter:'blur(35px)',
          animation:'auroraDrift 35s 10s ease-in-out infinite',
          transform:'translate(-50%,-50%)',
        }} />

        {/* ── Grid overlay ──────────────────────────────── */}
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:`
            linear-gradient(rgba(139,92,246,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.02) 1px, transparent 1px)
          `,
          backgroundSize:'70px 70px',
        }} />

        {/* ── Satellite 🛰️ + trail ──────────────────────── */}
        <div style={{
          position:'absolute', zIndex:5,
          animation:'satellitePass 20s 2s linear infinite',
          display:'flex', alignItems:'center', gap:0,
          filter:'drop-shadow(0 0 6px rgba(167,139,250,0.9))',
          pointerEvents:'none',
          fontSize:22,
          whiteSpace:'nowrap',
        }}>
          {/* Trail */}
          <div style={{
            height:1.5, borderRadius:2,
            background:'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), rgba(56,189,248,0.4))',
            animation:'satelliteTrail 20s 2s linear infinite',
          }} />
          {/* Satellite body */}
          <span style={{ lineHeight:1 }}>🛰️</span>
        </div>

      </div>
    </>
  )
}

// ── Login form ─────────────────────────────────────────────
export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [brandName, setBrandName] = useState('Smart Moon')
  const width = useWindowWidth()
  const isMobile = width < 600
  const navigate = useNavigate()

  useEffect(() => {
    getPublicBrand().then(b => {
      if (b?.platform_name) setBrandName(b.platform_name)
    }).catch(() => {})
  }, [])

  // ── If already logged in, redirect to dashboard ──────────
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    api.me().then(me => {
      if (me?.id) navigate('/inicio', { replace: true })
      else setChecking(false)
    }).catch(() => {
      setChecking(false)
    })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.login(email, password)
      navigate('/inicio', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciais inválidas')
    }
    setLoading(false)
  }

  const inputStyle = {
    width:'100%', padding:'13px 15px', borderRadius:11,
    border:'1px solid rgba(139,92,246,0.2)',
    background:'rgba(6,4,16,0.85)', color:'#e2e8f0', fontSize:14,
    outline:'none', transition:'border-color 0.25s, box-shadow 0.25s',
    boxSizing:'border-box', backdropFilter:'blur(8px)',
  }
  const focusIn  = e => { e.target.style.borderColor='#a78bfa'; e.target.style.boxShadow='0 0 0 3px rgba(167,139,250,0.1)' }
  const focusOut = e => { e.target.style.borderColor='rgba(139,92,246,0.2)'; e.target.style.boxShadow='none' }

  // Don't render login form while checking auth status
  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060412',
      }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex',
      alignItems:'center', justifyContent: isMobile ? 'flex-end' : 'center',
      flexDirection:'column',
      fontFamily:'"Inter","SF Pro Display",system-ui,sans-serif',
      position:'relative', overflow:'hidden',
      padding: isMobile ? '16px 16px 32px' : '24px',
    }}>
      <GalaxyBackground />

      {/* ── Card ───────────────────────────────────────── */}
      <div style={{
        width: isMobile ? '100%' : 420,
        padding: isMobile ? '28px 22px 24px' : '40px 36px',
        borderRadius: isMobile ? 20 : 22,
        background:'rgba(8,5,20,0.82)',
        border:'1px solid rgba(167,139,250,0.12)',
        backdropFilter:'blur(32px)',
        boxShadow:'0 30px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(167,139,250,0.06)',
        position:'relative', zIndex:10,
        animation:'fadeInUp 0.65s cubic-bezier(0.34,1.56,0.64,1) both',
        overflow:'hidden',
      }}>
        {/* Shimmer border */}
        <div style={{
          position:'absolute', inset:0, borderRadius: isMobile ? 20 : 22,
          background:'linear-gradient(105deg, transparent 40%, rgba(167,139,250,0.07) 50%, transparent 60%)',
          backgroundSize:'300% 100%',
          animation:'shimmerCard 6s ease infinite',
          pointerEvents:'none',
        }} />

        {/* ── Logo ─────────────────────────────────────── */}
        <div style={{ textAlign:'center', marginBottom: isMobile ? 22 : 28, display:'flex', flexDirection:'column', alignItems:'center', gap: 8 }}>
          <img src="/brand/logo-icon.svg" alt="Smart Moon" style={{ width: isMobile ? 52 : 64, height: isMobile ? 52 : 64 }} />
          <div>
            <h1 style={{
              fontSize: isMobile ? 20 : 24, fontWeight:900, margin:'8px 0 4px',
              background:'linear-gradient(135deg, #f1f5f9 30%, #a78bfa 70%, #38bdf8 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              backgroundClip:'text',
              letterSpacing:-0.5,
            }}>{brandName}</h1>
            <p style={{ fontSize: isMobile ? 11 : 12, color:'#334155', margin:0, fontWeight:500 }}>
              Acesse sua conta e comece a automatizar
            </p>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────── */}
        {error && (
          <div style={{
            padding:'10px 14px', borderRadius:10, marginBottom:16,
            background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.18)',
            color:'#f87171', fontSize:12, fontWeight:600,
          }}>⚠️ {error}</div>
        )}

        {/* ── Form ────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{
              fontSize:10, fontWeight:700, color:'#475569',
              letterSpacing:1, display:'block', marginBottom:7, textTransform:'uppercase',
            }}>E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required
              style={inputStyle} onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            <label style={{
              fontSize:10, fontWeight:700, color:'#475569',
              letterSpacing:1, display:'block', marginBottom:7, textTransform:'uppercase',
            }}>Senha</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={inputStyle} onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width:'100%', padding: isMobile ? '13px' : '14px',
            borderRadius:12, border:'none',
            background: loading
              ? 'rgba(20,16,40,0.8)'
              : 'linear-gradient(135deg, #7c3aed, #a78bfa 50%, #38bdf8)',
            color: loading ? '#334155' : 'white',
            fontSize:14, fontWeight:700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 8px 28px rgba(167,139,250,0.35)',
            transition:'all 0.3s ease', letterSpacing:0.3,
            position:'relative', overflow:'hidden',
          }}>
            {loading ? '⏳ Entrando...' : '🔐 Entrar na Smart Moon'}
          </button>
        </form>

        {/* ── Divider ─────────────────────────────────── */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, margin:'18px 0',
        }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.05)' }} />
          <span style={{ fontSize:10, color:'#1e293b', fontWeight:600 }}>OU</span>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.05)' }} />
        </div>

        {/* ── Register link ───────────────────────────── */}
        <a href="/register" style={{
          display:'block', textAlign:'center', textDecoration:'none',
          padding:'12px', borderRadius:11,
          border:'1px solid rgba(167,139,250,0.12)',
          background:'rgba(167,139,250,0.04)',
          color:'#a78bfa', fontSize:13, fontWeight:600,
          transition:'all 0.2s',
        }}
          onMouseEnter={e => { e.target.style.borderColor='rgba(167,139,250,0.3)'; e.target.style.background='rgba(167,139,250,0.08)' }}
          onMouseLeave={e => { e.target.style.borderColor='rgba(167,139,250,0.12)'; e.target.style.background='rgba(167,139,250,0.04)' }}
        >
          Criar nova conta →
        </a>

        {/* ── Footer ──────────────────────────────────── */}
        <div style={{ textAlign:'center', marginTop:18, fontSize:9, color:'#0f172a', letterSpacing:1 }}>
          {brandName} · BETA v1.0
        </div>
      </div>

      {/* ── Tagline below card (desktop only) ─────────── */}
      {!isMobile && (
        <div style={{
          marginTop:18, textAlign:'center', position:'relative', zIndex:10,
          animation:'fadeInUp 0.8s 0.2s ease both',
        }}>
          <p style={{
            fontSize:12, color:'#1e293b', fontWeight:600, margin:0,
            letterSpacing:0.5,
          }}>
            ⚡ Automatize. Escale. Domine. — Powered by Smart Moon
          </p>
        </div>
      )}
    </div>
  )
}
