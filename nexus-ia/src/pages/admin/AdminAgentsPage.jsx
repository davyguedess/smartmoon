import React from 'react'
import { Cpu } from 'lucide-react'
import { AdminPageShell, ActiveDot, PlanBadge, TrRow } from '../../components/admin/AdminPageShell'
import { adminApi } from '../../api'

export default function AdminAgentsPage() {
  return (
    <AdminPageShell
      title="Agentes"
      icon={Cpu}
      iconColor="--nexus-violet"
      columns={['Agente', 'Empresa', 'Tipo', 'Modelo', 'Skills', 'Status', 'Plano', 'Criado em']}
      fetchFn={async ({ page, search }) => {
        return await adminApi.listAgents({ page, search })
      }}
      searchPlaceholder="Buscar agente ou empresa..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{r.slug}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: 'var(--nexus-violet)', textTransform: 'capitalize' }}>{r.type}</span>
          </td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{r.model}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.provider}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{r.active_skills}</td>
          <td style={{ padding: '11px 14px' }}><ActiveDot active={r.is_active} /></td>
          <td style={{ padding: '11px 14px' }}><PlanBadge plan={r.plan} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
