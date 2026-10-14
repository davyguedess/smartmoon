import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { api } from '../../../api'
import {
  X, Bot, Save, Loader2, Sparkles, Zap, Brain,
  CheckCircle2, ChevronRight, RefreshCw, User, AlertCircle
} from 'lucide-react'

/* ─── AI Models (fallback when no trained agent is selected) ─── */
const MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'Rápido', badgeColor: '#a78bfa', badgeBg: 'rgba(139,92,246,0.12)', badgeBorder: 'rgba(139,92,246,0.25)', icon: '🔮' },
  { value: 'gpt-4o', label: 'GPT-4o', badge: 'Melhor', badgeColor: '#10b981', badgeBg: 'rgba(16,185,129,0.12)', badgeBorder: 'rgba(16,185,129,0.25)', icon: '🧠' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', badge: 'Econômico', badgeColor: '#60a5fa', badgeBg: 'rgba(59,130,246,0.12)', badgeBorder: 'rgba(59,130,246,0.25)', icon: '⚡' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku', badge: 'Anthropic', badgeColor: '#fbbf24', badgeBg: 'rgba(245,158,11,0.12)', badgeBorder: 'rgba(245,158,11,0.25)', icon: '✍️' },
]

const AGENT_TYPE_LABELS = {
  general: 'Geral',
  sales: 'Vendas',
  support: 'Suporte',
  custom: 'Customizado',
}

