import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!

  let { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    res.status(500).json({ error: profileError.message })
    return
  }

  if (!profile) {
    const {
      data: { user: authUser },
      error: authUserError,
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (authUserError) {
      res.status(500).json({ error: authUserError.message })
      return
    }

    const fullName =
      authUser?.user_metadata?.full_name ?? authUser?.email?.split('@')[0] ?? 'User'

    const { data: created, error: createError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: fullName })
      .select('*')
      .single()

    if (createError) {
      res.status(500).json({ error: createError.message })
      return
    }
    profile = created
  }

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from('team_members')
    .select('role, joined_at, teams(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })

  if (membershipsError) {
    res.status(500).json({ error: membershipsError.message })
    return
  }

  const teams = (memberships ?? [])
    .filter((membership: any) => membership.teams)
    .map((membership: any) => ({
      ...membership.teams,
      myRole: membership.role,
      joined_at: membership.joined_at,
    }))

  res.json({
    data: {
      profile,
      teams,
    },
  })
})

router.post('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : ''
  if (!fullName) {
    res.status(400).json({ error: 'full_name is required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: req.userId!, full_name: fullName })
    .select('*')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data })
})

export default router
