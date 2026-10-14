/**
 * AdminFeatureOverridesPage — Shows feature overrides from DB
 * Uses admin database table endpoint for feature_overrides
 */
import React from 'react'
import { Sliders } from 'lucide-react'
import { AdminPageShell, ActiveDot, TrRow } from '../../components/admin/AdminPageShell'
import { api } from '../../api'

export default function AdminFeatureOverridesPage() {
  return (
    <AdminPageShell
      title="Feature Overrides"
      subtitle="Configurações de features por empresa/plano"
      icon={Sliders}
      iconColor="--nexus-violet"
      columns={['Feature', 'Empresa', 'Valor', 'Habilitado', 'Atualizado em']}
      fetchFn={async ({ page }) => {
        // Uses the generic admin database table endpoint
        const res = await api.get(`/admin/database/feature_overrides?limit=50&offset=${(page - 1) * 50}`)
        const rows = (res.rows || []).map(r => ({
          id: r.id,
          feature: r.feature_key || r.feature || `Feature #${r.id}`,
          company_name: r.company_name || `Empresa #${r.company_id || '—'}`,
          value: r.value || r.override_value || '—',
          enabled: r.is_enabled !== false,
          updated_at: r.updated_at,
        }))
        return { items: rows, total: res.total || rows.length }
      }}
      searchPlaceholder="Buscar feature..."
      renderRow={(r, i) => (
        <TrRow key={r.id || i}>
          <td style={{ padding: '11px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{r.feature}</div>
          </td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.company_name}</td>
          <td style={{ padding: '11px 14px' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: 'var(--nexus-violet)', fontFamily: 'monospace' }}>{String(r.value)}</span>
          </td>
          <td style={{ padding: '11px 14px' }}><ActiveDot active={r.enabled} /></td>
          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
        </TrRow>
      )}
    />
  )
}
