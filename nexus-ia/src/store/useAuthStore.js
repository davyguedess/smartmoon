/**
 * useAuthStore — Global auth state para Smart Moon
 *
 * Usa Zustand para estado global, com persist no localStorage.
 *
 * Uso:
 *   const { user, token, login, logout, isAdmin } = useAuthStore()
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      user: null,       // { id, name, email, role, company_id }
      token: null,      // JWT access token
      company: null,    // { id, name, plan }
      isLoading: false,
      error: null,

      // ── Selectors ─────────────────────────────────────────────────────────
      isAuthenticated: () => !!get().token,
      isAdmin: () => ['admin', 'owner'].includes(get().user?.role),
      isOwner: () => get().user?.role === 'owner',
      plan: () => get().company?.plan || 'free',

      // ── Actions ───────────────────────────────────────────────────────────
      login: (token, user, company = null) => set({
        token,
        user,
        company,
        error: null,
        isLoading: false,
      }),

      logout: () => set({
        token: null,
        user: null,
        company: null,
        error: null,
      }),

      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      updateUser: (partial) => set((state) => ({
        user: state.user ? { ...state.user, ...partial } : null,
      })),
    }),
    {
      name: 'nexus-auth',         // localStorage key
      partialize: (state) => ({   // apenas persiste token + user (não error/loading)
        token: state.token,
        user: state.user,
        company: state.company,
      }),
    }
  )
)

export default useAuthStore