export default function ProjectAgentModal({ project, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [agents, setAgents] = useState([])
  const [enabled, setEnabled] = useState(!!project.agent_enabled)
  const [selectedAgentId, setSelectedAgentId] = useState(project.agent_profile_id || null)
  const [model, setModel] = useState(project.agent_model || 'gemini-2.0-flash')
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  // Fetch trained agents from the company
  useEffect(() => {
    const load = async () => {
      setLoadingAgents(true)
      try {
        const res = await api.get('/agent/profiles')
        setAgents(Array.isArray(res) ? res : (res?.profiles || res?.items || []))
      } catch {
        setAgents([])
      } finally {
        setLoadingAgents(false)
      }
    }
    load()
  }, [])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await api.patch(`/projects/${project.id}`, {
        agent_enabled: enabled,
        agent_profile_id: selectedAgentId || null,
        agent_model: selectedAgentId ? undefined : model, // only send model if no agent selected
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); onUpdate(); onClose() }, 1200)
    } catch (err) {
      setError(err.message || 'Erro ao atualizar agente')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(139,92,246,0.12)',
    borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  }

  return ReactDOM.createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(2,6,23,0.9)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 580,
        background: 'linear-gradient(160deg, #0f172a 0%, #13193a 100%)',
        border: '1px solid rgba(139,92,246,0.22)', borderRadius: 24,
        boxShadow: '0 0 0 1px rgba(139,92,246,0.06), 0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(139,92,246,0.08)',
        overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(139,92,246,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, flexShrink: 0, position: 'relative',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
              border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(139,92,246,0.2)',
            }}>
              <Bot style={{ width: 22, height: 22, color: '#a78bfa' }} />
              {enabled && (
                <div style={{
                  position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.7)', border: '2px solid #0f172a',
                }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Agente do Projeto</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3, fontWeight: 500 }}>
                Vincule um agente treinado para gerenciar este projeto
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(148,163,184,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
          >
            <X style={{ width: 18, height: 18, color: '#94a3b8' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'flex', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <X style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} /> {error}
            </div>
          )}

          {/* ── Toggle ── */}
          <div onClick={() => setEnabled(!enabled)} style={{
            padding: '18px 20px', borderRadius: 18, cursor: 'pointer',
            background: enabled ? 'rgba(16,185,129,0.07)' : 'rgba(15,23,42,0.6)',
            border: enabled ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(148,163,184,0.08)',
            boxShadow: enabled ? '0 0 30px rgba(16,185,129,0.06)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            transition: 'all 0.25s',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <Sparkles style={{ width: 15, height: 15, color: enabled ? '#34d399' : '#475569' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: enabled ? '#a7f3d0' : '#cbd5e1' }}>Agente Ativo no WhatsApp</span>
                {enabled && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>LIGADO</span>}
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                {enabled ? 'O agente responde mensagens automaticamente neste grupo' : 'Ative para o agente entrar em ação no WhatsApp do projeto'}
              </div>
            </div>
            {/* Toggle pill */}
            <div style={{
              width: 52, height: 28, borderRadius: 100, flexShrink: 0, position: 'relative',
              background: enabled ? 'linear-gradient(135deg, #10b981, #34d399)' : 'rgba(30,41,59,0.9)',
              border: enabled ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(148,163,184,0.15)',
              boxShadow: enabled ? '0 0 14px rgba(16,185,129,0.35)' : 'none', transition: 'all 0.25s',
            }}>
              <div style={{
                position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%',
                background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                left: enabled ? 27 : 3,
              }} />
            </div>
          </div>

          {/* ── Agent Selector ── */}
          <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User style={{ width: 13, height: 13, color: '#7c3aed' }} />
                Agente Treinado
              </div>
              {loadingAgents && <RefreshCw style={{ width: 12, height: 12, color: '#475569', animation: 'spin 1s linear infinite' }} />}
            </div>

            {loadingAgents ? (
              <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#475569', fontSize: 13 }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Carregando agentes...
              </div>
            ) : agents.length === 0 ? (
              <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(99,102,241,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#475569', fontSize: 13, textAlign: 'center' }}>
                <AlertCircle style={{ width: 22, height: 22, color: '#334155' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#64748b' }}>Nenhum agente criado ainda</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Crie um agente em <span style={{ color: '#818cf8', fontWeight: 600 }}>Agentes IA</span> e volte aqui para vinculá-lo</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* "Nenhum" option */}
                <button type="button" onClick={() => setSelectedAgentId(null)}
                  style={{
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    background: !selectedAgentId ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.5)',
                    border: !selectedAgentId ? '1.5px solid rgba(148,163,184,0.3)' : '1px solid rgba(99,102,241,0.08)',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (selectedAgentId) { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.18)'; e.currentTarget.style.background = 'rgba(15,23,42,0.7)' } }}
                  onMouseLeave={e => { if (selectedAgentId) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.08)'; e.currentTarget.style.background = 'rgba(15,23,42,0.5)' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Sem agente específico</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Usa apenas o modelo de IA selecionado abaixo</div>
                      </div>
                    </div>
                    {!selectedAgentId && <CheckCircle2 style={{ width: 16, height: 16, color: '#94a3b8', flexShrink: 0 }} />}
                  </div>
                </button>

                {/* Agent list */}
                {agents.map(agent => {
                  const isSel = selectedAgentId === agent.id
                  return (
                    <button key={agent.id} type="button" onClick={() => setSelectedAgentId(agent.id)}
                      style={{
                        padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        background: isSel ? 'rgba(139,92,246,0.1)' : 'rgba(15,23,42,0.5)',
                        border: isSel ? '1.5px solid rgba(139,92,246,0.45)' : '1px solid rgba(99,102,241,0.08)',
                        boxShadow: isSel ? '0 0 20px rgba(139,92,246,0.1)' : 'none',
                        transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.22)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)' } }}
                      onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.08)'; e.currentTarget.style.background = 'rgba(15,23,42,0.5)' } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                            background: isSel ? 'rgba(139,92,246,0.18)' : 'rgba(99,102,241,0.08)',
                            border: isSel ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(99,102,241,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20,
                          }}>
                            {agent.avatar || '🤖'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: isSel ? '#c4b5fd' : '#e2e8f0' }}>{agent.name}</span>
                              <span style={{
                                padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                                background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)',
                              }}>
                                {AGENT_TYPE_LABELS[agent.agent_type] || 'Agente'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{agent.model || agent.provider || 'Modelo customizado'}</span>
                              {agent.description && <><span style={{ color: '#334155' }}>·</span><span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</span></>}
                            </div>
                          </div>
                        </div>
                        {isSel && <CheckCircle2 style={{ width: 16, height: 16, color: '#a78bfa', flexShrink: 0 }} />}
                      </div>

                      {isSel && (
                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Zap style={{ width: 12, height: 12, color: '#7c3aed', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'rgba(167,139,250,0.9)', lineHeight: 1.4 }}>
                            Este agente receberá automaticamente a <strong style={{ color: '#c4b5fd' }}>Skill de Gerente de Projeto</strong> — com tarefas, membros e hierarquia de admins injetados no contexto.
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Fallback model selector (only when no agent selected) ── */}
          {!selectedAgentId && (
            <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain style={{ width: 13, height: 13, color: '#7c3aed' }} />
                Modelo de IA (sem agente específico)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODELS.map(m => {
                  const isSel = model === m.value
                  return (
                    <button key={m.value} type="button" onClick={() => setModel(m.value)}
                      style={{
                        padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                        background: isSel ? 'rgba(139,92,246,0.1)' : 'rgba(15,23,42,0.6)',
                        border: isSel ? '1.5px solid rgba(139,92,246,0.45)' : '1px solid rgba(99,102,241,0.08)',
                        transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.22)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)' } }}
                      onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.08)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)' } }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? '#c4b5fd' : '#e2e8f0' }}>{m.label}</div>
                        <span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: m.badgeBg, color: m.badgeColor, border: `1px solid ${m.badgeBorder}` }}>{m.badge}</span>
                      </div>
                      {isSel && <CheckCircle2 style={{ width: 14, height: 14, color: '#a78bfa', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Save ── */}
          <button type="submit" disabled={loading || saved}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              cursor: loading || saved ? 'default' : 'pointer', fontFamily: 'inherit',
              background: saved ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#fff', fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: saved ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 20px rgba(124,58,237,0.4)',
              transition: 'all 0.25s', opacity: loading ? 0.8 : 1,
            }}
            onMouseEnter={e => { if (!loading && !saved) e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.55)' }}
            onMouseLeave={e => { if (!loading && !saved) e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)' }}
          >
            {loading ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Salvando...</>
              : saved ? <><CheckCircle2 style={{ width: 16, height: 16 }} /> Agente Vinculado!</>
              : <><Save style={{ width: 16, height: 16 }} /> {selectedAgentId ? `Vincular ${selectedAgent?.name || 'Agente'}` : 'Salvar Configurações'}</>
            }
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>,
    document.body
  )
}
