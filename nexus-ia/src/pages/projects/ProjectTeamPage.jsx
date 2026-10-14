import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useParams, NavLink } from 'react-router-dom'
import { api } from '../../api'
import {
  Users, ChevronLeft, Plus, Shield, User, Phone,
  CheckCircle2, AlertCircle, Clock, Edit3, Save,
  X, Loader2, Trash2, Activity, Star
} from 'lucide-react'

const COLORS = ['#6366f1','#ec4899','#10b981','#f59e0b','#06b6d4','#a855f7','#f43f5e','#14b8a6']

function Avatar({ name, index, size = 48 }) {
  const bg = COLORS[index % COLORS.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}bb, ${bg})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.33, color: '#fff', flexShrink: 0,
      boxShadow: `0 0 0 3px rgba(15,23,42,1), 0 4px 16px ${bg}50`,
    }}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  )
}

function AddMemberModal({ projectId, onClose, onDone }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('member')
  const [responsibilities, setResponsibilities] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await api.post(`/projects/${projectId}/members`, { name, phone_number: phone, role, responsibilities })
      onDone()
      onClose()
    } catch (err) { setError(err.message || 'Erro ao adicionar') }
    finally { setLoading(false) }
  }

  const inp = (extra = {}) => ({
    style: {
      width: '100%', boxSizing: 'border-box', padding: '11px 14px',
      background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.14)',
      borderRadius: 11, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
      ...extra,
    },
    onFocus: e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' },
    onBlur: e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.14)'; e.currentTarget.style.boxShadow = 'none' },
  })

  const label = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{text}</div>
  )

  return ReactDOM.createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(2,6,23,0.88)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 500, background: 'linear-gradient(160deg,#0f172a,#131c35)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>Adicionar Membro</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(148,163,184,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(148,163,184,0.06)'}>
            <X style={{ width: 16, height: 16, color: '#94a3b8' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>}
          <div>{label('Nome completo')}<input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" {...inp()} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>{label('WhatsApp (DDI)')} <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="5511999999999" {...inp()} /></div>
            <div>{label('Função')}
              <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp().style, appearance: 'none', cursor: 'pointer' }}>
                <option value="member">Membro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div>{label('Responsabilidades')}
            <textarea rows={3} value={responsibilities} onChange={e => setResponsibilities(e.target.value)} placeholder="Ex: Responsável pelo módulo de pagamentos e integrações..." {...inp({ resize: 'none' })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid rgba(148,163,184,0.12)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 22px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              {loading ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: 14, height: 14 }} />}
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  )
}

