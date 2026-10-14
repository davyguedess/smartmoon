/**
 * usePlan — Hook global para dados do plano do usuário logado.
 *
 * Uso:
 *   const { plan, quota, hasFeature, canCreate, credits } = usePlan()
 *
 *   if (hasFeature('tts')) { ... }
 *   if (!canCreate('flows')) { return <UpgradePrompt /> }
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

// Cache singleton para evitar múltiplas chamadas simultâneas
let _planCache = null
let _cacheTs = 0
const CACHE_TTL = 60_000 // 60 segundos

export function usePlan() {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && _planCache && (now - _cacheTs) < CACHE_TTL) {
      setQuota(_planCache)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await api.billing.getQuota()
      _planCache = data
      _cacheTs = Date.now()
      setQuota(data)
    } catch (err) {
      setError(err.message)
      // fallback to empty state — never crash UI
      setQuota({
        plan: 'free',
        plan_label: 'Free',
        plan_color: '#6b7280',
        features: [],
        limits: {},
        usage: {},
        credits: { balance: 0, monthly_grant: 0 },
        over_quota: {},
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // BUG-12 FIX: escutar evento global emitido pelo Checkout pós-pagamento
  // para invalidar o cache singleton imediatamente (sem esperar os 60s do TTL)
  useEffect(() => {
    const handlePlanUpdated = () => {
      _planCache = null
      _cacheTs = 0
      load(true)
    }
    window.addEventListener('plan:updated', handlePlanUpdated)
    return () => window.removeEventListener('plan:updated', handlePlanUpdated)
  }, [load])

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Check if plan includes a feature slug.
   * Enterprise wildcard (*) grants all features.
   */
  const hasFeature = useCallback((feature) => {
    if (!quota) return false
    const features = quota.features || []
    return features.includes('*') || features.includes(feature)
  }, [quota])

  /**
   * Check if user can create more of `resourceType`.
   * resource: 'flows' | 'agents' | 'skills' | 'integrations' | 'campaigns'
   */
  const canCreate = useCallback((resource) => {
    if (!quota) return false
    const over = quota.over_quota || {}
    return !over[resource]
  }, [quota])

  /**
   * Returns current credit balance.
   */
  const credits = quota?.credits || { balance: 0, monthly_grant: 0 }

  /**
   * Force refresh plan data (call after install/uninstall).
   */
  const refresh = useCallback(() => {
    _planCache = null
    load(true)
  }, [load])

  return {
    quota,
    plan: quota?.plan || 'free',
    planLabel: quota?.plan_label || 'Free',
    planColor: quota?.plan_color || '#6b7280',
    features: quota?.features || [],
    limits: quota?.limits || {},
    usage: quota?.usage || {},
    credits,
    loading,
    error,
    hasFeature,
    canCreate,
    refresh,
    paymentPending: quota?.payment_pending || false,
  }
}
