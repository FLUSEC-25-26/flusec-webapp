import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

// GET /api/auth/me — returns profile + team membership
// Auto-creates profile if the Supabase trigger missed it
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.userId!

    // Fetch profile — auto-create if trigger didn't fire
    let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

    if (!profile) {
        // Profile missing — get user metadata from auth and create it
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
        const fullName = authUser?.user_metadata?.full_name
            ?? authUser?.email?.split('@')[0]
            ?? 'User'

        const { data: newProfile } = await supabaseAdmin
            .from('profiles')
            .upsert({ id: userId, full_name: fullName })
            .select()
            .single()

        profile = newProfile
    }

    if (!profile) {
        res.status(500).json({ error: 'Could not create or find profile' }); return
    }

    // Fetch team membership (service role bypasses RLS)
    const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', userId)
        .maybeSingle()

    let team = null
    if (membership?.team_id) {
        const { data: teamData } = await supabaseAdmin
            .from('teams')
            .select('*')
            .eq('id', membership.team_id)
            .maybeSingle()
        team = teamData ?? null
    }

    res.json({
        data: {
            profile,
            team,
            role: membership?.role ?? null,
        }
    })
})

// POST /api/auth/profile — upsert profile info
router.post('/profile', authMiddleware, async (req: AuthRequest, res) => {
    const { full_name } = req.body as { full_name: string }
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: req.userId!, full_name })
        .select()
        .single()
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(201).json({ data })
})

export default router
