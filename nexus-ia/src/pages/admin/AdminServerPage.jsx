/**
 * AdminServerPage — Tab de métricas do servidor
 * Extraído de AdminServer.jsx para modularização
 */
import { useState, useEffect, useCallback } from 'react'
import { Cpu, HardDrive, Clock, MemoryStick, Monitor, Globe, Activity } from 'lucide-react'
import { api } from '../../api'
import { StatCard, ProgressBar } from '../../components/cards'
import { AdminSectionHeader } from '../../components/admin'
import { formatUptime } from '../../utils'

export default function AdminServerPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMetrics(await api.adminServerMetrics())
    } catch (e) {
      console.error('Failed to load metrics:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !metrics) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⟳</span>
        Carregando métricas...
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <AdminSectionHeader
        title="🖥️ Servidor"
        subtitle={`${metrics.hostname} · ${metrics.os} · ${metrics.arch}`}
        onRefresh={load}
      />

      {/* Stats cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
        <StatCard icon={Cpu}        label="CPU"    value={`${metrics.cpu_percent}%`} sub={`${metrics.cpu_count} cores`}                  color="#8b5cf6" />
        <StatCard icon={MemoryStick} label="RAM"   value={`${metrics.ram_percent}%`} sub={`${metrics.ram_used_gb} / ${metrics.ram_total_gb} GB`} color="#3b82f6" />
        <StatCard icon={HardDrive}  label="Disco"  value={`${metrics.disk_percent}%`} sub={`${metrics.disk_used_gb} / ${metrics.disk_total_gb} GB`} color="#10b981" />
        <StatCard icon={Clock}      label="Uptime" value={formatUptime(metrics.uptime_seconds)} sub="Backend ativo"                       color="#f59e0b" />
      </div>

      {/* Progress bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'CPU',   value: metrics.cpu_percent,  color: '#8b5cf6' },
          { label: 'RAM',   value: metrics.ram_percent,  color: '#3b82f6' },
          { label: 'Disco', value: metrics.disk_percent, color: '#10b981' },
        ].map(b => (
          <div key={b.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{b.label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: b.color }}>{b.value}%</span>
            </div>
            <ProgressBar value={b.value} color={b.color} />
          </div>
        ))}
      </div>

      {/* Services */}
      <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--text-secondary)' }}>⚙️ Serviços Conectados</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Python',     value: metrics.python,       icon: '🐍' },
          { label: 'PostgreSQL', value: metrics.database_url, icon: '🐘' },
          { label: 'Ollama',     value: metrics.ollama_url,   icon: '🤖' },
          { label: 'Redis',      value: metrics.redis_url,    icon: '🔴' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
