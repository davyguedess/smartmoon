/**
 * AdminLicitationPage — Shows bids (licitações) from public_bids table
 * Uses dedicated /admin/licitation endpoint
 */
import React from 'react'
import { Landmark } from 'lucide-react'
import { AdminPageShell, TrRow, StatusBadge } from '../../components/admin/AdminPageShell'
import { api } from '../../api'

const BID_STATUS = {
  draft: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
  submitted: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  analyzing: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  won: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  lost: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  open: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  closed: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
}

export default function AdminLicitationPage() {
  return (
    <AdminPageShell
      title="Licitações"
      subtitle="Todas as licitações monitoradas na plataforma"
      icon={Landmark}
      iconColor="--nexus-amber"
      columns={['ID', 'Título / Órgão', 'UF', 'Status', 'Valor Estimado', 'Prazo']}
      fetchFn={async ({ page }) => {
        const res = await api.get(`/admin/licitation?page=${page}&limit=50`)
        // Normaliza resposta: { bids: [...], total }
        const list = Array.isArray(res) ? res
          : Array.isArray(res?.bids) ? res.bids
          : Array.isArray(res?.items) ? res.items
          : []
        const total = res?.total ?? list.length
        const rows = list.map(r => ({
          id: r.id,
          title: r.title || r.object_text?.slice(0, 60) || `Licitação #${r.id}`,
          organ: r.organ_name || r.company_name || '—',
          state: r.state || '—',
          status: r.status || 'open',
          value: r.estimated_value || 0,
          deadline: r.deadline_date,
        }))
        return { items: rows, total }
      }}
      searchPlaceholder="Buscar licitação..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{r.id}</td>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.organ}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.state}</td>
          <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status} colorMap={BID_STATUS} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: 'var(--nexus-green)' }}>
            {r.value ? `R$ ${Number(r.value).toLocaleString('pt-BR')}` : '—'}
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.deadline ? new Date(r.deadline).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
