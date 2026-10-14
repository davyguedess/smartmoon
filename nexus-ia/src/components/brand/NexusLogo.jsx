/**
 * NexusLogo — Componente centralizado de marca
 *
 * USA AS IMAGENS REAIS de /public/brand/ (sincronizadas de falcon/logo/).
 * Para trocar o logo: substitua os arquivos em falcon/logo/ e rode o sync.
 *
 * Uso:
 *   <NexusLogo />                    → horizontal (padrão)
 *   <NexusLogo variant="icon" />     → só o ícone
 *   <NexusLogo variant="inline" />   → ícone + logo horizontal lado a lado
 *   <NexusLogo size={40} />          → controla a altura do ícone
 */

// Caminhos servidos pela pasta /public/brand/ (Vite passa para /dist/ sem transformação)
const LOGO_HORIZONTAL = '/brand/logo-horizontal.png'
const LOGO_ICON       = '/brand/logo-icon.png'

// ── Fallback SVG — exibido enquanto imagem carrega ou se não existir ───────────
function FallbackIcon({ size = 36 }) {
  const s = size
  const cx = s / 2, cy = s / 2, r = s * 0.42
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90)
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
  const hex = pts.map(p => `${p.x},${p.y}`).join(' ')
  const left = s * 0.3, right = s * 0.7, top = s * 0.26, bot = s * 0.74
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
      <defs>
        <linearGradient id={`ng-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <polygon points={hex} fill="none" stroke={`url(#ng-${s})`} strokeWidth={s * 0.035} opacity="0.7" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={s * 0.04} fill={i % 2 === 0 ? '#38bdf8' : '#8b5cf6'} />)}
      <circle cx={cx} cy={cy} r={s * 0.06} fill={`url(#ng-${s})`} />
      <line x1={left} y1={bot} x2={left} y2={top} stroke={`url(#ng-${s})`} strokeWidth={s * 0.05} strokeLinecap="round" />
      <line x1={left} y1={top} x2={right} y2={bot} stroke={`url(#ng-${s})`} strokeWidth={s * 0.05} strokeLinecap="round" />
      <line x1={right} y1={top} x2={right} y2={bot} stroke={`url(#ng-${s})`} strokeWidth={s * 0.05} strokeLinecap="round" />
    </svg>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export function NexusLogo({
  variant    = 'horizontal', // 'icon' | 'horizontal' | 'inline'
  size       = 36,
  showTagline = false,
  className  = '',
  style      = {},
}) {
  // --- Só ícone ---
  if (variant === 'icon') {
    return (
      <div
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', userSelect: 'none', ...style }}
      >
        <img
          src={LOGO_ICON}
          alt="Logo"
          height={size}
          width={size}
          style={{ objectFit: 'contain', display: 'block' }}
          onError={e => {
            // fallback: esconde img e mostra SVG irmão
            e.currentTarget.style.display = 'none'
            const fb = e.currentTarget.nextSibling
            if (fb) fb.style.display = 'block'
          }}
        />
        {/* fallback oculto — aparece se a imagem falhar */}
        <span style={{ display: 'none' }}><FallbackIcon size={size} /></span>
      </div>
    )
  }

  // --- Horizontal (padrão) ou inline — usa logo-horizontal ---
  const imgHeight = variant === 'inline' ? size * 0.85 : size * 1.1

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        userSelect: 'none',
        ...style,
      }}
    >
      <img
        src={LOGO_HORIZONTAL}
        alt="Logo"
        height={Math.round(imgHeight)}
        style={{ objectFit: 'contain', display: 'block', maxWidth: '100%' }}
        onError={e => {
          e.currentTarget.style.display = 'none'
          const fb = e.currentTarget.nextSibling
          if (fb) fb.style.display = 'flex'
        }}
      />
      {/* fallback: ícone + texto caso horizontal não carregue */}
      <span style={{ display: 'none', alignItems: 'center', gap: 8 }}>
        <FallbackIcon size={size} />
        <span style={{
          background: 'linear-gradient(135deg, #e2e8f0 30%, #a78bfa 70%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontWeight: 800, fontSize: size * 0.6, letterSpacing: '-0.5px',
        }}>
          Smart Moon
        </span>
      </span>
      {showTagline && (
        <span style={{
          fontSize: size * 0.25, color: '#475569', fontWeight: 500,
          letterSpacing: '0.05em', marginTop: 2,
        }}>
          Plataforma de IA Empresarial
        </span>
      )}
    </div>
  )
}

// ── Favicon SVG (usado no index.html como data URI) ────────────────────────────
export function getFaviconDataUri() {
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="#060412"/>
    <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="url(#g)" stroke-width="1.5" opacity="0.8"/>
    <line x1="10" y1="22" x2="10" y2="11" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="11" x2="22" y2="22" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/>
    <line x1="22" y1="11" x2="22" y2="22" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="2" fill="url(#g)"/>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export default NexusLogo
