import React from 'react'
import { Target } from 'lucide-react'
import { AdminPageShell, PlanBadge, TrRow, StatusBadge } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

const CAMPAIGN_STATUS = {
  draft: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
  scheduled: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  generating: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  published: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

export default function AdminCampaignsPage() {
  return (
    <AdminPageShell
      title="Campanhas IA"
      icon={Target}
      iconColor="--nexus-pink"
      columns={['Campanha', 'Empresa', 'Tipo', 'Status', 'Publicação', 'Plano', 'Criado em']}
      fetchFn={async ({ page, search }) => {
        return await adminApi.listCampaigns({ page, search })
      }}
      searchPlaceholder="Buscar campanha..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title || `Campanha #${r.id}`}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(236,72,153,0.1)', color: '#ec4899', textTransform: 'capitalize' }}>{r.type || '—'}</span>
          </td>
          <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status || 'draft'} colorMap={CAMPAIGN_STATUS} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.publish_at ? new Date(r.publish_at).toLocaleDateString('pt-BR') : '—'}</td>
          <td style={{ padding: '11px 14px' }}><PlanBadge plan={r.plan} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
