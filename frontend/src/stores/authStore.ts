import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { clearPolicyApiTokenCache } from '@/lib/policyApi'
import { clearApiTokenCache } from '@/lib/api'
import type { Profile } from '@/types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001'

interface AuthState {
  user: Profile | null
  loading: boolean
  initialized: boolean
  setUser: (user: Profile | null) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (res.ok) {
      const json = (await res.json()) as { data: { profile: Profile } }
      return json.data.profile
    }
  } catch {
    // fall through to direct profile lookup
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return data ?? null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  initialize: async () => {
    set({ loading: true })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      set({
        user: profile,
        loading: false,
        initialized: true,
      })
    } else {
      clearPolicyApiTokenCache()
      clearApiTokenCache()
      set({
        user: null,
        loading: false,
        initialized: true,
      })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        set({
          user: profile,
          loading: false,
          initialized: true,
        })
      } else {
        clearPolicyApiTokenCache()
        clearApiTokenCache()
        set({
          user: null,
          loading: false,
          initialized: true,
        })
      }
    })
  },

  signOut: async () => {
    clearPolicyApiTokenCache()
    clearApiTokenCache()

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      set({
        user: null,
        loading: false,
        initialized: true,
      })
    }
  },
}))