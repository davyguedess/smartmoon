/**
 * Smart Moon — Billing & Quota Page
 * Shows current plan, usage meters, limits comparison table and upgrade CTA.
 */
import { useState, useEffect } from 'react'
import {
  Zap, ShieldCheck, Globe, Activity, GitBranch, MessageSquare,
  Cpu, RefreshCw, ArrowUpRight, CheckCircle, Lock
} from 'lucide-react'
import { api } from '../../api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === -1) return '∞'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function pctColor(pct) {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return 'var(--nexus-green)'
}

// ── Quota Gauge ───────────────────────────────────────────────────────────────

function QuotaGauge({ label, icon: Icon, used, limit, pct, color }) {
  const isUnlimited = limit === -1
  const barColor = isUnlimited ? 'var(--nexus-cyan)' : pctColor(pct)

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, padding: '16px 18px',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={color} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        </div>
        <span style={{ fontSize: 11, color: isUnlimited ? 'var(--nexus-cyan)' : pctColor(pct), fontWeight: 700 }}>
          {isUnlimited ? '∞ Ilimitado' : `${pct}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 999, background: 'var(--bg-base)', overflow: 'hidden', marginBottom: 8,
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${isUnlimited ? 10 : Math.max(pct, 2)}%`,
          background: isUnlimited
            ? 'linear-gradient(90deg, var(--nexus-cyan), var(--nexus-violet))'
            : barColor,
          transition: 'width 0.8s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{fmt(used)} utilizados</span>
        <span>de {fmt(limit)} / mês</span>
      </div>
    </div>
  )
}

// ── Plan Badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan, color }) {
  const ICONS = { free: '🌱', starter: '🌙', pro: '⚡', enterprise: '🚀' }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 30,
      background: `${color}15`, border: `1px solid ${color}35`,
      color, fontSize: 13, fontWeight: 800,
    }}>
      <span>{ICONS[plan] || '🌱'}</span>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </div>
  )
}

// ── Plan Comparison Table ─────────────────────────────────────────────────────

// PLANS are loaded dynamically from /admin/plans/public — see Billing()

const PLAN_ICONS = { free: '🌱', starter: '🌙', pro: '⚡', enterprise: '🚀' }

