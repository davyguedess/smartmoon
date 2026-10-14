/**
 * Componentes específicos do painel administrativo da Smart Moon
 * 
 * Exports:
 *   - AdminActivityFeed   — feed de atividade recente do sistema
 *   - AdminQuickAction    — botão de ação rápida do dashboard
 *   - AdminSectionHeader  — cabeçalho de seção com título + ação
 */

import { RefreshCw } from 'lucide-react'

/**
 * AdminSectionHeader — Cabeçalho padrão de seção admin
 */
export function AdminSectionHeader({ title, subtitle, action, onRefresh }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 20,
    }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {action}
        {onRefresh && (
          <button onClick={onRefresh} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, border: '1px solid var(--border-default)',
            background: 'var(--bg-card)', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * AdminActivityFeed — Feed de atividade recente
 */
export function AdminActivityFeed({ items = [], loading = false }) {
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Carregando atividades...
      </div>
    )
  }
  if (!items.length) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Nenhuma atividade recente
      </div>
    )
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id ?? i} style={{
          display: 'flex', gap: 12, padding: '10px 0',
          borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
            {item.icon || '🔹'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.action}
            </div>
            {item.detail && (
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.detail}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
            {item.time}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * AdminQuickAction — Botão de ação rápida estilizado
 */
export function AdminQuickAction({ icon: Icon, label, description, onClick, color = 'var(--nexus-violet)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderRadius: 12, border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)', cursor: 'pointer',
        textAlign: 'left', width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.background = `${color}06`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.background = 'var(--bg-card)'
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{description}</div>
        )}
      </div>
    </button>
  )
}
