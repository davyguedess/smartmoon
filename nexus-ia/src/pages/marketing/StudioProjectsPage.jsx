/**
 * Smart Moon — Studio Projects Page
 * Galeria de projetos salvos do usuário
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import {
  Plus, Image, Clock, Trash2, Edit3, Copy,
  FolderOpen, RefreshCw, Grid3x3, List,
  Search, Download, ChevronRight, Sparkles,
} from 'lucide-react'

const fmt = d => d ? new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }) : ''
const fmtTime = d => d ? new Date(d).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''

function ProjectCard({ project, viewMode, onOpen, onDelete, onDuplicate }) {
  const [hover, setHover] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (viewMode === 'list') {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 16px',
          background: hover ? 'var(--bg-card-hover)' : 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onOpen(project)}
      >
        {/* Thumbnail */}
        <div style={{
          width: 60, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          {project.thumbnail_url
            ? <img src={project.thumbnail_url} alt={project.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><Image size={20} color="var(--text-muted)" /></div>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {project.format || 'square'} · {fmt(project.updated_at)} {fmtTime(project.updated_at)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onDuplicate(project)} title="Duplicar" style={{ padding: '6px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--nexus-cyan)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          ><Copy size={13} /></button>
          <button onClick={async () => { setDeleting(true); await onDelete(project.id); setDeleting(false) }} title="Excluir" disabled={deleting}
            style={{ padding: '6px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--nexus-red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          ><Trash2 size={13} /></button>
          <button onClick={() => onOpen(project)} title="Abrir no Studio"
            style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--gradient-purple)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
          ><Edit3 size={11} /> Editar</button>
        </div>
      </div>
    )
  }

  // Grid mode
  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        background: 'var(--bg-card)',
        border: `1px solid ${hover ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
        cursor: 'pointer', transition: 'all 0.2s',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover ? 'var(--shadow-lg)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 160, background: 'var(--bg-elevated)' }}
        onClick={() => onOpen(project)}>
        {project.thumbnail_url
          ? <img src={project.thumbnail_url} alt={project.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : (
            <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
              <Image size={32} color="var(--text-muted)" />
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>Sem thumbnail</span>
            </div>
          )
        }
        {/* Hover overlay */}
        {hover && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <button onClick={e => { e.stopPropagation(); onOpen(project) }}
              style={{ padding:'8px 16px', borderRadius:8, background:'var(--gradient-purple)', border:'none', cursor:'pointer', color:'#fff', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', gap:5 }}>
              <Edit3 size={12}/> Editar
            </button>
          </div>
        )}
        {/* Format badge */}
        <div style={{ position:'absolute', top:8, left:8, padding:'2px 7px', borderRadius:20, background:'rgba(0,0,0,0.7)', fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.7)' }}>
          {project.format || 'square'}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {project.name}
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
            <Clock size={9} style={{ display:'inline', marginRight:3 }} />
            {fmt(project.updated_at)}
          </div>
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onDuplicate(project)} title="Duplicar"
            style={{ padding:'5px', borderRadius:6, background:'transparent', border:'1px solid var(--border-subtle)', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
            <Copy size={11} />
          </button>
          <button onClick={async () => { setDeleting(true); await onDelete(project.id); setDeleting(false) }} disabled={deleting} title="Excluir"
            style={{ padding:'5px', borderRadius:6, background:'transparent', border:'1px solid var(--border-subtle)', cursor:'pointer', color:deleting?'var(--text-muted)':'var(--text-muted)', display:'flex', transition:'color 0.15s' }}
            onMouseEnter={e => !deleting && (e.currentTarget.style.color='var(--nexus-red)')}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
          ><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  )
}

function EmptyProjects({ onNew }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'64px 24px', textAlign:'center' }}>
      <div style={{ width:80, height:80, borderRadius:'var(--radius-xl)', background:'rgba(139,92,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--glow-purple)' }}>
        <FolderOpen size={36} color="var(--nexus-purple)" />
      </div>
      <div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>Nenhum projeto ainda</h2>
        <p style={{ fontSize:14, color:'var(--text-secondary)', maxWidth:320, lineHeight:1.6 }}>
          Crie seu primeiro design no Studio e ele aparecerá aqui para você editar quando quiser.
        </p>
      </div>
      <button onClick={onNew} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:'var(--radius-md)', background:'var(--gradient-purple)', border:'none', cursor:'pointer', color:'#fff', fontSize:14, fontWeight:800, boxShadow:'var(--glow-purple)' }}>
        <Plus size={16} /> Criar novo design
      </button>
    </div>
  )
}

export default function StudioProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const data = await api.get('/studio/projects?limit=50')
      const list = Array.isArray(data) ? data : (data?.projects || [])
      setProjects(list)
    } catch {
      // Fallback: localStorage
      const saved = JSON.parse(localStorage.getItem('nexus_studio_library') || '[]')
      setProjects(saved.map(p => ({ ...p, format: p.format || 'square', updated_at: p.createdAt })))
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpen = (project) => {
    sessionStorage.setItem('nexus_studio_load', JSON.stringify({
      elements: project.canvas_json?.elements || project.elements || [],
      bgColor: project.canvas_json?.bgColor || project.bgColor || '#0f172a',
      format: project.canvas_json?.format || project.format || 'feed',
    }))
    navigate('/studio')
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/studio/projects/${id}`)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch {
      // Fallback: localStorage
      const saved = JSON.parse(localStorage.getItem('nexus_studio_library') || '[]')
      const filtered = saved.filter(p => p.id !== id)
      localStorage.setItem('nexus_studio_library', JSON.stringify(filtered))
      setProjects(filtered.map(p => ({ ...p, updated_at: p.createdAt })))
    }
  }

  const handleDuplicate = async (project) => {
    try {
      await api.post(`/studio/projects/${project.id}/duplicate`)
      load(true)
    } catch {
      // Local duplicate fallback
      const copy = { ...project, id: Date.now(), name: `${project.name} (cópia)`, createdAt: new Date().toISOString(), updated_at: new Date().toISOString() }
      setProjects(prev => [copy, ...prev])
    }
  }

  const filtered = projects.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:'var(--radius-md)', background:'var(--gradient-purple)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--glow-purple)', flexShrink:0 }}>
            <FolderOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}>Meus Projetos</h1>
            <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'2px 0 0' }}>
              {loading ? 'Carregando...' : `${projects.length} projeto${projects.length!==1?'s':''}`}
            </p>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Search */}
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              style={{ padding:'8px 12px 8px 30px', borderRadius:'var(--radius-sm)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:12, outline:'none', width:200 }}
            />
          </div>

          {/* View mode */}
          <div style={{ display:'flex', borderRadius:'var(--radius-sm)', overflow:'hidden', border:'1px solid var(--border-subtle)' }}>
            {[['grid', <Grid3x3 size={13}/>], ['list', <List size={13}/>]].map(([mode, icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding:'7px 10px', border:'none', cursor:'pointer', background: viewMode===mode ? 'var(--bg-elevated)' : 'transparent', color: viewMode===mode ? 'var(--text-primary)' : 'var(--text-muted)', display:'flex', alignItems:'center' }}>
                {icon}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={() => load(true)} title="Atualizar"
            style={{ padding:'8px', borderRadius:'var(--radius-sm)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          {/* New project */}
          <button onClick={() => navigate('/studio')}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:'var(--radius-md)', background:'var(--gradient-brand)', border:'none', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:800, boxShadow:'var(--glow-brand)' }}>
            <Plus size={14} /> Novo Design
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      {!loading && projects.length > 0 && (
        <div style={{ padding:'10px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:20, flexShrink:0 }}>
          {[
            { label:'Total', value: projects.length, color:'var(--nexus-purple)' },
            { label:'Feed 1:1', value: projects.filter(p=>p.format==='feed'||p.format==='square').length, color:'var(--nexus-blue)' },
            { label:'Stories', value: projects.filter(p=>p.format==='story').length, color:'var(--nexus-pink)' },
          ].map(({label,value,color}) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }} />
              <span style={{ color:'var(--text-muted)' }}>{label}:</span>
              <span style={{ fontWeight:800, color }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{ borderRadius:'var(--radius-lg)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', overflow:'hidden' }}>
                <div style={{ height:160, background:'linear-gradient(90deg,var(--border-subtle) 25%,rgba(255,255,255,0.06) 50%,var(--border-subtle) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }} />
                <div style={{ padding:12 }}>
                  <div style={{ height:14, borderRadius:4, background:'var(--border-subtle)', marginBottom:8 }} />
                  <div style={{ height:10, borderRadius:4, background:'var(--border-subtle)', width:'60%' }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyProjects onNew={() => navigate('/studio')} />
        ) : viewMode === 'grid' ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
            {/* Novo projeto card */}
            <div onClick={() => navigate('/studio')} style={{ borderRadius:'var(--radius-lg)', border:'2px dashed var(--border-default)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:24, minHeight:200, transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(139,92,246,0.5)'; e.currentTarget.style.background='rgba(139,92,246,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-default)'; e.currentTarget.style.background='transparent' }}>
              <Plus size={28} color="var(--nexus-purple)" />
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>Novo Design</span>
            </div>
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} viewMode="grid" onOpen={handleOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} />
            ))}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} viewMode="list" onOpen={handleOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
