import React from 'react'
import { Volume2 } from 'lucide-react'
import { AdminPageShell, PlanBadge, TrRow, StatusBadge } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

const VOICE_STATUS = {
  ready: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  training: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  processing: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

export default function AdminVoicePage() {
  return (
    <AdminPageShell
      title="Voice Profiles"
      icon={Volume2}
      iconColor="--nexus-cyan"
      columns={['Perfil', 'Provider', 'Empresa', 'Samples', 'Gerações', 'Status', 'Plano', 'Criado em']}
      fetchFn={async ({ page }) => {
        return await adminApi.listVoiceProfiles({ page })
      }}
      searchPlaceholder="Buscar perfil de voz..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {r.voice_id || '—'}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{r.provider || '—'}</td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{r.sample_count ?? 0}</td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-violet)' }}>{r.generation_count ?? 0}</td>
          <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status || 'ready'} colorMap={VOICE_STATUS} /></td>
          <td style={{ padding: '11px 14px' }}><PlanBadge plan={r.plan} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
