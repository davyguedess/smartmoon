import { useState, useEffect } from 'react'
import { Plus, Trash2, Link2, Unlink, Bot, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../api'

// ── BotCard ───────────────────────────────────────────────────────────────────
function BotCard({ bot, flows, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState(bot.flow_id ? String(bot.flow_id) : '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleConnect = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const data = await api.telegramBotsConnectFlow(bot.id, selectedFlow ? parseInt(selectedFlow) : null)
      setMsg({ ok: true, text: data?.message || 'Fluxo conectado!' })
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setSaving(true)
    try {
      const data = await api.telegramBotsConnectFlow(bot.id, null)
      setMsg({ ok: true, text: data?.message || 'Fluxo desconectado.' })
      setSelectedFlow('')
      await onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Remover o bot @${bot.username}? O webhook será desativado.`)) return
    setDeleting(true)
    try {
      await api.telegramBotsRemove(bot.id)
      await onRefresh()
    } catch (e) { console.error(e) } finally { setDeleting(false) }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(bot.webhook_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasFlow = !!bot.flow_id

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${hasFlow ? 'rgba(34,158,217,0.3)' : 'var(--border-subtle)'}`,
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      boxShadow: hasFlow ? '0 0 0 1px rgba(34,158,217,0.1), 0 4px 20px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
          cursor: 'pointer', userSelect: 'none',
          background: hasFlow ? 'linear-gradient(90deg, rgba(34,158,217,0.06) 0%, transparent 100%)' : 'transparent',
        }}
      >
        {/* Bot Avatar */}
        <div style={{
          width: 46, height: 46, borderRadius: 14,
          background: 'linear-gradient(135deg, #229ED9, #1a7fab)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 3px 10px rgba(34,158,217,0.3)',
        }}>
          <Bot size={22} color="white" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {bot.label}
            </span>
            {bot.username && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-base)', padding: '2px 7px', borderRadius: 6 }}>
                @{bot.username}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {hasFlow
              ? <span style={{ color: '#229ED9' }}>🔗 Flow: <strong>{bot.flow_name || `#${bot.flow_id}`}</strong></span>
              : <span>⚪ Sem fluxo conectado</span>
            }
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
            background: hasFlow ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,120,0.1)',
            color: hasFlow ? 'var(--nexus-green)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: hasFlow ? '#10b981' : '#6b7280', display: 'inline-block' }} />
            {hasFlow ? 'Ativo' : 'Sem flow'}
          </span>
          {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(34,158,217,0.12)' }}>
          {/* Webhook URL */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
              URL do Webhook
            </div>
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center',
              background: 'var(--bg-base)', borderRadius: 10, padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
            }}>
              <code style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bot.webhook_url}
              </code>
              <button onClick={copyWebhook} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : 'var(--text-muted)', padding: 0 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Flow Selector */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Fluxo Conectado
            </div>

            {/* Current status */}
            <div style={{
              padding: '8px 12px', borderRadius: 10, marginBottom: 10,
              background: hasFlow ? 'rgba(16,185,129,0.08)' : 'rgba(100,100,120,0.06)',
              border: `1px solid ${hasFlow ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasFlow ? '#10b981' : '#6b7280', flexShrink: 0 }} />
              {hasFlow
                ? <span style={{ color: '#10b981', fontWeight: 600 }}>Conectado: <span style={{ color: 'var(--text-primary)' }}>{bot.flow_name || `Flow #${bot.flow_id}`}</span></span>
                : <span style={{ color: 'var(--text-muted)' }}>Nenhum fluxo — o bot não responderá</span>
              }
            </div>

            {/* Select + Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedFlow}
                onChange={e => setSelectedFlow(e.target.value)}
                style={{
                  flex: 1, padding: '9px 13px', borderRadius: 10,
                  background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                  color: selectedFlow ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12,
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Selecionar fluxo...</option>
                {flows.map(f => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name} {f.status === 'published' ? '✓' : `(${f.status})`}
                  </option>
                ))}
              </select>

              <button
                onClick={handleConnect}
                disabled={!selectedFlow || saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px',
                  borderRadius: 10,
                  background: selectedFlow && !saving ? 'linear-gradient(135deg, #229ED9, #1a7fab)' : 'var(--bg-card)',
                  color: selectedFlow && !saving ? 'white' : 'var(--text-muted)',
                  border: selectedFlow && !saving ? 'none' : '1px solid var(--border-default)',
                  cursor: !selectedFlow || saving ? 'not-allowed' : 'pointer',
                  fontSize: 11, fontWeight: 700,
                  boxShadow: selectedFlow && !saving ? '0 2px 10px rgba(34,158,217,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <Link2 size={12} /> {saving ? 'Salvando...' : 'Conectar'}
              </button>

              {hasFlow && (
                <button
                  onClick={handleDisconnect}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px',
                    borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: 'rgba(239,68,68,0.08)', color: 'var(--nexus-red)',
                    border: '1px solid rgba(239,68,68,0.2)', transition: 'all 0.15s',
                  }}
                >
                  <Unlink size={12} /> Desconectar
                </button>
              )}
            </div>

            {msg && (
              <div style={{
                marginTop: 8, padding: '7px 12px', borderRadius: 8, fontSize: 11,
                background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                color: msg.ok ? 'var(--nexus-green)' : 'var(--nexus-red)',
                border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>{msg.text}</div>
            )}
          </div>

          {/* Delete */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                borderRadius: 8, cursor: 'pointer', fontSize: 11,
                background: 'rgba(239,68,68,0.06)', color: 'var(--nexus-red)',
                border: '1px solid rgba(239,68,68,0.15)', transition: 'all 0.15s',
              }}
            >
              <Trash2 size={12} /> {deleting ? 'Removendo...' : 'Remover Bot'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddBotModal ───────────────────────────────────────────────────────────────
function AddBotModal({ onClose, onAdded }) {
  const [botToken, setBotToken] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!botToken.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.telegramBotsAdd({ bot_token: botToken.trim(), label: label.trim() || undefined })
      onAdded(data)
      onClose()
    } catch (e) {
      setError(e.message || 'Erro ao adicionar bot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 20, padding: 28,
          width: 440, border: '1px solid var(--border-default)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'linear-gradient(135deg, #229ED9, #1a7fab)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Adicionar Bot Telegram</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Obtenha o token via @BotFather</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 }}>
              Bot Token *
            </label>
            <input
              type="text"
              placeholder="1234567890:AABBccDDee..."
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: 10, background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 }}>
              Nome (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Bot de Atendimento CFO"
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: 10, background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(34,158,217,0.07)', border: '1px solid rgba(34,158,217,0.15)', fontSize: 11, color: 'var(--text-secondary)' }}>
            💡 O webhook será configurado automaticamente. O bot começará a responder assim que você conectar um fluxo.
          </div>

          {error && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--nexus-red)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12 }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={!botToken.trim() || loading}
              style={{
                flex: 2, padding: '10px', borderRadius: 10,
                background: botToken.trim() && !loading ? 'linear-gradient(135deg, #229ED9, #1a7fab)' : 'var(--bg-card)',
                color: botToken.trim() && !loading ? 'white' : 'var(--text-muted)',
                border: 'none', cursor: !botToken.trim() || loading ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
                boxShadow: botToken.trim() && !loading ? '0 3px 15px rgba(34,158,217,0.35)' : 'none',
              }}
            >
              {loading ? '⏳ Conectando...' : '➕ Adicionar Bot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TelegramBots() {
  const [bots, setBots] = useState([])
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [botsData, flowsData] = await Promise.all([
        api.telegramBotsList(),
        api.telegramFlowsList(),
      ])
      setBots(Array.isArray(botsData) ? botsData : [])
      const fl = Array.isArray(flowsData) ? flowsData : (flowsData?.items || [])
      setFlows(fl)
    } catch (e) {
      console.error('TelegramBots load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 780, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, #229ED9, #1a7fab)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(34,158,217,0.3)',
            }}>
              <Bot size={20} color="white" />
            </span>
            Telegram Bots
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Gerencie múltiplos bots — cada um conectado a um fluxo independente
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-default)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #229ED9, #1a7fab)', color: 'white',
              fontSize: 13, fontWeight: 700,
              boxShadow: '0 3px 14px rgba(34,158,217,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 5px 18px rgba(34,158,217,0.45)' }}
            onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 3px 14px rgba(34,158,217,0.35)' }}
          >
            <Plus size={15} /> Adicionar Bot
          </button>
        </div>
      </div>

      {/* Architecture info */}
      <div style={{
        padding: '12px 16px', borderRadius: 12, marginBottom: 24,
        background: 'rgba(34,158,217,0.06)', border: '1px solid rgba(34,158,217,0.15)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18 }}>🏗️</span>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong>Como funciona:</strong> Cada bot Telegram tem seu próprio webhook URL e pode ser conectado a um fluxo independente. O fluxo define qual agente responde, qual persona usar e quais ferramentas estão disponíveis.
        </div>
      </div>

      {/* Bot List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 12 }}>Carregando bots...</div>
        </div>
      ) : bots.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 40px',
          background: 'var(--bg-card)', borderRadius: 16,
          border: '2px dashed var(--border-subtle)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhum bot registrado</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Adicione seu primeiro bot para começar a gerenciar fluxos de atendimento
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #229ED9, #1a7fab)', color: 'white',
              fontSize: 13, fontWeight: 700, boxShadow: '0 3px 14px rgba(34,158,217,0.35)',
            }}
          >
            <Plus size={15} /> Adicionar primeiro Bot
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bots.map(bot => (
            <BotCard key={bot.id} bot={bot} flows={flows} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Diagram */}
      {bots.length > 0 && (
        <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
            Mapa de Conexões
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bots.map(bot => (
              <div key={bot.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{
                  background: 'rgba(34,158,217,0.12)', color: '#229ED9',
                  padding: '3px 9px', borderRadius: 6, fontWeight: 600
                }}>
                  @{bot.username || bot.label}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                {bot.flow_id
                  ? <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '3px 9px', borderRadius: 6, fontWeight: 600 }}>{bot.flow_name || `Flow #${bot.flow_id}`}</span>
                  : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>sem fluxo</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <AddBotModal
          onClose={() => setShowModal(false)}
          onAdded={() => { load(); setShowModal(false) }}
        />
      )}
    </div>
  )
}
