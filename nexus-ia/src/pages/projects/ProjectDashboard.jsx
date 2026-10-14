import React, { useState, useEffect } from 'react'
import { useParams, NavLink } from 'react-router-dom'
import { api } from '../../api'
import {
  Briefcase, Users, LayoutDashboard, Target, Calendar,
  Bell, CheckCircle2, Circle, AlertCircle, Clock,
  ChevronLeft, Mic, BarChart3, Bot, Plus, Zap, ArrowRight,
  Loader2, Shield, Phone, TrendingUp, MessageSquare
} from 'lucide-react'
import MeetingRecorder from './components/MeetingRecorder'
import ProjectMembersModal from './components/ProjectMembersModal'
import ProjectAgentModal from './components/ProjectAgentModal'
import ProjectWhatsAppModal from './components/ProjectWhatsAppModal'
import '../../projects-tailwind.css'

const GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
]

function Avatar({ name, index, size = 'md' }) {
  const g = GRADIENTS[index % GRADIENTS.length]
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${g} flex items-center justify-center font-bold text-white shadow-lg shrink-0 ring-2 ring-slate-900`}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3 group"
      style={{
        background: 'rgba(15,23,42,0.7)',
        border: `1px solid ${accent}18`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${accent}08`,
      }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl -translate-y-8 translate-x-8 transition-all duration-500 group-hover:opacity-20"
        style={{ background: accent }} />
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</span>
      </div>
      <div className="relative z-10">
        <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>
        {sub && <div className="text-xs font-medium mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>{sub}</div>}
      </div>
    </div>
  )
}

const STATUS_COLORS = {
  active: { text: '#34d399', dot: '#10b981', label: 'Em Andamento' },
  completed: { text: '#60a5fa', dot: '#3b82f6', label: 'Concluído' },
  paused: { text: '#fbbf24', dot: '#f59e0b', label: 'Pausado' },
}

