/**
 * StatCard — Card de métrica reutilizável
 * 
 * Props:
 *   icon: LucideIcon component
 *   label: string
 *   value: string | number
 *   sub: string (subtítulo opcional)
 *   color: string CSS color
 *   trend: { value: number, label: string } (opcional)
 */
export function StatCard({ icon: Icon, label, value, sub, color = 'var(--nexus-violet)', trend }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      padding: '16px 18px',
      flex: '1 1 180px',
      minWidth: 180,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}08`,
        transform: 'translate(20px, -20px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={color} />
        </div>
        <div>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
            letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
          }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value}
          </div>
        </div>
      </div>

      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      )}

      {trend && (
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600,
          color: trend.value >= 0 ? 'var(--nexus-green)' : 'var(--nexus-red)',
        }}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{trend.label}</span>
        </div>
      )}
    </div>
  )
}

/**
 * InfoCard — Card genérico com título, conteúdo e ações
 */
export function InfoCard({ title, children, action, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      overflow: 'hidden',
      ...style,
    }}>
      {(title || action) && (
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {title && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * ProgressBar — Barra de progresso com cores adaptativas
 */
export function ProgressBar({ value, color = 'var(--nexus-violet)', height = 6 }) {
  const autoColor = value > 85
    ? 'var(--nexus-red)'
    : value > 60
    ? 'var(--nexus-amber)'
    : color

  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: height, height, overflow: 'hidden'
    }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%',
        background: autoColor,
        borderRadius: height,
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

/**
 * BadgeStatus — Badge colorido de status
 */
export function BadgeStatus({ status }) {
  const map = {
    active:   { label: 'Ativo',      color: 'var(--nexus-green)' },
    inactive: { label: 'Inativo',    color: 'var(--nexus-red)' },
    pending:  { label: 'Pendente',   color: 'var(--nexus-amber)' },
    error:    { label: 'Erro',       color: 'var(--nexus-red)' },
    running:  { label: 'Rodando',    color: 'var(--nexus-cyan)' },
    free:     { label: 'Free',       color: 'var(--text-muted)' },
    pro:      { label: 'Pro',        color: 'var(--nexus-violet)' },
    enterprise: { label: 'Enterprise', color: 'var(--nexus-gold, #f59e0b)' },
  }
  const s = map[status] || { label: status, color: 'var(--text-muted)' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      background: `${s.color}18`, color: s.color,
      borderRadius: 20, display: 'inline-block',
    }}>
      {s.label}
    </span>
  )
}
