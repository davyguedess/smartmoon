import { useState, useEffect, useRef } from 'react'
import { api } from '../../api'
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronRight, Zap } from 'lucide-react'

const STATUS_CONFIG = {
  success: { color: 'var(--nexus-green)', icon: CheckCircle, label: 'Concluída' },
  failed: { color: 'var(--nexus-red)', icon: XCircle, label: 'Falhou' },
  running: { color: 'var(--nexus-blue)', icon: Activity, label: 'Executando' },
  queued: { color: 'var(--nexus-amber)', icon: Clock, label: 'Na fila' },
  waiting: { color: 'var(--nexus-amber)', icon: Clock, label: 'Aguardando' },
  canceled: { color: 'var(--text-muted)', icon: XCircle, label: 'Cancelada' },
}

function ExecutionRow({ exec }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const { color, icon: Icon, label } = STATUS_CONFIG[exec.status] || STATUS_CONFIG.queued

  const loadDetail = async () => {
    if (!open && !detail) {
      try {
        const d = await api.getExecutionLogs(exec.id)
        setDetail(d)
      } catch { setDetail({ error: 'Erro ao carregar logs' }) }
    }
    setOpen(o => !o)
  }

  return (
    <>
      <tr onClick={loadDetail} style={{ cursor: 'pointer' }}
        onMouseEnter={e => Array.from(e.currentTarget.querySelectorAll('td')).forEach(td => td.style.background = 'var(--bg-card-hover)')}
        onMouseLeave={e => Array.from(e.currentTarget.querySelectorAll('td')).forEach(td => td.style.background = 'var(--bg-card)')}
      >
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px 0 0 10px', borderLeft: `3px solid ${color}`, transition: 'background 0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {open ? <ChevronDown size={12} color="var(--text-muted)" /> : <ChevronRight size={12} color="var(--text-muted)" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>#{exec.id}</span>
          </div>
        </td>
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', fontSize: 12, transition: 'background 0.1s' }}>
          Flow #{exec.flow_id}
        </td>
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', transition: 'background 0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={13} color={color} />
            <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
          </div>
        </td>
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', fontSize: 11, color: 'var(--text-muted)', transition: 'background 0.1s' }}>
          {exec.trigger_type || 'manual'}
        </td>
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', fontSize: 11, color: 'var(--text-muted)', transition: 'background 0.1s' }}>
          {new Date(exec.created_at).toLocaleString('pt-BR')}
        </td>
        <td style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '0 10px 10px 0', transition: 'background 0.1s' }}>
          {exec.finished_at && exec.started_at ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {((new Date(exec.finished_at) - new Date(exec.started_at)) / 1000).toFixed(1)}s
            </span>
          ) : exec.status === 'running' ? (
            <span style={{ fontSize: 10, color: 'var(--nexus-blue)', animation: 'pulse 1s infinite' }}>Em curso...</span>
          ) : '—'}
        </td>
      </tr>

      {open && detail && (
        <tr>
          <td colSpan={6} style={{ padding: '0 12px 12px 44px' }}>
            <div style={{
              background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              {detail.error ? (
                <span style={{ color: 'var(--nexus-red)', fontSize: 12 }}>{detail.error}</span>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.8 }}>
                    STEPS DE EXECUÇÃO ({detail.steps?.length || 0})
                  </div>
                  {detail.steps?.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum step registrado</span>
                  ) : detail.steps?.map((s, i) => {
                    const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.queued
                    const SIcon = sc.icon
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '7px 0', borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <SIcon size={12} color={sc.color} style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{s.node_type}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{s.node_id}</span>
                            {s.duration_ms && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.duration_ms}ms</span>}
                          </div>
                          {s.output_json && Object.keys(s.output_json).length > 0 && (
                            <pre style={{ fontSize: 10, margin: '4px 0 0', color: 'var(--nexus-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                              {JSON.stringify(s.output_json, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Executions() {
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await api.listExecutions(100)
      setExecutions(data || [])
    } catch { setExecutions([]) }
    setLoading(false)
  }

  useEffect(() => {
    // Initial load via REST (fast)
    refresh()

    // WebSocket for real-time updates
    let ws = null
    let retryDelay = 1000
    let retryTimer = null
    let alive = true

    const connect = async () => {
      if (!alive) return
      let token = ''
      try {
        const res = await fetch('/auth/ws-token', { credentials: 'include' })
        if (res.ok) { const d = await res.json(); token = d.token || '' }
      } catch {}
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${wsProto}//${window.location.host}/ws/executions?token=${token}`)

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'execution_update' && Array.isArray(msg.data)) {
            setExecutions(msg.data)
            setLoading(false)
          }
        } catch {}
      }

      ws.onopen = () => { retryDelay = 1000 }

      ws.onclose = () => {
        if (!alive) return
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000)
          connect()
        }, retryDelay)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      alive = false
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [])

  const filtered = executions.filter(e => filter === 'all' || e.status === filter)
  const counts = { all: executions.length, ...Object.fromEntries(['success', 'failed', 'running', 'waiting'].map(s => [s, executions.filter(e => e.status === s).length])) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Execuções</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '2px 0 0' }}>
            Monitoramento em tempo real via WebSocket
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'running', 'success', 'failed', 'waiting'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-default)',
              background: filter === s ? (STATUS_CONFIG[s]?.color || 'var(--nexus-cyan)') + '18' : 'var(--bg-card)',
              color: filter === s ? (STATUS_CONFIG[s]?.color || 'var(--nexus-cyan)') : 'var(--text-muted)',
            }}>
              {{ all: 'Todas', running: 'Rodando', success: 'OK', failed: 'Falha', waiting: 'Aguardando' }[s]}
              <span style={{ marginLeft: 5, opacity: 0.7 }}>{counts[s] || 0}</span>
            </button>
          ))}
        </div>
        <button onClick={refresh} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          borderRadius: 8, border: '1px solid var(--border-default)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 60 }}>
            <Zap size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Nenhuma execução encontrada</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Clique em "Testar" em um fluxo para ver as execuções aqui</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead>
              <tr>
                {['ID', 'Fluxo', 'Status', 'Trigger', 'Iniciada em', 'Duração'].map(h => (
                  <th key={h} style={{
                    padding: '6px 12px', textAlign: 'left', fontSize: 10,
                    fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => <ExecutionRow key={e.id} exec={e} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