export default function ProjectDashboard() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMeeting, setShowMeeting] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)


  useEffect(() => { fetchDashboard() }, [id])

  const fetchDashboard = async () => {
    try {
      const res = await api.get(`/projects/${id}/dashboard`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 blur-xl rounded-full" style={{ background: 'rgba(99,102,241,0.3)' }} />
          <Loader2 className="relative w-10 h-10 text-indigo-400 animate-spin" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">Carregando projeto...</span>
      </div>
    </div>
  )

  if (!data) return null
  const { project, tasks, members, phases, alerts } = data
  const status = STATUS_COLORS[project.status] || STATUS_COLORS.active
  const progress = project.total_tasks ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8 h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <NavLink to="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-4 transition-all duration-200 group"
            style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(148,163,184,0.9)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.5)'}
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Voltar aos Projetos
          </NavLink>
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                boxShadow: '0 0 24px rgba(99,102,241,0.15)',
              }}>
              <Briefcase className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: status.dot, boxShadow: `0 0 6px ${status.dot}` }} />
                  <span className="text-xs font-bold" style={{ color: status.text }}>{status.label}</span>
                </div>
                {project.meta_goal && (
                  <>
                    <span style={{ color: 'rgba(148,163,184,0.2)' }}>·</span>
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" style={{ color: 'rgba(148,163,184,0.5)' }} />
                      <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>{project.meta_goal}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <NavLink to={`/projects/${id}/team`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: 'rgba(148,163,184,0.9)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = 'rgba(148,163,184,0.9)' }}
          >
            <Users className="w-4 h-4" />
            Equipe
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
              {members.length}
            </span>
          </NavLink>


          <button onClick={() => setShowAgent(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: project.agent_enabled ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.12)',
              border: project.agent_enabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.25)',
              color: project.agent_enabled ? '#34d399' : '#a78bfa',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <Bot className="w-4 h-4" />
            Agente {project.agent_enabled ? '● Ativo' : '○ Inativo'}
          </button>

          {/* WhatsApp Group Link */}
          <button onClick={() => setShowWhatsApp(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: project.whatsapp_group_id ? 'rgba(16,185,129,0.08)' : 'rgba(15,23,42,0.8)',
              border: project.whatsapp_group_id ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(99,102,241,0.15)',
              color: project.whatsapp_group_id ? '#34d399' : 'rgba(148,163,184,0.7)',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <MessageSquare className="w-4 h-4" />
            {project.whatsapp_group_id ? 'Grupo ●' : 'Grupo WhatsApp'}
          </button>

          <NavLink to={`/projects/${id}/analytics`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: 'rgba(148,163,184,0.9)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = 'rgba(148,163,184,0.9)' }}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </NavLink>

          <NavLink to={`/projects/${id}/marketing`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#34d399',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; e.currentTarget.style.color = '#a7f3d0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; e.currentTarget.style.color = '#34d399' }}
          >
            <TrendingUp className="w-4 h-4" /> Marketing
          </NavLink>

          <button onClick={() => setShowMeeting(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.55)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.4)'}
          >
            <Mic className="w-4 h-4" /> Iniciar Reunião
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Status" value={status.label} icon={TrendingUp} color={status.text} accent={status.dot} />
        <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(99,102,241,0.15)',
            backdropFilter: 'blur(12px)',
          }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>Tarefas</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {project.completed_tasks} <span className="text-lg font-medium text-slate-500">/ {project.total_tasks}</span>
            </div>
            <div className="relative w-full h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: 'rgba(148,163,184,0.1)' }}>
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                }} />
            </div>
            <div className="text-xs font-bold mt-1.5" style={{ color: 'rgba(99,102,241,0.8)' }}>{progress}% completo</div>
          </div>
        </div>
        <StatCard
          label="Atrasos"
          value={project.overdue_tasks > 0 ? `${project.overdue_tasks}` : '0'}
          sub={project.overdue_tasks > 0 ? 'tarefas atrasadas' : 'Tudo em dia ✓'}
          icon={AlertCircle}
          color={project.overdue_tasks > 0 ? '#f87171' : '#34d399'}
          accent={project.overdue_tasks > 0 ? '#ef4444' : '#10b981'}
        />
        <StatCard
          label="Prazo Final"
          value={project.deadline ? new Date(project.deadline).toLocaleDateString('pt-BR') : '—'}
          sub={project.deadline ? 'data de entrega' : 'Não definido'}
          icon={Calendar}
          color="#e2e8f0"
          accent="#6366f1"
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* TASKS */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              </div>
              Cronograma &amp; Tarefas
            </h2>
            <button className="flex items-center gap-1.5 text-xs font-bold transition-all duration-200"
              style={{ color: 'rgba(99,102,241,0.7)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(99,102,241,0.7)'}>
              Ver Kanban <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(99,102,241,0.1)',
              backdropFilter: 'blur(12px)',
            }}>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }}>
                  <Plus className="w-7 h-7 text-indigo-400 opacity-50" />
                </div>
                <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>Nenhuma tarefa criada ainda</p>
              </div>
            ) : (
              <div>
                {tasks.map((task, i) => (
                  <div key={task.id}
                    className="flex items-center gap-4 px-5 py-4 transition-all duration-150 group"
                    style={{
                      borderBottom: i < tasks.length - 1 ? '1px solid rgba(99,102,241,0.06)' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="shrink-0">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : task.status === 'in_progress' ? (
                        <div className="relative w-5 h-5">
                          <Circle className="w-5 h-5 text-indigo-500" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          </div>
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold truncate ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {task.title}
                      </h4>
                      {task.due_date && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" style={{ color: 'rgba(148,163,184,0.3)' }} />
                          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                            {new Date(task.due_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex -space-x-2">
                      {task.responsible_member_ids?.slice(0, 3).map((mId, j) => {
                        const m = members.find(x => x.id === mId)
                        return m ? <Avatar key={mId} name={m.name} index={j} size="sm" /> : null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-6">

          {/* ALERTS */}
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <Bell className="w-4 h-4 text-rose-400" />
              </div>
              Alertas Recentes
            </h2>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(239,68,68,0.08)', backdropFilter: 'blur(12px)' }}>
              {alerts.length === 0 ? (
                <div className="flex items-center gap-3 p-5">
                  <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>Nenhum alerta ativo</span>
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(239,68,68,0.06)' }}>
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex gap-3 p-4">
                      <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${alert.severity === 'critical' || alert.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                      <div>
                        <h4 className="text-xs font-bold text-slate-300">{alert.title}</h4>
                        {alert.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(148,163,184,0.5)' }}>{alert.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TEAM */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
                Equipe
              </h2>
              <button onClick={() => setShowMembers(true)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
                style={{ color: 'rgba(99,102,241,0.6)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(99,102,241,0.6)'}
              >
                <Plus className="w-3.5 h-3.5" /> Gerenciar
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.1)', backdropFilter: 'blur(12px)' }}>
              {members.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Users className="w-8 h-8 opacity-20 text-slate-400" />
                  <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>Nenhum membro</p>
                  <button onClick={() => setShowMembers(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar Membro
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(99,102,241,0.06)' }}>
                  {members.map((member, i) => (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3.5 group transition-all duration-150"
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Avatar name={member.name} index={i} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-300 truncate">{member.name}</span>
                          {member.role === 'admin' && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
                              <Shield className="w-2 h-2" /> Admin
                            </span>
                          )}
                        </div>
                        {member.phone_number && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" style={{ color: 'rgba(148,163,184,0.3)' }} />
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(148,163,184,0.35)' }}>{member.phone_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showMeeting && (
        <MeetingRecorder projectId={id} projectName={project.name}
          onClose={() => setShowMeeting(false)}
          onMeetingProcessed={() => { setShowMeeting(false); fetchDashboard() }} />
      )}
      {showMembers && (
        <ProjectMembersModal projectId={id} members={members}
          onClose={() => setShowMembers(false)}
          onUpdate={fetchDashboard} />
      )}
      {showAgent && (
        <ProjectAgentModal project={project}
          onClose={() => setShowAgent(false)}
          onUpdate={fetchDashboard} />
      )}
      {showWhatsApp && (
        <ProjectWhatsAppModal project={project}
          onClose={() => setShowWhatsApp(false)}
          onSaved={fetchDashboard} />
      )}

    </div>
  )
}
