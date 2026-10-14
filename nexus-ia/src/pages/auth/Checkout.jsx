/**
 * Checkout — Smart Moon PIX Payment Page
 * Post-registration checkout for paid plans.
 * Shows QR Code, copy-paste PIX code, polls payment status.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function Checkout() {
  const navigate = useNavigate()
  const [checkout, setCheckout] = useState(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('pending') // pending | paid | error
  const [timeLeft, setTimeLeft] = useState(30 * 60) // 30 min countdown
  const pollRef = useRef(null)
  const countdownRef = useRef(null)

  // Load checkout data from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('checkout_data')
    if (!raw) {
      navigate('/login')
      return
    }
    try {
      setCheckout(JSON.parse(raw))
    } catch {
      navigate('/login')
    }
  }, [navigate])

  // Poll payment status
  const checkPayment = useCallback(async () => {
    try {
      const res = await fetch('/auth/payment-status', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.active || data.subscription_status === 'active') {
        setStatus('paid')
        sessionStorage.removeItem('checkout_data')
        // BUG-16 FIX: parar timers imediatamente ao confirmar pagamento
        if (pollRef.current) clearInterval(pollRef.current)
        if (countdownRef.current) clearInterval(countdownRef.current)
        pollRef.current = null
        countdownRef.current = null
        // BUG-12 FIX: invalidar cache do usePlan para o novo plano aparecer imediatamente
        window.dispatchEvent(new CustomEvent('plan:updated'))
        // Redirect after success animation
        setTimeout(() => navigate('/'), 3000)
      }
    } catch { /* silent */ }
  }, [navigate])

  useEffect(() => {
    if (!checkout) return
    pollRef.current = setInterval(checkPayment, 5000)
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    // Initial check
    checkPayment()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [checkout, checkPayment])

  const handleCopy = () => {
    if (!checkout?.pix_copy_paste) return
    navigator.clipboard.writeText(checkout.pix_copy_paste)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const skipToApp = () => {
    sessionStorage.removeItem('checkout_data')
    navigate('/')
  }

  if (!checkout) return null

  // ── Success State ──
  if (status === 'paid') {
    return (
      <div style={wrapperStyle}>
        <style>{animations}</style>
        <div style={bgStyle} />
        <div style={{
          ...cardStyle, textAlign: 'center', padding: '60px 40px',
          animation: 'fadeInUp 0.5s ease both',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #10b981, #34d399)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, animation: 'successPulse 1s ease infinite',
            boxShadow: '0 0 40px rgba(16,185,129,0.4)',
          }}>✓</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: '0 0 8px' }}>
            Pagamento Confirmado! 🎉
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', margin: '0 0 8px' }}>
            Seu plano <strong style={{ color: '#a78bfa' }}>{checkout.plan_name}</strong> foi ativado.
          </p>
          <p style={{ fontSize: 13, color: '#475569' }}>
            Redirecionando para a plataforma...
          </p>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', margin: '20px auto 0',
            border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      </div>
    )
  }

  // ── Payment Pending State ──
  return (
    <div style={wrapperStyle}>
      <style>{animations}</style>
      <div style={bgStyle} />

      <div style={{
        ...cardStyle, maxWidth: 480, animation: 'fadeInUp 0.5s ease both',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, animation: 'moonPulse 3s ease-in-out infinite',
          }}>🌙</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: '0 0 4px' }}>
            Finalize seu pagamento
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Plano <strong style={{ color: '#a78bfa' }}>{checkout.plan_name}</strong>
          </p>
        </div>

        {/* Amount */}
        <div style={{
          textAlign: 'center', padding: '16px 0', marginBottom: 20,
          borderTop: '1px solid rgba(139,92,246,0.15)',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            Valor
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#a78bfa' }}>
            R$ {checkout.amount?.toFixed(2)?.replace('.', ',')}
          </div>
        </div>

        {/* QR Code */}
        {checkout.pix_qr_code && (
          <div style={{
            textAlign: 'center', marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, letterSpacing: 0.5 }}>
              📱 Escaneie o QR Code com seu app de banco
            </div>
            <div style={{
              display: 'inline-block', padding: 12, borderRadius: 16,
              background: 'white',
              boxShadow: '0 0 30px rgba(139,92,246,0.3), 0 8px 32px rgba(0,0,0,0.4)',
              animation: 'qrGlow 3s ease-in-out infinite',
            }}>
              <img
                src={`data:image/png;base64,${checkout.pix_qr_code}`}
                alt="QR Code PIX"
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Copy PIX Code */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
            Ou copie o código PIX:
          </div>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <div style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(8,6,20,0.8)', border: '1px solid rgba(139,92,246,0.2)',
              fontSize: 11, color: '#94a3b8', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {checkout.pix_copy_paste || '...'}
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: copied
                  ? 'linear-gradient(135deg, #10b981, #34d399)'
                  : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                color: 'white', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.3s',
                boxShadow: copied
                  ? '0 4px 16px rgba(16,185,129,0.3)'
                  : '0 4px 16px rgba(139,92,246,0.3)',
              }}
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* Countdown */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '12px 0', marginBottom: 16,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: timeLeft > 0 ? '#f59e0b' : '#ef4444',
            animation: timeLeft > 0 ? 'blink 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 12, color: timeLeft > 0 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
            {timeLeft > 0
              ? `Aguardando pagamento... ${formatTime(timeLeft)}`
              : 'QR Code expirado — acesse a plataforma e pague pelo painel'}
          </span>
        </div>

        {/* Status bar */}
        <div style={{
          padding: '14px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#a78bfa',
            animation: 'spin 1s linear infinite', flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              Verificando pagamento automaticamente
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              A página será atualizada assim que o PIX for confirmado
            </div>
          </div>
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={skipToApp}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#475569', fontWeight: 600,
              textDecoration: 'underline', padding: '8px 12px',
            }}
          >
            Entrar na plataforma e pagar depois →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──
const wrapperStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
  padding: '24px 16px', position: 'relative',
}

const bgStyle = {
  position: 'fixed', inset: 0, zIndex: 0,
  background: 'radial-gradient(ellipse at 20% 30%, #0f0720 0%, #060612 40%, #030208 100%)',
  pointerEvents: 'none',
}

const cardStyle = {
  width: '100%', position: 'relative', zIndex: 10,
  padding: '32px 28px', borderRadius: 24,
  background: 'rgba(8,6,20,0.92)',
  border: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(28px)',
  boxShadow: '0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.05)',
}

const animations = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes moonPulse {
    0%,100% { box-shadow: 0 0 20px rgba(167,139,250,0.3); }
    50% { box-shadow: 0 0 40px rgba(167,139,250,0.6); }
  }
  @keyframes qrGlow {
    0%,100% { box-shadow: 0 0 20px rgba(139,92,246,0.2), 0 8px 32px rgba(0,0,0,0.4); }
    50% { box-shadow: 0 0 40px rgba(139,92,246,0.4), 0 12px 40px rgba(0,0,0,0.5); }
  }
  @keyframes successPulse {
    0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(16,185,129,0.3); }
    50% { transform: scale(1.05); box-shadow: 0 0 50px rgba(16,185,129,0.5); }
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`
