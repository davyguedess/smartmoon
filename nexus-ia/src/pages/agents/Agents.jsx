import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useToast } from '../../components/ui/Toast'
import {
  Bot, Plus, RefreshCw, Pencil, Trash2, ToggleLeft, ToggleRight,
  Zap, BookOpen, Store, ChevronRight, Brain, Cpu, ThumbsUp,
  X, Check, AlertTriangle, Sliders, Send, MessageSquare, Unlink, Wifi, Settings
} from 'lucide-react'

// ── Shared pill ────────────────────────────────────
function Pill({ children, color = 'purple' }) {
  const colors = {
    green: { bg: 'rgba(16,185,129,0.12)', text: 'var(--nexus-green)', border: 'rgba(16,185,129,0.25)' },
    red: { bg: 'rgba(239,68,68,0.12)', text: 'var(--nexus-red)', border: 'rgba(239,68,68,0.25)' },
    purple: { bg: 'rgba(139,92,246,0.12)', text: 'var(--nexus-purple)', border: 'rgba(139,92,246,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.12)', text: 'var(--nexus-amber)', border: 'rgba(245,158,11,0.25)' },
  }
  const c = colors[color] || colors.purple
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{children}</span>
  )
}

// ── Agent Card ─────────────────────────────────────
function AgentCard({ agent, onEdit, onDelete, onToggle, onTrain }) {
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: agent.is_active ? 'rgba(139,92,246,0.15)' : 'rgba(100,100,120,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>🤖</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {agent.name}
            <Pill color={agent.is_active ? 'green' : 'red'}>
              {agent.is_active ? '● Ativo' : '○ Inativo'}
            </Pill>
            {(agent.agent_type === 'sales') && <Pill color="purple">💰 Vendas</Pill>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {agent.slug} · {agent.model || 'llama3.2'} · {agent.provider || 'ollama'}
          </div>
          {agent.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.4 }}>
              {agent.description}
            </div>
          )}
        </div>
      </div>

      {/* System prompt preview */}
      {agent.system_prompt && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 11,
          background: 'var(--bg-elevated)', color: 'var(--text-muted)',
          fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5,
          borderLeft: '2px solid rgba(139,92,246,0.4)',
          maxHeight: 60, overflow: 'hidden', position: 'relative',
        }}>
          {agent.system_prompt.slice(0, 120)}{agent.system_prompt.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/agents/${agent.id}/sales-config`)} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px', borderRadius: 9,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
          border: '1px solid rgba(99,102,241,0.25)',
          color: '#6366F1', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>
          <Settings size={13} /> Config Vendas
        </button>
        <button onClick={() => onTrain(agent)} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px', borderRadius: 9,
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
          color: 'var(--nexus-purple)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>
          <Brain size={13} /> Treinar
        </button>
        <button onClick={() => onEdit(agent)} title="Editar" style={{
          padding: '9px 12px', borderRadius: 9,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}><Pencil size={13} /></button>
        <button onClick={() => onToggle(agent)} title={agent.is_active ? 'Desativar' : 'Ativar'} style={{
          padding: '9px 12px', borderRadius: 9,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          color: agent.is_active ? 'var(--nexus-green)' : 'var(--text-muted)', cursor: 'pointer',
        }}>{agent.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}</button>
        {confirming ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { onDelete(agent.id); setConfirming(false) }} style={{
              padding: '9px 12px', borderRadius: 9,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--nexus-red)', cursor: 'pointer',
            }}><Check size={13} /></button>
            <button onClick={() => setConfirming(false)} style={{
              padding: '9px 12px', borderRadius: 9,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} title="Excluir" style={{
            padding: '9px 12px', borderRadius: 9,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}><Trash2 size={13} /></button>
        )}
      </div>
    </div>
  )
}

// ── Agent Form Modal ───────────────────────────────
function AgentModal({ agent, onSave, onClose }) {
  const [form, setForm] = useState({
    name: agent?.name || '',
    slug: agent?.slug || '',
    description: agent?.description || '',
    system_prompt: agent?.system_prompt || '',
    model: agent?.model || 'llama3.2',
    provider: agent?.provider || 'ollama',
    temperature: agent?.temperature || '0.7',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const isNew = !agent?.id

  const autoSlug = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v, ...(k === 'name' && isNew ? { slug: autoSlug(v) } : {}) }))
  }

  const handle = async () => {
    if (!form.name || !form.slug) { setError('Nome e slug são obrigatórios'); return }
    setLoading(true); setError(null)
    try {
      if (isNew) await api.agentCreateProfile(form)
      else await api.agentUpdateProfile(agent.id, form)
      onSave()
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const Field = ({ label, k, textarea, rows }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</label>
      {textarea ? (
        <textarea value={form[k]} onChange={e => set(k, e.target.value)} rows={rows || 4}
          style={{
            padding: '9px 12px', borderRadius: 8, resize: 'vertical',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1.5,
          }} />
      ) : (
        <input value={form[k]} onChange={e => set(k, e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: 13,
          }} />
      )}
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18,
        border: '1px solid var(--border-default)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{isNew ? '+ Novo Agente' : `Editar: ${agent.name}`}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <Field label="Nome do Agente" k="name" />
        <Field label="Slug (identificador único)" k="slug" />
        <Field label="Descrição" k="description" />
        <Field label="System Prompt (Persona)" k="system_prompt" textarea rows={5} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Modelo</label>
            <input value={form.model} onChange={e => set('model', e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Provider</label>
            <select value={form.provider} onChange={e => set('provider', e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }}>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Temperatura</label>
            <input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={e => set('temperature', e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
        </div>

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.08)', color: 'var(--nexus-red)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={handle} disabled={loading} style={{ padding: '9px 20px', borderRadius: 9, background: 'var(--nexus-purple)', border: 'none', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>
            {loading ? 'Salvando...' : isNew ? 'Criar Agente' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Meus Agentes Tab ───────────────────────────────
function MyAgentsTab({ onTrain, onGoSkills }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | agent_obj

  const load = async () => {
    setLoading(true)
    try { setAgents(await api.agentListProfiles() || []) } catch { setAgents([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    try { await api.agentDeleteProfile(id); load() } catch (e) { alert(e.message) }
  }
  const handleToggle = async (agent) => {
    try { await api.agentUpdateProfile(agent.id, { is_active: !agent.is_active }); load() } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Total', value: agents.length, icon: Bot },
          { label: 'Ativos', value: agents.filter(a => a.is_active).length, icon: Check },
          { label: 'Skills', value: '—', icon: Zap },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <s.icon size={18} color="var(--nexus-purple)" />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <button data-tour="create-agent-btn" onClick={() => setModal('new')} style={{
          padding: '12px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-purple))',
          border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Plus size={15} /> Novo Agente
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>Carregando agentes...</div>
      ) : agents.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '50px 20px', background: 'var(--bg-card)',
          borderRadius: 14, border: '1px dashed var(--border-subtle)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nenhum agente criado ainda</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Crie seu primeiro agente e defina sua persona e habilidades</div>
          <button onClick={() => setModal('new')} style={{
            padding: '10px 22px', borderRadius: 10,
            background: 'var(--nexus-purple)', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>+ Criar Primeiro Agente</button>
        </div>
      ) : (
        <div data-tour="agent-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {agents.map(a => (
            <AgentCard key={a.id} agent={a}
              onEdit={() => setModal(a)}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onTrain={() => onTrain(a)}
            />
          ))}
        </div>
      )}

      {/* Quick tip */}
      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <Cpu size={14} color="var(--nexus-purple)" />
        Após criar um agente, vá em <strong style={{ color: 'var(--nexus-purple)', cursor: 'pointer' }} onClick={() => onGoSkills()}>Skill Store</strong> para instalar capacidades e depois em <strong style={{ color: 'var(--nexus-purple)' }}>Treinar</strong> para conversar com ele.
      </div>

      {modal && (
        <AgentModal
          agent={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Train Redirect Tab ─────────────────────────────
function TrainTab({ onSelectAgent }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agentListProfiles().then(r => { setAgents(r || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 700, color: 'var(--nexus-purple)' }}>Agent Training Studio</span> — Selecione um agente abaixo para abrir o chat de treinamento. Você pode conversar com o agente, ajustar a persona em tempo real e instalar skills.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Carregando...</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Crie um agente primeiro na aba "Meus Agentes"</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {agents.map(a => (
            <button key={a.id} onClick={() => onSelectAgent(a)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.2s, background 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-card)' }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🤖</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.model} · {a.provider}</div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skill Store Tab ────────────────────────────────
// Catalog is now loaded from the backend API (no static list)

function InstallSkillModal({ skill, onClose }) {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.agentListProfiles().then(r => { setAgents(r || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const install = async () => {
    if (!selectedAgent) return
    setInstalling(true)
    try {
      await api.agentInstallSkill(selectedAgent, { skill_id: skill.id })
      setDone(true)
    } catch (e) {
      alert(`Erro ao instalar: ${e.message}`)
    }
    setInstalling(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(8,11,20,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 420,
        border: '1px solid var(--border-default)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{skill.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{skill.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{skill.cat} · {skill.desc}</div>
          </div>
        </div>
        {done ? (
          <div style={{ padding: 20, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus-green)' }}>Skill instalada com sucesso!</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>O prompt do agente foi atualizado automaticamente.</div>
          </div>
        ) : (
          <>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 6 }}>Instalar no Agente</label>
              {loading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando agentes...</div>
              ) : agents.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum agente encontrado. Crie um em "Meus Agentes".</div>
              ) : (
                <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 9,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                }}>
                  <option value="">Selecionar agente...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.model})</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
              <button onClick={install} disabled={!selectedAgent || installing} style={{
                padding: '9px 20px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 700,
                background: selectedAgent ? 'var(--nexus-green)' : 'var(--bg-elevated)',
                color: selectedAgent ? '#fff' : 'var(--text-muted)',
                cursor: !selectedAgent || installing ? 'not-allowed' : 'pointer',
              }}>{installing ? 'Instalando...' : '+ Instalar Skill'}</button>
            </div>
          </>
        )}
        {done && <button onClick={onClose} style={{ padding: '9px', borderRadius: 9, border: 'none', background: 'var(--nexus-purple)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Fechar</button>}
      </div>
    </div>
  )
}

// ── Telegram Section (per-agent) ───────────────────
function TelegramSection({ agent }) {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [tokenInput, setTokenInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [linking, setLinking] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    setLoading(true)
    api.agentListTelegramBots(agent.id).then(r => { setBots(r || []); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [agent.id])

  const testToken = async () => {
    if (!tokenInput.trim()) return
    setTesting(true); setTestResult(null)
    try {
      const r = await api.agentTestTelegramToken(agent.id, tokenInput.trim())
      setTestResult(r)
    } catch { setTestResult({ ok: false, error: 'Erro ao testar' }) }
    setTesting(false)
  }

  const linkBot = async () => {
    if (!testResult?.ok || !tokenInput.trim()) return
    setLinking(true)
    try {
      await api.agentLinkTelegramBot(agent.id, { bot_token: tokenInput.trim(), label: labelInput || testResult.first_name })
      setTokenInput(''); setLabelInput(''); setTestResult(null); setShowForm(false)
      load()
    } catch (e) { alert(e.message) }
    setLinking(false)
  }

  const unlinkBot = async (integId) => {
    if (!confirm('Remover este bot do agente?')) return
    try { await api.agentUnlinkTelegramBot(agent.id, integId); load() } catch (e) { alert(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={13} /> Bots Telegram vinculados
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: 'rgba(0,136,204,0.12)', border: '1px solid rgba(0,136,204,0.25)', color: '#2da5e0',
        }}>{showForm ? '✕ Fechar' : '+ Vincular Bot'}</button>
      </div>

      {loading ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Carregando...</div> : bots.length === 0 && !showForm ? (
        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--bg-elevated)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Nenhum bot vinculado. Clique em "+ Vincular Bot" para conectar um.
        </div>
      ) : bots.map(b => (
        <div key={b.id} style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(0,136,204,0.06)', border: '1px solid rgba(0,136,204,0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{b.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.bot_token_preview}</div>
          </div>
          <Pill color="green">● Conectado</Pill>
          <button onClick={() => unlinkBot(b.id)} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--nexus-red)', cursor: 'pointer' }}>
            <Unlink size={11} />
          </button>
        </div>
      ))}

      {showForm && (
        <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>Bot Token</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={tokenInput} onChange={e => { setTokenInput(e.target.value); setTestResult(null) }}
              placeholder="1234567890:ABCDEF..." style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={testToken} disabled={testing || !tokenInput.trim()} style={{
              padding: '8px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,136,204,0.12)', border: '1px solid rgba(0,136,204,0.3)', color: '#2da5e0',
              display: 'flex', alignItems: 'center', gap: 5,
            }}><Wifi size={12} />{testing ? '...' : 'Testar'}</button>
          </div>
          {testResult && (
            <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 11,
              background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: testResult.ok ? 'var(--nexus-green)' : 'var(--nexus-red)',
            }}>
              {testResult.ok ? `✅ @${testResult.username} — ${testResult.first_name}` : `❌ ${testResult.error}`}
            </div>
          )}
          {testResult?.ok && (
            <>
              <input value={labelInput} onChange={e => setLabelInput(e.target.value)}
                placeholder={`Nome amigável (ex: "Atendimento")`} style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 11 }} />
              <button onClick={linkBot} disabled={linking} style={{
                padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,136,204,0.15)', border: '1px solid rgba(0,136,204,0.3)', color: '#2da5e0',
              }}>{linking ? 'Vinculando...' : '🔗 Vincular Bot ao Agente'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Custom Skill Builder Modal ──────────────────────
function CustomSkillBuilderModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', icon: '🔧', category: 'Custom', description: '', prompt_patch: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const CATEGORIES = ['Custom', 'Atendimento', 'Financeiro', 'Dados', 'Agenda', 'Mensagens', 'Pesquisa', 'Relatórios']
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError(null)
    try {
      await api.agentCreateCustomSkill(form)
      onSaved()
      onClose()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border-default)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="var(--nexus-purple)" /> Criar Skill Customizada
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Ícone</label>
            <input value={form.icon} onChange={e => set('icon', e.target.value)} maxLength={2}
              style={{ width: 56, padding: '9px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 22, textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nome da Skill</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Coletar Dados do Cliente"
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Categoria</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Descrição Curta</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="O que essa skill faz?"
              style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Prompt Patch</label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2, lineHeight: 1.4 }}>
            Este texto será anexado ao System Prompt do agente quando a skill estiver ativa.
          </div>
          <textarea value={form.prompt_patch} onChange={e => set('prompt_patch', e.target.value)}
            rows={6} placeholder={`Ex:\nVocê tem acesso à skill de coleta de dados. Quando o usuário fornecer informações pessoais como nome, email ou telefone, salve-as estruturadas no contexto da conversa...`}
            style={{ padding: '10px 12px', borderRadius: 8, resize: 'vertical', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 }} />
        </div>

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.08)', color: 'var(--nexus-red)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, background: 'var(--nexus-purple)', border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Salvando...' : '🚀 Criar e Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SkillsTab() {
  const [installTarget, setInstallTarget] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [catalogSkills, setCatalogSkills] = useState([])
  const [customSkills, setCustomSkills] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('Todos')

  const loadCatalog = () => {
    setLoadingCatalog(true)
    api.agentSkillsCatalog()
      .then(r => {
        const items = (r || []).map(s => ({
          id: s.id,
          icon: s.icon || '🔧',
          name: s.name,
          cat: s.category,
          desc: s.description || '',
          ready: s.status === 'available',
          badges: s.badges || [],
        }))
        setCatalogSkills(items)
      })
      .catch(() => {})
      .finally(() => setLoadingCatalog(false))
  }
  const loadCustom = () => {
    api.agentListCustomSkills().then(r => setCustomSkills(r || [])).catch(() => {})
  }
  useEffect(() => { loadCatalog(); loadCustom() }, [])

  const allSkills = [
    ...catalogSkills,
    ...customSkills.map(s => ({ id: s.slug, icon: s.icon, name: s.name, cat: s.category, desc: s.description || '', ready: s.is_active, isCustom: true, customId: s.id }))
  ]
  const cats = ['Todos', ...new Set(allSkills.map(s => s.cat))]
  const filtered = allSkills.filter(s =>
    (catFilter === 'Todos' || s.cat === catFilter) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--nexus-green)' }}>Skill Store</span> — Instale capacidades pré-prontas ou crie suas próprias skills customizadas.
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{allSkills.length} skills disponíveis</span>
      </div>
      {loadingCatalog && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 13 }}>Carregando catálogo de skills...</div>
      )}
      {/* Filtros + botão criar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Buscar skills..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 12 }} />
        <button onClick={() => setShowBuilder(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--nexus-purple)',
        }}><Zap size={13} /> Criar Skill</button>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: catFilter === c ? 'var(--nexus-green)' : 'var(--bg-elevated)',
              border: `1px solid ${catFilter === c ? 'var(--nexus-green)' : 'var(--border-subtle)'}`,
              color: catFilter === c ? '#fff' : 'var(--text-muted)',
            }}>{c}</button>
          ))}
        </div>
      </div>
      <div data-tour="skill-store-catalog" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {filtered.map(s => (
          <div key={s.id} style={{
            background: 'var(--bg-card)', border: `1px solid ${s.isCustom ? 'rgba(139,92,246,0.2)' : 'var(--border-subtle)'}`,
            borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
            opacity: s.ready ? 1 : 0.6, transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => s.ready && (e.currentTarget.style.borderColor = s.isCustom ? 'rgba(139,92,246,0.5)' : 'rgba(16,185,129,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = s.isCustom ? 'rgba(139,92,246,0.2)' : 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.cat}</div>
              </div>
              {s.isCustom ? (
                <Pill color="purple">🔧 Custom</Pill>
              ) : (
                <Pill color={s.ready ? 'green' : 'amber'}>{s.ready ? 'Disponível' : 'Em breve'}</Pill>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            <button onClick={() => s.ready && setInstallTarget(s)} disabled={!s.ready} style={{
              padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: s.ready ? 'pointer' : 'not-allowed',
              background: s.ready ? (s.isCustom ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)') : 'var(--bg-elevated)',
              border: `1px solid ${s.ready ? (s.isCustom ? 'rgba(139,92,246,0.25)' : 'rgba(16,185,129,0.25)') : 'var(--border-subtle)'}`,
              color: s.ready ? (s.isCustom ? 'var(--nexus-purple)' : 'var(--nexus-green)') : 'var(--text-muted)',
            }}>
              {s.ready ? '+ Instalar no Agente' : 'Em desenvolvimento'}
            </button>
          </div>
        ))}
      </div>
      {installTarget && <InstallSkillModal skill={installTarget} onClose={() => setInstallTarget(null)} />}
      {showBuilder && <CustomSkillBuilderModal onClose={() => setShowBuilder(false)} onSaved={loadCustom} />}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────
export default function Agents() {
  const [tab, setTab] = useState('agents')
  const [trainingAgent, setTrainingAgent] = useState(null)

  const TABS = [
    { id: 'agents', label: 'Meus Agentes', icon: Bot },
    { id: 'train', label: 'Treinar', icon: Brain },
    { id: 'skills', label: 'Skill Store', icon: Store },
  ]

  // If training mode, show the studio inline
  if (trainingAgent && tab === 'train') {
    return (
      <AgentTrainingInline agent={trainingAgent} onBack={() => setTrainingAgent(null)} />
    )
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Agentes de IA</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>
            Crie, treine e configure agentes inteligentes para seus fluxos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'var(--bg-card)', borderRadius: 12, alignSelf: 'flex-start', border: '1px solid var(--border-subtle)' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500,
              background: active ? 'var(--nexus-purple)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {tab === 'agents' && (
        <MyAgentsTab
          onTrain={(a) => { setTrainingAgent(a); setTab('train') }}
          onGoSkills={() => setTab('skills')}
        />
      )}
      {tab === 'train' && (
        <TrainTab onSelectAgent={(a) => setTrainingAgent(a)} />
      )}
      {tab === 'skills' && <SkillsTab />}
    </div>
  )
}

// ── Inline Training Studio (opened from Agents page) ──
function AgentTrainingInline({ agent, onBack }) {
  const sessionId = `train_${agent.id}_${Date.now()}`
  const [messages, setMessages] = useState([
    { role: 'system', content: `Sessão de treino iniciada para **${agent.name}**. Converse para testar a persona e ajustar o comportamento.` }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [activePanel, setActivePanel] = useState(null) // null | 'persona' | 'skills'
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt || '')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [agentSkills, setAgentSkills] = useState([])
  const [loadingSkills, setLoadingSkills] = useState(false)

  const send = async () => {
    if (!input.trim() || sending) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const history = messages.filter(m => m.role !== 'system').concat(userMsg)
      const res = await api.agentTrainChat(agent.id, history)
      setMessages(prev => [...prev, { role: 'assistant', content: res.response || res.message || 'Sem resposta.' }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${e.message}` }])
    }
    setSending(false)
  }

  const savePrompt = async () => {
    setSavingPrompt(true)
    try { await api.agentUpdateProfile(agent.id, { system_prompt: systemPrompt }); setActivePanel(null) } catch {}
    setSavingPrompt(false)
  }

  const saveFeedback = async (msgIndex, rating) => {
    const m = messages[msgIndex]
    if (!m || m.role !== 'assistant') return
    const prev = messages[msgIndex - 1]
    setFeedback(f => ({ ...f, [msgIndex]: rating }))
    try {
      await api.agentAddMemory({
        agent_id: agent.id, session_id: sessionId,
        role: 'assistant', content: m.content,
        memory_type: 'example',
        metadata: { rating, prompt: prev?.content || '' },
      })
    } catch {}
  }

  const loadSkills = async () => {
    setLoadingSkills(true)
    try { setAgentSkills((await api.agentGetSkills(agent.id)) || []) } catch {}
    setLoadingSkills(false)
  }

  const toggleSkill = async (skillId, cur) => {
    try {
      await api.agentToggleSkill(agent.id, skillId, { active: !cur })
      setAgentSkills(prev => prev.map(s => s.skill_id === skillId ? { ...s, active: !cur } : s))
    } catch {}
  }

  const removeSkill = async (skillId) => {
    try {
      await api.agentRemoveSkill(agent.id, skillId)
      setAgentSkills(prev => prev.filter(s => s.skill_id !== skillId))
    } catch {}
  }

  const openPanel = (p) => {
    if (activePanel === p) { setActivePanel(null); return }
    setActivePanel(p)
    if (p === 'skills') loadSkills()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>← Voltar</button>
        <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{agent.name} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--nexus-purple)' }}>— Training Studio</span></div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{agent.model} · {agent.provider} · session {sessionId.slice(-8)}</div>
        </div>
        <div style={{ flex: 1 }} />
        {[['persona', '✏️ Persona'], ['skills', '⚡ Skills'], ['telegram', '📱 Telegram']].map(([p, label]) => (
          <button key={p} onClick={() => openPanel(p)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: activePanel === p ? 'rgba(139,92,246,0.18)' : 'var(--bg-elevated)',
            border: `1px solid ${activePanel === p ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
            color: activePanel === p ? 'var(--nexus-purple)' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                {m.role !== 'user' && (
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: m.role === 'system' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {m.role === 'system' ? '⚙️' : '🤖'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{
                    maxWidth: '100%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? 'var(--nexus-purple)' : m.role === 'system' ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)',
                    color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                    border: m.role === 'system' ? '1px solid rgba(245,158,11,0.2)' : 'none',
                    fontSize: 13, lineHeight: 1.55,
                  }}>
                    {m.content}
                  </div>
                  {m.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: 5, paddingLeft: 4 }}>
                      {[['good', '👍', 'rgba(16,185,129,0.15)', 'rgba(16,185,129,0.4)'], ['bad', '👎', 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.35)']].map(([r, emoji, bg, border]) => (
                        <button key={r} onClick={() => saveFeedback(i, r)}
                          style={{
                            padding: '2px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid',
                            background: feedback[i] === r ? bg : 'transparent',
                            borderColor: feedback[i] === r ? border : 'var(--border-subtle)',
                            opacity: feedback[i] && feedback[i] !== r ? 0.3 : 1, transition: 'all 0.15s',
                          }}>
                          {emoji} {feedback[i] === r ? (r === 'good' ? 'Salvo!' : 'Marcado') : ''}
                        </button>
                      ))}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>{feedback[i] ? '' : 'avaliar'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
                <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-elevated)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nexus-purple)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
          </div>
          {/* Input */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, background: 'var(--bg-surface)', flexShrink: 0 }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Envie uma mensagem para treinar o agente..."
              style={{ flex: 1, padding: '11px 16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 13 }}
            />
            <button onClick={send} disabled={sending || !input.trim()} style={{
              padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: 'var(--nexus-purple)', border: 'none', color: '#fff',
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', opacity: !input.trim() ? 0.5 : 1,
            }}>Enviar</button>
          </div>
        </div>

        {/* Persona Panel */}
        {activePanel === 'persona' && (
          <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>✏️ System Prompt</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Defina a persona, tom e regras do agente.</div>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={12}
              style={{ padding: '10px 12px', borderRadius: 8, resize: 'vertical', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }} />
            <button onClick={savePrompt} disabled={savingPrompt} style={{ padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: 'var(--nexus-purple)', border: 'none', color: '#fff', cursor: savingPrompt ? 'wait' : 'pointer' }}>
              {savingPrompt ? 'Salvando...' : '💾 Salvar Persona'}
            </button>
            <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Configurações</div>
              {[['Modelo', agent.model], ['Provider', agent.provider], ['Temperatura', agent.temperature]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: 'var(--nexus-cyan)' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills Panel */}
        {activePanel === 'skills' && (
          <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>⚡ Skills Instaladas</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Skills ativas moldam o comportamento e capacidades do agente.</div>
            {loadingSkills ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Carregando...</div>
            ) : agentSkills.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-elevated)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>⚡</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma skill instalada.</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Vá à aba Skill Store para instalar.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agentSkills.map(s => {
                  const meta = SKILL_CATALOG.find(c => c.id === s.skill_id) || {}
                  return (
                    <div key={s.skill_id} style={{
                      padding: '12px', borderRadius: 10, background: 'var(--bg-elevated)',
                      border: `1px solid ${s.active ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                      display: 'flex', gap: 10, alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 18 }}>{meta.icon || '⚡'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{meta.name || s.skill_id}</div>
                        <div style={{ fontSize: 10, color: s.active ? 'var(--nexus-green)' : 'var(--text-muted)' }}>{s.active ? '● Ativa' : '○ Inativa'}</div>
                      </div>
                      <button onClick={() => toggleSkill(s.skill_id, s.active)} style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: s.active ? 'rgba(16,185,129,0.15)' : 'var(--bg-card)',
                        color: s.active ? 'var(--nexus-green)' : 'var(--text-muted)',
                      }}>{s.active ? 'ON' : 'OFF'}</button>
                      <button onClick={() => removeSkill(s.skill_id)} style={{
                        padding: '4px 8px', borderRadius: 7, fontSize: 10, cursor: 'pointer',
                        border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: 'rgba(239,68,68,0.7)',
                      }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Telegram Panel */}
        {activePanel === 'telegram' && (
          <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>📱 Telegram</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Vincule um bot do Telegram a este agente. O bot responderá automaticamente às mensagens usando a persona e skills configuradas.
            </div>
            <TelegramSection agent={agent} />
          </div>
        )}
      </div>
    </div>
  )
}