function MemberCard({ member, index, tasks, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [nameText, setNameText] = useState(member.name || '')
  const [phoneText, setPhoneText] = useState(member.phone_number || '')
  const [respText, setRespText] = useState(member.responsibilities || '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Sync local state when member prop changes (e.g. after save)
  useEffect(() => {
    setNameText(member.name || '')
    setPhoneText(member.phone_number || '')
    setRespText(member.responsibilities || '')
  }, [member.name, member.phone_number, member.responsibilities])

  const memberTasks = tasks.filter(t => Array.isArray(t.responsible_member_ids) && t.responsible_member_ids.includes(member.id))
  const done = memberTasks.filter(t => t.status === 'completed').length
  const overdue = memberTasks.filter(t => t.status === 'overdue').length
  const active = memberTasks.filter(t => ['pending','in_progress','blocked'].includes(t.status)).length

  const saveMember = async () => {
    setSaving(true)
    const payload = {}
    if (nameText.trim() && nameText.trim() !== member.name) payload.name = nameText.trim()
    if (phoneText.trim() && phoneText.trim() !== member.phone_number) payload.phone_number = phoneText.trim()
    if (respText !== (member.responsibilities || '')) payload.responsibilities = respText
    try {
      if (Object.keys(payload).length > 0) {
        await api.patch(`/projects/${member.project_id}/members/${member.id}`, payload)
      }
      onUpdate()
    } catch { /* silent */ }
    finally { setSaving(false); setEditing(false) }
  }

  const cancelEdit = () => {
    setEditing(false)
    setNameText(member.name || '')
    setPhoneText(member.phone_number || '')
    setRespText(member.responsibilities || '')
  }

  const toggleRole = async () => {
    const newRole = member.role === 'admin' ? 'member' : 'admin'
    try { await api.patch(`/projects/${member.project_id}/members/${member.id}`, { role: newRole }); onUpdate() }
    catch { /* silent */ }
  }

  const remove = async () => {
    if (!window.confirm(`Remover ${member.name} do projeto?`)) return
    setRemoving(true)
    try { await api.delete(`/projects/${member.project_id}/members/${member.id}`); onUpdate() }
    catch { setRemoving(false) }
  }

  const editInputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.35)',
    borderRadius: 10, color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }

  const STATUS_PILL = {
    completed: { bg: 'rgba(16,185,129,0.1)', color: '#34d399', label: 'Concluída' },
    in_progress: { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', label: 'Em andamento' },
    pending: { bg: 'rgba(148,163,184,0.08)', color: '#64748b', label: 'Pendente' },
    blocked: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', label: 'Bloqueada' },
    overdue: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', label: 'Atrasada' },
  }

  return (
    <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)'}>

      {/* Top */}
      <div style={{ padding: '22px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Avatar name={editing ? nameText || 'XX' : member.name} index={index} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 5 }}>Nome</div>
                <input value={nameText} onChange={e => setNameText(e.target.value)} placeholder="Nome completo"
                  style={editInputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 5 }}>WhatsApp</div>
                <input value={phoneText} onChange={e => setPhoneText(e.target.value)} placeholder="5511999999999"
                  style={editInputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{member.name}</span>
                <button onClick={toggleRole} title="Clique para alternar função"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: member.role === 'admin' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                    color: member.role === 'admin' ? '#f87171' : '#818cf8' }}>
                  {member.role === 'admin' ? <Shield style={{ width: 9, height: 9 }} /> : <User style={{ width: 9, height: 9 }} />}
                  {member.role === 'admin' ? 'Admin' : 'Membro'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <Phone style={{ width: 12, height: 12, color: '#475569' }} />
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>{member.phone_number}</span>
              </div>
            </>
          )}
          {member.last_whatsapp_activity && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Activity style={{ width: 11, height: 11, color: '#334155' }} />
              <span style={{ fontSize: 11, color: '#334155' }}>Último acesso: {new Date(member.last_whatsapp_activity).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)} title="Editar membro"
              style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.07)'}>
              <Edit3 style={{ width: 13, height: 13, color: '#818cf8' }} />
            </button>
          ) : null}
          <button onClick={remove} disabled={removing}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}>
            {removing ? <Loader2 style={{ width: 13, height: 13, color: '#f87171', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: 13, height: 13, color: '#f87171' }} />}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid rgba(99,102,241,0.07)', borderBottom: '1px solid rgba(99,102,241,0.07)' }}>
        {[{ icon: CheckCircle2, val: done, label: 'Concluídas', color: '#34d399' },
          { icon: Clock, val: active, label: 'Em aberto', color: '#818cf8' },
          { icon: AlertCircle, val: overdue, label: 'Atrasadas', color: '#fbbf24' }
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 10px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(99,102,241,0.07)' : 'none' }}>
            <s.icon style={{ width: 16, height: 16, color: s.color, margin: '0 auto 4px' }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Responsibilities */}
      <div style={{ padding: '18px 24px', borderBottom: memberTasks.length > 0 ? '1px solid rgba(99,102,241,0.07)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Responsabilidades</div>
          {editing && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={cancelEdit} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveMember} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer' }}>
                {saving ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 11, height: 11 }} />} Salvar
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <textarea rows={3} value={respText} onChange={e => setRespText(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        ) : (
          <p style={{ fontSize: 13, color: member.responsibilities ? '#94a3b8' : '#334155', lineHeight: 1.6, margin: 0, fontStyle: member.responsibilities ? 'normal' : 'italic' }}>
            {member.responsibilities || 'Nenhuma responsabilidade definida ainda. Clique em Editar para adicionar.'}
          </p>
        )}
      </div>

      {/* Tasks */}
      {memberTasks.length > 0 && (
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 10 }}>Tarefas Atribuídas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {memberTasks.slice(0, 4).map(t => {
              const s = STATUS_PILL[t.status] || STATUS_PILL.pending
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.07)' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              )
            })}
            {memberTasks.length > 4 && <div style={{ fontSize: 11, color: '#475569', textAlign: 'center' }}>+{memberTasks.length - 4} tarefas</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjectTeamPage() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    try {
      const [dash, taskList] = await Promise.all([
        api.get(`/projects/${id}/dashboard`),
        api.get(`/projects/${id}/tasks`),
      ])
      setProject(dash.project)
      setMembers(dash.members || [])
      setTasks(Array.isArray(taskList) ? taskList : [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Loader2 style={{ width: 36, height: 36, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const admins = members.filter(m => m.role === 'admin')
  const regular = members.filter(m => m.role !== 'admin')

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <NavLink to={`/projects/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)', textDecoration: 'none', marginBottom: 20, transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(148,163,184,0.9)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.5)'}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Voltar ao Dashboard
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', margin: 0 }}>
              Gestão de Equipe
            </h1>
            <p style={{ fontSize: 14, color: '#475569', marginTop: 6, fontWeight: 500 }}>
              {project?.name} · {members.length} {members.length === 1 ? 'membro' : 'membros'}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)'}>
            <Plus style={{ width: 16, height: 16 }} /> Adicionar Membro
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(99,102,241,0.15)', borderRadius: 20 }}>
          <Users style={{ width: 48, height: 48, color: '#1e293b', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Equipe vazia</div>
          <p style={{ fontSize: 14, color: '#334155', marginBottom: 20 }}>Adicione os membros do projeto para começar a distribuir tarefas.</p>
          <button onClick={() => setShowAdd(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Adicionar Primeiro Membro
          </button>
        </div>
      ) : (
        <>
          {admins.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Shield style={{ width: 14, height: 14, color: '#f87171' }} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f87171' }}>Administradores</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
                {admins.map((m, i) => <MemberCard key={m.id} member={m} index={i} tasks={tasks} onUpdate={load} onRemove={load} />)}
              </div>
            </div>
          )}

          {regular.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Users style={{ width: 14, height: 14, color: '#818cf8' }} />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818cf8' }}>Membros da Equipe</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
                {regular.map((m, i) => <MemberCard key={m.id} member={m} index={admins.length + i} tasks={tasks} onUpdate={load} onRemove={load} />)}
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && <AddMemberModal projectId={id} onClose={() => setShowAdd(false)} onDone={load} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
