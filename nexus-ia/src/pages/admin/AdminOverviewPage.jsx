/**
 * AdminOverviewPage — Executive dashboard for Smart Moon platform
 * ALL data from real backend API — zero mock/fictional data
 */
import React, { useState, useEffect } from 'react'
import {
  TrendingUp, Users, Cpu, GitBranch, Plug2, Volume2,
  Target, Landmark, Activity, AlertTriangle, ArrowUpRight,
  Zap, ShoppingBag, BarChart3, Clock, RefreshCw, AlertCircle
} from 'lucide-react'
import { adminApi } from '../../api'

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = '--nexus-cyan', trend, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.2s ease', cursor: 'default',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `var(${color})`
        e.currentTarget.style.boxShadow = `0 0 20px rgba(99,102,241,0.15)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05 }}>
        <Icon size={80} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `rgba(99,102,241,0.12)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={`var(${color})`} />
        </div>
        {trend != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: trend >= 0 ? 'var(--nexus-green)' : 'var(--nexus-red)',
          }}>
            <ArrowUpRight size={11} style={{ transform: trend < 0 ? 'rotate(90deg)' : 'none' }} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {loading ? '—' : (value ?? 0)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 10, color: `var(${color})`, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Module Usage Bar ──────────────────────────────────────
function UsageBar({ label, value, max, color = '#6366f1' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 4 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: color, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// ── Time formatting ──────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

// ── Error Banner ────────────────────────────────────────
function ErrorBanner({ error, onRetry }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 18px', borderRadius: 12,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      marginBottom: 16,
    }}>
      <AlertCircle size={18} color="#ef4444" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Erro ao carregar dados</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{error}</div>
      </div>
      <button onClick={onRetry} style={{
        padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)',
        background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>Tentar novamente</button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
const AVATARS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']

export default function AdminOverviewPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Also load sales and audit for bottom section
  const [salesData, setSalesData] = useState(null)
  const [auditData, setAuditData] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [overview, sales, audit] = await Promise.all([
        adminApi.overview(),
        adminApi.getSales({ page: 1 }).catch(() => null),
        adminApi.getAuditTrail({ page: 1 }).catch(() => null),
      ])
      setData(overview)
      setSalesData(sales)
      setAuditData(audit)
      setLastUpdated(new Date())
    } catch (e) {
      const msg = e?.message || String(e)
      if (msg.includes('401') || msg.includes('403')) {
        setError('Sem permissão de superadmin. Verifique suas credenciais.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60000) // refresh every 60s
    return () => clearInterval(t)
  }, [])

  const m = data?.metrics || {}
  const month = data?.month || {}
  const topCompanies = data?.top_companies_by_usage || []
  const recentAudits = data?.recent_audits || []
  const salesRecords = salesData?.records || []
  const monthSummary = salesData?.month_summary || {}
  const auditEvents = auditData?.events || []

  // Compute module distribution from real metrics
  const totalModuleSum = (m.active_agents || 0) + (m.active_flows || 0) + (m.total_campaigns || 0) + (m.active_integrations || 0) + (m.total_skills || 0) + (m.voice_profiles || 0)

  return (
    <div style={{ padding: 24, maxWidth: 1600 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Visão Geral da Plataforma
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Dashboard executivo · Dados em tempo real do banco de dados
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {lastUpdated.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', transition: 'all 0.15s ease',
          }}>
            <RefreshCw size={12} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <ErrorBanner error={error} onRetry={load} />}

      {/* KPI Row 1 — Core metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
        <KPICard label="Total de Usuários" value={m.total_users} icon={Users} color="--nexus-blue" loading={loading} />
        <KPICard label="Empresas" value={m.total_companies} icon={ShoppingBag} color="--nexus-cyan" loading={loading} />
        <KPICard label="Agentes Ativos" value={m.active_agents} sub={`de ${m.total_agents ?? 0} total`} icon={Cpu} color="--nexus-violet" loading={loading} />
        <KPICard label="Fluxos Publicados" value={m.active_flows} sub={`de ${m.total_flows ?? 0} total`} icon={GitBranch} color="--nexus-green" loading={loading} />
        <KPICard label="Integrações Online" value={m.active_integrations} sub={`de ${m.total_integrations ?? 0} total`} icon={Plug2} color="--nexus-amber" loading={loading} />
      </div>

      {/* KPI Row 2 — Module metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard label="Skills" value={m.total_skills} icon={Zap} color="--nexus-purple" loading={loading} />
        <KPICard label="Voice Profiles" value={m.voice_profiles} icon={Volume2} color="--nexus-cyan" loading={loading} />
        <KPICard label="Campanhas" value={m.total_campaigns} sub={`${m.active_campaigns ?? 0} ativas`} icon={Target} color="--nexus-pink" loading={loading} />
        <KPICard label="Execuções/Mês" value={(month.executions || 0).toLocaleString('pt-BR')} icon={Activity} color="--nexus-green" loading={loading} />
        <KPICard label="Custo IA/Mês" value={`$${(month.cost_usd || 0).toFixed(2)}`} sub={`${((month.tokens || 0) / 1000).toFixed(0)}k tokens`} icon={BarChart3} color="--nexus-red" loading={loading} />
      </div>

      {/* Main row: Module Usage + Recent Audit + Top Companies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px 300px', gap: 16, marginBottom: 16 }}>

        {/* Module Usage — real counts from metrics */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Distribuição por Módulo</div>
          <UsageBar label="Agentes" value={m.total_agents || 0} max={totalModuleSum || 1} color="#6366f1" />
          <UsageBar label="Fluxos" value={m.total_flows || 0} max={totalModuleSum || 1} color="#10b981" />
          <UsageBar label="Campanhas" value={m.total_campaigns || 0} max={totalModuleSum || 1} color="#ec4899" />
          <UsageBar label="Skills" value={m.total_skills || 0} max={totalModuleSum || 1} color="#f59e0b" />
          <UsageBar label="Integrações" value={m.total_integrations || 0} max={totalModuleSum || 1} color="#3b82f6" />
          <UsageBar label="Voz" value={m.voice_profiles || 0} max={totalModuleSum || 1} color="#00d4ff" />

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Custo Mês</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>${(month.cost_usd || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Execuções</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{(month.executions || 0).toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Tokens</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{((month.tokens || 0) / 1000).toFixed(1)}k</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Companies by Usage */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top Empresas por Uso</div>
          {topCompanies.length === 0 && !loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhum dado de uso neste mês
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topCompanies.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 9,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: AVATARS[i % AVATARS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: 'white',
                }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.plan}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{c.executions}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>exec</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Activity — from real audit_logs */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Atividade Recente</div>
          {recentAudits.length === 0 && !loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhum evento de auditoria ainda
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentAudits.slice(0, 8).map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 9,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: item.action?.includes('delete') ? '#ef4444' : item.action?.includes('create') ? '#10b981' : '#6366f1',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.action || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {item.resource || '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {timeAgo(item.ts)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Sales from real usage_logs + Server uptime */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

        {/* Sales Table — real data from usage_logs */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Uso por Empresa (mês)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{salesRecords.length} registros</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Empresa', 'Plano', 'Período', 'Execuções', 'Tokens', 'Custo USD'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesRecords.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  {loading ? 'Carregando...' : 'Nenhum registro de uso encontrado'}
                </td></tr>
              ) : salesRecords.slice(0, 8).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{r.company_name}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: 'rgba(99,102,241,0.12)', color: '#6366f1', textTransform: 'capitalize',
                    }}>{r.plan || 'free'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.month}/{r.year}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{(r.executions || 0).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{((r.tokens || 0) / 1000).toFixed(1)}k</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: r.cost_usd > 0 ? 'var(--nexus-green)' : 'var(--text-muted)' }}>
                    ${(r.cost_usd || 0).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary + Uptime */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 14, padding: 18, flex: 1,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)' }}>RESUMO DO MÊS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Custo Total IA</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nexus-cyan)' }}>
                  ${(monthSummary.total_cost_usd || month.cost_usd || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Execuções</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {(monthSummary.total_executions || month.executions || 0).toLocaleString('pt-BR')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tokens Consumidos</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {((monthSummary.total_tokens || month.tokens || 0) / 1000).toFixed(1)}k
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 14, padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--nexus-green)', boxShadow: '0 0 8px var(--nexus-green)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>SERVER UPTIME</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>
              {data?.server_uptime_seconds ? `${Math.floor(data.server_uptime_seconds / 3600)}h ${Math.floor((data.server_uptime_seconds % 3600) / 60)}m` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              API Backend Online
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
