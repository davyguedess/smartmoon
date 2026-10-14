/**
 * CreditsBadge — Shows current credit balance in the app header.
 * Pulses red when balance < 100.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins } from 'lucide-react'
import { api } from '../../api'

export default function CreditsBadge() {
  const [balance, setBalance] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await api.billing.getQuota()
        if (mounted) setBalance(data?.credits?.balance ?? 0)
      } catch {
        // silently fail — badge just won't show
      }
    }
    load()

    // Refresh every 60s
    const interval = setInterval(load, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  if (balance === null) return null

  const low = balance < 100
  const critical = balance < 20

  return (
    <button
      onClick={() => navigate('/billing')}
      title={`${balance} créditos disponíveis`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        background: critical
          ? 'linear-gradient(135deg, #ef444430, #ef444415)'
          : low
            ? 'linear-gradient(135deg, #f59e0b30, #f59e0b15)'
            : 'linear-gradient(135deg, #10b98120, #6366f115)',
        border: `1px solid ${critical ? '#ef444440' : low ? '#f59e0b40' : '#10b98130'}`,
        borderRadius: 8, cursor: 'pointer',
        color: critical ? '#ef4444' : low ? '#f59e0b' : 'var(--nexus-green)',
        fontSize: 12, fontWeight: 700,
        animation: critical ? 'pulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.2s',
      }}
      onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
      onMouseOut={e => e.currentTarget.style.opacity = '1'}
    >
      <Coins size={13} />
      {balance.toLocaleString('pt-BR')} cr.
    </button>
  )
}
