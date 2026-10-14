/**
 * AdminServer — Shell de navegação do painel administrativo
 *
 * Este componente é apenas o container com tab bar.
 * A lógica de cada tab foi extraída para páginas separadas:
 *   - AdminServerPage.jsx   → métricas do servidor
 *   - AdminFilesPage.jsx    → explorador de arquivos
 *   - AdminDatabasePage.jsx → inspetor de banco de dados
 */
import { useState } from 'react'
import { Monitor, FolderOpen, Database } from 'lucide-react'
import AdminServerPage from './AdminServerPage'
import AdminFilesPage from './AdminFilesPage'
import AdminDatabasePage from './AdminDatabasePage'

const TABS = [
  { id: 'server',   label: 'Servidor',      icon: Monitor,    color: '#8b5cf6', Component: AdminServerPage },
  { id: 'files',    label: 'Arquivos',      icon: FolderOpen, color: '#f59e0b', Component: AdminFilesPage },
  { id: 'database', label: 'Banco de Dados', icon: Database,  color: '#3b82f6', Component: AdminDatabasePage },
]

export default function AdminServer() {
  const [activeTab, setActiveTab] = useState('server')

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.Component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                borderRadius: 10, border: 'none',
                background: isActive ? `${tab.color}15` : 'transparent',
                color: isActive ? tab.color : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                transition: 'all 0.15s',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <div style={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}
