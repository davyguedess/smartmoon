/**
 * UpgradePrompt — Shown when a user tries to access a feature not in their plan.
 */
import { Lock, ArrowUpRight, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const FEATURE_LABELS = {
  tts: 'Voz / Text-to-Speech',
  voice_agents: 'Agentes de Voz',
  cloud_ai: 'IA Cloud (GPT-4, Gemini, Claude)',
  campaigns: 'Campanhas de Marketing',
  webhooks: 'Webhooks',
  analytics: 'Analytics Avançado',
  audit_log: 'Log de Auditoria',
  telegram: 'Telegram Bot',
  whatsapp: 'WhatsApp Business',
  google_workspace: 'Google Workspace',
  bids: 'Licitações',
  memory_summary: 'Memória de IA (Sumarização)',
  sso: 'SSO / Login Empresarial',
  custom_models: 'Modelos Personalizados',
}

export default function UpgradePrompt({ feature, fullPage = false }) {
  const navigate = useNavigate()
  const label = FEATURE_LABELS[feature] || feature

  const inner = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 20, padding: 40, textAlign: 'center',
    }}>
      {/* Lock icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed20, #6366f120)',
        border: '2px solid #7c3aed40',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Lock size={28} color="#7c3aed" />
      </div>

      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Funcionalidade Premium
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--nexus-violet)' }}>{label}</strong> não está disponível no seu plano atual.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Faça upgrade para desbloquear esta e outras funcionalidades.
        </p>
      </div>

      <button
        onClick={() => navigate('/billing')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
          border: 'none', borderRadius: 10, cursor: 'pointer',
          color: '#fff', fontWeight: 700, fontSize: 14,
          boxShadow: '0 4px 15px #7c3aed40',
          transition: 'opacity 0.2s',
        }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        <Zap size={15} />
        Ver Planos e Fazer Upgrade
        <ArrowUpRight size={15} />
      </button>
    </div>
  )

  if (fullPage) {
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {inner}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      margin: '24px auto',
      maxWidth: 480,
    }}>
      {inner}
    </div>
  )
}
