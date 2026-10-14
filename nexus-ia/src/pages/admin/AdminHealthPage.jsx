/**
 * AdminHealthPage — Real-time health monitoring for Smart Moon services
 */
import React, { useState, useEffect } from 'react'
import {
  Activity, Database, Cpu, Globe, Wifi, RefreshCw,
  CheckCircle, AlertTriangle, XCircle, Clock, Server,
  MemoryStick, HardDrive, AlertCircle
} from 'lucide-react'
import { adminApi } from '../../api'

const STATUS_STYLES = {
  healthy: { icon: CheckCircle, color: 'var(--nexus-green)', bg: 'rgba(16,185,129,0.08)', label: 'Operacional' },
  degraded: { icon: AlertTriangle, color: 'var(--nexus-amber)', bg: 'rgba(245,158,11,0.08)', label: 'Degradado' },
  error: { icon: XCircle, color: 'var(--nexus-red)', bg: 'rgba(239,68,68,0.08)', label: 'Erro' },
  offline: { icon: XCircle, color: 'var(--nexus-red)', bg: 'rgba(239,68,68,0.08)', label: 'Offline' },
  unknown: { icon: Activity, color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: 'Desconhecido' },
}

function ServiceCard({ name, icon: Icon, color, data }) {
  const statusKey = data?.status || 'unknown'
  const s = STATUS_STYLES[statusKey] || STATUS_STYLES.unknown
  const StatusIcon = s.icon

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${data?.status === 'healthy' ? 'rgba(16,185,129,0.2)' : data?.status ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)'}`,
      borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.04 }}>
        <Icon size={80} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={17} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Serviço crítico</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: statusKey === 'healthy' ? `0 0 8px ${s.color}` : 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {data?.latency_ms != null && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>LATÊNCIA</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--nexus-cyan)' }}>{data.latency_ms}ms</div>
          </div>
        )}
        {data?.models != null && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>MODELOS</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--nexus-purple)' }}>{data.models}</div>
          </div>
        )}
        {data?.cpu_percent != null && (
          <>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>CPU</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: data.cpu_percent > 80 ? 'var(--nexus-red)' : 'var(--nexus-green)' }}>{data.cpu_percent}%</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>RAM</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: data.ram_percent > 85 ? 'var(--nexus-red)' : 'var(--nexus-amber)' }}>{data.ram_percent}%</div>
            </div>
          </>
        )}
        {data?.uptime_seconds != null && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', gridColumn: data.disk_percent != null ? '1' : '1/3' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>UPTIME</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {Math.floor(data.uptime_seconds / 3600)}h {Math.floor((data.uptime_seconds % 3600) / 60)}m
            </div>
          </div>
        )}
        {data?.disk_percent != null && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>DISCO</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: data.disk_percent > 80 ? 'var(--nexus-red)' : 'var(--text-primary)' }}>{data.disk_percent}%</div>
          </div>
        )}
        {data?.error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px', gridColumn: '1/3', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 10, color: 'var(--nexus-red)', marginBottom: 2, fontWeight: 700 }}>ERRO</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{data.error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminHealthPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastCheck, setLastCheck] = useState(new Date())

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.getHealth()
      setData(res)
      setLastCheck(new Date())
    } catch (e) {
      setData(null)
      setError(e?.message || 'Erro ao carregar status de saúde')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const overall = data?.overall || 'unknown'
  const overallStyle = STATUS_STYLES[overall] || STATUS_STYLES.unknown
  const OverallIcon = overallStyle.icon

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Health Monitor</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Status em tempo real de todos os serviços · atualiza a cada 15s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {lastCheck.toLocaleTimeString('pt-BR')}
          </span>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Verificar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16,
        }}>
          <AlertCircle size={14} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Overall Status Banner */}
      <div style={{
        background: overall === 'healthy' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${overall === 'healthy' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
        borderRadius: 14, padding: '18px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        marginBottom: 24,
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: overallStyle.color, boxShadow: `0 0 12px ${overallStyle.color}`, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: overallStyle.color }}>
            {overall === 'healthy' ? 'Todos os sistemas operacionais' : 'Degradação detectada — verificar logs'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Verificado em {lastCheck.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <ServiceCard name="PostgreSQL Database" icon={Database} color="var(--nexus-blue)" data={data?.services?.database} />
        <ServiceCard name="Redis Cache" icon={Server} color="var(--nexus-red)" data={data?.services?.redis} />
        <ServiceCard name="Ollama / LLM Engine" icon={Cpu} color="var(--nexus-purple)" data={data?.services?.ollama} />
        <ServiceCard name="Sistema & Recursos" icon={Activity} color="var(--nexus-green)" data={data?.services?.system} />
      </div>
    </div>
  )
}
