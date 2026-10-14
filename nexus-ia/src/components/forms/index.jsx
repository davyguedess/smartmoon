/**
 * Form components — inputs, selects, fields reutilizáveis
 * 
 * Exports:
 *   - FormField   — campo com label + erro
 *   - TextInput   — input de texto estilizado
 *   - SelectInput — select estilizado
 *   - FormRow     — linha de campos lado a lado
 */

/**
 * FormField — Wrapper de campo com label e mensagem de erro
 */
export function FormField({ label, error, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700,
          color: error ? 'var(--nexus-red)' : 'var(--text-secondary)',
          marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {label}
          {required && <span style={{ color: 'var(--nexus-red)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--nexus-red)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  )
}

/**
 * TextInput — Input de texto estilizado no padrão NEXUS
 */
export function TextInput({ value, onChange, placeholder, type = 'text', disabled, error, ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${error ? 'var(--nexus-red)' : 'var(--border-default)'}`,
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)', fontSize: 13,
        outline: 'none', boxSizing: 'border-box',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => !error && (e.target.style.borderColor = 'var(--nexus-violet)')}
      onBlur={e => !error && (e.target.style.borderColor = 'var(--border-default)')}
      {...props}
    />
  )
}

/**
 * TextareaInput — Textarea estilizado
 */
export function TextareaInput({ value, onChange, placeholder, disabled, rows = 4, error }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${error ? 'var(--nexus-red)' : 'var(--border-default)'}`,
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)', fontSize: 13,
        outline: 'none', boxSizing: 'border-box', resize: 'vertical',
        opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => !error && (e.target.style.borderColor = 'var(--nexus-violet)')}
      onBlur={e => !error && (e.target.style.borderColor = 'var(--border-default)')}
    />
  )
}

/**
 * SelectInput — Select estilizado
 */
export function SelectInput({ value, onChange, options = [], disabled, error }) {
  return (
    <select
      value={value}
      onChange={e => onChange?.(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${error ? 'var(--nexus-red)' : 'var(--border-default)'}`,
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)', fontSize: 13,
        outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

/**
 * FormRow — Linha com múltiplos campos lado a lado
 */
export function FormRow({ children, cols = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 16,
    }}>
      {children}
    </div>
  )
}

/**
 * SubmitButton — Botão de submit com estado de loading
 */
export function SubmitButton({ loading, children, disabled, variant = 'primary' }) {
  const styles = {
    primary: { bg: 'var(--nexus-violet)', color: '#fff' },
    danger:  { bg: '#ef4444', color: '#fff' },
    ghost:   { bg: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  }
  const s = styles[variant]
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      style={{
        padding: '10px 20px', borderRadius: 10, border: s.border || 'none',
        background: loading || disabled ? 'var(--bg-elevated)' : s.bg,
        color: loading || disabled ? 'var(--text-muted)' : s.color,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700,
        transition: 'all 0.15s',
      }}
    >
      {loading ? 'Salvando...' : children}
    </button>
  )
}
