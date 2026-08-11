import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

type TeamRole = 'leader' | 'member' | 'viewer'

function generateInviteCode(): string {
  // The invite code is an authorization secret, not a display identifier.
  // Use cryptographically secure randomness rather than Math.random().
  return randomBytes(8).toString('hex').toUpperCase()
}

function normaliseTeamCode(raw: string): string {
  return raw.trim().toUpperCase()
}

async function getTeamById(teamId: string) {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function getTeamByCode(teamCode: string) {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .eq('team_code', normaliseTeamCode(teamCode))
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function getMembership(teamId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, role, joined_at')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function ensureTeamMember(teamId: string, userId: string) {
  const membership = await getMembership(teamId, userId)
  if (!membership) return null

  const team = await getTeamById(teamId)
  if (!team) return null

  return { membership, team }
}

async function ensureTeamLeader(teamId: string, userId: string) {
  const result = await ensureTeamMember(teamId, userId)
  if (!result) return null
  if (result.membership.role !== 'leader') return null
  return result
}

async function generateNextTeamCode(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('team_code')
    .like('team_code', 'FTA%')
    .order('team_code', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const latest = data?.[0]?.team_code ?? 'FTA1000'
  const match = /^FTA(\d+)$/.exec(latest)
  const nextNumber = match ? Number(match[1]) + 1 : 1001

  return `FTA${String(nextNumber).padStart(4, '0')}`
}

// POST /api/teams — Create team
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { name, description } = req.body as { name: string; description?: string }

  if (!name?.trim()) {
    res.status(400).json({ error: 'Team name is required' })
    return
  }

  let createdTeam: any = null
  let lastError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = generateInviteCode()
    const team_code = await generateNextTeamCode()

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        invite_code,
        team_code,
        leader_id: req.userId!,
      })
      .select()
      .single()

    if (!teamErr && team) {
      createdTeam = team
      break
    }

    lastError = teamErr?.message ?? 'Failed to create team'
  }

  if (!createdTeam) {
    res.status(500).json({ error: lastError ?? 'Failed to create team' })
    return
  }

  const { error: memberErr } = await supabaseAdmin.from('team_members').insert({
    team_id: createdTeam.id,
    user_id: req.userId!,
    role: 'leader',
  })

  if (memberErr) {
    res.status(500).json({ error: memberErr.message })
    return
  }

  res.status(201).json({
    data: {
      team_id: createdTeam.id,
      team_code: createdTeam.team_code,
      invite_code: createdTeam.invite_code,
    },
  })
})

// POST /api/teams/join — Join a team by invite code
router.post('/join', authMiddleware, async (req: AuthRequest, res) => {
  const { invite_code } = req.body as { invite_code: string }

  if (!invite_code?.trim()) {
    res.status(400).json({ error: 'Invite code required' })
    return
  }

  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, team_code')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .maybeSingle()

  if (error || !team) {
    res.status(404).json({ error: 'Invalid invite code' })
    return
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', req.userId!)
    .maybeSingle()

  if (existingErr) {
    res.status(500).json({ error: existingErr.message })
    return
  }

  if (existing) {
    res.status(409).json({ error: 'Already a member of this team' })
    return
  }

  const { error: insertErr } = await supabaseAdmin.from('team_members').insert({
    team_id: team.id,
    user_id: req.userId!,
    role: 'member',
  })

  if (insertErr) {
    res.status(500).json({ error: insertErr.message })
    return
  }

  res.json({
    data: {
      team_id: team.id,
      team_code: team.team_code,
      team_name: team.name,
    },
  })
})

// POST /api/teams/resolve-code — Resolve public team code to internal UUID
router.post('/resolve-code', authMiddleware, async (req: AuthRequest, res) => {
  const { team_code } = req.body as { team_code: string }

  if (!team_code?.trim()) {
    res.status(400).json({ error: 'team_code is required' })
    return
  }

  const team = await getTeamByCode(team_code)

  if (!team) {
    res.status(404).json({ error: 'Team not found for the given team code' })
    return
  }

  const membership = await getMembership(team.id, req.userId!)

  if (!membership) {
    res.status(403).json({ error: 'You are not a member of this team' })
    return
  }

  res.json({
    data: {
      team_id: team.id,
      team_code: team.team_code,
      team_name: team.name,
      description: team.description ?? null,
      role: membership.role as TeamRole,
    },
  })
})

// GET /api/teams/my-teams — all teams this user belongs to
router.get('/my-teams', authMiddleware, async (req: AuthRequest, res) => {
  const { data: memberships, error } = await supabaseAdmin
    .from('team_members')
    .select('role, teams(*)')
    .eq('user_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const teams = (memberships ?? []).map((m: any) => ({
    ...m.teams,
    myRole: m.role,
  }))

  res.json({ data: teams })
})

