/**
 * DataTable — Tabela de dados genérica e reutilizável
 * 
 * Props:
 *   columns: [{ key, label, render?, width? }]
 *   rows: Array de objetos
 *   loading: boolean
 *   emptyMessage: string
 *   onRowClick: (row) => void (opcional)
 *   stickyHeader: boolean (default true)
 */
import { Loader } from 'lucide-react'

export function DataTable({
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = 'Nenhum dado encontrado',
  onRowClick,
  stickyHeader = true,
  maxHeight,
}) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} />
        <span style={{ marginLeft: 8 }}>Carregando...</span>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', maxHeight }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: 'var(--nexus-violet)',
                borderBottom: '1px solid var(--border-subtle)',
                whiteSpace: 'nowrap',
                width: col.width,
                ...(stickyHeader ? {
                  position: 'sticky', top: 0,
                  background: 'var(--bg-card)',
                  zIndex: 1,
                } : {}),
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (onRowClick) e.currentTarget.style.background = 'rgba(99,102,241,0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 250,
                }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Pagination — controle de paginação para DataTable
 */
export function Pagination({ total, limit, offset, onPageChange }) {
  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderTop: '1px solid var(--border-subtle)',
      fontSize: 11, color: 'var(--text-muted)',
    }}>
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} de {total}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={page === 1}
          onClick={() => onPageChange(offset - limit)}
          style={pageBtn(page === 1)}
        >← Anterior</button>
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(offset + limit)}
          style={pageBtn(page === totalPages)}
        >Próximo →</button>
      </div>
    </div>
  )
}

function pageBtn(disabled) {
  return {
    padding: '5px 12px', borderRadius: 8,
    border: '1px solid var(--border-default)',
    background: disabled ? 'transparent' : 'var(--bg-card)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 11, fontWeight: 600, opacity: disabled ? 0.5 : 1,
  }
}
