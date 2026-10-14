/**
 * AdminCreditsPage — Gestão de Créditos SM
 * Abas: Saldos | Pacotes SM | Compras
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Coins, Search, TrendingUp, TrendingDown, Users, Star, ChevronRight,
  X, ArrowUpRight, ArrowDownRight, Gift, ShoppingCart, RefreshCw, Clock,
  Building2, Plus, Package, Trash2, Eye, Edit3, CheckCircle2, AlertCircle,
  Save, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { adminApi } from '../../api'
import { useToast } from '../../components/ui/Toast'

const badge = (text, color = '#7c3aed', bg = 'rgba(124,58,237,0.12)') => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: bg, color, textTransform: 'uppercase', letterSpacing: 1 }}>{text}</span>
)

const planColor = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', business: '#e91e8c', enterprise: '#f59e0b' }

const TAB_STYLE = (active) => ({
  padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: active ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'rgba(255,255,255,0.05)',
  color: active ? '#000' : 'var(--text-muted)', fontWeight: 700, fontSize: 12,
  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
})
const lblStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

// ── Grant Credits Modal ───────────────────────────────────────────────────────
function GrantModal({ companies, onClose, onDone }) {
  const [form, setForm] = useState({ company_id: '', amount: 100, type: 'bonus', description: 'Bônus de boas-vindas' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGrant = async () => {
    if (!form.company_id || form.amount <= 0) return setError('Selecione a empresa e defina um valor positivo')
    setSaving(true); setError(null)
    try {
      const res = await adminApi.grantCredits({ ...form, amount: parseInt(form.amount), company_id: parseInt(form.company_id) })
      onDone(res)
      onClose()
    } catch (e) { setError(e?.message || 'Erro ao conceder créditos') }
    finally { setSaving(false) }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16,
        width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Gift size={18} color="#f59e0b" /> Conceder Créditos
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Adicione créditos manualmente ao saldo de uma empresa
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>{error}</div>}

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lblStyle}>Empresa</label>
            <select value={form.company_id} onChange={e => set('company_id', e.target.value)} style={inputStyle}>
              <option value="">Selecione a empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.plan})</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>Quantidade de Créditos</label>
            <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lblStyle}>Tipo de Transação</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
              <option value="bonus">Bônus</option>
              <option value="purchase">Compra</option>
              <option value="refund">Reembolso</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>Descrição / Motivo</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Ex: Bônus de indicação, Reembolso..." style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleGrant} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#000', fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Processando...' : `Conceder ${form.amount || 0} Créditos`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ company, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getCreditHistory(company.company_id || company.id)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [company])

  const typeIcon = (type) => {
    if (type === 'consume') return <ArrowDownRight size={14} color="#ef4444" />
    if (type === 'bonus' || type === 'purchase') return <ArrowUpRight size={14} color="#10b981" />
    if (type === 'refund') return <RefreshCw size={14} color="#3b82f6" />
    return <Coins size={14} color="#6b7280" />
  }
  const typeColor = (type) => type === 'consume' ? '#ef4444' : (type === 'bonus' || type === 'purchase') ? '#10b981' : '#3b82f6'

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16,
        width: '100%', maxWidth: 720, maxHeight: '88vh', overflow: 'auto', padding: 0 }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{company.company}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  {badge(company.plan, planColor[company.plan] || '#6b7280')}
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                    Saldo: {data?.balance ?? company.balance} créditos
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Carregando...</div>
          ) : !data?.transactions?.length ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Nenhuma transação registrada</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.transactions.map((tx) => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${typeColor(tx.type)}15` }}>
                    {typeIcon(tx.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{tx.description || tx.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: typeColor(tx.type) }}>
                      {tx.type === 'consume' ? '-' : '+'}{Math.abs(tx.amount)} cr.
                    </div>
                    {tx.balance_after != null && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Saldo: {tx.balance_after}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pack Editor Modal ─────────────────────────────────────────────────────────
function PackEditorModal({ pack, onClose, onSave }) {
  const isNew = !pack?.id
  const [form, setForm] = useState({
    name: '', description: '', credits_amount: 100, price_brl: 9.90,
    badge_text: '', is_active: true, is_highlighted: false, sort_order: 0,
    color: '#f59e0b', icon: 'coins',
    ...(pack || {}),
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.credits_amount) return
    setSaving(true)
    try {
      await adminApi.saveSmCreditPack(form)
      onSave()
      onClose()
    } catch (e) { alert(e?.message || 'Erro') }
    finally { setSaving(false) }
  }

  const ICON_OPTIONS = ['coins', 'zap', 'star', 'rocket', 'crown', 'gift', 'sparkles']
  const COLOR_OPTIONS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#e91e8c', '#6366f1', '#14b8a6']

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div style={{ background: '#0f0f1a', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16,
        width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Package size={18} color="#f59e0b" /> {isNew ? 'Novo Pack SM' : 'Editar Pack SM'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lblStyle}>Nome do Pack</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Iniciante" style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Badge (etiqueta)</label>
              <input value={form.badge_text || ''} onChange={e => set('badge_text', e.target.value)} placeholder="Ex: POPULAR" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={lblStyle}>Descrição</label>
            <input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Descrição curta..." style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lblStyle}>Créditos SM</label>
              <input type="number" min="1" value={form.credits_amount} onChange={e => set('credits_amount', parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Preço (R$)</label>
              <input type="number" min="0" step="0.01" value={form.price_brl} onChange={e => set('price_brl', parseFloat(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Ordem</label>
              <input type="number" min="0" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>
          </div>

          {/* Color + Icon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lblStyle}>Cor</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => set('color', c)} style={{
                    width: 28, height: 28, borderRadius: 8, border: form.color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    background: c, cursor: 'pointer', transition: 'all 0.15s',
                  }} />
                ))}
              </div>
            </div>
            <div>
              <label style={lblStyle}>Ícone</label>
              <select value={form.icon} onChange={e => set('icon', e.target.value)} style={inputStyle}>
                {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e5e7eb' }}>
              <button onClick={() => set('is_active', !form.is_active)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {form.is_active ? <ToggleRight size={22} color="#10b981" /> : <ToggleLeft size={22} color="#6b7280" />}
              </button>
              Ativo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e5e7eb' }}>
              <button onClick={() => set('is_highlighted', !form.is_highlighted)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {form.is_highlighted ? <ToggleRight size={22} color="#f59e0b" /> : <ToggleLeft size={22} color="#6b7280" />}
              </button>
              Destaque
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#000', fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Pack'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Saldos ───────────────────────────────────────────────────────────────
function TabSaldos({ search, setSearch, page, setPage, credits, total, loading, kpis, setGrantModal, setHistoryTarget }) {
  const KPIS = [
    { label: 'Saldo Total', value: `${(kpis.total_balance || 0).toLocaleString()} cr.`, icon: <Coins size={16} />, color: '#f59e0b' },
    { label: 'Total Emitido', value: `${(kpis.total_earned || 0).toLocaleString()} cr.`, icon: <TrendingUp size={16} />, color: '#10b981' },
    { label: 'Empresas c/ saldo', value: kpis.companies_with_credits || 0, icon: <Users size={16} />, color: '#7c3aed' },
    { label: 'Total Empresas', value: total, icon: <Building2 size={16} />, color: '#3b82f6' },
  ]

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {KPIS.map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, color: k.color }}>
              {k.icon}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar empresa..." style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              {['Empresa', 'Plano', 'Saldo', 'Total Ganho', 'Gasto', 'Tx', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : credits.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma empresa encontrada</td></tr>
            ) : credits.map(cr => (
              <tr key={cr.company_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setHistoryTarget(cr)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>{cr.company}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID #{cr.company_id}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    background: `${planColor[cr.plan] || '#6b7280'}22`, color: planColor[cr.plan] || '#6b7280' }}>{cr.plan}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: cr.balance > 0 ? '#f59e0b' : '#6b7280' }}>{cr.balance.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>cr.</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{cr.lifetime_earned.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{cr.total_spent.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{cr.tx_count}</td>
                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setHistoryTarget(cr)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 12px', borderRadius: 7,
                      border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Histórico <ChevronRight size={11} />
                    </button>
                    <button onClick={() => setGrantModal(true)} style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px', borderRadius: 7,
                      border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      <Gift size={11} /> +
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>‹ Ant.</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Pág. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={credits.length < 50}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>Próx. ›</button>
        </div>
      )}
    </>
  )
}

// ── Tab: Pacotes SM ──────────────────────────────────────────────────────────
function TabPacks() {
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editPack, setEditPack] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await adminApi.listSmCreditPacks(); setPacks(res.packs || []) }
    catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Desativar este pack?')) return
    try { await adminApi.deleteSmCreditPack(id); load() } catch { }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{packs.length} pacotes configurados</div>
        <button onClick={() => setEditPack({})} style={{
          display: 'flex', gap: 6, alignItems: 'center', padding: '9px 18px', borderRadius: 9, border: 'none',
          background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer'
        }}>
          <Plus size={14} /> Novo Pack
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {packs.map(pack => (
            <div key={pack.id} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${pack.is_active ? 'rgba(255,255,255,0.07)' : 'rgba(239,68,68,0.2)'}`,
              opacity: pack.is_active ? 1 : 0.5, transition: 'all 0.2s',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${pack.color}18`, border: `1px solid ${pack.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Coins size={18} style={{ color: pack.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>{pack.name}</span>
                  {pack.badge_text && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 12, background: pack.color, color: '#fff' }}>{pack.badge_text}</span>}
                  {!pack.is_active && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>INATIVO</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{pack.description}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: pack.color }}>{pack.credits_amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>créditos SM</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#e5e7eb' }}>
                  {pack.price_brl === 0 ? 'GRÁTIS' : `R$ ${Number(pack.price_brl).toFixed(2).replace('.', ',')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditPack(pack)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Edit3 size={11} /> Editar
                </button>
                {pack.is_active && (
                  <button onClick={() => handleDelete(pack.id)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editPack !== null && <PackEditorModal pack={editPack.id ? editPack : null} onClose={() => setEditPack(null)} onSave={load} />}
    </>
  )
}

// ── Tab: Compras SM ──────────────────────────────────────────────────────────
function TabPurchases() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listSmCreditPurchases({ page, status: filter, search })
      setPurchases(res.purchases || [])
      setTotal(res.total || 0)
    } catch { }
    finally { setLoading(false) }
  }, [page, filter, search])

  useEffect(() => { load() }, [load])

  const statusColor = { paid: '#10b981', pending: '#f59e0b', expired: '#ef4444' }
  const statusLabel = { paid: 'Pago', pending: 'Pendente', expired: 'Expirado' }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'paid', 'pending', 'expired'].map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1) }}
            style={{
              padding: '6px 16px', borderRadius: 7, border: `1px solid ${filter === s ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
              background: filter === s ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
              color: filter === s ? '#fbbf24' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
            {s === 'all' ? 'Todos' : statusLabel[s] || s}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar empresa..." style={{ ...inputStyle, paddingLeft: 32, fontSize: 12 }} />
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              {['ID', 'Empresa', 'Pack', 'Créditos', 'Valor', 'Método', 'Status', 'Data'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma compra encontrada</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>#{p.id}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{p.company_name}</div>
                  {p.user_email && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.user_email}</div>}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{p.pack_name || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 900, color: '#f59e0b' }}>{(p.credits_amount || 0).toLocaleString()}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                    background: p.payment_method === 'wallet' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                    color: p.payment_method === 'wallet' ? '#10b981' : '#6366f1', textTransform: 'uppercase' }}>
                    {p.payment_method || 'PIX'}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                    background: `${statusColor[p.status] || '#6b7280'}18`, color: statusColor[p.status] || '#6b7280', textTransform: 'uppercase' }}>
                    {statusLabel[p.status] || p.status}
                  </span>
                </td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>‹</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '6px 12px' }}>Pág. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={purchases.length < 50}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>›</button>
        </div>
      )}
    </>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminCreditsPage() {
  const [activeTab, setActiveTab] = useState('saldos')
  const [credits, setCredits] = useState([])
  const [kpis, setKpis] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [grantModal, setGrantModal] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [companies, setCompanies] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listCredits({ page, search })
      setCredits(res.credits || [])
      setTotal(res.total || 0)
      setKpis(res.kpis || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { adminApi.listCompanies().then(setCompanies).catch(() => {}) }, [])

  return (
    <div style={{ padding: 28, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins size={18} color="#f59e0b" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>Créditos SM</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Gerencie saldos, pacotes e compras de créditos da plataforma
          </p>
        </div>
        {activeTab === 'saldos' && (
          <button onClick={() => setGrantModal(true)} style={{
            display: 'flex', gap: 8, alignItems: 'center', padding: '10px 20px', borderRadius: 10,
            border: 'none', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#000',
            fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> Conceder Créditos
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={() => setActiveTab('saldos')} style={TAB_STYLE(activeTab === 'saldos')}>
          <Coins size={14} /> Saldos
        </button>
        <button onClick={() => setActiveTab('packs')} style={TAB_STYLE(activeTab === 'packs')}>
          <Package size={14} /> Pacotes SM
        </button>
        <button onClick={() => setActiveTab('purchases')} style={TAB_STYLE(activeTab === 'purchases')}>
          <ShoppingCart size={14} /> Compras
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'saldos' && (
        <TabSaldos
          search={search} setSearch={setSearch} page={page} setPage={setPage}
          credits={credits} total={total} loading={loading} kpis={kpis}
          setGrantModal={setGrantModal} setHistoryTarget={setHistoryTarget}
        />
      )}
      {activeTab === 'packs' && <TabPacks />}
      {activeTab === 'purchases' && <TabPurchases />}

      {/* Modals */}
      {grantModal && <GrantModal companies={companies} onClose={() => setGrantModal(false)} onDone={load} />}
      {historyTarget && <HistoryModal company={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  )
}
