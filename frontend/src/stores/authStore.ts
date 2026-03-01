import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
    user: Profile | null
    loading: boolean
    initialized: boolean
    setUser: (user: Profile | null) => void
    initialize: () => Promise<void>
    signOut: () => Promise<void>
}

async function fetchProfile(userId: string): Promise<Profile | null> {
    // Try backend first (auto-creates profile if trigger missed)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    try {
        const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (res.ok) {
            const json = await res.json() as { data: { profile: Profile } }
            return json.data.profile
        }
    } catch { /* fallthrough */ }

    // Fallback: direct Supabase query
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    return data ?? null
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    initialized: false,

    setUser: (user) => set({ user }),

    initialize: async () => {
        set({ loading: true })

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            const profile = await fetchProfile(session.user.id)
            set({ user: profile })
        }

        // Listen for login/logout
        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const profile = await fetchProfile(session.user.id)
                set({ user: profile, loading: false })
            } else {
                set({ user: null, loading: false })
            }
        })

        set({ loading: false, initialized: true })
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null })
    },
}))
