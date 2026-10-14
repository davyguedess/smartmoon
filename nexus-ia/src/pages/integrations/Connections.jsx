import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Link2, AlertTriangle, CheckCircle2, Activity, MessageSquare, XCircle, QrCode, Trash2, Wifi, WifiOff, RotateCcw, Zap, Smartphone } from 'lucide-react'
import { api } from '../../api'

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: '📱' },
  whatsapp_cloud: { label: 'WhatsApp Cloud', color: '#25D366', icon: '📱' },
  zapi: { label: 'WhatsApp (Z-API)', color: '#7c3aed', icon: '⚡' },
  smartmoon: { label: 'WhatsApp Direto (SmartMoon)', color: '#0ea5e9', icon: '🌙' },
  telegram: { label: 'Telegram', color: '#229ED9', icon: '🤖' },
  google: { label: 'Google Workspace', color: '#4285F4', icon: '🔵' },
}

function StatusDot({ status }) {
  const colors = {
    connected: '#10b981',
    ok: '#10b981',
    pending: '#f59e0b',
    disconnected: '#6b7280',
    warning: '#f59e0b',
    error: '#ef4444',
  }
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: colors[status] || '#6b7280',
      display: 'inline-block',
      boxShadow: `0 0 6px ${colors[status] || '#6b7280'}60`,
    }} />
  )
}

