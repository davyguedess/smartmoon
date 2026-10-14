import React from 'react'
import { Shield } from 'lucide-react'
import { AdminPageShell, TrRow } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

function timeAgo(isoString) {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

const ACTION_COLORS = {
  create: '#10b981',
  update: '#3b82f6',
  delete: '#ef4444',
  login: '#6366f1',
  admin: '#f59e0b',
}

function actionColor(action) {
  if (!action) return '#64748b'
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return color
  }
  return '#64748b'
}

export default function AdminAuditPage() {
  return (
    <AdminPageShell
      title="Trilha de Auditoria"
      icon={Shield}
      iconColor="--nexus-amber"
      columns={['Ação', 'Recurso', 'Ator', 'Empresa', 'IP', 'Quando']}
      fetchFn={async ({ page, search }) => {
        return await adminApi.getAuditTrail({ page, action: search })
      }}
      searchPlaceholder="Filtrar por ação..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: actionColor(r.action), flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{r.action}</span>
            </div>
          </td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.resource_type || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {r.resource_id || '—'}</div>
          </td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{r.actor_name || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.actor_email || ''}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name || '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.ip || '—'}</td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(r.ts)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.ts ? new Date(r.ts).toLocaleString('pt-BR') : ''}</div>
          </td>
        </TrRow>
      )}
    />
  )
}
