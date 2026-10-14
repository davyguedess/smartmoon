import React, { useState, useEffect } from 'react'
import { useParams, NavLink } from 'react-router-dom'
import { api } from '../../api'
import {
  BarChart3, TrendingUp, Clock, Target, AlertTriangle,
  ChevronLeft, Download, RefreshCw, Zap, PieChart,
  CheckCircle2, AlertCircle, Loader2, Activity
} from 'lucide-react'

const ACCENT = {
  indigo: '#6366f1', emerald: '#10b981', blue: '#3b82f6',
  rose: '#ef4444', amber: '#f59e0b', violet: '#8b5cf6', cyan: '#06b6d4',
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: `1px solid ${color}18`,
      borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.07, filter: 'blur(20px)', transform: 'translate(20px,-20px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#475569' }}>{label}</span>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#64748b', width: 88, textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1, height: 10, borderRadius: 100, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 100, width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60`, transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Section({ title, icon: Icon, iconColor, children, span2 }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.1)',
      borderRadius: 20, padding: '24px', gridColumn: span2 ? 'span 2' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${iconColor}14`, border: `1px solid ${iconColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 15, height: 15, color: iconColor }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function ProjectAnalytics() {
  const { id } = useParams()
  const [analytics, setAnalytics] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('last_7d')
  const [exporting, setExporting] = useState(false)

  useEffect(() => { fetchAll() }, [id, dateRange])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [a, m] = await Promise.all([
        api.get(`/projects/${id}/analytics`),
        api.get(`/projects/${id}/metrics?date_range=${dateRange}`),
      ])
      setAnalytics(a); setMetrics(m)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/projects/${id}/export/pdf`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `relatorio_projeto_${id}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao exportar PDF') }
    finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <Loader2 style={{ width: 36, height: 36, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>Carregando analytics...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const s = analytics?.summary || {}
  const v = analytics?.velocity || {}
  const bp = analytics?.by_priority || {}
  const totals = metrics?.totals || {}

  const maxPriority = Math.max(bp.critical || 0, bp.high || 0, bp.normal || 0, 1)
  const total = s.total || 1

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 28, scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <NavLink to={`/projects/${id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)', textDecoration: 'none', marginBottom: 18, transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(148,163,184,0.9)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.5)'}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> Voltar ao Dashboard
          </NavLink>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 style={{ width: 22, height: 22, color: '#818cf8' }} />
            </div>
            Analytics do Projeto
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            style={{ padding: '9px 14px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 11, color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last_7d">Últimos 7 dias</option>
            <option value="last_14d">Últimos 14 dias</option>
            <option value="last_30d">Últimos 30 dias</option>
          </select>

          <button onClick={fetchAll}
            style={{ padding: '9px 14px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 11, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)'}>
            <RefreshCw style={{ width: 15, height: 15 }} />
          </button>

          <button onClick={handleExportPdf} disabled={exporting}
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 11, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', opacity: exporting ? 0.7 : 1 }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.55)' }}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)'}>
            <Download style={{ width: 14, height: 14 }} />
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
        <StatCard label="Progresso" value={`${s.progress_percent || 0}%`} icon={Target} color={ACCENT.indigo} sub={`${s.completed || 0} de ${s.total || 0} tarefas`} />
        <StatCard label="Concluídas" value={s.completed || 0} icon={CheckCircle2} color={ACCENT.emerald} sub="tarefas finalizadas" />
        <StatCard label="Em Andamento" value={s.in_progress || 0} icon={Zap} color={ACCENT.blue} sub="em execução agora" />
        <StatCard label="Atrasadas" value={s.overdue || 0} icon={AlertCircle} color={s.overdue > 0 ? ACCENT.rose : ACCENT.emerald} sub={s.overdue > 0 ? 'requer atenção' : 'tudo em dia ✓'} />
        <StatCard label="Velocidade" value={v.avg_days_per_task ? `${v.avg_days_per_task}d` : '—'} icon={Clock} color={ACCENT.amber} sub="média por tarefa" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>

        {/* Distribution */}
        <Section title="Distribuição de Tarefas" icon={PieChart} iconColor={ACCENT.indigo}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Bar label="Concluídas" value={s.completed || 0} max={total} color="#10b981" />
            <Bar label="Em andamento" value={s.in_progress || 0} max={total} color="#3b82f6" />
            <Bar label="Pendentes" value={s.pending || 0} max={total} color="#6366f1" />
            <Bar label="Bloqueadas" value={s.blocked || 0} max={total} color="#f59e0b" />
            <Bar label="Atrasadas" value={s.overdue || 0} max={total} color="#ef4444" />
          </div>

          {/* Progress ring (CSS only) */}
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="10" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="#6366f1" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - (s.progress_percent || 0) / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#818cf8' }}>
                {s.progress_percent || 0}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Conclusão Geral</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{s.completed || 0} de {s.total || 0} tarefas concluídas</div>
              {v.estimated_days_remaining != null && (
                <div style={{ marginTop: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: '#818cf8', fontWeight: 700 }}>
                  ~{v.estimated_days_remaining} dias p/ conclusão
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Priority */}
        <Section title="Tarefas por Prioridade" icon={AlertTriangle} iconColor={ACCENT.amber}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Bar label="Crítica" value={bp.critical || 0} max={maxPriority} color="#ef4444" />
            <Bar label="Alta" value={bp.high || 0} max={maxPriority} color="#f59e0b" />
            <Bar label="Normal" value={bp.normal || 0} max={maxPriority} color="#6366f1" />
          </div>

          {/* Velocity box */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#475569' }}>Velocidade da Equipe</div>
            {[
              { label: 'Tarefas concluídas / semana', value: v.tasks_per_week || '—', color: ACCENT.emerald },
              { label: 'Média de dias por tarefa', value: v.avg_days_per_task ? `${v.avg_days_per_task} dias` : '—', color: ACCENT.indigo },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.07)' }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Marketing Metrics — only shown when real integrations exist */}
        {metrics && metrics.success && !metrics.not_configured && (
          <Section title="Métricas de Tráfego Pago" icon={TrendingUp} iconColor={ACCENT.emerald} span2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Investimento Total', value: `R$ ${(totals.total_spend || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: ACCENT.rose },
                { label: 'Cliques Totais', value: (totals.total_clicks || 0).toLocaleString('pt-BR'), color: ACCENT.blue },
                { label: 'Impressões', value: (totals.total_impressions || 0).toLocaleString('pt-BR'), color: ACCENT.violet },
                { label: 'Leads', value: totals.total_leads || 0, color: ACCENT.emerald },
              ].map((m, i) => (
                <div key={i} style={{ padding: '16px', borderRadius: 14, background: 'rgba(15,23,42,0.5)', border: `1px solid ${m.color}14`, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
            {metrics.platforms && Object.keys(metrics.platforms).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                {Object.entries(metrics.platforms).map(([key, p]) => (
                  <div key={key} style={{ padding: '18px', borderRadius: 14, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>
                        {key === 'meta_ads' ? '📘 Meta Ads' : '🔍 Google Ads'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
                      {[['Cliques', (p.metrics?.clicks || 0).toLocaleString('pt-BR'), ACCENT.blue],
                        ['CPC', `R$ ${(p.metrics?.cpc || 0).toFixed(2)}`, ACCENT.amber],
                        ['Gasto', `R$ ${(p.metrics?.spend || 0).toFixed(2)}`, ACCENT.rose]
                      ].map(([l, v, c]) => (
                        <div key={l}>
                          <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, fontWeight: 600 }}>{l}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Completion Timeline */}
        {analytics?.completion_timeline?.length > 0 && (
          <Section title="Timeline de Conclusões" icon={Activity} iconColor={ACCENT.cyan} span2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
              {analytics.completion_timeline.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.07)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                  </span>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.6)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#94a3b8', flex: 1 }}>{item.title}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Empty state */}
        {!analytics?.completion_timeline?.length && !metrics && s.total === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '60px 20px', background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(99,102,241,0.15)', borderRadius: 20 }}>
            <BarChart3 style={{ width: 48, height: 48, color: '#1e293b', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Sem dados suficientes</div>
            <p style={{ fontSize: 14, color: '#334155' }}>Adicione tarefas e marque conclusões para ver as métricas aqui.</p>
          </div>
        )}
      </div>
    </div>
  )
}
