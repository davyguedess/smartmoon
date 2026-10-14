/**
 * CRM Dashboard — Overview metrics, KPIs, sales funnel, and activity chart.
 */
import { useState, useEffect } from 'react'
import { api } from '../../api'
import './CRM.css'

export default function CRMDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.crm.metricsOverview(days),
      api.crm.metricsFunnel(days),
    ]).then(([m, f]) => {
      setMetrics(m)
      setFunnel(f)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="crm-page-loading">Carregando métricas...</div>

  const kpis = [
    { label: 'Contatos', value: metrics?.total_contacts || 0, icon: '👥', color: '#8b5cf6' },
    { label: 'Novos', value: metrics?.new_contacts || 0, icon: '🆕', color: '#10b981' },
    { label: 'Msgs Enviadas', value: metrics?.messages_sent || 0, icon: '📤', color: '#3b82f6' },
    { label: 'Msgs Recebidas', value: metrics?.messages_received || 0, icon: '📥', color: '#06b6d4' },
    { label: 'Vendas', value: metrics?.total_sales || 0, icon: '💰', color: '#f59e0b' },
    { label: 'Receita', value: `R$ ${(metrics?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: '💵', color: '#10b981' },
    { label: 'Agendamentos', value: metrics?.appointments || 0, icon: '📅', color: '#ec4899' },
    { label: 'Conversão', value: `${metrics?.conversion_rate || 0}%`, icon: '📈', color: '#f97316' },
  ]

  const funnelStages = funnel?.funnel || []
  const maxCount = Math.max(...funnelStages.map(s => s.count), 1)

  const activity = metrics?.daily_activity || []
  const maxActivity = Math.max(...activity.map(a => a.count), 1)

  return (
    <div className="crm-dashboard">
      <div className="crm-dash-header">
        <div>
          <h1>📊 CRM Dashboard</h1>
          <p className="crm-dash-subtitle">Métricas de desempenho do WhatsApp CRM</p>
        </div>
        <div className="crm-dash-filters">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              className={`crm-period-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="crm-kpi-grid">
        {kpis.map(kpi => (
          <div key={kpi.label} className="crm-kpi-card" style={{ '--kpi-color': kpi.color }}>
            <div className="crm-kpi-icon">{kpi.icon}</div>
            <div className="crm-kpi-value">{kpi.value}</div>
            <div className="crm-kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="crm-dash-grid">
        {/* Sales Funnel */}
        <div className="crm-dash-card">
          <h3>Funil de Vendas</h3>
          <div className="crm-funnel">
            {funnelStages.map((stage, i) => (
              <div key={stage.stage} className="crm-funnel-stage">
                <div className="crm-funnel-label">
                  <span>{stage.stage}</span>
                  <span className="crm-funnel-count">{stage.count} ({stage.percentage}%)</span>
                </div>
                <div className="crm-funnel-bar-bg">
                  <div
                    className="crm-funnel-bar"
                    style={{
                      width: `${(stage.count / maxCount) * 100}%`,
                      opacity: 1 - (i * 0.2),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Chart */}
        <div className="crm-dash-card">
          <h3>Atividade (14 dias)</h3>
          <div className="crm-chart">
            {activity.map(day => (
              <div key={day.date} className="crm-chart-bar-wrapper">
                <div
                  className="crm-chart-bar"
                  style={{ height: `${(day.count / maxActivity) * 100}%` }}
                  title={`${day.date}: ${day.count} interações`}
                />
                <div className="crm-chart-day">{day.date.split('-')[2]}</div>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="crm-chart-empty">Sem dados no período</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="crm-dash-row">
        <div className="crm-dash-stat-card">
          <div className="crm-dash-stat-icon">🧑‍💼</div>
          <div>
            <div className="crm-dash-stat-value">{metrics?.active_operators || 0}</div>
            <div className="crm-dash-stat-label">Operadores Ativos</div>
          </div>
        </div>
        <div className="crm-dash-stat-card">
          <div className="crm-dash-stat-icon">📢</div>
          <div>
            <div className="crm-dash-stat-value">{metrics?.broadcasts_sent || 0}</div>
            <div className="crm-dash-stat-label">Campanhas Enviadas</div>
          </div>
        </div>
      </div>
    </div>
  )
}
