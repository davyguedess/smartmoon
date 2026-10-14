/**
 * AdminUserDetailPage — Complete user profile for admins
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Building2, CreditCard, Activity, Settings,
  Shield, GitBranch, Cpu, Plug2, Volume2, Target, Clock,
  ChevronDown, CheckCircle, XCircle, Edit3, Save, X
} from 'lucide-react'
import { api } from '../../api'

function Block({ title, icon: Icon, color = '--nexus-violet', children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{
        padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-elevated)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `rgba(99,102,241,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={`var(${color})`} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--nexus-cyan)' : 'var(--text-primary)' }}>{value ?? '—'}</span>
    </div>
  )
}

function StatCard({ label, value, color = '--nexus-cyan' }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: `var(${color})` }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

const PLANS = ['free', 'starter', 'pro', 'business', 'enterprise']

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(false)
  const [newPlan, setNewPlan] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get(`/admin/users/${id}`)
      .then(res => { setData(res); setNewPlan(res.company?.plan || 'free') })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleSavePlan = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/users/${id}/plan`, { plan: newPlan })
      setMsg('Plano atualizado com sucesso!')
      setEditPlan(false)
      const res = await api.get(`/admin/users/${id}`)
      setData(res)
    } catch (e) {
      setMsg(`Erro: ${e.message}`)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
  if (!data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Erro ao carregar dados do usuário</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Verifique permissão superadmin e ID do usuário ({id})</div>
      <button onClick={() => navigate('/admin/users')} style={{ padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
        <ArrowLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Voltar
      </button>
    </div>
  )

  const u = data.user || {}
  const company = data.company || {}
  const usage = data.usage || {}
  const flows = data.flows || { total: 0, active: 0 }
  const agents = data.agents || { total: 0, active: 0 }
  const integrations = data.integrations || []
  const recentExecutions = data.recent_executions || []
  const auditLog = data.audit_log || []

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={() => navigate('/admin/users')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{u.name}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{u.email} · {company.name}</p>
        </div>
        {msg && <div style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid var(--nexus-green)', borderRadius: 8, fontSize: 12, color: 'var(--nexus-green)' }}>{msg}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Left column */}
        <div>
          {/* Identity */}
          <Block title="Identidade" icon={User} color="--nexus-blue">
            <InfoRow label="Nome" value={u.name} />
            <InfoRow label="Email" value={u.email} />
            <InfoRow label="Role" value={u.role} />
            <InfoRow label="Empresa" value={company.name} />
            <InfoRow label="Tenant ID" value={company.id} highlight />
            <InfoRow label="Cadastro" value={u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'} />
            <InfoRow label="Status" value={u.is_active ? 'Ativo' : 'Inativo'} highlight={u.is_active} />
          </Block>

          {/* Commercial */}
          <Block title="Comercial" icon={CreditCard} color="--nexus-green">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plano Atual</div>
                <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'capitalize', color: 'var(--nexus-cyan)' }}>{company.plan || 'free'}</div>
              </div>
              <button onClick={() => setEditPlan(!editPlan)} style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, cursor: 'pointer', color: 'var(--nexus-violet)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Edit3 size={11} /> Alterar Plano
              </button>
            </div>
            {editPlan && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Selecionar novo plano:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PLANS.map(p => (
                    <button key={p} onClick={() => setNewPlan(p)} style={{
                      padding: '4px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: newPlan === p ? 'var(--nexus-violet)' : 'var(--bg-card)',
                      border: `1px solid ${newPlan === p ? 'var(--nexus-violet)' : 'var(--border-subtle)'}`,
                      color: newPlan === p ? 'white' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}>{p}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={handleSavePlan} disabled={saving} style={{ padding: '6px 14px', background: 'var(--nexus-green)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Save size={11} /> {saving ? 'Salvando...' : 'Confirmar'}
                  </button>
                  <button onClick={() => setEditPlan(false)} style={{ padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <InfoRow label="Status da empresa" value={company.is_active ? 'Ativa' : 'Inativa'} />
          </Block>

          {/* Usage */}
          <Block title="Uso da Plataforma" icon={Activity} color="--nexus-amber">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <StatCard label="Execuções/Mês" value={(usage.executions || 0).toLocaleString()} color="--nexus-cyan" />
              <StatCard label="Tokens Usados" value={`${((usage.tokens || 0) / 1000).toFixed(0)}k`} color="--nexus-purple" />
              <StatCard label="Custo IA" value={`$${(usage.cost_usd || 0).toFixed(2)}`} color="--nexus-red" />
              <StatCard label="Fluxos Criados" value={usage.flows_created || 0} color="--nexus-green" />
            </div>
            <InfoRow label="Fluxos Ativos" value={`${flows.active} / ${flows.total}`} highlight />
            <InfoRow label="Agentes Ativos" value={`${agents.active} / ${agents.total}`} highlight />
            <InfoRow label="Voice Profiles" value={data?.voice_profiles ?? 0} />
            <InfoRow label="Campanhas Ativas" value={data?.campaigns?.active ?? 0} />
          </Block>
        </div>

        {/* Right column */}
        <div>
          {/* Integrations */}
          <Block title="Integrações" icon={Plug2} color="--nexus-cyan">
            {integrations.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhuma integração configurada</p>
            ) : integrations.slice(0, 8).map((integ, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{integ.provider}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: integ.status === 'connected' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: integ.status === 'connected' ? 'var(--nexus-green)' : 'var(--nexus-red)',
                }}>{integ.status}</span>
              </div>
            ))}
          </Block>

          {/* Recent Executions */}
          <Block title="Execuções Recentes" icon={GitBranch} color="--nexus-blue">
            {recentExecutions.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Nenhuma execução recente</p>
            ) : recentExecutions.slice(0, 6).map((exec, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>#{exec.id}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{exec.trigger || 'manual'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: exec.status === 'success' ? 'rgba(16,185,129,0.12)' : exec.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                    color: exec.status === 'success' ? 'var(--nexus-green)' : exec.status === 'failed' ? 'var(--nexus-red)' : 'var(--nexus-amber)',
                  }}>{exec.status}</span>
                </div>
              </div>
            ))}
          </Block>

          {/* Audit */}
          <Block title="Auditoria & Segurança" icon={Shield} color="--nexus-red">
            {auditLog.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Sem eventos de auditoria</p>
            ) : auditLog.slice(0, 8).map((ev, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.action}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ev.resource_type} · {ev.ip}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingLeft: 10 }}>
                  {ev.ts ? new Date(ev.ts).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
            ))}
          </Block>
        </div>
      </div>
    </div>
  )
}
