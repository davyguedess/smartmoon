/**
 * ConfirmModal — Modal de confirmação reutilizável
 * 
 * Props:
 *   open: boolean
 *   title: string
 *   message: string | ReactNode
 *   confirmLabel: string (default "Confirmar")
 *   cancelLabel: string (default "Cancelar")
 *   variant: "danger" | "warning" | "default"
 *   onConfirm: () => void
 *   onCancel: () => void
 *   loading: boolean
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null

  const variantColors = {
    danger:  { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', btnBg: '#ef4444', btnColor: '#fff' },
    warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', btnBg: '#f59e0b', btnColor: '#fff' },
    default: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', btnBg: 'var(--nexus-violet)', btnColor: '#fff' },
  }
  const vc = variantColors[variant]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={e => e.target === e.currentTarget && onCancel?.()}>
      <div style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${vc.border}`,
        borderRadius: 16, padding: 28,
        maxWidth: 440, width: '100%',
        boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${vc.border}`,
        background: `linear-gradient(135deg, var(--bg-surface) 0%, ${vc.bg} 100%)`,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 10px', color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '9px 18px', borderRadius: 10,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '9px 18px', borderRadius: 10,
              border: 'none',
              background: vc.btnBg, color: vc.btnColor,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * BaseModal — Modal genérico com header, corpo e footer
 */
export function BaseModal({ open, title, onClose, children, footer, width = 520 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, width: '100%', maxWidth: width,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
