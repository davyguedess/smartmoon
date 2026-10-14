import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Activity,
  Shield, MessageSquare, Zap, Building2, Phone, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR')
const StatusDot = ({ status }) => (
  <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: status === 'connected' ? '#10b981' : status === 'pending' ? '#f59e0b' : '#6b7280',
    boxShadow: status === 'connected' ? '0 0 6px #10b981' : 'none',
  }} />
)
const Pill = ({ label, color = '#a78bfa', bg }) => (
  <span style={{
    padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700,
    color, background: bg || color + '18', letterSpacing: 0.5,
    textTransform: 'uppercase',
  }}>{label}</span>
)
const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: '18px 20px', ...style,
  }}>{children}</div>
)
const KPI = ({ label, value, sub, color = '#a78bfa', icon: Icon, warn }) => (
  <Card style={{ flex: 1, minWidth: 140 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: (warn ? '#ef4444' : color) + '18',
      }}>
        {Icon && <Icon size={15} color={warn ? '#ef4444' : color} />}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: warn ? '#ef4444' : color }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </Card>
)

// ── SmartMoon Instance Row ───────────────────────────────────────────────────
function InstanceRow({ inst }) {
  const [open, setOpen] = useState(false)
  const isHigh = inst.messages_1h > 100
  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${isHigh ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
      background: isHigh ? 'rgba(239,68,68,0.04)' : 'var(--bg-base)',
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
      >
        <StatusDot status={inst.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              🌙 {inst.label || inst.instance_id}
            </span>
            {inst.display_phone && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{inst.display_phone}</span>
            )}
            <Pill label={inst.status} color={inst.status === 'connected' ? '#10b981' : '#6b7280'} />
            {isHigh && <Pill label="⚠ Alto Volume" color="#ef4444" />}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {inst.company_name} · {inst.plan} · {fmt(inst.conversations)} conversas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, textAlign: 'right', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0ea5e9' }}>{fmt(inst.messages_1h)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>msgs/hora</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{fmt(inst.messages_24h)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>msgs/24h</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{inst.msgs_per_sec.toFixed(4)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>msgs/s</div>
          </div>
          {open ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </div>
      </div>
      {open && (
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Detail label="Instance ID" value={inst.instance_id} mono />
          <Detail label="Push Name" value={inst.push_name || '—'} />
          <Detail label="Total Msgs" value={fmt(inst.total_messages)} />
          <Detail label="Flow ID" value={inst.flow_id || '—'} />
          <Detail label="Criado" value={inst.created_at ? new Date(inst.created_at).toLocaleDateString('pt-BR') : '—'} />
          <Detail label="Atualizado" value={inst.updated_at ? new Date(inst.updated_at).toLocaleString('pt-BR') : '—'} />
        </div>
      )}
    </div>
  )
}
const Detail = ({ label, value, mono }) => (
  <div>
    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined, fontWeight: 600 }}>{value}</div>
  </div>
)

// ── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const isOut = log.direction === 'outbound'
  return (
    <tr>
      <td style={{ padding: '5px 8px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {log.created_at ? new Date(log.created_at).toLocaleTimeString('pt-BR') : '—'}
      </td>
      <td style={{ padding: '5px 8px' }}>
        <span style={{
          padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
          background: isOut ? 'rgba(14,165,233,0.12)' : 'rgba(52,211,153,0.12)',
          color: isOut ? '#0ea5e9' : '#34d399',
        }}>{log.direction}</span>
      </td>
      <td style={{ padding: '5px 8px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {log.phone || '—'}
      </td>
      <td style={{ padding: '5px 8px', fontSize: 10, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.text_preview || <em style={{ color: 'var(--text-muted)' }}>{log.type}</em>}
      </td>
      <td style={{ padding: '5px 8px', fontSize: 10, color: 'var(--text-muted)' }}>{log.company_name}</td>
      <td style={{ padding: '5px 8px', fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{log.instance_id}</td>
      <td style={{ padding: '5px 8px' }}>
        <span style={{
          padding: '1px 5px', borderRadius: 4, fontSize: 9,
          background: log.status === 'sent' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
          color: log.status === 'sent' ? '#34d399' : '#ef4444',
        }}>{log.status || '—'}</span>
      </td>
    </tr>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminSmartMoonPage() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [security, setSecurity] = useState(null)
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [logFilter, setLogFilter] = useState({ hours: 24, direction: '' })
  const [error, setError] = useState(null)

  const loadOverview = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ov, sec] = await Promise.all([
        api.request('/admin/smartmoon/overview'),
        api.request('/admin/smartmoon/security'),
      ])
      setOverview(ov); setSecurity(sec)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api.request(
        `/admin/smartmoon/logs?hours=${logFilter.hours}&direction=${logFilter.direction}&limit=200`
      )
      setLogs(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [logFilter])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { if (tab === 'logs') loadLogs() }, [tab, loadLogs])

  const sm = overview?.summary || {}
  const sec = security || {}
  const instances = overview?.instances || []
  const alerts = overview?.high_volume_alerts || []

  const TABS = [
    { id: 'overview', label: '📊 Overview', desc: 'Instâncias e volume' },
    { id: 'logs', label: '📋 Logs', desc: 'Mensagens em tempo real' },
    { id: 'security', label: '🔒 Segurança', desc: 'Alertas e auditoria' },
  ]

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            }}>
              <span style={{ fontSize: 18 }}>🌙</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>SmartMoon Engine</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Painel de administração — superadmin</p>
            </div>
          </div>
        </div>
        <button
          onClick={tab === 'logs' ? loadLogs : loadOverview}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, marginBottom: 16 }}>
          ❌ {error}
        </div>
      )}

      {/* Tab Nav */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 22,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'transparent',
            color: tab === t.id ? 'white' : 'var(--text-muted)',
            fontSize: 11, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            transition: 'all 0.2s',
          }}>
            <span>{t.label}</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KPI label="Instâncias" value={fmt(sm.total_instances)} icon={Activity} color="#0ea5e9" />
            <KPI label="Conectadas" value={fmt(sm.connected)} icon={CheckCircle} color="#10b981"
              sub={`${sm.disconnected || 0} desconectadas`} />
            <KPI label="Msgs/hora" value={fmt(sm.total_messages_1h)} icon={MessageSquare} color="#a78bfa"
              sub={`${sm.global_msgs_per_sec?.toFixed(4) || '0'} msgs/s global`} />
            <KPI label="Msgs/24h" value={fmt(sm.total_messages_24h)} icon={Zap} color="#f59e0b" />
            {alerts.length > 0 && (
              <KPI label="Alto Volume" value={alerts.length} icon={AlertTriangle} color="#ef4444" warn
                sub="instâncias >100 msgs/hora" />
            )}
          </div>

          {/* Alertas */}
          {alerts.length > 0 && (
            <Card style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                ⚠ Instâncias com alto volume (última hora)
              </div>
              {alerts.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{i.label || i.instance_id}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{i.company_name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{fmt(i.messages_1h)} msgs</span>
                </div>
              ))}
            </Card>
          )}

          {/* Instances list */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Todas as instâncias ({instances.length})
            </div>
            {instances.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Nenhuma instância SmartMoon cadastrada</div>
              : instances.map(i => <InstanceRow key={i.id} inst={i} />)
            }
          </Card>
        </>
      )}

      {/* ── LOGS ── */}
      {tab === 'logs' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={logFilter.hours} onChange={e => setLogFilter(f => ({ ...f, hours: +e.target.value }))}
              style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}>
              {[1, 6, 12, 24, 72, 168].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <select value={logFilter.direction} onChange={e => setLogFilter(f => ({ ...f, direction: e.target.value }))}
              style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}>
              <option value="">Todas direções</option>
              <option value="outbound">Saída</option>
              <option value="inbound">Entrada</option>
            </select>
            <button onClick={loadLogs} style={{ padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              Filtrar
            </button>
            {logs?.burst_alerts?.length > 0 && (
              <div style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                ⚠ {logs.burst_alerts.length} empresa(s) com burst detectado
              </div>
            )}
          </div>

          <Card style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Logs de mensagens — {logs?.total_returned || 0} registros
            </div>
            {logs?.logs?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Hora', 'Direção', 'Telefone', 'Mensagem', 'Empresa', 'Instância', 'Status'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.logs.map(log => <LogRow key={log.msg_id} log={log} />)}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 24 }}>
                {loading ? '⏳ Carregando...' : 'Nenhum log no período selecionado'}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <>
          {/* RAM */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KPI label="RAM Usada" value={`${sec.server?.ram_used_gb || 0} GB`}
              sub={`${sec.server?.ram_percent || 0}% do total`}
              icon={Activity} color={sec.server?.ram_warning ? '#ef4444' : '#10b981'}
              warn={sec.server?.ram_warning} />
            <KPI label="Total Instâncias" value={fmt(sec.instances?.total)} icon={Phone} color="#0ea5e9" />
            <KPI label="Conectadas" value={fmt(sec.instances?.connected)} icon={CheckCircle} color="#10b981" />
            <KPI label="Zumbis +24h" value={sec.zombie_instances?.length || 0}
              icon={XCircle} color="#ef4444" warn={(sec.zombie_instances?.length || 0) > 0} />
          </div>

          {/* Anti-ban config */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🛡 Configuração Anti-Ban Ativa
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Detail label="Máx msgs/min" value={sec.anti_ban_config?.max_msg_per_min || 8} />
              <Detail label="Delay mín" value={`${sec.anti_ban_config?.typing_delay_min_ms || 2000}ms`} />
              <Detail label="Delay máx" value={`${sec.anti_ban_config?.typing_delay_max_ms || 6000}ms`} />
              <Detail label="Presença Online" value={sec.anti_ban_config?.online_presence ? '✅ Ativo' : '❌ Inativo'} />
            </div>
          </Card>

          {/* Potential abuse */}
          <Card style={{ marginBottom: 16, border: sec.potential_abuse?.length > 0 ? '1px solid rgba(239,68,68,0.25)' : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: sec.potential_abuse?.length > 0 ? '#ef4444' : 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ⚠ Possível Uso Abusivo (última hora)
            </div>
            {sec.potential_abuse?.length > 0 ? sec.potential_abuse.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{a.company_name}</span>
                <Pill label={a.plan} color="#a78bfa" />
                <Pill label={a.risk} color={a.risk === 'HIGH' ? '#ef4444' : '#f59e0b'} />
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{fmt(a.msgs_1h)} msgs/h</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmt(a.unique_contacts)} contatos únicos</div>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: '#10b981', padding: '8px 0' }}>✅ Nenhuma atividade suspeita detectada</div>
            )}
          </Card>

          {/* Zombie instances */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              💀 Instâncias Zumbi (desconectadas +24h)
            </div>
            {sec.zombie_instances?.length > 0 ? sec.zombie_instances.map((z, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', flexWrap: 'wrap' }}>
                <XCircle size={12} color="#6b7280" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{z.company_name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{z.instance_id}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                  Última vez: {z.last_seen ? new Date(z.last_seen).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: '#10b981', padding: '8px 0' }}>✅ Nenhuma instância zumbi</div>
            )}
          </Card>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
