/**
 * AgentsStorePage — Marketplace de Agentes IA para o usuário.
 *
 * Rotas:
 *   /store/agents      → catálogo
 *   /store/my-agents   → instalados
 *
 * Integra com:
 *   GET  /store/agents
 *   GET  /store/my-agents
 *   POST /store/agents/:id/install
 *   DEL  /store/agents/:id
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Search, ShoppingCart, CheckCircle2, Lock, X,
  RefreshCw, Coins, Package, Sparkles, Download,
  MessageSquare, Zap, Brain, Star, Users,
} from 'lucide-react'
import { api } from '../../api'
import { usePlan } from '../../hooks/usePlan'

// ── Agent Card ─────────────────────────────────────────────────────────────────
function AgentCard({ agent, installed, onInstall, onUninstall, installing, credits, planFeatures }) {
  const isFree = agent.price_credits === 0
  const canAfford = isFree || credits >= agent.price_credits
  const isExclusive = agent.is_exclusive

  const ROLE_COLORS = {
    sales: '#6366f1', support: '#10b981', marketing: '#f59e0b',
    finance: '#3b82f6', hr: '#ec4899', operations: '#8b5cf6', default: '#64748b',
  }
  const roleColor = ROLE_COLORS[agent.role?.toLowerCase()] || ROLE_COLORS.default

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${installed ? '#6366f130' : 'var(--border-subtle)'}`,
      borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
    }}
      onMouseOver={e => e.currentTarget.style.borderColor = installed ? '#6366f150' : 'var(--nexus-cyan)40'}
      onMouseOut={e => e.currentTarget.style.borderColor = installed ? '#6366f130' : 'var(--border-subtle)'}
    >
      {isExclusive && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          color: '#fff', fontSize: 9, fontWeight: 800,
          padding: '2px 8px', borderRadius: 20, letterSpacing: 0.5,
        }}>EXCLUSIVO</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${roleColor}20`, border: `1px solid ${roleColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{agent.icon || '🤖'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{agent.name}</div>
          <div style={{
            fontSize: 10, color: '#fff', fontWeight: 700,
            background: roleColor, padding: '1px 8px', borderRadius: 20,
            display: 'inline-block', opacity: 0.9,
          }}>{agent.role || 'Agente'}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{agent.description || 'Agente de IA especializado para sua empresa.'}</p>

      {/* Capabilities */}
      {agent.capabilities?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {agent.capabilities.slice(0, 3).map((cap, i) => (
            <span key={i} style={{
              fontSize: 10, color: 'var(--nexus-cyan)', fontWeight: 600,
              background: 'var(--nexus-cyan)10', border: '1px solid var(--nexus-cyan)25',
              padding: '1px 7px', borderRadius: 20,
            }}>✓ {cap}</span>
          ))}
        </div>
      )}

      {/* Stats */}
      {(agent.uses_count > 0 || agent.rating) && (
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          {agent.uses_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} />
              {agent.uses_count} usos
            </span>
          )}
          {agent.rating && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={11} color="#f59e0b" fill="#f59e0b" />
              {agent.rating}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Coins size={13} color={isFree ? '#10b981' : '#f59e0b'} />
          <span style={{ fontSize: 13, fontWeight: 800, color: isFree ? '#10b981' : '#f59e0b' }}>
            {isFree ? 'Grátis' : `${agent.price_credits} cr.`}
          </span>
        </div>

        {installed ? (
          <button
            onClick={() => onUninstall(agent.id)}
            disabled={installing === agent.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
              background: '#6366f120', border: '1px solid #6366f140',
              color: '#6366f1', fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#ef444420'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444440' }}
            onMouseOut={e => { e.currentTarget.style.background = '#6366f120'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#6366f140' }}
          >
            <CheckCircle2 size={12} /> Instalado
          </button>
        ) : !canAfford ? (
          <button disabled style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 9, cursor: 'not-allowed',
            background: '#ef444415', border: '1px solid #ef444430',
            color: '#ef4444', fontSize: 11, fontWeight: 700,
          }}>
            <Coins size={11} /> Sem créditos
          </button>
        ) : (
          <button
            onClick={() => onInstall(agent)}
            disabled={installing === agent.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
              background: `linear-gradient(135deg, ${roleColor}, ${roleColor}dd)`,
              border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
              opacity: installing === agent.id ? 0.6 : 1, transition: 'opacity 0.2s',
            }}
          >
            {installing === agent.id ? <RefreshCw size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={11} />}
            {isFree ? 'Instalar' : `Instalar — ${agent.price_credits} cr.`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Confirm modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ agent, credits, onConfirm, onCancel, loading }) {
  if (!agent) return null
  const isFree = agent.price_credits === 0
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 20, padding: 32, width: '100%', maxWidth: 420,
        animation: 'fadeUp 0.2s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>{agent.icon || '🤖'}</div>
        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 18 }}>Adicionar "{agent.name}"?</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
          {agent.description}
        </p>
        {!isFree && (
          <div style={{
            background: '#f59e0b15', border: '1px solid #f59e0b30',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Custo</span>
            <span style={{ fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Coins size={14} />{agent.price_credits} créditos
            </span>
          </div>
        )}
        {!isFree && (
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 12, padding: '10px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)',
          }}>
            <span>Saldo disponível</span>
            <span style={{ fontWeight: 700, color: credits >= agent.price_credits ? '#10b981' : '#ef4444' }}>
              {credits} cr.
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Adicionando…' : isFree ? 'Adicionar grátis' : `Confirmar — ${agent.price_credits} cr.`}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AgentsStorePage() {
  const { credits, features: planFeatures, planLabel, planColor, refresh: refreshPlan } = usePlan()
  const [tab, setTab] = useState('store')
  const [agents, setAgents] = useState([])
  const [myAgents, setMyAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(null)
  const [search, setSearch] = useState('')
  const [confirmAgent, setConfirmAgent] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [storeData, myData] = await Promise.all([
        api.store.listAgents({ search }),
        api.store.myAgents(),
      ])
      setAgents(storeData?.agents || storeData || [])
      setMyAgents(myData?.agents || myData || [])
    } catch (e) {
      console.error('Agent store load error:', e)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const installedIds = new Set(myAgents.map(a => a.agent_id || a.id))

  const handleInstall = async (agent) => {
    setInstalling(agent.id)
    setConfirmAgent(null)
    try {
      await api.store.installAgent(agent.id)
      showToast(`✅ "${agent.name}" adicionado com sucesso!`)
      await load()
      refreshPlan()
    } catch (e) {
      const msg = e?.detail || e?.message || 'Erro ao instalar agente'
      showToast(`❌ ${msg}`, 'error')
    } finally {
      setInstalling(null)
    }
  }

  const handleUninstall = async (agentId) => {
    setInstalling(agentId)
    try {
      await api.store.uninstallAgent(agentId)
      showToast('Agente removido.')
      await load()
      refreshPlan()
    } catch (e) {
      showToast(`❌ ${e?.detail || 'Erro ao remover'}`, 'error')
    } finally {
      setInstalling(null)
    }
  }

  const filtered = (tab === 'installed' ? myAgents : agents).filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="agents-store-page" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media (max-width: 768px) {
          .agents-store-page { padding: 16px !important; }
          .agents-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .agents-header h1 { font-size: 18px !important; }
          .agents-tabs button { padding: 8px 10px !important; font-size: 12px !important; }
          .agents-search { max-width: none !important; }
          .agents-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .agents-confirm-modal { padding: 20px !important; margin: 16px !important; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999,
          background: toast.type === 'error' ? '#ef444420' : '#10b98120',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}40`,
          color: toast.type === 'error' ? '#ef4444' : '#10b981',
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          animation: 'fadeUp 0.2s ease', backdropFilter: 'blur(8px)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="agents-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={22} color="var(--nexus-cyan)" />
            Agentes Store
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Adicione agentes de IA especializados à sua equipe digital
          </p>
        </div>

        {/* Credits */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '10px 16px',
        }}>
          <Coins size={16} color="#f59e0b" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
              {(credits?.balance ?? 0).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>créditos</div>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#fff',
            background: planColor || '#6366f1',
            padding: '2px 8px', borderRadius: 20, marginLeft: 4,
          }}>{planLabel}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="agents-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 12, padding: 4 }}>
        {[
          { id: 'store', label: 'Explorar Agentes', icon: ShoppingCart },
          { id: 'installed', label: `Meus Agentes (${myAgents.length})`, icon: Package },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.id ? 'var(--bg-card)' : 'transparent',
            border: tab === t.id ? '1px solid var(--border-subtle)' : '1px solid transparent',
            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="agents-search" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, padding: '8px 14px', marginBottom: 20, maxWidth: 400,
      }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar agentes…"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 13, width: '100%',
          }}
        />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={13} /></button>}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="agents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 220, background: 'var(--bg-card)', borderRadius: 16,
              border: '1px solid var(--border-subtle)', opacity: 0.5,
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
          <Bot size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {tab === 'installed' ? 'Nenhum agente instalado ainda.' : 'Nenhum agente encontrado.'}
          </p>
          {tab === 'installed' && (
            <button onClick={() => setTab('store')} style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 10,
              background: '#6366f1', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Explorar Agentes</button>
          )}
        </div>
      ) : (
        <div className="agents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              installed={installedIds.has(agent.id)}
              installing={installing}
              credits={credits?.balance ?? 0}
              planFeatures={planFeatures}
              onInstall={(a) => setConfirmAgent(a)}
              onUninstall={handleUninstall}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        agent={confirmAgent}
        credits={credits?.balance ?? 0}
        onConfirm={() => handleInstall(confirmAgent)}
        onCancel={() => setConfirmAgent(null)}
        loading={installing === confirmAgent?.id}
      />
    </div>
  )
}
