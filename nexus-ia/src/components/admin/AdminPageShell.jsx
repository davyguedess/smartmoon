/**
 * AdminPageShell — Reusable shell for module listing pages
 * Provides loading state, empty state, error state, data table + pagination
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

export function AdminPageShell({
  title,
  subtitle,
  icon: Icon,
  iconColor = '--nexus-violet',
  columns = [],
  fetchFn,
  renderRow,
  extraFilters,
  searchPlaceholder = 'Buscar...',
}) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (fetchFn) {
        const res = await fetchFn({ page, search })
        const items = res.items || res.agents || res.skills || res.profiles || res.campaigns || res.flows || res.integrations || res.events || res.records || res.users || []
        setRows(items)
        setTotal(res.total || items.length)
        setPages(Math.max(1, Math.ceil((res.total || items.length) / 50)))
      } else {
        // No fetchFn means this page has no backend yet — show empty
        setRows([])
        setTotal(0)
        setPages(1)
      }
    } catch (e) {
      setRows([])
      setTotal(0)
      const msg = e?.message || String(e)
      if (msg.includes('401') || msg.includes('403')) {
        setError('Sem permissão de superadmin')
      } else {
        setError(msg || 'Erro ao carregar dados')
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, fetchFn])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {Icon && (
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={`var(${iconColor})`} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{title}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {subtitle || `${total.toLocaleString('pt-BR')} registros · todos os tenants`}
            </p>
          </div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 9, padding: '7px 12px', flex: 1 }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={searchPlaceholder}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
        {extraFilters}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        {columns.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                {columns.map(col => (
                  <th key={col} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum registro encontrado</td></tr>
              ) : rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Página {page} de {pages} · {total} resultados</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Shared cell renderers
export function StatusBadge({ status, colorMap }) {
  const colors = colorMap?.[status] || { bg: 'rgba(100,116,139,0.15)', color: '#64748b' }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: colors.bg, color: colors.color }}>
      {status}
    </span>
  )
}

export function ActiveDot({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? 'var(--nexus-green)' : 'var(--nexus-red)', boxShadow: active ? '0 0 6px var(--nexus-green)' : 'none' }} />
      <span style={{ fontSize: 11, color: active ? 'var(--nexus-green)' : 'var(--nexus-red)', fontWeight: 600 }}>{active ? 'Ativo' : 'Inativo'}</span>
    </div>
  )
}

export function PlanBadge({ plan }) {
  const colors = {
    free: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
    starter: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    pro: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    business: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
    enterprise: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  }
  const c = colors[plan] || colors.free
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{plan || 'free'}</span>
}

export function TrRow({ children, ...props }) {
  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      {...props}
    >
      {children}
    </tr>
  )
}
