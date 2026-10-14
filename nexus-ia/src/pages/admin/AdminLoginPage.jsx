/**
 * AdminLoginPage — Portal de Acesso Exclusivo SuperAdmin
 *
 * Rota pública: /admin/login
 * Completamente separada do login de usuários (/login).
 *
 * Fluxo:
 *  1. Chama api.login() com as credenciais
 *  2. Verifica api.me() → is_superadmin === true
 *  3. Se sim → redireciona para /admin/overview
 *  4. Se não → faz logout imediato e mostra erro "acesso negado"
 *
 * Design: dark vermelho/militar — diferenciado do login de usuário (purple/galaxy)
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

// ── Partículas de fundo (hexagonal grid + glow) ──────────────────────────
function AdminBackground() {
  const dots = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.8 + 0.4,
    delay: Math.random() * 8,
    duration: Math.random() * 4 + 4,
    opacity: Math.random() * 0.5 + 0.1,
  })), [])

  return (
    <>
      <style>{`
        @keyframes adminPulse {
          0%,100% { opacity: var(--op, .15); transform: scale(1); }
          50%      { opacity: calc(var(--op, .15) * 2.5); transform: scale(1.6); }
        }
        @keyframes adminScanline {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: .06; }
          90%  { opacity: .06; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes adminFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes adminGlow {
          0%,100% { box-shadow: 0 0 40px rgba(239,68,68,0.15), 0 0 0 1px rgba(239,68,68,0.08); }
          50%      { box-shadow: 0 0 80px rgba(239,68,68,0.28), 0 0 0 1px rgba(239,68,68,0.15); }
        }
        @keyframes adminShimmer {
          0%   { background-position: -400% center; }
          100% { background-position: 400% center; }
        }
        @keyframes adminSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes adminCornerPulse {
          0%,100% { opacity: .4; }
          50%      { opacity: .9; }
        }
      `}</style>

      {/* Deep dark base */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 30% 50%, #1a0505 0%, #0d0202 40%, #060000 100%)',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239,68,68,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />

        {/* Red glow orb left */}
        <div style={{
          position: 'absolute', top: '40%', left: '20%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(185,28,28,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'adminCornerPulse 6s ease-in-out infinite',
          transform: 'translate(-50%,-50%)',
        }} />

        {/* Dark amber glow right */}
        <div style={{
          position: 'absolute', top: '60%', left: '75%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,53,15,0.10) 0%, transparent 70%)',
          filter: 'blur(35px)',
          animation: 'adminCornerPulse 9s 3s ease-in-out infinite',
          transform: 'translate(-50%,-50%)',
        }} />

        {/* Scanline effect */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: '30%',
          background: 'linear-gradient(180deg, transparent, rgba(239,68,68,0.035), transparent)',
          animation: 'adminScanline 8s 1s linear infinite',
        }} />

        {/* Dots */}
        {dots.map(d => (
          <div key={d.id} style={{
            position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
            width: d.size, height: d.size, borderRadius: '50%',
            background: 'rgba(239,68,68,0.6)',
            '--op': d.opacity,
            animation: `adminPulse ${d.duration}s ${d.delay}s ease-in-out infinite`,
          }} />
        ))}

        {/* Corner brackets — top left */}
        <div style={{ position: 'absolute', top: 24, left: 24, width: 40, height: 40,
          borderTop: '2px solid rgba(239,68,68,0.3)', borderLeft: '2px solid rgba(239,68,68,0.3)',
          animation: 'adminCornerPulse 4s ease-in-out infinite',
        }} />
        {/* Corner brackets — bottom right */}
        <div style={{ position: 'absolute', bottom: 24, right: 24, width: 40, height: 40,
          borderBottom: '2px solid rgba(239,68,68,0.3)', borderRight: '2px solid rgba(239,68,68,0.3)',
          animation: 'adminCornerPulse 4s 2s ease-in-out infinite',
        }} />

        {/* Top bar accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), rgba(239,68,68,0.3), transparent)',
        }} />
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function AdminLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  // ── Se já estiver logado como superadmin, ir direto ao painel ─────────
  useEffect(() => {
    api.me()
      .then(me => {
        if (me?.is_superadmin === true) {
          navigate('/admin/overview', { replace: true })
        } else {
          // Logado mas não é superadmin — não redirecionar para o painel de usuários
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [navigate])

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.login(email, password)
      const me = await api.me()

      if (me?.is_superadmin !== true) {
        // Logout imediato — usuário comum não pode entrar aqui
        try { await api.logout() } catch {}
        setError('⛔ Acesso negado — esta área é exclusiva para SuperAdmins.')
        setLoading(false)
        return
      }

      navigate('/admin/overview', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciais inválidas')
    }

    setLoading(false)
  }

  const inputBase = {
    width: '100%', padding: '13px 16px', borderRadius: 10,
    background: 'rgba(20,4,4,0.9)',
    border: '1px solid rgba(239,68,68,0.18)',
    color: '#fca5a5', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const focusIn  = e => { e.target.style.borderColor = '#ef4444'; e.target.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.1)' }
  const focusOut = e => { e.target.style.borderColor = 'rgba(239,68,68,0.18)'; e.target.style.boxShadow = 'none' }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: '#7f1d1d', letterSpacing: 1.2, display: 'block', marginBottom: 7, textTransform: 'uppercase' }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060000' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(239,68,68,0.15)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'adminSpin 0.7s linear infinite' }} />
        <style>{`@keyframes adminSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter","SF Pro Display",system-ui,sans-serif',
      position: 'relative', overflow: 'hidden',
      padding: 24,
    }}>
      <AdminBackground />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        padding: '40px 36px',
        borderRadius: 20,
        background: 'rgba(12,3,3,0.88)',
        border: '1px solid rgba(239,68,68,0.14)',
        backdropFilter: 'blur(28px)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
        position: 'relative', zIndex: 10,
        animation: 'adminFadeUp 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
        animation: 'adminGlow 4s ease-in-out infinite, adminFadeUp 0.6s ease both',
        overflow: 'hidden',
      }}>
        {/* Shimmer top edge */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5), rgba(239,68,68,0.3), transparent)',
          animation: 'adminShimmer 4s ease infinite',
          backgroundSize: '400% 100%',
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
            boxShadow: '0 0 30px rgba(239,68,68,0.3), 0 8px 20px rgba(0,0,0,0.5)',
          }}>🛡️</div>

          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 3,
            color: '#ef4444', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Acesso Restrito
          </div>

          <h1 style={{
            fontSize: 22, fontWeight: 900, margin: '0 0 6px',
            background: 'linear-gradient(135deg, #fca5a5 20%, #ef4444 60%, #b91c1c 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', letterSpacing: -0.5,
          }}>
            SM Admin
          </h1>

          <p style={{ fontSize: 12, color: '#450a0a', margin: 0, fontWeight: 500 }}>
            Painel exclusivo para SuperAdministradores
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', fontSize: 12, fontWeight: 600, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>E-mail</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@empresa.com"
              required
              autoComplete="username"
              style={inputBase}
              onFocus={focusIn}
              onBlur={focusOut}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Senha</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={inputBase}
              onFocus={focusIn}
              onBlur={focusOut}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12, border: 'none',
              background: loading
                ? 'rgba(40,8,8,0.8)'
                : 'linear-gradient(135deg, #991b1b, #dc2626 50%, #b91c1c)',
              color: loading ? '#7f1d1d' : 'white',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 28px rgba(220,38,38,0.4)',
              transition: 'all 0.25s ease', letterSpacing: 0.5,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {loading ? '⏳ Verificando permissões...' : '🔐 Acessar Painel Admin'}
          </button>
        </form>

        {/* Security notice */}
        <div style={{
          marginTop: 24, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <p style={{ fontSize: 11, color: '#450a0a', margin: 0, lineHeight: 1.6 }}>
            Esta área é monitorada. Tentativas de acesso não autorizado são registradas e reportadas.
          </p>
        </div>

        {/* Back to user login */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login" style={{
            fontSize: 11, color: '#450a0a', textDecoration: 'none', fontWeight: 600,
            letterSpacing: 0.3,
          }}
            onMouseEnter={e => e.target.style.color = '#7f1d1d'}
            onMouseLeave={e => e.target.style.color = '#450a0a'}
          >
            ← Login de usuário
          </a>
        </div>
      </div>

      {/* Bottom label */}
      <div style={{
        position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center',
        fontSize: 9, color: '#1a0505', fontWeight: 700, letterSpacing: 2, zIndex: 10,
      }}>
        SMARTMOON ADMIN · ACESSO SEGURO · SSL ATIVO
      </div>
    </div>
  )
}
