/**
 * NEXUS.IA — Admin Payments Page
 * Painel administrativo completo do gateway de pagamentos.
 * Mostra métricas financeiras, cobranças e gerencia saques.
 */
import { useState, useEffect, useCallback } from 'react'
import { AdminPageShell } from '../../components/admin/AdminPageShell'
import {
  DollarSign, TrendingUp, Clock, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, ChevronDown, Filter, Eye,
  Download, CreditCard, Wallet, ArrowUpRight, ArrowDownLeft,
  BarChart2, Activity, Users
} from 'lucide-react'
import { useToast } from '../../components/ui/Toast'

const API_BASE = '/admin/payments'

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Erro ${res.status}`)
  }
  return res.json()
}

// ── Helpers ─────────────────────────────────────────────────────
const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtDate = s => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const STATUS_COLORS = {
  pending:         { bg: '#fef3c7', fg: '#92400e', label: 'Pendente' },
  approved:        { bg: '#d1fae5', fg: '#065f46', label: 'Aprovado' },
  rejected:        { bg: '#fee2e2', fg: '#991b1b', label: 'Rejeitado' },
  paid:            { bg: '#d1fae5', fg: '#065f46', label: 'Pago' },
  waiting_payment: { bg: '#fef3c7', fg: '#92400e', label: 'Aguardando' },
  expired:         { bg: '#f1f5f9', fg: '#64748b', label: 'Expirado' },
  sent:            { bg: '#dbeafe', fg: '#1e40af', label: 'Enviado' },
  processing:      { bg: '#ede9fe', fg: '#5b21b6', label: 'Processando' },
  failed:          { bg: '#fee2e2', fg: '#991b1b', label: 'Falhou' },
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#f1f5f9', fg: '#64748b', label: status }
  return (
    <span style={{
      background: s.bg, color: s.fg,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>{s.label}</span>
  )
}

// ── KPI Card ────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#7c3aed', alert }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, padding: '20px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
      {alert && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: '#ef4444', color: '#fff', fontSize: 10,
          borderRadius: 999, padding: '1px 6px', fontWeight: 700,
        }}>{alert}</div>
      )}
    </div>
  )
}

// ── Reject Modal ─────────────────────────────────────────────────
function RejectModal({ withdrawal, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 5) return
    setLoading(true)
    try { await onConfirm(reason) } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 440,
        border: '1px solid var(--border-subtle)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Rejeitar Saque</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
          Empresa: <strong>{withdrawal.company_id}</strong> — {fmtBRL(withdrawal.amount)}
        </p>
        <textarea
          placeholder="Motivo da rejeição (obrigatório)..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13,
          }}>Cancelar</button>
          <button onClick={submit} disabled={loading || reason.trim().length < 5} style={{
            padding: '8px 16px', borderRadius: 8,
            background: reason.trim().length >= 5 ? '#ef4444' : '#94a3b8',
            border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>{loading ? 'Rejeitando...' : 'Rejeitar Saque'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Approve Modal ─────────────────────────────────────────────────
function ApproveModal({ withdrawal, onClose, onConfirm }) {
  const [transferId, setTransferId] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try { await onConfirm(transferId.trim() || null) } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480,
        border: '1px solid var(--border-subtle)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>Aprovar Saque</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px' }}>
          {withdrawal.company_name || `Empresa #${withdrawal.company_id}`} — <strong style={{ color: 'var(--text-primary)' }}>{fmtBRL(withdrawal.amount)}</strong>
        </p>

        <div style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 18,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>⚠️ PIX Automático indisponível</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            A conta Mercado Pago ainda não tem permissão de Payouts habilitada.
            Faça o PIX <strong>manualmente</strong> para a chave abaixo e cole o ID do comprovante.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-base)', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all',
          border: '1px solid var(--border-subtle)',
        }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 11 }}>
            {withdrawal.pix_key_type?.toUpperCase()} · Chave PIX:
          </span>
          <br />
          <strong style={{ color: 'var(--text-primary)' }}>{withdrawal.pix_key}</strong>
        </div>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
          ID do Comprovante (opcional — para registro)
        </label>
        <input
          placeholder="Ex: E0000000020250426... ou ID do Pix enviado"
          value={transferId}
          onChange={e => setTransferId(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Deixe em branco se não tiver o ID agora. O saque será marcado como concluído.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13,
          }}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{
            padding: '8px 20px', borderRadius: 8,
            background: '#10b981', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Aprovando...' : '✓ Confirmar Aprovação'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function AdminPaymentsPage() {
  const toast = useToast()
  const [overview, setOverview]   = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [charges, setCharges]     = useState([])
  const [tab, setTab]             = useState('withdrawals')
  const [wFilter, setWFilter]     = useState('pending')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [approveModal, setApproveModal] = useState(null)
  const [actionLoading, setActionLoading] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, wds] = await Promise.all([
        apiFetch(`${API_BASE}/overview`),
        apiFetch(`${API_BASE}/withdrawals?status=${wFilter}&limit=50`),
      ])
      setOverview(ov)
      setWithdrawals(wds.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [wFilter])

  useEffect(() => { load() }, [load])

  const loadCharges = useCallback(async () => {
    try {
      const res = await apiFetch('/payments/charges?limit=50')
      setCharges(Array.isArray(res) ? res : (res.items || []))
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === 'charges') loadCharges()
  }, [tab, loadCharges])

  const openApprove = (w) => setApproveModal(w)

  const approve = async (w, manualTransferId) => {
    const id = w.id
    setApproveModal(null)
    setActionLoading(p => ({ ...p, [id]: 'approve' }))
    try {
      const body = {}
      if (manualTransferId) body.manual_transfer_id = manualTransferId
      await apiFetch(`${API_BASE}/withdrawals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Saque aprovado com sucesso!')
      await load()
    } catch (e) {
      toast.error(`Erro ao aprovar: ${e.message}`)
    } finally {
      setActionLoading(p => ({ ...p, [id]: null }))
    }
  }

  const reject = async (id, reason) => {
    setActionLoading(p => ({ ...p, [id]: 'reject' }))
    try {
      await apiFetch(`${API_BASE}/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      setRejectModal(null)
      toast.info('Saque rejeitado.')
      await load()
    } catch (e) {
      toast.error(`Erro ao rejeitar: ${e.message}`)
    } finally {
      setActionLoading(p => ({ ...p, [id]: null }))
    }
  }

  // ── Tabs ───────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',    label: 'Visão Geral', icon: BarChart2 },
    { id: 'withdrawals', label: 'Saques',       icon: ArrowDownLeft },
    { id: 'charges',     label: 'Cobranças',    icon: ArrowUpRight },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Financeiro</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Gateway de pagamentos e gestão de saques</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            data-tour={`admin-tab-${t.id}`}
            onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
            background: tab === t.id ? '#7c3aed' : 'var(--bg-card)',
            color: tab === t.id ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            <t.icon size={14} />
            {t.label}
            {t.id === 'withdrawals' && overview?.withdrawals_pending > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', fontSize: 10,
                borderRadius: 999, padding: '1px 6px', fontWeight: 700,
              }}>{overview.withdrawals_pending}</span>
            )}
          </button>
        ))}
        <button onClick={load} style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Atualizar
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '12px 16px', color: '#991b1b', marginBottom: 20, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>Carregando métricas...</div>
          ) : overview ? (
            <>
              <div data-tour="admin-overview-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard icon={DollarSign}   label="Total Cobrado"       value={fmtBRL(overview.total_charged)}     color="#7c3aed" />
                <KpiCard icon={CheckCircle}  label="Total Recebido"      value={fmtBRL(overview.total_paid)}         color="#10b981" />
                <KpiCard icon={Clock}        label="Aguardando Pagamento" value={fmtBRL(overview.total_pending)}     color="#f59e0b" />
                <KpiCard icon={Wallet}       label="Saldo Total (sistema)"value={fmtBRL(overview.system_balance)}    color="#3b82f6" />
                <KpiCard icon={TrendingUp}   label="Taxa de Conversão"    value={`${overview.conversion_rate}%`}    color="#06b6d4" sub={`${overview.charges_paid} pagas`} />
                <KpiCard icon={ArrowDownLeft}label="Saques Pendentes"     value={overview.withdrawals_pending}       color="#f59e0b" alert={overview.withdrawals_pending > 0 ? '!' : null} />
                <KpiCard icon={Activity}     label="Webhooks Pendentes"   value={overview.webhooks_unprocessed}      color={overview.webhooks_unprocessed > 0 ? '#ef4444' : '#64748b'} />
                <KpiCard icon={CreditCard}   label="Cobranças em Aberto"  value={overview.charges_pending}           color="#8b5cf6" />
              </div>

              {/* Conversion bar */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Taxa de Conversão de Cobranças</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{overview.conversion_rate}%</span>
                </div>
                <div style={{ background: 'var(--bg-base)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: `${overview.conversion_rate}%`, height: '100%',
                    background: 'linear-gradient(90deg, #7c3aed, #10b981)',
                    transition: 'width 0.5s ease', borderRadius: 999,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{overview.charges_paid} pagas</span>
                  <span>{overview.charges_pending} pendentes</span>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* ── WITHDRAWALS TAB ──────────────────────────────────── */}
      {tab === 'withdrawals' && (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['pending','failed','approved','rejected','all'].map(s => (
              <button key={s} data-tour={`withdraw-filter-${s}`} onClick={() => setWFilter(s)} style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: wFilter === s ? '#7c3aed' : 'var(--bg-card)',
                color: wFilter === s ? '#fff' : 'var(--text-muted)',
              }}>
                {s === 'all' ? 'Todos' : STATUS_COLORS[s]?.label || s}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>Carregando saques...</div>
          ) : withdrawals.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)',
            }}>
              <ArrowDownLeft size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0 }}>Nenhum saque {wFilter !== 'all' ? `com status "${STATUS_COLORS[wFilter]?.label}"` : ''}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {withdrawals.map(w => (
                <div key={w.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 12, padding: '16px 20px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Empresa #{w.company_id}</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{fmtBRL(w.amount)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(w.created_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Chave PIX</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{w.pix_key}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.pix_key_type} · {w.bank_name || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Badge status={w.status} />
                    {w.rejection_reason && (
                      <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{w.rejection_reason}</div>
                    )}
                    {w.mp_transfer_id && (
                      <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>MP: {w.mp_transfer_id}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(w.status === 'pending' || w.status === 'failed') && (
                      <>
                        <button
                          data-tour="withdraw-approve-btn"
                          onClick={() => openApprove(w)}
                          disabled={!!actionLoading[w.id]}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: 'none',
                            background: w.status === 'failed' ? '#f59e0b' : '#10b981',
                            color: '#fff', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600,
                            opacity: actionLoading[w.id] ? 0.6 : 1,
                          }}
                        >
                          {actionLoading[w.id] === 'approve' ? '...' : (w.status === 'failed' ? '↩ Retentar' : '✓ Aprovar')}
                        </button>
                        {w.status === 'pending' && (
                          <button
                            data-tour="withdraw-reject-btn"
                            onClick={() => setRejectModal(w)}
                            disabled={!!actionLoading[w.id]}
                            style={{
                              padding: '7px 14px', borderRadius: 8, border: '1px solid #ef4444',
                              background: 'transparent', color: '#ef4444', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600,
                            }}
                          >✕ Rejeitar</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CHARGES TAB ──────────────────────────────────────── */}
      {tab === 'charges' && (
        <>
          {charges.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)',
            }}>
              <CreditCard size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0 }}>Nenhuma cobrança registrada ainda</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['ID','Empresa','Cliente','Valor','Status','PIX','Criada em'].map(h => (
                      <th key={h} data-tour="charges-table-header" style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charges.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{c.id}</td>
                      <td style={{ padding: '10px 12px' }}>{c.company_id}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.client_name || c.client_email || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtBRL(c.amount)}</td>
                      <td style={{ padding: '10px 12px' }}><Badge status={c.status} /></td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.pix_copy_paste ? c.pix_copy_paste.slice(0, 20) + '…' : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <RejectModal
          withdrawal={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={reason => reject(rejectModal.id, reason)}
        />
      )}

      {/* Approve Modal */}
      {approveModal && (
        <ApproveModal
          withdrawal={approveModal}
          onClose={() => setApproveModal(null)}
          onConfirm={transferId => approve(approveModal, transferId)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
