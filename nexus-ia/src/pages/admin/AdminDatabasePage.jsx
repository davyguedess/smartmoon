/**
 * AdminDatabasePage — Inspetor de banco de dados
 * Extraído de AdminServer.jsx para modularização
 */
import { useState, useEffect, useCallback } from 'react'
import { Table2, Hash, Globe, Activity, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { api } from '../../api'
import { StatCard } from '../../components/cards'
import { AdminSectionHeader } from '../../components/admin'

// Colunas sensíveis mascaradas pelo backend — indicadas visualmente
const SENSITIVE_HINT = ['password_hash', 'encrypted_key', 'token_hash', 'api_key', 'secret_key']

export default function AdminDatabasePage() {
  const [tables, setTables] = useState([])
  const [dbStats, setDbStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedTable, setExpandedTable] = useState(null)
  const [tableData, setTableData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tablesData, statsData] = await Promise.all([
        api.adminDatabaseTables(),
        api.adminDatabaseStats(),
      ])
      setTables(tablesData.tables || [])
      setDbStats(statsData)
    } catch (e) {
      console.error('DB load error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadTableData = async (tableName) => {
    if (expandedTable === tableName) {
      setExpandedTable(null)
      setTableData(null)
      return
    }
    setExpandedTable(tableName)
    setLoadingData(true)
    try {
      setTableData(await api.adminDatabaseData(tableName, 20))
    } catch (e) {
      console.error('Table load error:', e)
    }
    setLoadingData(false)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} />
        <span style={{ marginLeft: 8 }}>Carregando banco de dados...</span>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  const totalRows = tables.reduce((s, t) => s + t.rows, 0)

  return (
    <div style={{ padding: 24 }}>
      <AdminSectionHeader
        title="🗄️ Banco de Dados"
        subtitle={dbStats ? `${dbStats.database_name} · ${dbStats.database_size} · ${dbStats.active_connections} conexões ativas` : ''}
        onRefresh={load}
      />

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard icon={Table2}   label="Tabelas"          value={tables.length}                  color="#8b5cf6" />
        <StatCard icon={Hash}     label="Total Registros"  value={totalRows.toLocaleString('pt-BR')} color="#3b82f6" />
        <StatCard icon={Globe}    label="Banco"            value={dbStats?.database_size || '—'}   color="#10b981" />
        <StatCard icon={Activity} label="Conexões"         value={dbStats?.active_connections || 0} color="#f59e0b" />
      </div>

      {/* Table list */}
      {tables.map(tbl => (
        <div key={tbl.name} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, marginBottom: 10, overflow: 'hidden',
          borderLeft: `3px solid ${expandedTable === tbl.name ? 'var(--nexus-violet)' : 'transparent'}`,
          transition: 'border-color 0.2s',
        }}>
          {/* Table header row */}
          <button onClick={() => loadTableData(tbl.name)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '14px 18px', border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
          }}>
            <Table2 size={16} color={tbl.rows > 0 ? 'var(--nexus-cyan)' : 'var(--text-muted)'} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{tbl.name}</span>
              <span style={{
                marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '2px 8px',
                background: tbl.rows > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                color: tbl.rows > 0 ? 'var(--nexus-green)' : 'var(--nexus-red)',
                borderRadius: 20,
              }}>
                {tbl.rows.toLocaleString('pt-BR')} {tbl.rows === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tbl.column_count} colunas</span>
            {expandedTable === tbl.name
              ? <ChevronUp size={14} color="var(--text-muted)" />
              : <ChevronDown size={14} color="var(--text-muted)" />}
          </button>

          {/* Expanded: schema + data */}
          {expandedTable === tbl.name && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {/* Column schema */}
              <div style={{ padding: '12px 18px', background: 'rgba(99,102,241,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--nexus-violet)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  📋 Esquema
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tbl.columns.map(col => (
                    <span key={col.name} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: col.is_sensitive ? 'rgba(239,68,68,0.06)' : 'var(--bg-elevated)',
                      border: `1px solid ${col.is_sensitive ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)'}`,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{ color: col.is_sensitive ? 'var(--nexus-red)' : 'var(--nexus-cyan)' }}>
                        {col.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>({col.type})</span>
                      {col.is_sensitive && <span title="Coluna mascarada">🔒</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Data rows */}
              {loadingData ? (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : tableData && tableData.rows.length > 0 ? (
                <div style={{ overflowX: 'auto', maxHeight: 400 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                        {tableData.columns.map(col => (
                          <th key={col} style={{
                            padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                            color: SENSITIVE_HINT.includes(col) ? 'var(--nexus-red)' : 'var(--nexus-violet)',
                            whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)',
                            position: 'sticky', top: 0, background: 'var(--bg-card)',
                          }}>
                            {col}{SENSITIVE_HINT.includes(col) ? ' 🔒' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {tableData.columns.map(col => (
                            <td key={col} style={{
                              padding: '7px 12px', whiteSpace: 'nowrap',
                              maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis',
                              color: row[col] === null ? 'var(--text-muted)'
                                : row[col] === '***MASKED***' ? 'var(--nexus-red)'
                                : 'var(--text-primary)',
                              fontFamily: typeof row[col] === 'number' ? 'monospace' : 'inherit',
                              fontStyle: row[col] === '***MASKED***' ? 'italic' : 'normal',
                            }}>
                              {row[col] === null ? '—'
                                : typeof row[col] === 'object' ? JSON.stringify(row[col]).slice(0, 80)
                                : String(row[col]).slice(0, 100)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 18px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                    Mostrando {tableData.rows.length} de {tableData.total.toLocaleString('pt-BR')} registros
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  Tabela vazia
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
