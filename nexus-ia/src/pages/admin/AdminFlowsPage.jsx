/**
 * AdminFlowsPage — Smart Moon Admin
 *
 * Tabela completa de flows de todos os tenants (cross-tenant).
 * Colunas: Fluxo / Empresa / Status / Versão / Nós / Execuções / Plano / Publicado / Criado
 *
 * Ao clicar em qualquer linha → Modal detail com:
 *  - KPIs de execução (total, sucesso, erros, duração média)
 *  - Diagrama simplificado dos nós (lista com tipos e labels)
 *  - Conexões/Arestas do flow
 *  - Agentes ativos da empresa
 *  - Integrações conectadas
 *  - Histórico de execuções (últimas 20)
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, X, RefreshCw, Search, ChevronLeft, ChevronRight,
  Zap, AlertCircle, CheckCircle, Clock, Play, Users, Plug2,
  Bot, ArrowRight, Eye, Trash2, ExternalLink,
} from 'lucide-react'
import { adminApi } from '../../api'
import { PlanBadge, StatusBadge } from '../../components/admin/AdminPageShell'

// ── Status color maps ─────────────────────────────────────────────────────────
const FLOW_STATUS_MAP = {
  draft:     { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
  published: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  archived:  { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const EXEC_STATUS_MAP = {
  success: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  error:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  running: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  queued:  { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
}

const INT_STATUS_MAP = {
  connected:    { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  disconnected: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  pending:      { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

// Node type icons
const NODE_ICONS = {
  trigger:          '⚡',
  llm:              '🧠',
  ai:               '🤖',
  condition:        '🔀',
  delay:            '⏳',
  send_message:     '💬',
  send_whatsapp:    '📲',
  send_telegram:    '✈️',
  send_email:       '📧',
  http:             '🌐',
  webhook:          '🔗',
  agent:            '🤖',
  loop:             '🔁',
  code:             '💻',
  end:              '🏁',
  start:            '🚀',
  api_call:         '📡',
  decision:         '🔀',
  speech_to_text:   '🎤',
  text_to_speech:   '🔊',
  crm:              '🗂️',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const dur = (s) => {
  if (!s) return '—'
  if (s < 60) return `${s}s`
  return `${Math.floor(s/60)}m ${s%60}s`
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Flow Detail Modal ─────────────────────────────────────────────────────────
function FlowDetailModal({ flowRow, onClose, onDelete }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('nodes') // nodes | executions | agents | integrations
  const [delConf, setDelConf] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const d = await adminApi.getFlow(flowRow.id)
        setDetail(d)
      } catch (e) {
        setError(e?.message || 'Erro ao carregar detalhes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [flowRow.id])

  const handleDelete = async () => {
    try {
      await adminApi.deleteFlow(flowRow.id)
      onDelete(flowRow.id)
      onClose()
    } catch (e) {
      setError(e?.message || 'Erro ao deletar')
      setDelConf(false)
    }
  }

  const TABS = [
    { id: 'nodes',        label: 'Nós & Conexões', icon: GitBranch },
    { id: 'executions',   label: 'Execuções',      icon: Play },
    { id: 'agents',       label: 'Agentes',        icon: Bot },
    { id: 'integrations', label: 'Integrações',    icon: Plug2 },
  ]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 18, width: '100%', maxWidth: 860, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Modal Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch size={20} color="var(--nexus-green)" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{flowRow.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span style={{ fontFamily: 'monospace' }}>#{flowRow.id}</span>
                {' · '}
                <span>{flowRow.company_name}</span>
                {' · '}
                <PlanBadge plan={flowRow.plan} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!delConf ? (
              <button onClick={() => setDelConf(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                <Trash2 size={12} /> Deletar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Confirmar?</span>
                <button onClick={handleDelete} style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Sim</button>
                <button onClick={() => setDelConf(false)} style={{
                  padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                }}>Não</button>
              </div>
            )}
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: 9, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}><X size={15} /></button>
          </div>
        </div>

        {/* ── Loading / Error ── */}
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Carregando detalhes...
          </div>
        )}
        {error && (
          <div style={{ padding: 20 }}>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12 }}>
              {error}
            </div>
          </div>
        )}

        {detail && !loading && (
          <>
            {/* ── KPIs ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 12, padding: '16px 24px',
              borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
            }}>
              {[
                { label: 'Total Exec.',  value: detail.execution_stats.total,   color: '--nexus-violet', icon: Play },
                { label: 'Sucesso',      value: detail.execution_stats.success,  color: '--nexus-green',  icon: CheckCircle },
                { label: 'Erros',        value: detail.execution_stats.errors,   color: '--nexus-red',    icon: AlertCircle },
                { label: 'Nós',          value: detail.definition.nodes_count,   color: '--nexus-cyan',   icon: GitBranch },
                { label: 'Duração Méd.', value: dur(detail.execution_stats.avg_duration_s), color: '--nexus-amber', icon: Clock, raw: true },
              ].map(({ label, value, color, icon: Icon, raw }) => (
                <div key={label} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 12, padding: '12px 14px', textAlign: 'center',
                }}>
                  <Icon size={14} color={`var(${color})`} style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: raw ? 16 : 22, fontWeight: 900, color: `var(${color})` }}>
                    {raw ? value : (typeof value === 'number' ? value.toLocaleString('pt-BR') : value)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Info bar ── */}
            <div style={{
              display: 'flex', gap: 20, padding: '12px 24px',
              borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'Status',    value: <StatusBadge status={detail.flow.status} colorMap={FLOW_STATUS_MAP} /> },
                { label: 'Versão',    value: <span style={{ fontWeight: 800, color: 'var(--nexus-violet)' }}>v{detail.flow.version || 1}</span> },
                { label: 'Empresa',   value: detail.company.name },
                { label: 'Criado por', value: detail.flow.created_by?.name || '—' },
                { label: 'Publicado', value: fmtDate(detail.flow.published_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 12 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 14px', fontSize: 12, fontWeight: 700,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: tab === id ? 'var(--nexus-violet)' : 'var(--text-muted)',
                  borderBottom: tab === id ? '2px solid var(--nexus-violet)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div style={{ padding: '16px 24px', flex: 1 }}>

              {/* NODES TAB */}
              {tab === 'nodes' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
                    {detail.definition.nodes_count} nós · {detail.definition.edges_count} conexões
                  </div>
                  {detail.definition.nodes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 12 }}>
                      Flow sem nós definidos
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.definition.nodes.map((node, i) => (
                        <div key={node.id || i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 10,
                          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>
                            {NODE_ICONS[node.type] || '📦'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {node.label || node.type || 'Nó'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              type: {node.type} · id: {node.id}
                            </div>
                          </div>
                          {/* Check if this node has edges connected */}
                          {(() => {
                            const inEdges  = detail.definition.edges.filter(e => e.target === node.id).length
                            const outEdges = detail.definition.edges.filter(e => e.source === node.id).length
                            return (
                              <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                                <span title="Entradas">↙ {inEdges}</span>
                                <span title="Saídas">↗ {outEdges}</span>
                              </div>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edges */}
                  {detail.definition.edges.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Conexões / Arestas ({detail.definition.edges_count})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {detail.definition.edges.map((edge, i) => {
                          const srcNode = detail.definition.nodes.find(n => n.id === edge.source)
                          const tgtNode = detail.definition.nodes.find(n => n.id === edge.target)
                          return (
                            <div key={edge.id || i} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                              borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                              fontSize: 11,
                            }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {NODE_ICONS[srcNode?.type] || '📦'} {srcNode?.label || edge.source}
                              </span>
                              <ArrowRight size={11} style={{ flexShrink: 0, color: 'var(--nexus-violet)' }} />
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {NODE_ICONS[tgtNode?.type] || '📦'} {tgtNode?.label || edge.target}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EXECUTIONS TAB */}
              {tab === 'executions' && (
                <div>
                  {detail.recent_executions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
                      Nenhuma execução registrada
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {['#ID', 'Status', 'Trigger', 'Início', 'Duração'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.recent_executions.map(e => (
                            <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{e.id}</td>
                              <td style={{ padding: '9px 12px' }}><StatusBadge status={e.status || 'queued'} colorMap={EXEC_STATUS_MAP} /></td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>{e.trigger || '—'}</td>
                              <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(e.created_at)}</td>
                              <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: 'var(--nexus-amber)' }}>{dur(e.duration_s)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AGENTS TAB */}
              {tab === 'agents' && (
                <div>
                  {detail.agents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
                      Nenhum agente ativo nesta empresa
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.agents.map(agent => (
                        <div key={agent.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16,
                          }}>🤖</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              {agent.type} · {agent.model || '—'}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                            background: agent.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: agent.is_active ? '#10b981' : '#ef4444',
                          }}>
                            {agent.is_active ? '● Ativo' : '○ Inativo'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* INTEGRATIONS TAB */}
              {tab === 'integrations' && (
                <div>
                  {detail.integrations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
                      Nenhuma integração configurada nesta empresa
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.integrations.map(integ => (
                        <div key={integ.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{integ.provider}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Desde {fmtDate(integ.created_at)}</div>
                          </div>
                          <StatusBadge status={integ.status || 'pending'} colorMap={INT_STATUS_MAP} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminFlowsPage() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('all') // all | published | draft | archived
  const [selected, setSelected] = useState(null)  // flow row for modal

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await adminApi.listFlows({ page, search })
      const items = res.flows || res.items || []
      setRows(items)
      setTotal(res.total || items.length)
      setPages(Math.max(1, Math.ceil((res.total || items.length) / 50)))
    } catch (e) {
      setError(e?.message || 'Erro ao carregar flows')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleDelete = (deletedId) => {
    setRows(prev => prev.filter(r => r.id !== deletedId))
    setTotal(prev => prev - 1)
  }

  // Apply local filter
  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = {
    total:      rows.length,
    published:  rows.filter(r => r.status === 'published').length,
    draft:      rows.filter(r => r.status === 'draft').length,
    executions: rows.reduce((acc, r) => acc + (r.total_executions || 0), 0),
  }

  const COL = ['', 'Fluxo', 'Empresa', 'Status', 'Versão', 'Nós', 'Execuções', 'Plano', 'Publicado', 'Criado']

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Gerenciar Fluxos</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Todos os fluxos da plataforma · {total.toLocaleString('pt-BR')} registros
          </p>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Fluxos',    value: kpis.total,      color: '--nexus-violet' },
          { label: 'Publicados',         value: kpis.published,  color: '--nexus-green'  },
          { label: 'Rascunhos',          value: kpis.draft,      color: '--nexus-amber'  },
          { label: 'Execuções (página)', value: kpis.executions.toLocaleString('pt-BR'), color: '--nexus-cyan' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: `var(${color})` }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 9, padding: '8px 12px',
        }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar fluxo ou empresa..."
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
        {['all', 'published', 'draft', 'archived'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filter === f ? 'var(--nexus-violet)' : 'var(--bg-card)',
            color: filter === f ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${filter === f ? 'var(--nexus-violet)' : 'var(--border-subtle)'}`,
          }}>
            {f === 'all' ? 'Todos' : f === 'published' ? '✅ Publicados' : f === 'draft' ? '📝 Rascunhos' : '🗃️ Arquivados'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
          borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14,
        }}>
          <AlertCircle size={14} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: 6,
            border: '1px solid rgba(239,68,68,0.3)', background: 'transparent',
            color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>Tentar novamente</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
              {COL.map(col => (
                <th key={col} style={{
                  padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap'
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COL.length} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={COL.length} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum fluxo encontrado</td></tr>
            ) : filtered.map((r, i) => (
              <tr
                key={r.id || i}
                onClick={() => setSelected(r)}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* View icon */}
                <td style={{ padding: '11px 14px', width: 36 }}>
                  <Eye size={13} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                </td>
                {/* Fluxo */}
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{r.id}</div>
                </td>
                {/* Empresa */}
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.company_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID {r.company_id}</div>
                </td>
                {/* Status */}
                <td style={{ padding: '11px 14px' }}>
                  <StatusBadge status={r.status || 'draft'} colorMap={FLOW_STATUS_MAP} />
                </td>
                {/* Versão */}
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-violet)' }}>
                  v{r.version || 1}
                </td>
                {/* Nós */}
                <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--nexus-cyan)', fontWeight: 700 }}>
                  {r.nodes_count ?? '—'}
                </td>
                {/* Execuções */}
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={11} color="var(--nexus-amber)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus-amber)' }}>
                      {(r.total_executions || 0).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </td>
                {/* Plano */}
                <td style={{ padding: '11px 14px' }}>
                  <PlanBadge plan={r.plan} />
                </td>
                {/* Publicado */}
                <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {r.published_at ? new Date(r.published_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                {/* Criado */}
                <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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

      {/* Click hint */}
      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          <Eye size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          Clique em qualquer linha para ver o detalhe completo do fluxo
        </div>
      )}

      {/* Modal */}
      {selected && (
        <FlowDetailModal
          flowRow={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
