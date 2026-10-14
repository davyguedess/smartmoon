/**
 * useAsync — Hook para gerenciar chamadas assíncronas com loading/error state
 * 
 * Uso:
 *   const { data, loading, error, execute } = useAsync(api.adminDashboard)
 */
import { useState, useCallback } from 'react'

export function useAsync(asyncFn, { immediate = false, initialData = null } = {}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn(...args)
      setData(result)
      return result
    } catch (err) {
      setError(err?.message || 'Erro desconhecido')
      throw err
    } finally {
      setLoading(false)
    }
  }, [asyncFn])

  return { data, loading, error, execute, setData }
}

/**
 * usePagination — Hook para controle de paginação
 * 
 * Uso:
 *   const { offset, limit, onPageChange, resetPage } = usePagination()
 */
export function usePagination(defaultLimit = 50) {
  const [offset, setOffset] = useState(0)
  const limit = defaultLimit

  const onPageChange = useCallback((newOffset) => {
    setOffset(Math.max(0, newOffset))
  }, [])

  const resetPage = useCallback(() => setOffset(0), [])

  return { offset, limit, onPageChange, resetPage }
}

/**
 * useDebounce — Hook para debounce de valores (ex: busca em tempo real)
 */
import { useEffect } from 'react'

export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}

/**
 * useLocalStorage — Hook para persistência em localStorage
 */
export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const v = typeof value === 'function' ? value(stored) : value
      setStored(v)
      localStorage.setItem(key, JSON.stringify(v))
    } catch (err) {
      console.warn(`useLocalStorage: failed to set key "${key}"`, err)
    }
  }, [key, stored])

  return [stored, setValue]
}
