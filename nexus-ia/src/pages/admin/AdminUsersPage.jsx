/**
 * AdminUsersPage — Gerenciamento de usuários com modais completos
 *
 * FIXES:
 * - React error #310: UserDetailModal extraído como componente real (hooks no top-level)
 * - Edit modal: removido "Role", adicionado Trocar Senha + Trocar Plano
 * - View modal: último login, data cadastro, plano ativo, gateway, saques, fluxos/nós/conexões
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, RefreshCw, Edit3, Pause, Trash2, Eye,
  ChevronLeft, ChevronRight, Crown, Shield, CheckCircle,
  X, Save, AlertTriangle, UserPlus, Zap, Coins, CreditCard,
  Activity, Package, Key, ArrowDownCircle, GitBranch,
  Calendar, Clock, TrendingUp, Layers, Wallet, LogIn,
} from 'lucide-react'
import { api, adminApi, impersonation } from '../../api'

const PLAN_COLORS = {
  free: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
  starter: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  pro: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  business: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
  enterprise: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

const ALL_PLANS = ['free', 'starter', 'pro', 'business', 'enterprise']

function PlanBadge({ plan }) {
  const c = PLAN_COLORS[plan?.toLowerCase()] || PLAN_COLORS.free
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.color, textTransform: 'capitalize',
    }}>{plan || 'free'}</span>
  )
}

function StatusDot({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: active ? 'var(--nexus-green)' : 'var(--nexus-red)',
        boxShadow: active ? '0 0 6px var(--nexus-green)' : 'none',
      }} />
      <span style={{ fontSize: 11, color: active ? 'var(--nexus-green)' : 'var(--nexus-red)', fontWeight: 600 }}>
        {active ? 'Ativo' : 'Inativo'}
      </span>
    </div>
  )
}

// ── Modal Wrapper ───────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)', borderRadius: '18px 18px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon}
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
          }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

const fLabel = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }
const fValue = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6 }
const fInput = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

function fmt(n) {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtBRL(n) {
  return `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
}

// ── Componente separado para o modal de detalhe (FIX do React #310) ─────────
function UserDetailModal({ viewUser, onClose }) {
  const [tab, setTab] = useState('perfil')

  const u = viewUser?.user || viewUser
  const company = viewUser?.company || {}
  const flows = viewUser?.flows || {}
  const agents = viewUser?.agents || {}
  const usage = viewUser?.usage || {}
  const aiTokens = viewUser?.ai_tokens || {}
  const gateway = viewUser?.gateway_movements || []
  const withdrawals = viewUser?.withdrawals || { count: 0, total: 0 }
  const nodesCount = viewUser?.nodes_count || 0
  const connCount = viewUser?.connections_count || 0
  const lastLogin = viewUser?.last_login

  const TABS = [
    { k: 'perfil', label: 'Perfil', Icon: Eye },
    { k: 'plano', label: 'Plano & Uso', Icon: Package },
    { k: 'gateway', label: 'Gateway', Icon: CreditCard },
    { k: 'tokens', label: 'Tokens IA', Icon: Zap },
    { k: 'saques', label: 'Saques', Icon: Wallet },
  ]

  return (
    <Modal
      title={`Detalhes — ${u?.name || '...'}`}
      icon={<Eye size={16} color="var(--nexus-cyan)" />}
      onClose={onClose}
      width={760}
    >
      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0, overflowX: 'auto' }}>
        {TABS.map(({ k, label, Icon }) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 14px', background: 'none', border: 'none', whiteSpace: 'nowrap',
            borderBottom: tab === k ? '2px solid var(--nexus-violet)' : '2px solid transparent',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            color: tab === k ? 'var(--nexus-violet)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: -1,
          }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Perfil ─── */}
      {tab === 'perfil' && (
        <div>
          {/* Header compacto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: `hsl(${(u?.id * 60 || 0) % 360}, 60%, 35%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: 'white',
            }}>
              {(u?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{u?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u?.email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <PlanBadge plan={company?.plan || u?.plan} />
                <StatusDot active={u?.is_active} />
              </div>
            </div>
            {u?.is_superadmin && <Shield size={16} color="#ef4444" />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            <div><div style={fLabel}>Documento</div><div style={fValue}>{u?.document || '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{u?.document_type ? `(${u.document_type.toUpperCase()})` : ''}</span></div></div>
            <div><div style={fLabel}>Nascimento</div><div style={fValue}>{u?.birth_date ? fmtDateShort(u.birth_date) : '—'}</div></div>
            <div><div style={fLabel}>Empresa / Tenant</div><div style={fValue}>{company?.name || '—'}</div></div>
            <div>
              <div style={fLabel}>Data de Cadastro</div>
              <div style={{ ...fValue, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} color="var(--nexus-cyan)" />
                {fmtDate(u?.created_at)}
              </div>
            </div>
            <div>
              <div style={fLabel}>Último Login</div>
              <div style={{ ...fValue, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={12} color={lastLogin ? 'var(--nexus-green)' : 'var(--text-muted)'} />
                {lastLogin ? fmtDate(lastLogin) : '—'}
              </div>
            </div>
            <div><div style={fLabel}>Superadmin</div><div style={fValue}>{u?.is_superadmin ? '✅ Sim' : '❌ Não'}</div></div>
          </div>
        </div>
      )}

      {/* ─── Tab: Plano & Uso ─── */}
      {tab === 'plano' && (
        <div>
          {/* Plano ativo */}
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'var(--bg-card)', border: `1px solid ${PLAN_COLORS[company?.plan?.toLowerCase()]?.color || '#6b7280'}40`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Plano Ativo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlanBadge plan={company?.plan} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>empresa: {company?.name}</span>
              </div>
            </div>
            <StatusDot active={company?.is_active ?? u?.is_active} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Fluxos (ativo/total)', value: `${flows.active || 0} / ${flows.total || 0}`, color: 'var(--nexus-cyan)', Icon: GitBranch },
              { label: 'Nós nos fluxos', value: nodesCount, color: '#a78bfa', Icon: Layers },
              { label: 'Conexões', value: connCount, color: '#38bdf8', Icon: Activity },
              { label: 'Agentes', value: `${agents.active || 0} / ${agents.total || 0}`, color: 'var(--nexus-violet)', Icon: Zap },
              { label: 'Execuções (mês)', value: fmt(usage.executions), color: 'var(--nexus-green)', Icon: TrendingUp },
              { label: 'Tokens IA usados', value: fmt(aiTokens.total_balance), color: '#f59e0b', Icon: Coins },
            ].map(s => (
              <div key={s.label} style={{ padding: '12px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <s.Icon size={14} color={s.color} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Créditos */}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Créditos Nexus</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{fmtBRL(viewUser?.credit_balance)}</div>
          </div>
        </div>
      )}

      {/* ─── Tab: Gateway ─── */}
      {tab === 'gateway' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>Movimentação do Gateway PIX</div>
          {gateway.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              <CreditCard size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>Nenhuma movimentação encontrada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gateway.map((gw, i) => {
                const sc = { paid: '#10b981', pending: '#f59e0b', expired: '#6b7280', cancelled: '#ef4444', waiting_payment: '#4285F4' }[gw.status] || '#6b7280'
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>PACK</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{gw.pack_name || 'Cobrança PIX'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>VALOR</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmtBRL(gw.amount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: sc + '20', color: sc, fontWeight: 700 }}>{gw.status}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>DATA</div>
                      <div style={{ fontSize: 11 }}>{fmtDateShort(gw.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Tokens IA ─── */}
      {tab === 'tokens' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>Saldo por Provider</div>
          {(aiTokens.balances || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Nenhum saldo encontrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {(aiTokens.balances || []).map((b, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div><div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>PROVIDER</div><div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{b.provider}</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>SALDO</div><div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmt(b.balance_tokens)}</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>COMPRADO</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(b.total_purchased)}</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>USADO</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(b.total_used)}</div></div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Transações Recentes</div>
          {(aiTokens.transactions || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma transação encontrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(aiTokens.transactions || []).slice(0, 10).map((tx, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: tx.tx_type === 'consume' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: tx.tx_type === 'consume' ? '#ef4444' : '#10b981' }}>{tx.tx_type}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{tx.description || '—'}</span>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{fmt(tx.tokens)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDateShort(tx.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Saques ─── */}
      {tab === 'saques' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', textAlign: 'center' }}>
              <ArrowDownCircle size={20} color="#10b981" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Saques Aprovados</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{withdrawals.count}</div>
            </div>
            <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
              <Wallet size={20} color="#f59e0b" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Sacado</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{fmtBRL(withdrawals.total)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Para ver o detalhamento completo, acesse a seção <strong>Gateway → Saques</strong>.
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Componente separado para o modal de edição ───────────────────────────────
function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    is_active: user.is_active,
  })
  const [newPassword, setNewPassword] = useState('')
  const [newPlan, setNewPlan] = useState(user.plan || '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [impersonating, setImpersonating] = useState(false)
  const navigate = useNavigate()

  const handleSaveInfo = async () => {
    setLoading(true); setErr(''); setOk('')
    try {
      await adminApi.updateUser(user.id, { name: form.name, email: form.email, is_active: form.is_active })
      setOk('Dados atualizados!')
      setTimeout(() => { setOk(''); onSaved() }, 800)
    } catch (e) { setErr(e?.message || 'Erro ao salvar') }
    setLoading(false)
  }

  const handleImpersonate = async () => {
    setImpersonating(true); setErr('')
    try {
      const res = await adminApi.impersonateUser(user.id)
      impersonation.start(res.token, res.user_name, res.user_email)
      setOk(`Entrando como ${res.user_name}...`)
      setTimeout(() => { navigate('/') }, 600)
    } catch (e) { setErr(e?.message || 'Erro ao impersonar usuario') }
    setImpersonating(false)
  }

  const handleChangePlan = async () => {
    if (!newPlan) return setErr('Selecione um plano')
    setLoading(true); setErr(''); setOk('')
    try {
      await adminApi.updateUserPlan(user.id, newPlan)
      setOk(`Plano alterado para ${newPlan}!`)
      setTimeout(() => { setOk(''); onSaved() }, 900)
    } catch (e) { setErr(e?.message || 'Erro ao alterar plano') }
    setLoading(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return setErr('Senha deve ter ao menos 6 caracteres')
    setLoading(true); setErr(''); setOk('')
    try {
      await adminApi.changeUserPassword(user.id, newPassword)
      setOk('Senha alterada com sucesso!')
      setNewPassword('')
      setTimeout(() => setOk(''), 2000)
    } catch (e) { setErr(e?.message || 'Erro ao alterar senha') }
    setLoading(false)
  }

  const section = (title, icon) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, margin: '18px 0 10px', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
      {icon}{title}
    </div>
  )

  return (
    <Modal title={`Editar — ${user.name}`} icon={<Edit3 size={16} color="var(--nexus-violet)" />} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Dados básicos ── */}
        <div><div style={fLabel}>Nome</div><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={fInput} /></div>
        <div><div style={fLabel}>E-mail</div><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={fInput} /></div>

        {/* Status */}
        <div>
          <div style={fLabel}>Status da Conta</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setForm(p => ({ ...p, is_active: v }))} style={{
                flex: 1, padding: '9px', borderRadius: 8,
                border: `1px solid ${form.is_active === v ? (v ? 'var(--nexus-green)' : 'var(--nexus-red)') : 'var(--border-subtle)'}`,
                background: form.is_active === v ? (v ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'var(--bg-card)',
                color: form.is_active === v ? (v ? 'var(--nexus-green)' : 'var(--nexus-red)') : 'var(--text-muted)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{v ? '✅ Ativo' : '🚫 Inativo'}</button>
            ))}
          </div>
        </div>

        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 600 }}>⚠️ {err}</div>}
        {ok && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✅ {ok}</div>}

        <button onClick={handleSaveInfo} disabled={loading} style={{
          padding: '11px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#4a4a6a' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Save size={14} />{loading ? 'Salvando...' : 'Salvar Dados'}
        </button>

        {/* ── Trocar Plano ── */}
        {section('Trocar Plano', <Package size={12} />)}
        <div>
          <div style={{ ...fLabel, marginBottom: 8 }}>Selecione o novo plano</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {ALL_PLANS.map(p => {
              const c = PLAN_COLORS[p] || PLAN_COLORS.free
              const sel = newPlan === p
              return (
                <button key={p} onClick={() => setNewPlan(p)} style={{
                  padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  border: `1px solid ${sel ? c.color : 'var(--border-subtle)'}`,
                  background: sel ? c.bg : 'var(--bg-card)',
                  color: sel ? c.color : 'var(--text-muted)',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}>{p}</button>
              )
            })}
          </div>
          {user.plan && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Plano atual: <PlanBadge plan={user.plan} />
            </div>
          )}
        </div>
        <button onClick={handleChangePlan} disabled={loading || !newPlan} style={{
          padding: '10px', borderRadius: 9, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#4a4a6a' : 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Package size={13} />{loading ? 'Alterando...' : 'Confirmar Troca de Plano'}
        </button>

        {/* ── Trocar Senha ── */}
        {section('Trocar Senha', <Key size={12} />)}
        <div>
          <div style={fLabel}>Nova Senha (mín. 6 caracteres)</div>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha..."
            style={fInput}
            onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
          />
        </div>
        <button onClick={handleChangePassword} disabled={loading || !newPassword} style={{
          padding: '10px', borderRadius: 9, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#4a4a6a' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
          color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Key size={13} />{loading ? 'Alterando...' : 'Alterar Senha'}
        </button>

        {/* ── Logar como ── */}
        {section('Logar como Usuário', <LogIn size={12} />)}
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
            Você entrará na plataforma <strong>como {user.name}</strong> com todas as suas permissões e restrições de plano.
            Um banner vermelho ficará visível no topo durante a impersonação.
          </div>
          <button onClick={handleImpersonate} disabled={impersonating} style={{
            width: '100%', padding: '11px', borderRadius: 9, border: 'none', cursor: impersonating ? 'not-allowed' : 'pointer',
            background: impersonating ? '#4a4a6a' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <LogIn size={14} />{impersonating ? 'Iniciando...' : `👻 Entrar como ${user.name}`}
          </button>
        </div>

      </div>
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [viewUser, setViewUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [delError, setDelError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({
        page, limit: 50,
        ...(search && { q: search }),
        ...(planFilter && { plan: planFilter }),
        ...(statusFilter && { status: statusFilter }),
      })
      const res = await api.get(`/admin/users?${params}`)
      setUsers(res.users || [])
      setTotal(res.total || 0)
      setPages(res.pages || 1)
    } catch (e) {
      setUsers([]); setTotal(0)
      setError(e?.message || 'Erro ao carregar usuários')
    } finally { setLoading(false) }
  }, [page, search, planFilter, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load() }, 400)
    return () => clearTimeout(t)
  }, [search])

  const handleView = async (user) => {
    try {
      const detail = await api.get(`/admin/users/${user.id}`)
      // detail tem shape: { user, company, flows, agents, usage, ai_tokens, gateway_movements, … }
      // enriquecemos com os campos flat do listing
      setViewUser({ ...user, ...detail })
    } catch { setViewUser(user) }
  }

  const handleToggle = async (user) => {
    try { await adminApi.toggleUser(user.id); load() }
    catch (e) { alert(e?.message || 'Erro ao alterar status') }
  }

  const handleConfirmDelete = async () => {
    setDelLoading(true); setDelError('')
    try { await adminApi.deleteUser(deleteUser.id); setDeleteUser(null); load() }
    catch (e) { setDelError(e?.message || 'Erro ao excluir') }
    setDelLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>

      {/* ── VIEW MODAL ── */}
      {viewUser && <UserDetailModal viewUser={viewUser} onClose={() => setViewUser(null)} />}

      {/* ── EDIT MODAL ── */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); load() }}
        />
      )}

      {/* ── DELETE MODAL ── */}
      {deleteUser && (
        <Modal title="Confirmar Exclusão" icon={<AlertTriangle size={16} color="#ef4444" />} onClose={() => setDeleteUser(null)} width={440}>
          <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Excluir {deleteUser.name}?</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
              Esta ação é <strong style={{ color: '#ef4444' }}>permanente e irreversível</strong>.<br />
              Todos os dados do usuário serão removidos.
            </p>
            {delError && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, marginBottom: 12 }}>⚠️ {delError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteUser(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmDelete} disabled={delLoading} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: delLoading ? '#6b2020' : '#ef4444', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {delLoading ? '⏳ Excluindo...' : '🗑 Confirmar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Gerenciar Usuários</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {total.toLocaleString('pt-BR')} usuários · todos os tenants
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/register')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(6,182,212,0.15))',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: '#8b5cf6',
          }}>
            <UserPlus size={13} />Novo Usuário
          </button>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            <RefreshCw size={12} />Atualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 9, padding: '7px 12px', flex: 1 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou empresa..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: '100%' }} />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }} style={{ padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
          <option value="">Todos os planos</option>
          {ALL_PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={{ padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Usuário', 'Empresa / Tenant', 'Plano', 'Status', 'Fluxos', 'Agentes', 'Integrações', 'Ações'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum usuário encontrado</td></tr>
            ) : users.map(u => (
              <tr key={u.id}
                style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: `hsl(${(u.id * 60) % 360}, 60%, 35%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: 'white',
                    }}>
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{u.name}</span>
                        {u.is_superadmin && <Shield size={11} color="#ef4444" />}
                        {u.role === 'owner' && <Crown size={11} color="var(--nexus-amber)" />}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.company_name || '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {u.company_id || u.id}</div>
                </td>
                <td style={{ padding: '12px 14px' }}><PlanBadge plan={u.plan} /></td>
                <td style={{ padding: '12px 14px' }}><StatusDot active={u.is_active} /></td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{u.active_flows}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/{u.total_flows}</span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{u.active_agents}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{u.active_integrations}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {/* VIEW */}
                    <button title="Ver detalhe" onClick={() => handleView(u)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--nexus-cyan)'; e.currentTarget.style.color = 'var(--nexus-cyan)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    ><Eye size={12} /></button>

                    {/* EDIT */}
                    <button title="Editar" onClick={() => setEditUser(u)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--nexus-violet)'; e.currentTarget.style.color = 'var(--nexus-violet)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    ><Edit3 size={12} /></button>

                    {/* LOGAR COMO */}
                    {!u.is_superadmin && (
                      <button title="Logar como este usuário" onClick={() => setEditUser(u)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      ><LogIn size={12} /></button>
                    )}

                    {/* TOGGLE */}
                    <button title={u.is_active ? 'Suspender' : 'Ativar'} onClick={() => handleToggle(u)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = u.is_active ? 'var(--nexus-amber)' : 'var(--nexus-green)'; e.currentTarget.style.color = u.is_active ? 'var(--nexus-amber)' : 'var(--nexus-green)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >{u.is_active ? <Pause size={12} /> : <CheckCircle size={12} />}</button>

                    {/* DELETE */}
                    {!u.is_superadmin && (
                      <button title="Excluir" onClick={() => { setDelError(''); setDeleteUser(u) }} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      ><Trash2 size={12} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Página {page} de {pages} · {total} resultados</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
