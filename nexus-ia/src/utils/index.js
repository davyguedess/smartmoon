/**
 * Frontend Utilities — Smart Moon
 * 
 * Funções utilitárias compartilhadas entre componentes e páginas.
 */

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Formata bytes em formato legível: 1024 → "1.0 KB"
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Formata data ISO em formato legível com locale pt-BR
 */
export function formatDate(dateStr, { dateStyle = 'short', timeStyle } = {}) {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle, timeStyle }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

/**
 * Formata número com separadores de milhar
 */
export function formatNumber(n, options = {}) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', options).format(n)
}

/**
 * Formata valor em USD
 */
export function formatUSD(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Formata duração em segundos para "Xh Ym Zs"
 */
export function formatUptime(seconds) {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Formata tempo relativo: "2 minutos atrás", "há 3 dias"
 */
export function formatRelative(dateStr) {
  if (!dateStr) return '—'
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return rtf.format(-seconds, 'second')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    return rtf.format(-Math.floor(hours / 24), 'day')
  } catch {
    return dateStr
  }
}

// ── String Helpers ────────────────────────────────────────────────────────────

/**
 * Trunca string com ellipsis
 */
export function truncate(str, max = 50) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

/**
 * Converte string para slug: "Meu Agente" → "meu-agente"
 */
export function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ── Object Helpers ────────────────────────────────────────────────────────────

/**
 * Remove chaves undefined/null de um objeto
 */
export function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}

// ── Color Helpers ─────────────────────────────────────────────────────────────

/**
 * Retorna cor CSS de acordo com percentual (verde → amarelo → vermelho)
 */
export function percentColor(value) {
  if (value > 85) return 'var(--nexus-red)'
  if (value > 60) return 'var(--nexus-amber)'
  return 'var(--nexus-green)'
}
