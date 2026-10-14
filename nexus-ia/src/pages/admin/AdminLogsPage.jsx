import React from 'react'
import { ScrollText } from 'lucide-react'
import { AdminPageShell, TrRow, StatusBadge } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

const LOG_STATUS = {
  completed: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  success: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  failed: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  running: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

export default function AdminLogsPage() {
  return (
    <AdminPageShell
      title="Logs de Execução"
      icon={ScrollText}
      iconColor="--nexus-cyan"
      columns={['ID', 'Fluxo', 'Empresa', 'Status', 'Trigger', 'Erro', 'Início', 'Fim']}
      fetchFn={async ({ page }) => {
        const res = await adminApi.getLogs({ page, section: 'executions' })
        return { items: res.items || [], total: (res.items || []).length }
      }}
      searchPlaceholder="Buscar logs..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{r.id}</td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600 }}>{r.flow_name || '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status || '—'} colorMap={LOG_STATUS} /></td>
          <td style={{ padding: '11px 14px' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: 'var(--nexus-violet)', textTransform: 'capitalize' }}>{r.trigger || '—'}</span>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 11, color: r.error ? '#ef4444' : 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.error || '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.finished_at ? new Date(r.finished_at).toLocaleString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
