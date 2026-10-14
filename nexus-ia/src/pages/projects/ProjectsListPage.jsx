import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Plus, LayoutDashboard, Calendar, Users, Briefcase, Search, ArrowRight, Loader2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { api } from '../../api'
import '../../projects-tailwind.css'

export default function ProjectsListPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', meta_goal: '' })

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const data = await api.get('/projects')
      setProjects(Array.isArray(data) ? data : (data?.items || data?.results || []))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/projects', newProject)
      setIsCreateModalOpen(false)
      setNewProject({ name: '', description: '', meta_goal: '' })
      fetchProjects()
    } catch (err) {
      console.error(err)
      alert("Erro ao criar projeto")
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-indigo-500" />
            Smart Project Manager
          </h1>
          <p className="text-slate-400 mt-2">
            Gerencie projetos com inteligência artificial, WhatsApp e controle de SLA.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(projects || []).map(project => (
          <div key={project.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 hover:border-indigo-500/50 transition-all flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white truncate pr-4">{project.name}</h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                {project.status === 'active' ? 'Ativo' : 'Concluído'}
              </span>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
              {project.description || 'Sem descrição.'}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-xs">Tarefas</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {project.completed_tasks} / {project.total_tasks}
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full" 
                    style={{ width: `${project.total_tasks ? (project.completed_tasks / project.total_tasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Equipe</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {project.members_count} Membros
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-rose-400 font-medium">
                  {project.overdue_tasks > 0 && <span>{project.overdue_tasks} atrasadas</span>}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-700/50">
              <NavLink 
                to={`/projects/${project.id}`}
                className="flex items-center justify-between text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4" />
              </NavLink>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-20 bg-slate-800/40 rounded-xl border border-slate-700/50 mt-8">
          <Briefcase className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-300 mb-2">Nenhum projeto encontrado</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Você ainda não possui projetos gerenciados pelo Smart Project Manager. Crie seu primeiro projeto para começar.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-6 py-2 rounded-lg font-medium hover:bg-indigo-600/30 transition-colors"
          >
            Criar Primeiro Projeto
          </button>
        </div>
      )}

      {/* Modal Criar Projeto */}
      {isCreateModalOpen && ReactDOM.createPortal(
        <div
          onClick={e => e.target === e.currentTarget && setIsCreateModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(2,6,23,0.88)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div style={{
            width: '100%', maxWidth: 520,
            background: 'linear-gradient(160deg, #0f172a 0%, #131c35 100%)',
            border: '1px solid rgba(99,102,241,0.22)', borderRadius: 24,
            boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(99,102,241,0.07)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Novo Projeto</div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(148,163,184,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
              >
                <span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>✕</span>
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[{label:'Nome do Projeto *', key:'name', placeholder:'Ex: Lançamento de Produto X', required:true, type:'input'},
                {label:'Meta Principal', key:'meta_goal', placeholder:'Ex: Faturar R$ 100k no primeiro mês', required:false, type:'input'},
                {label:'Descrição', key:'description', placeholder:'Descreva brevemente o projeto...', required:false, type:'textarea'},
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea rows={3} required={f.required} value={newProject[f.key]} onChange={e => setNewProject({...newProject, [f.key]: e.target.value})} placeholder={f.placeholder}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.12)', borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  ) : (
                    <input required={f.required} type="text" value={newProject[f.key]} onChange={e => setNewProject({...newProject, [f.key]: e.target.value})} placeholder={f.placeholder}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.12)', borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '11px 20px', borderRadius: 12, border: '1px solid rgba(148,163,184,0.12)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Cancelar</button>
                <button type="submit"
                  style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'}
                >Criar Projeto</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
