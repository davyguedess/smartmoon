/**
 * NEXUS.IA — Global Toast Notification System
 * Usage: import { useToast } from './Toast'
 *        const toast = useToast()
 *        toast.success('Salvo!') | toast.error('Falhou!') | toast.info('...')
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

// ── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(null)

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const add = useCallback((type, message, duration) => {
    const id = ++counter.current
    const ms = duration ?? (type === 'error' ? 5000 : type === 'warning' ? 4000 : 2500)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => remove(id), ms)
    return id
  }, [])

  function remove(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const toast = {
    success: (msg, ms) => add('success', msg, ms),
    error:   (msg, ms) => add('error',   msg, ms),
    info:    (msg, ms) => add('info',    msg, ms),
    warning: (msg, ms) => add('warning', msg, ms),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = {
  success: {
    border:  'rgba(16,185,129,0.35)',
    bg:      'rgba(16,185,129,0.12)',
    icon:    '#10b981',
    bar:     '#10b981',
    Icon:    CheckCircle,
  },
  error: {
    border:  'rgba(239,68,68,0.35)',
    bg:      'rgba(239,68,68,0.12)',
    icon:    '#ef4444',
    bar:     '#ef4444',
    Icon:    XCircle,
  },
  warning: {
    border:  'rgba(245,158,11,0.35)',
    bg:      'rgba(245,158,11,0.12)',
    icon:    '#f59e0b',
    bar:     '#f59e0b',
    Icon:    AlertTriangle,
  },
  info: {
    border:  'rgba(99,102,241,0.35)',
    bg:      'rgba(99,102,241,0.12)',
    icon:    '#6366f1',
    bar:     '#6366f1',
    Icon:    Info,
  },
}

// ── Container ─────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 24,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ── Individual Toast ──────────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const s = STYLES[toast.type] || STYLES.info
  const { Icon } = s

  return (
    <div
      style={{
        pointerEvents: 'all',
        minWidth: 280,
        maxWidth: 400,
        background: 'rgba(15,23,42,0.95)',
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${s.border}`,
        backdropFilter: 'blur(16px)',
        animation: 'toastSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Colored left bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: s.bar, borderRadius: '12px 0 0 12px',
      }} />

      {/* Icon */}
      <div style={{ marginLeft: 4, paddingTop: 1, flexShrink: 0 }}>
        <Icon size={16} color={s.icon} />
      </div>

      {/* Message */}
      <p style={{
        margin: 0, flex: 1,
        fontSize: 13, fontWeight: 500,
        color: '#e2e8f0', lineHeight: 1.5,
        fontFamily: "'Inter', sans-serif",
      }}>
        {toast.message}
      </p>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#475569', padding: '1px 2px', borderRadius: 4,
          display: 'flex', alignItems: 'center', flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
        onMouseLeave={e => e.currentTarget.style.color = '#475569'}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Global CSS animation ──────────────────────────────────────────────────────
const style = document.createElement('style')
style.textContent = `
  @keyframes toastSlideIn {
    from { transform: translateX(120%) scale(0.85); opacity: 0; }
    to   { transform: translateX(0)    scale(1);    opacity: 1; }
  }
`
document.head.appendChild(style)