function ChannelCard({ channel, onRefresh }) {
  const cfg = CHANNEL_CONFIG[channel.provider] || CHANNEL_CONFIG[channel.channel] || { label: channel.provider, color: '#6366f1', icon: '🔌' }
  const [checking, setChecking] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)

  const isZapi = channel.provider === 'zapi'
  const isSmartmoon = channel.provider === 'smartmoon'

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      if (isZapi) {
        const status = await api.zapiStatus(channel.integration_id)
        alert(`Status: ${status.connected ? '✅ Conectado' : '❌ Desconectado'}`)
      } else if (isSmartmoon) {
        const status = await api.smartmoonStatus(channel.integration_id)
        alert(`Status: ${status.status || status.db_status || 'desconhecido'}`)
      }
      onRefresh?.()
    } catch (e) {
      alert(`Erro: ${e.message}`)
    } finally {
      setChecking(false)
    }
  }

  const handleQrCode = async () => {
    setQrLoading(true)
    try {
      if (isZapi) {
        const data = await api.zapiQrCode(channel.integration_id)
        setQrData(data)
      } else if (isSmartmoon) {
        const data = await api.smartmoonQrCode(channel.integration_id)
        setQrData(data)
      }
    } catch (e) {
      alert(`Erro ao gerar QR Code: ${e.message}`)
    } finally {
      setQrLoading(false)
    }
  }

  const handleRestart = async () => {
    if (!isSmartmoon) return
    try {
      await api.smartmoonRestart(channel.integration_id)
      alert('♻️ Instância reiniciando...')
      onRefresh?.()
    } catch (e) {
      alert(`Erro: ${e.message}`)
    }
  }

  const handleRemove = async () => {
    const providerLabel = isSmartmoon ? 'SmartMoon' : 'Z-API'
    if (!confirm(`Remover esta instância ${providerLabel}?`)) return
    try {
      if (isZapi) await api.zapiRemove(channel.integration_id)
      else if (isSmartmoon) await api.smartmoonRemove(channel.integration_id)
      onRefresh?.()
    } catch (e) {
      alert(`Erro: ${e.message}`)
    }
  }

  const showActions = isZapi || isSmartmoon

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${cfg.color}25`,
      borderRadius: 16,
      padding: '18px 20px',
      transition: 'all 0.2s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)`,
        borderRadius: '16px 16px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: cfg.color + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {cfg.icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {channel.label || cfg.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {channel.push_name && `${channel.push_name} · `}
              {channel.username && `@${channel.username} · `}
              {channel.display_phone && `${channel.display_phone} · `}
              {channel.instance_id && `ID: ${channel.instance_id.slice(0, 8)}... · `}
              {channel.provider}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusDot status={channel.status} />
          <span style={{
            fontSize: 10, fontWeight: 600, color: channel.status === 'connected' ? '#10b981' : channel.status === 'pending' ? '#f59e0b' : '#6b7280',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {channel.status}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {channel.conversations !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MessageSquare size={12} color={cfg.color} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{channel.conversations}</strong> conversas
            </span>
          </div>
        )}
        {channel.messages !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Activity size={12} color={cfg.color} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{channel.messages}</strong> mensagens
            </span>
          </div>
        )}
      </div>

      {/* Flow connection */}
      {channel.flow_id ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: `${cfg.color}10`,
          border: `1px solid ${cfg.color}20`,
          fontSize: 11, color: cfg.color,
        }}>
          <Link2 size={11} /> Flow: <strong>{channel.flow_name || `#${channel.flow_id}`}</strong>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 11, color: '#f59e0b',
        }}>
          <AlertTriangle size={11} /> Nenhum flow vinculado
        </div>
      )}

      {/* Services (Google) */}
      {channel.services && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {channel.services.map(s => (
            <span key={s} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: `${cfg.color}10`, color: cfg.color, fontWeight: 600,
            }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons for Z-API and SmartMoon */}
      {showActions && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button onClick={handleCheckStatus} disabled={checking}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: `1px solid ${cfg.color}30`,
              background: `${cfg.color}08`, color: cfg.color,
              cursor: checking ? 'wait' : 'pointer', fontSize: 10, fontWeight: 600,
            }}>
            {channel.status === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
            {checking ? 'Verificando...' : 'Status'}
          </button>
          <button onClick={handleQrCode} disabled={qrLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: `1px solid ${cfg.color}30`,
              background: `${cfg.color}08`, color: cfg.color,
              cursor: qrLoading ? 'wait' : 'pointer', fontSize: 10, fontWeight: 600,
            }}>
            <QrCode size={10} /> {qrLoading ? 'Gerando...' : 'QR Code'}
          </button>
          {isSmartmoon && (
            <button onClick={handleRestart}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, border: `1px solid ${cfg.color}30`,
                background: `${cfg.color}08`, color: cfg.color,
                cursor: 'pointer', fontSize: 10, fontWeight: 600,
              }}>
              <RotateCcw size={10} /> Reconectar
            </button>
          )}
          <button onClick={handleRemove}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.08)', color: '#ef4444',
              cursor: 'pointer', fontSize: 10, fontWeight: 600,
              marginLeft: 'auto',
            }}>
            <Trash2 size={10} /> Remover
          </button>
        </div>
      )}

      {/* QR Code display */}
      {qrData && (
        <div style={{
          marginTop: 10, padding: 12, borderRadius: 10,
          background: `${cfg.color}05`,
          border: `1px solid ${cfg.color}15`,
          textAlign: 'center',
        }}>
          {qrData.qr || qrData.value ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                📱 Escaneie com o WhatsApp para conectar
              </div>
              {(() => {
                const qrValue = qrData.qr || qrData.value
                if (qrValue.startsWith('data:') || qrValue.startsWith('http')) {
                  return <img src={qrValue} alt="QR Code" style={{ maxWidth: 200, borderRadius: 8 }} />
                }
                return (
                  <div style={{
                    fontSize: 10, color: 'var(--text-secondary)', wordBreak: 'break-all',
                    padding: 8, background: 'var(--bg-primary)', borderRadius: 6,
                  }}>
                    {qrValue}
                  </div>
                )
              })()}
            </>
          ) : qrData.status === 'CONNECTED' ? (
            <div style={{ fontSize: 11, color: '#10b981' }}>
              ✅ Instância já conectada
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ⏳ Aguardando QR Code...
            </div>
          )}
          <button onClick={() => setQrData(null)} style={{
            marginTop: 8, padding: '4px 12px', borderRadius: 6, fontSize: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}

function HealthPanel({ health }) {
  if (!health?.integrations?.length) return null

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Activity size={14} color="#a78bfa" /> Health Check
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {health.integrations.map((h, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-card)',
            border: `1px solid ${h.status === 'ok' ? 'rgba(16,185,129,0.2)' : h.status === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {h.status === 'ok' ? <CheckCircle2 size={14} color="#10b981" /> :
             h.status === 'warning' ? <AlertTriangle size={14} color="#f59e0b" /> :
             <XCircle size={14} color="#ef4444" />}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{h.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>({h.provider})</span>
            </div>
            {h.issues?.length > 0 && (
              <div style={{ fontSize: 10, color: h.status === 'error' ? '#ef4444' : '#f59e0b' }}>
                {h.issues.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}



export default function Connections({ embedded = false }) {
  const [data, setData] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [statusData, healthData] = await Promise.all([
        api.connectionsStatus(),
        api.connectionsHealth(),
      ])
      setData(statusData)
      setHealth(healthData)
    } catch (e) {
      console.error('Failed to load connections:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const connected = data?.channels?.filter(c => c.status === 'connected').length || 0
  const total = data?.total_channels || 0
  const zapiCount = data?.channels?.filter(c => c.provider === 'zapi').length || 0
  const metaCount = data?.channels?.filter(c => c.provider === 'whatsapp_cloud').length || 0
  const smartmoonCount = data?.channels?.filter(c => c.provider === 'smartmoon').length || 0

  return (
    <div style={{ padding: embedded ? '0 0 24px' : 24, overflowY: embedded ? 'visible' : 'auto', height: embedded ? 'auto' : '100%' }}>
      {/* Header — only shown when standalone */}
      {!embedded && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            Conexões
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '5px 0 0' }}>
            Status unificado de todos os canais de comunicação
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', cursor: loading ? 'wait' : 'pointer',
            fontSize: 11, fontWeight: 600,
          }}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>
      )}

      {/* Refresh when embedded */}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)', cursor: loading ? 'wait' : 'pointer',
            fontSize: 11, fontWeight: 600,
          }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        padding: '14px 18px', background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)', borderRadius: 14,
      }}>
        {[
          { label: 'Canais', value: total, color: '#a78bfa' },
          { label: 'Conectados', value: connected, color: '#10b981' },
          { label: 'SmartMoon', value: smartmoonCount, color: '#0ea5e9' },
          { label: 'Meta Cloud', value: metaCount, color: '#25D366' },
          { label: 'Z-API', value: zapiCount, color: '#7c3aed' },
          { label: 'Offline', value: total - connected, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Channel cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          ⏳ Carregando conexões...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 14,
          maxWidth: 900,
        }}>
          {data?.channels?.map((ch, i) => (
            <ChannelCard key={i} channel={ch} onRefresh={load} />
          ))}
          {(!data?.channels || data.channels.length === 0) && (
            <div style={{
              padding: 40, textAlign: 'center', borderRadius: 14,
              background: 'var(--bg-card)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', fontSize: 13, gridColumn: '1 / -1',
            }}>
              Nenhum canal configurado. Vá para <strong>Integrações</strong> para conectar WhatsApp, Z-API ou Telegram.
            </div>
          )}
        </div>
      )}

      {/* Health */}
      <HealthPanel health={health} />
    </div>
  )
}
