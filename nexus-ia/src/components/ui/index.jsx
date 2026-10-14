/**
 * Smart Moon — Premium UI Components (Sprint B1.2)
 * Button, Card, Badge, Stat, PageHeader
 */
import React from 'react'

/* ─── Button ──────────────────────────────────────────────────────────────── */
export function Button({
  children,
  variant = 'primary',    // primary | secondary | ghost | danger | gradient | outline
  size    = 'md',         // sm | md | lg
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  onClick,
  type = 'button',
  disabled,
  className = '',
  style = {},
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    transition: 'all var(--dur-base) var(--ease-out)',
    letterSpacing: '0.01em',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
    ...{
      sm: { padding: '6px 14px', fontSize: 12 },
      md: { padding: '9px 18px', fontSize: 13 },
      lg: { padding: '12px 24px', fontSize: 14 },
    }[size],
    ...{
      primary: {
        background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-purple))',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
      },
      gradient: {
        background: 'var(--gradient-brand)',
        color: '#fff',
        boxShadow: 'var(--glow-brand)',
      },
      secondary: {
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-default)',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
      },
      outline: {
        background: 'transparent',
        color: 'var(--nexus-cyan)',
        border: '1px solid rgba(0,212,255,0.4)',
      },
      danger: {
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(220,38,38,0.35)',
      },
    }[variant],
    ...style,
  }

  return (
    <button
      type={type}
      style={base}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      onMouseEnter={e => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.filter = 'brightness(1.1)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.filter = 'none'
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}

/* ─── Card ────────────────────────────────────────────────────────────────── */
export function Card({
  children,
  variant   = 'default',   // default | glass | gradient | bordered | glow
  padding   = '20px',
  radius    = 'var(--radius-lg)',
  hover     = false,
  onClick,
  style     = {},
  className = '',
}) {
  const variants = {
    default: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
    },
    glass: {
      background: 'rgba(16,24,40,0.7)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    },
    gradient: {
      background: 'linear-gradient(145deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.05) 100%)',
      border: '1px solid rgba(139,92,246,0.2)',
    },
    bordered: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
    },
    glow: {
      background: 'var(--bg-card)',
      border: '1px solid rgba(139,92,246,0.4)',
      boxShadow: 'var(--glow-purple)',
    },
  }

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        borderRadius: radius,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--dur-base) var(--ease-out)',
        ...variants[variant],
        ...style,
      }}
      onMouseEnter={hover ? e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      } : undefined}
      onMouseLeave={hover ? e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = variants[variant].boxShadow || 'none'
      } : undefined}
    >
      {children}
    </div>
  )
}

/* ─── Badge ───────────────────────────────────────────────────────────────── */
export function Badge({
  children,
  color   = 'purple',  // purple | cyan | green | amber | red | gray
  size    = 'sm',
  dot     = false,
  pulse   = false,
}) {
  const colorMap = {
    purple: { bg: 'rgba(139,92,246,0.15)', text: '#c084fc', border: 'rgba(139,92,246,0.3)' },
    cyan:   { bg: 'rgba(0,212,255,0.1)',   text: '#00d4ff', border: 'rgba(0,212,255,0.25)' },
    green:  { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
    amber:  { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    red:    { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)'  },
    gray:   { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  }
  const c = colorMap[color] || colorMap.purple
  const sizes = { sm: { fontSize: 11, padding: '2px 8px' }, md: { fontSize: 12, padding: '4px 10px' } }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 'var(--radius-full)',
      border: `1px solid ${c.border}`,
      background: c.bg, color: c.text,
      fontWeight: 700, letterSpacing: '0.03em',
      flexShrink: 0,
      ...sizes[size],
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: c.text, flexShrink: 0,
          animation: pulse ? 'pulse-dot 2s infinite' : undefined,
        }} />
      )}
      {children}
    </span>
  )
}

/* ─── Stat ────────────────────────────────────────────────────────────────── */
export function Stat({ label, value, sub, icon, color = 'var(--nexus-purple)', trend, trendUp, small = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: small ? '14px' : '18px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow accent top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.7,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: small ? 22 : 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {(sub || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          {trend && (
            <span style={{ color: trendUp ? 'var(--nexus-green)' : 'var(--nexus-red)', fontWeight: 700 }}>
              {trendUp ? '↑' : '↓'} {trend}
            </span>
          )}
          {sub && <span style={{ color: 'var(--text-muted)' }}>{sub}</span>}
        </div>
      )}
    </div>
  )
}

/* ─── PageHeader ──────────────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, icon, actions, breadcrumb }) {
  return (
    <div style={{
      padding: '20px 24px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexShrink: 0,
      background: 'linear-gradient(180deg, rgba(16,24,40,0.8) 0%, transparent 100%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {icon && (
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-purple)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--glow-purple)', flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div>
          {breadcrumb && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600 }}>
              {breadcrumb}
            </div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}

/* ─── Divider ─────────────────────────────────────────────────────────────── */
export function Divider({ label, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', ...style }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      {label && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

/* ─── EmptyState ──────────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, opacity: 0.6 }}>{icon || '🔍'}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300 }}>{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 20, color = 'var(--nexus-purple)' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}30`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}