function ComparisonTable({ currentPlan, plans }) {
  if (!plans || plans.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, 1fr)`, gap: 16 }}>
      {plans.map(plan => {
        const isCurrent = plan.name === currentPlan
        const color = plan.color || '#6b7280'
        const icon = PLAN_ICONS[plan.name] || '🌱'
        const priceLabel = plan.price === 0 ? 'Grátis' : `R$ ${plan.price}/mês`
        const isHighlighted = plan.name === 'pro'
        return (
          <div key={plan.id} style={{
            background: isHighlighted ? `${color}08` : 'var(--bg-card)',
            border: `1px solid ${isCurrent ? color : isHighlighted ? `${color}40` : 'var(--border-subtle)'}`,
            borderRadius: 14, padding: 20, position: 'relative',
            boxShadow: isCurrent ? `0 0 0 2px ${color}30` : 'none',
          }}>
            {isCurrent && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                background: color, color: 'white', fontSize: 10, fontWeight: 800,
                padding: '2px 12px', borderRadius: 30, whiteSpace: 'nowrap',
              }}>
                Plano Atual
              </div>
            )}
            {isHighlighted && !isCurrent && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                background: color, color: 'white', fontSize: 10, fontWeight: 800,
                padding: '2px 12px', borderRadius: 30, whiteSpace: 'nowrap',
              }}>
                Recomendado
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color }}>{plan.display_name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
                {priceLabel}
              </div>
              {plan.description && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  {plan.description}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                ['Fluxos', plan.max_flows === -1 ? '∞' : plan.max_flows],
                ['Agentes IA', plan.max_agents === -1 ? '∞' : plan.max_agents],
                ['Skills', plan.max_skills === -1 ? '∞' : plan.max_skills],
                ['Integrações', plan.max_integrations === -1 ? '∞' : plan.max_integrations],
                ['Perfis de Voz', plan.max_voice_profiles === 0 ? '—' : plan.max_voice_profiles === -1 ? '∞' : plan.max_voice_profiles],
                ['Campanhas', plan.max_campaigns === 0 ? '—' : plan.max_campaigns === -1 ? '∞' : plan.max_campaigns],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: value === '∞' ? 'var(--nexus-cyan)' : value === '—' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {plan.modules?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                {plan.modules.map(m => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                    <CheckCircle size={11} color={color} />
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {m.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isCurrent ? (
              <div style={{
                textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: `${color}15`, color,
                border: `1px solid ${color}30`,
              }}>
                ✓ Plano Ativo
              </div>
            ) : (
              <button style={{
                width: '100%', padding: '8px 0', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: isHighlighted
                  ? `linear-gradient(135deg, ${color}, #06b6d4)`
                  : 'var(--bg-base)',
                color: isHighlighted ? 'white' : 'var(--text-secondary)',
                boxShadow: isHighlighted ? `0 4px 14px ${color}40` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {plan.name === 'enterprise' ? 'Falar com Vendas' : 'Fazer Upgrade'}
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Billing() {
  const [quota, setQuota] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [quotaData, plansData] = await Promise.allSettled([
        api.get('/billing/quota').catch(() => api.request('/billing/quota')),
        fetch('/admin/plans/public', { credentials: 'include' })
          .then(r => r.json())
          .catch(() => ({ plans: [] })),
      ])
      if (quotaData.status === 'fulfilled' && quotaData.value) {
        setQuota(quotaData.value)
      } else {
        setError(quotaData.reason?.message || 'Não foi possível carregar os dados de plano.')
      }
      if (plansData.status === 'fulfilled') setPlans(plansData.value?.plans || [])
    } catch (e) {
      setError(e.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Carregando informações de plano...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: 'var(--nexus-red)', fontSize: 14 }}>⚠️ {error}</div>
        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 12 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!quota) return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nenhum dado de plano disponível.</div>
      <button onClick={load} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 12 }}>
        Tentar novamente
      </button>
    </div>
  )

  const planColor = quota?.plan_color || '#6b7280'
  const pct = quota?.percentages || {}
  const usage = quota?.usage || {}
  const limits = quota?.limits || {}

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 28px' }}>

      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 6 }}>Plano & Consumo</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            <PlanBadge plan={quota?.plan || 'free'} color={planColor} />
            <span>·</span>
            <span>
              Período: {quota?.period?.month?.toString().padStart(2, '0') ?? '--'}/{quota?.period?.year ?? '--'}
            </span>
          </div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          borderRadius: 8, border: '1px solid var(--border-default)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={12} />
          Atualizar
        </button>
      </div>

      {/* ─── Over-quota warnings ─── */}
      {Object.entries(quota?.over_quota || {}).filter(([, v]) => v).map(([dim]) => (
        <div key={dim} style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠️ Limite de <strong>{dim}</strong> atingido. Faça upgrade para continuar.
        </div>
      ))}

      {/* ─── Usage Gauges ─── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          Consumo do Mês
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          <QuotaGauge
            label="Execuções" icon={Activity}
            used={usage.executions} limit={limits.executions_per_month}
            pct={pct.executions} color="var(--nexus-green)"
          />
          <QuotaGauge
            label="Tokens de IA" icon={MessageSquare}
            used={usage.ai_tokens} limit={limits.ai_tokens_per_month}
            pct={pct.ai_tokens} color="var(--nexus-violet)"
          />
          <QuotaGauge
            label="Fluxos Ativos" icon={GitBranch}
            used={usage.flows} limit={limits.flows_max}
            pct={pct.flows} color="var(--nexus-blue)"
          />
          <QuotaGauge
            label="Chamadas de API" icon={Cpu}
            used={usage.api_calls} limit={limits.api_calls_per_month}
            pct={pct.api_calls} color="var(--nexus-amber)"
          />
        </div>
      </div>

      {/* ─── Features ─── */}
      {(quota?.features?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            Funcionalidades Incluídas
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(quota?.features || []).map(f => (
              <div key={f} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: `${planColor}12`, border: `1px solid ${planColor}25`, color: planColor,
              }}>
                <CheckCircle size={10} />
                {f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Plan comparison ─── */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          Comparar Planos
        </h2>
        {plans.length > 0
          ? <ComparisonTable currentPlan={quota?.plan || 'free'} plans={plans} />
          : <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando planos...</div>
        }
      </div>

    </div>
  )
}
