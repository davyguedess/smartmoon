/**
 * ErrorBoundary — Previne tela preta quando componentes React crasham.
 * Captura erros JavaScript no render tree e exibe UI de recuperação.
 */
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Crash capturado:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error } = this.state
    const msg = error?.message || String(error)

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', padding: 40,
        background: 'var(--bg-surface, #0f172a)', color: 'var(--text-primary, #e2e8f0)',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 16, marginBottom: 24,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>⚠️</div>

        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#f87171' }}>
          Ops! Algo deu errado
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', margin: '0 0 24px', textAlign: 'center', maxWidth: 420 }}>
          Esta página encontrou um erro e não pôde ser exibida.<br/>
          Clique em "Tentar Novamente" ou volte para o painel.
        </p>

        {/* Error details */}
        {msg && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 24,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            fontFamily: 'monospace', fontSize: 11, color: '#fca5a5',
            maxWidth: 520, wordBreak: 'break-word', textAlign: 'left',
          }}>
            {msg.length > 200 ? msg.slice(0, 200) + '…' : msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{
              padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: 'var(--nexus-violet, #7c3aed)', color: '#fff',
              border: 'none', cursor: 'pointer',
            }}
          >
            🔄 Tentar Novamente
          </button>
          <button
            onClick={() => { window.location.href = '/admin/overview' }}
            style={{
              padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: 'var(--bg-card, #1e293b)', color: 'var(--text-secondary, #cbd5e1)',
              border: '1px solid var(--border-subtle, #334155)', cursor: 'pointer',
            }}
          >
            🏠 Ir ao Painel
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: 'var(--bg-card, #1e293b)', color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border-subtle, #334155)', cursor: 'pointer',
            }}
          >
            ↺ Recarregar
          </button>
        </div>
      </div>
    )
  }
}

/**
 * HOC conveniente: envolve qualquer componente com ErrorBoundary
 * Usage: const SafeComponent = withErrorBoundary(MyComponent)
 */
export function withErrorBoundary(Component, fallbackProps = {}) {
  return function SafeWrapped(props) {
    return (
      <ErrorBoundary {...fallbackProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
