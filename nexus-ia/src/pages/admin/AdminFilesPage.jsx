/**
 * AdminFilesPage — Explorador de arquivos do servidor
 * Extraído de AdminServer.jsx para modularização
 */
import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, FileText, ChevronRight, ArrowLeft, Loader } from 'lucide-react'
import { api } from '../../api'
import { AdminSectionHeader } from '../../components/admin'
import { formatBytes } from '../../utils'

function getFileIcon(name, type) {
  if (type === 'directory') return '📁'
  const ext = name.split('.').pop()?.toLowerCase()
  const map = {
    py: '🐍', js: '📜', jsx: '⚛️', ts: '📘', tsx: '📘',
    json: '📋', md: '📝', html: '🌐', css: '🎨',
    sql: '🗃️', yml: '⚙️', yaml: '⚙️', sh: '⚡', log: '📃',
  }
  return map[ext] || '📄'
}

export default function AdminFilesPage() {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewFile, setViewFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [loadingFile, setLoadingFile] = useState(false)

  const load = useCallback(async (path = '') => {
    setLoading(true)
    setViewFile(null)
    setFileContent(null)
    try {
      const data = await api.adminFiles(path)
      setItems(data.items || [])
      setCurrentPath(data.current_path || '')
    } catch (e) {
      console.error('File list error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openFile = async (path) => {
    setLoadingFile(true)
    try {
      const data = await api.adminFileContent(path)
      setViewFile(data)
      setFileContent(data.content)
    } catch (e) {
      console.error('File read error:', e)
    }
    setLoadingFile(false)
  }

  const goUp = () => {
    const parts = currentPath.split('/')
    parts.pop()
    load(parts.join('/'))
  }

  // ── File viewer ────────────────────────────────────────────────────────────
  if (viewFile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: 'var(--bg-surface)',
        }}>
          <button onClick={() => { setViewFile(null); setFileContent(null) }} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, border: '1px solid var(--border-default)',
            background: 'var(--bg-card)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
          }}>
            <ArrowLeft size={12} /> Voltar
          </button>
          <FileText size={14} color="var(--nexus-cyan)" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{viewFile.name}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {formatBytes(viewFile.size)} · {viewFile.lines} linhas
          </span>
        </div>
        <pre style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px', margin: 0,
          background: 'var(--bg-base)', color: 'var(--text-primary)',
          fontSize: 12, lineHeight: 1.7,
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {fileContent || 'Tipo de arquivo não suportado para visualização.'}
        </pre>
      </div>
    )
  }

  // ── File browser ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Breadcrumb */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        {currentPath && (
          <button onClick={goUp} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            borderRadius: 7, border: '1px solid var(--border-default)',
            background: 'var(--bg-card)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 11,
          }}>
            <ArrowLeft size={11} /> Voltar
          </button>
        )}
        <FolderOpen size={14} color="var(--nexus-amber)" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>/</span>
        {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronRight size={10} color="var(--text-muted)" />
            <button onClick={() => load(arr.slice(0, i + 1).join('/'))} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: i === arr.length - 1 ? 'var(--nexus-cyan)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, padding: 0,
            }}>
              {part}
            </button>
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {items.length} itens
        </span>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Diretório vazio
          </div>
        ) : items.map(item => (
          <button
            key={item.name}
            onClick={() => item.type === 'directory' ? load(item.path) : openFile(item.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', borderRadius: 10, marginBottom: 2, border: 'none',
              background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)',
              textAlign: 'left', transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 18 }}>{getFileIcon(item.name, item.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {item.modified ? new Date(item.modified).toLocaleString('pt-BR') : ''}
              </div>
            </div>
            {item.size != null && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatBytes(item.size)}
              </span>
            )}
            {item.type === 'directory' && <ChevronRight size={12} color="var(--text-muted)" />}
          </button>
        ))}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
