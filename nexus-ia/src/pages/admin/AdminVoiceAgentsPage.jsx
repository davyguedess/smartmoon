/**
 * AdminVoiceAgentsPage — Voice agents (agentes de voz) from real DB
 * Uses agents endpoint filtered to voice type
 */
import React from 'react'
import { Mic } from 'lucide-react'
import { AdminPageShell, ActiveDot, PlanBadge, TrRow } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

export default function AdminVoiceAgentsPage() {
  return (
    <AdminPageShell
      title="Agentes de Voz"
      subtitle="Agentes especializados em interação por voz"
      icon={Mic}
      iconColor="--nexus-cyan"
      columns={['Agente', 'Empresa', 'Modelo', 'Skills', 'Status', 'Plano', 'Criado em']}
      fetchFn={async ({ page, search }) => {
        // Fetch all agents — filtering voice-type in backend if supported
        return await adminApi.listAgents({ page, search })
      }}
      searchPlaceholder="Buscar agente de voz..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{r.slug}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{r.model}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.provider}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{r.active_skills ?? 0}</td>
          <td style={{ padding: '11px 14px' }}><ActiveDot active={r.is_active} /></td>
          <td style={{ padding: '11px 14px' }}><PlanBadge plan={r.plan} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