// PATCH /api/teams/:teamId — Update team name/description
router.patch('/:teamId', authMiddleware, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string
  const { name, description } = req.body as {
    name?: string
    description?: string | null
  }

  const leader = await ensureTeamLeader(teamId, req.userId!)
  if (!leader) {
    res.status(403).json({ error: 'Only the team leader can update team settings' })
    return
  }

  const updates: Record<string, unknown> = {}

  if (typeof name === 'string') {
    if (!name.trim()) {
      res.status(400).json({ error: 'Team name cannot be empty' })
      return
    }
    updates.name = name.trim()
  }

  if (description !== undefined) {
    updates.description =
      typeof description === 'string' ? description.trim() || null : null
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields provided to update' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ data })
})

// GET /api/teams/:teamId — Get team info
router.get('/:teamId', authMiddleware, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string

  const result = await ensureTeamMember(teamId, req.userId!)
  if (!result) {
    res.status(404).json({ error: 'Team not found or access denied' })
    return
  }

  res.json({ data: result.team })
})

// GET /api/teams/:teamId/members — List members with stats
router.get('/:teamId/members', authMiddleware, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string

  const access = await ensureTeamMember(teamId, req.userId!)
  if (!access) {
    res.status(403).json({ error: 'You are not a member of this team' })
    return
  }

  const { data: members, error } = await supabaseAdmin
    .from('team_members')
    .select('*, profiles(*)')
    .eq('team_id', teamId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data: findings } = await supabaseAdmin
        .from('findings')
        .select('security_severity, component, last_seen_at, status')
        .eq('team_id', teamId)
        .eq('uploaded_by', m.user_id)

      const openFindings = (findings ?? []).filter((f) => f.status !== 'resolved')
      const total = openFindings.length
      const critical = openFindings.filter((f) => f.security_severity === 'critical').length
      const high = openFindings.filter((f) => f.security_severity === 'high').length
      const medium = openFindings.filter((f) => f.security_severity === 'medium').length
      const low = openFindings.filter((f) => f.security_severity === 'low').length

      const by_component: Record<string, number> = {}
      openFindings.forEach((f) => {
        by_component[f.component] = (by_component[f.component] ?? 0) + 1
      })

      const sorted = [...(findings ?? [])].sort(
        (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
      )

      return {
        ...m,
        profile: m.profiles,
        stats: {
          total,
          critical,
          high,
          medium,
          low,
          by_component,
          last_scanned_at: sorted[0]?.last_seen_at ?? null,
        },
      }
    }),
  )

  res.json({ data: enriched })
})

// DELETE /api/teams/:teamId/members/:userId — Remove member
router.delete('/:teamId/members/:userId', authMiddleware, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string
  const userId = req.params.userId as string

  const leader = await ensureTeamLeader(teamId, req.userId!)
  if (!leader) {
    res.status(403).json({ error: 'Only the team leader can remove members' })
    return
  }

  if (leader.team.leader_id === userId) {
    res.status(400).json({ error: 'The team leader cannot be removed' })
    return
  }

  const { error } = await supabaseAdmin
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ data: { message: 'Member removed' } })
})

// POST /api/teams/:teamId/invite/regenerate
router.post('/:teamId/invite/regenerate', authMiddleware, async (req: AuthRequest, res) => {
  const teamId = req.params.teamId as string

  const leader = await ensureTeamLeader(teamId, req.userId!)
  if (!leader) {
    res.status(403).json({ error: 'Only the leader can regenerate the invite code' })
    return
  }

  const invite_code = generateInviteCode()

  const { data, error } = await supabaseAdmin
    .from('teams')
    .update({ invite_code })
    .eq('id', teamId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ data })
})

export default router