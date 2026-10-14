/**
 * AdminSalesPage — Smart Moon Revenue & Subscription Dashboard
 * Real data from /admin/sales — subscriptions, transactions, KPIs
 */
import React, { useState, useEffect } from 'react'
import {
  DollarSign, TrendingUp, Users, ShoppingCart, RefreshCw,
  AlertCircle, CreditCard, ArrowUpRight, ArrowDownRight,
  Clock, CheckCircle, XCircle, Activity, BarChart3, Eye
} from 'lucide-react'
import { adminApi } from '../../api'

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = '#6366f1', trend }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12, padding: '18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.2s ease', cursor: 'default',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.boxShadow = `0 0 20px ${color}25`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ position: 'absolute', top: -12, right: -12, opacity: 0.06 }}>
        <Icon size={80} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={color} />
        </div>
        {trend != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: trend >= 0 ? '#22c55e' : '#ef4444',
          }}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    paid: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Pago', icon: CheckCircle },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pendente', icon: Clock },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Falhou', icon: XCircle },
    refunded: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Reembolso', icon: ArrowDownRight },
    active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Ativa', icon: CheckCircle },
    cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Cancelada', icon: XCircle },
    expired: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Expirada', icon: Clock },
  }
  const s = map[status] || { bg: 'rgba(100,100,140,0.1)', color: '#64748b', label: status || '—', icon: Activity }
  const SIcon = s.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 8,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
    }}>
      <SIcon size={11} /> {s.label}
    </span>
  )
}

// ── Distribution Bar ──────────────────────────────────────
function DistributionBar({ items }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma assinatura ativa</div>
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            width: `${(item.count / total) * 100}%`,
            background: item.color || '#6366f1',
            transition: 'width 0.5s ease',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color || '#6366f1' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {item.plan}: <strong style={{ color: 'var(--text-primary)' }}>{item.count}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function AdminSalesPage() {
  const [summary, setSummary] = useState({})
  const [records, setRecords] = useState([])
  const [recentSubs, setRecentSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.getSales({ page })
      setSummary(res.month_summary || {})
      setRecords(res.records || [])
      setRecentSubs(res.recent_subscriptions || [])
      setTotalRecords(res.total_records || 0)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar vendas')
      setSummary({})
      setRecords([])
      setRecentSubs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  const fmtBRL = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const fmtDate = (iso) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCart size={22} color="#22c55e" /> Vendas & Assinaturas
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Receita, assinaturas ativas e transações da plataforma
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <KPICard
          icon={DollarSign} label="MRR" color="#22c55e"
          value={fmtBRL(summary.mrr)} sub="Receita Mensal Recorrente"
        />
        <KPICard
          icon={TrendingUp} label="Receita do Mês" color="#8b5cf6"
          value={fmtBRL(summary.month_revenue)}
          sub={`Total: ${fmtBRL(summary.total_revenue)}`}
        />
        <KPICard
          icon={Users} label="Assinaturas Ativas" color="#06b6d4"
          value={summary.active_subscriptions ?? 0}
          sub={`Total: ${summary.total_subscriptions ?? 0}`}
        />
        <KPICard
          icon={ArrowUpRight} label="Novas no Mês" color="#f59e0b"
          value={summary.new_this_month ?? 0}
        />
        <KPICard
          icon={ArrowDownRight} label="Cancelamentos" color="#ef4444"
          value={summary.cancelled_this_month ?? 0}
          sub={`Churn: ${summary.churn_rate ?? 0}%`}
        />
      </div>

      {/* Two columns: Distribution + Recent Subscriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Plan Distribution */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '18px',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={14} color="#8b5cf6" /> Distribuição por Plano
          </h3>
          <DistributionBar items={summary.plan_distribution || []} />
        </div>

        {/* Recent Subscriptions */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '18px',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CreditCard size={14} color="#06b6d4" /> Assinaturas Recentes
          </h3>
          {recentSubs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>
              Nenhuma assinatura registrada
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {recentSubs.map((sub, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: i < recentSubs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sub.company_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {sub.plan_name} · {fmtDate(sub.started_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                      {fmtBRL(sub.price)}
                    </span>
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={14} color="#22c55e" /> Transações
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {totalRecords} transação{totalRecords !== 1 ? 'ões' : ''}
          </span>
        </div>

        {records.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? '⏳ Carregando...' : 'Nenhuma transação registrada'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['ID', 'Empresa', 'Plano', 'Valor', 'Método', 'Status', 'Data'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', fontSize: 10, fontWeight: 700,
                      color: 'var(--text-muted)', textAlign: 'left',
                      letterSpacing: 0.5, textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, i) => (
                  <tr key={rec.id || i} style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      #{rec.id}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {rec.company_name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {rec.plan_name ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: `${rec.plan_color || '#6366f1'}18`,
                          color: rec.plan_color || '#6366f1',
                        }}>
                          {rec.plan_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                      {fmtBRL(rec.amount)}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {rec.payment_method || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <StatusBadge status={rec.status} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtDate(rec.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalRecords > 20 && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', justifyContent: 'center', gap: 8,
          }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >← Anterior</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
              Página {page}
            </span>
            <button
              disabled={page * 20 >= totalRecords}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                color: page * 20 >= totalRecords ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: page * 20 >= totalRecords ? 'not-allowed' : 'pointer',
              }}
            >Próxima →</button>
          </div>
        )}
      </div>
    </div>
  )
}
