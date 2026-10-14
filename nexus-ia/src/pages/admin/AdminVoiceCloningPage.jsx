/**
 * AdminVoiceCloningPage — Voice cloning profiles from real DB
 */
import React from 'react'
import { Copy } from 'lucide-react'
import { AdminPageShell, PlanBadge, TrRow, StatusBadge } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

const STATUS_MAP = {
  ready: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  training: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  processing: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

export default function AdminVoiceCloningPage() {
  return (
    <AdminPageShell
      title="Clonagem de Voz"
      subtitle="Perfis de clonagem de voz na plataforma"
      icon={Copy}
      iconColor="--nexus-cyan"
      columns={['Perfil', 'Provider', 'Empresa', 'Samples', 'Status', 'Plano', 'Criado em']}
      fetchFn={async ({ page }) => {
        return await adminApi.listVoiceProfiles({ page })
      }}
      searchPlaceholder="Buscar perfil de voz..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Voice ID: {r.voice_id || '—'}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{r.provider || '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{r.sample_count ?? 0}</td>
          <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status || 'ready'} colorMap={STATUS_MAP} /></td>
          <td style={{ padding: '11px 14px' }}><PlanBadge plan={r.plan} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
