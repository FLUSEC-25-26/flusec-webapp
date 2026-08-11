import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/api'
import type { AuthMeResponse, Profile, TeamWithRole } from '@/types'

interface AuthState {
  user: Profile | null
  teams: TeamWithRole[]
  loading: boolean
  initialized: boolean
  setUser: (user: Profile | null) => void
  refreshMe: () => Promise<void>
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

async function fetchMe(): Promise<AuthMeResponse | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const response = await apiRequest<{ data: AuthMeResponse }>('/api/v1/auth/me')
  return response.data
}

let authListenerRegistered = false

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  teams: [],
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  refreshMe: async () => {
    const me = await fetchMe()
    set({ user: me?.profile ?? null, teams: me?.teams ?? [] })
  },

  initialize: async () => {
    set({ loading: true })
    try {
      const me = await fetchMe()
      set({
        user: me?.profile ?? null,
        teams: me?.teams ?? [],
        loading: false,
        initialized: true,
      })
    } catch (error) {
      console.error('[FLUSEC] Failed to initialize account:', error)
      set({ user: null, teams: [], loading: false, initialized: true })
    }

    if (!authListenerRegistered) {
      authListenerRegistered = true
      supabase.auth.onAuthStateChange((_event, session) => {
        // Avoid doing async Supabase work inside the auth callback itself.
        window.setTimeout(async () => {
          if (!session?.user) {
            set({ user: null, teams: [], loading: false, initialized: true })
            return
          }
          try {
            const me = await fetchMe()
            set({
              user: me?.profile ?? null,
              teams: me?.teams ?? [],
              loading: false,
              initialized: true,
            })
          } catch (error) {
            console.error('[FLUSEC] Failed to refresh account:', error)
          }
        }, 0)
      })
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      set({ user: null, teams: [], loading: false, initialized: true })
    }
  },
}))
