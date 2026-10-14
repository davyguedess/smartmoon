import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import '../../projects-tailwind.css'
import { 
  Briefcase, CheckCircle2, Circle, Clock, LayoutDashboard, 
  LogOut, Target, Loader2, ArrowRight
} from 'lucide-react'

export default function PublicProjectDashboard() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [slug])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem(`project_token_${slug}`)
      if (!token) {
        navigate(`/p/${slug}`)
        return
      }

      // API request passing token in header
      const res = await api.get(`/projects/public/${slug}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setData(res)
    } catch (err) {
      console.error(err)
      setError('Sessão expirada ou acesso negado.')
      localStorage.removeItem(`project_token_${slug}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(`project_token_${slug}`)
    navigate(`/p/${slug}`)
  }

  const handleCompleteTask = async (taskId) => {
    // In a full implementation, you might want a modal to ask for completion notes
    const notes = prompt("Deixe uma breve anotação sobre a conclusão da tarefa:")
    if (notes === null) return // Cancelled
    
    try {
      const token = localStorage.getItem(`project_token_${slug}`)
      await api.post(`/projects/public/${slug}/tasks/${taskId}/complete`, { notes }, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      // Refresh data
      fetchData()
    } catch (err) {
      console.error(err)
      alert("Erro ao concluir tarefa. Tente novamente.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-slate-400 mt-4 font-medium">Carregando painel do projeto...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
            <LogOut className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button 
            onClick={() => navigate(`/p/${slug}`)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium"
          >
            Fazer Login Novamente
          </button>
        </div>
      </div>
    )
  }

  const { project, tasks, my_member_id } = data

  // Filter tasks: show my pending tasks and recent completed tasks
  const myTasks = tasks.filter(t => t.responsible_member_ids?.includes(my_member_id) && t.status !== 'completed')
  const otherTasks = tasks.filter(t => !myTasks.includes(t))

  return (
    <div className="min-h-screen bg-slate-950">
      {/* HEADER */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
              <Briefcase className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-lg font-bold text-white hidden sm:block">{project.name}</h1>
          </div>
          <button 
            onClick={handleLogout}
            className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2"
          >
            Sair <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* PROJECT INFO BANNER */}
        <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">{project.name}</h2>
          <p className="text-indigo-200/80 mb-4">{project.description || 'Nenhuma descrição fornecida.'}</p>
          
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50 flex items-center gap-3">
              <Target className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Meta</div>
                <div className="text-sm font-medium text-slate-200">{project.meta_goal || 'Não definida'}</div>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50 flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Progresso</div>
                <div className="text-sm font-medium text-slate-200">{project.completed_tasks} de {project.total_tasks} Tarefas</div>
              </div>
            </div>
          </div>
        </div>

        {/* MY TASKS */}
        <h3 className="text-xl font-bold text-white mb-4">Minhas Tarefas Pendentes</h3>
        {myTasks.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center text-slate-400 mb-8">
            Você não possui tarefas pendentes no momento.
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {myTasks.map(task => (
              <div key={task.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-500/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Sua Tarefa
                    </span>
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                        <Clock className="w-3 h-3" /> Prazo: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-slate-200">{task.title}</h4>
                </div>
                <button 
                  onClick={() => handleCompleteTask(task.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" /> Marcar como Feita
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PROJECT CRONOGRAM */}
        <h3 className="text-xl font-bold text-white mb-4 mt-12">Cronograma Geral</h3>
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-800/50">
            {otherTasks.map(task => (
              <div key={task.id} className={`p-4 flex items-center gap-4 ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                <div className="shrink-0">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : task.status === 'in_progress' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div>
                  <h4 className={`text-sm font-semibold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                    {task.title}
                  </h4>
                  {task.status === 'completed' && task.completion_notes && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">Obs: {task.completion_notes}</p>
                  )}
                </div>
              </div>
            ))}
            {otherTasks.length === 0 && (
              <div className="p-8 text-center text-slate-500">Nenhuma outra tarefa no cronograma.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
