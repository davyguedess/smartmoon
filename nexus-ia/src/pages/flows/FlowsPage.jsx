/**
 * Smart Moon — Flows List Page
 * Mostra todos os flows da empresa com cards, status e ações rápidas.
 * Botão "Novo Fluxo" → /flows/new/builder
 * Botão "Editar"     → /flows/:id/builder
 * Botão "Testar"     → api.testFlow(id)
 * Botão "Publicar"   → api.publishFlow(id)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GitBranch, Plus, Play, Edit3, Trash2, Zap, Globe, Lock,
  Clock, CheckCircle, XCircle, RefreshCw, Activity
} from 'lucide-react'
import { api } from '../../api'

// ── Helpers ──────────────────────────────────────────────────────────────────

const TRIGGER_ICONS = {
  webhook: '🔗', whatsapp: '💬', telegram: '📱', gmail: '📧',
  schedule: '⏰', manual: '▶️', whatsapp_trigger: '💬', telegram_trigger: '📱',
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 16, paddingBottom: 60,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'linear-gradient(135deg, var(--nexus-violet)18, var(--nexus-cyan)18)',
        border: '1px dashed var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30,
      }}>🧩</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nenhum fluxo criado</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Crie seu primeiro fluxo de automação com IA
        </div>
      </div>
      <button onClick={onNew} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 20px', borderRadius: 10,
        background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
        border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
      }}>
        <Plus size={14} />
        Criar Primeiro Fluxo
      </button>
    </div>
  )
}

// ── Flow Card ─────────────────────────────────────────────────────────────────

function FlowCard({ flow, onEdit, onTest, onPublish, onDelete, testing }) {
  const [hovered, setHovered] = useState(false)
  const isPublished = flow.status === 'published' || flow.is_active
  const trigger = flow.trigger_type || flow.trigger?.type || 'manual'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--nexus-violet)40' : 'var(--border-subtle)'}`,
        borderRadius: 14,
        padding: '16px 18px',
        cursor: 'default',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(115,85,235,0.15)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Trigger icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {TRIGGER_ICONS[trigger] || '🧩'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flow.name || `Fluxo #${flow.id}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flow.description || 'Sem descrição'}
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: isPublished ? 'var(--nexus-green)15' : 'var(--bg-base)',
          color: isPublished ? 'var(--nexus-green)' : 'var(--text-muted)',
          border: `1px solid ${isPublished ? 'var(--nexus-green)30' : 'var(--border-subtle)'}`,
        }}>
          {isPublished ? <Globe size={9} /> : <Lock size={9} />}
          {isPublished ? 'Ativo' : 'Rascunho'}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 16,
        padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)',
        fontSize: 11, color: 'var(--text-muted)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <GitBranch size={10} color="var(--nexus-violet)" />
          {flow.nodes_count ?? (flow.definition?.nodes?.length ?? '—')} nós
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Activity size={10} color="var(--nexus-blue)" />
          {flow.total_executions ?? 0} execuções
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={10} />
          {timeAgo(flow.updated_at || flow.created_at)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onEdit(flow)} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: 'var(--nexus-violet)18', border: '1px solid var(--nexus-violet)30',
          color: 'var(--nexus-violet)', transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--nexus-violet)28'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--nexus-violet)18'}
        >
          <Edit3 size={11} />
          Editar
        </button>

        <button onClick={() => onTest(flow)} disabled={testing === flow.id} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: testing === flow.id ? 'var(--nexus-green)08' : 'var(--nexus-green)18',
          border: '1px solid var(--nexus-green)30',
          color: 'var(--nexus-green)', opacity: testing === flow.id ? 0.7 : 1,
          transition: 'background 0.15s',
        }}>
          {testing === flow.id
            ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <Play size={11} />
          }
          {testing === flow.id ? 'Testando...' : 'Testar'}
        </button>

        {!isPublished && (
          <button onClick={() => onPublish(flow)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'var(--nexus-cyan)18', border: '1px solid var(--nexus-cyan)30',
            color: 'var(--nexus-cyan)', transition: 'background 0.15s',
          }}>
            <Zap size={11} />
            Publicar
          </button>
        )}

        <button onClick={() => onDelete(flow)} style={{
          width: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px 0', borderRadius: 8, fontSize: 11, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--nexus-red)15'; e.currentTarget.style.color = 'var(--nexus-red)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const navigate = useNavigate()
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(null)  // flow id being tested
  const [toast, setToast] = useState(null)       // {msg, type:'ok'|'err'}

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listFlows()
      setFlows(data || [])
    } catch { setFlows([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleEdit = (flow) => {
    navigate(`/flows/${flow.id}/builder`)
  }

  const handleNew = () => {
    navigate('/flows/new/builder')
  }

  const handleTest = async (flow) => {
    setTesting(flow.id)
    try {
      await api.testFlow(flow.id, {})
      showToast(`✅ Fluxo "${flow.name}" testado com sucesso!`)
    } catch (e) {
      showToast(`❌ Erro ao testar: ${e.message}`, 'err')
    }
    setTesting(null)
  }

  const handlePublish = async (flow) => {
    try {
      await api.publishFlow(flow.id)
      showToast(`🚀 Fluxo "${flow.name}" publicado!`)
      load()
    } catch (e) {
      showToast(`❌ Erro: ${e.message}`, 'err')
    }
  }

  const handleDelete = async (flow) => {
    if (!confirm(`Excluir fluxo "${flow.name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.deleteFlow(flow.id)
      showToast(`🗑️ Fluxo removido.`)
      setFlows(f => f.filter(x => x.id !== flow.id))
    } catch (e) {
      showToast(`❌ Erro: ${e.message}`, 'err')
    }
  }

  const totalActive = flows.filter(f => f.status === 'published' || f.is_active).length

  return (
    <div className="flows-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 768px) {
          .flows-page .flows-header { padding: 12px 14px !important; flex-wrap: wrap !important; gap: 8px !important; }
          .flows-page .flows-header h1 { font-size: 16px !important; }
          .flows-page .flows-header .flows-new-btn span { display: none; }
          .flows-page .flows-content { padding: 14px !important; }
          .flows-page .flows-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .flows-page .flows-stats-row { gap: 8px !important; flex-wrap: wrap !important; }
          .flows-page .flow-actions { flex-wrap: wrap !important; }
          .flows-page .flow-actions button { font-size: 10px !important; padding: 6px 0 !important; }
          .flows-page .flows-toast { bottom: 80px !important; }
        }
      `}</style>

      {/* ─── Header ─── */}
      <div className="flows-header" style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Fluxos de Automação</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '2px 0 0' }}>
            {loading ? 'Carregando...' : `${flows.length} fluxos · ${totalActive} ativos`}
          </p>
        </div>

        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          borderRadius: 8, border: '1px solid var(--border-default)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={12} />
        </button>

        <button onClick={handleNew} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
          borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
          color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(115,85,235,0.3)',
        }}>
          <Plus size={14} />
          Novo Fluxo
        </button>
      </div>

      {/* ─── Content ─── */}
      <div className="flows-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 60 }}>
            Carregando...
          </div>
        ) : flows.length === 0 ? (
          <EmptyState onNew={handleNew} />
        ) : (
          <div className="flows-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {flows.map(flow => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onEdit={handleEdit}
                onTest={handleTest}
                onPublish={handlePublish}
                onDelete={handleDelete}
                testing={testing}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'err' ? '#ef444420' : '#10b98120',
          border: `1px solid ${toast.type === 'err' ? '#ef4444' : '#10b981'}40`,
          color: toast.type === 'err' ? '#ef4444' : '#10b981',
          backdropFilter: 'blur(8px)', zIndex: 999, pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
