import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import { createNotification } from './notifications'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────
function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function isTeamLeader(teamId: string, userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single()
    return data?.role === 'leader'
}

// POST /api/teams — Create team
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    const { name, description } = req.body as { name: string; description?: string }
    if (!name) { res.status(400).json({ error: 'Team name is required' }); return }

    const invite_code = generateInviteCode()

    // Create team
    const { data: team, error: teamErr } = await supabaseAdmin
        .from('teams')
        .insert({ name, description, invite_code, leader_id: req.userId! })
        .select()
        .single()
    if (teamErr) { res.status(500).json({ error: teamErr.message }); return }

    // Add creator as leader member
    await supabaseAdmin.from('team_members').insert({
        team_id: team.id,
        user_id: req.userId!,
        role: 'leader',
    })

    res.status(201).json({ data: { team_id: team.id, invite_code } })
})

// POST /api/teams/join — Join a team by invite code
router.post('/join', authMiddleware, async (req: AuthRequest, res) => {
    const { invite_code } = req.body as { invite_code: string }
    if (!invite_code) { res.status(400).json({ error: 'Invite code required' }); return }

    const { data: team, error } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('invite_code', invite_code)
        .single()
    if (error || !team) { res.status(404).json({ error: 'Invalid invite code' }); return }

    // Check if already a member
    const { data: existing } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', req.userId!)
        .single()
    if (existing) { res.status(409).json({ error: 'Already a member of this team' }); return }

    await supabaseAdmin.from('team_members').insert({
        team_id: team.id, user_id: req.userId!, role: 'member'
    })

    // Notify team leader that a new member joined
    const { data: joinerProfile } = await supabaseAdmin
        .from('profiles').select('full_name').eq('id', req.userId!).single()
    const { data: teamFull } = await supabaseAdmin
        .from('teams').select('leader_id').eq('id', team.id).single()
    if (teamFull && teamFull.leader_id !== req.userId) {
        await createNotification({
            userId: teamFull.leader_id,
            teamId: team.id,
            type: 'member_joined',
            title: 'New member joined',
            message: `${joinerProfile?.full_name ?? 'Someone'} joined your team "${team.name}".`,
        })
    }

    res.json({ data: { team_id: team.id, team_name: team.name } })
})

// GET /api/teams/my-teams — all teams this user belongs to
router.get('/my-teams', authMiddleware, async (req: AuthRequest, res) => {
    const { data: memberships, error } = await supabaseAdmin
        .from('team_members')
        .select('role, teams(*)')
        .eq('user_id', req.userId!)

    if (error) { res.status(500).json({ error: error.message }); return }

    const teams = (memberships ?? []).map((m: any) => ({
        ...m.teams,
        myRole: m.role,
    }))

    res.json({ data: teams })
})

// GET /api/teams/:teamId — Get team info
router.get('/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const { teamId } = req.params
    const { data: team, error } = await supabaseAdmin
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()
    if (error) { res.status(404).json({ error: 'Team not found' }); return }
    res.json({ data: team })
})

// PUT /api/teams/:teamId — Update team name/description (leader only)
router.put('/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string
    const { name, description } = req.body as { name?: string; description?: string }

    const isLeader = await isTeamLeader(teamId, req.userId!)
    if (!isLeader) { res.status(403).json({ error: 'Only the team leader can edit team info' }); return }

    const updates: Record<string, string | null> = {}
    if (name) updates.name = name
    if (description !== undefined) updates.description = description ?? null

    const { data, error } = await supabaseAdmin
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single()

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data })
})


// DELETE /api/teams/:teamId — Delete team (leader only)
router.delete('/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string

    // Only the leader can delete
    const { data: team } = await supabaseAdmin
        .from('teams')
        .select('leader_id')
        .eq('id', teamId)
        .single()

    if (!team) { res.status(404).json({ error: 'Team not found' }); return }
    if (team.leader_id !== req.userId) {
        res.status(403).json({ error: 'Only the team leader can delete this team' }); return
    }

    // Manually delete child rows that don't have ON DELETE CASCADE on team_id
    // Order matters: fix_tasks → findings → scan_sessions → team_members → teams
    await supabaseAdmin.from('fix_tasks').delete().eq('team_id', teamId)
    await supabaseAdmin.from('findings').delete().eq('team_id', teamId)
    await supabaseAdmin.from('scan_sessions').delete().eq('team_id', teamId)
    await supabaseAdmin.from('team_members').delete().eq('team_id', teamId)

    // Now safe to delete the team
    const { error } = await supabaseAdmin.from('teams').delete().eq('id', teamId)
    if (error) { res.status(500).json({ error: error.message }); return }

    res.json({ data: { message: 'Team deleted successfully' } })
})



// GET /api/teams/:teamId/members — List members with stats
router.get('/:teamId/members', authMiddleware, async (req: AuthRequest, res) => {
    const { teamId } = req.params

    const { data: members, error } = await supabaseAdmin
        .from('team_members')
        .select('*, profiles(*)')
        .eq('team_id', teamId)
    if (error) { res.status(500).json({ error: error.message }); return }

    // Enrich each member with latest stats
    const enriched = await Promise.all((members ?? []).map(async (m) => {
        const { data: findings } = await supabaseAdmin
            .from('findings')
            .select('severity, module, created_at')
            .eq('team_id', teamId)
            .eq('uploaded_by', m.user_id)

        const total = findings?.length ?? 0
        const critical = findings?.filter(f => f.severity === 'critical').length ?? 0
        const high = findings?.filter(f => f.severity === 'high').length ?? 0
        const medium = findings?.filter(f => f.severity === 'medium').length ?? 0
        const low = findings?.filter(f => f.severity === 'low').length ?? 0

        const by_module: Record<string, number> = {}
        findings?.forEach(f => { by_module[f.module] = (by_module[f.module] ?? 0) + 1 })

        const risk_score = Math.min(100,
            critical * 25 + high * 10 + medium * 3 + low * 1
        )

        const sorted = [...(findings ?? [])].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        return {
            ...m,
            profile: m.profiles,
            stats: { total, critical, high, medium, low, by_module, risk_score, last_scanned_at: sorted[0]?.created_at ?? null }
        }
    }))

    res.json({ data: enriched })
})

// DELETE /api/teams/:teamId/members/:userId — Remove member
router.delete('/:teamId/members/:userId', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string
    const userId = req.params.userId as string
    const isLeader = await isTeamLeader(teamId, req.userId!)
    if (!isLeader) { res.status(403).json({ error: 'Only the team leader can remove members' }); return }

    await supabaseAdmin.from('team_members').delete()
        .eq('team_id', teamId).eq('user_id', userId)

    // Notify the removed member
    const { data: teamInfo } = await supabaseAdmin
        .from('teams').select('name').eq('id', teamId).single()
    await createNotification({
        userId,
        teamId,
        type: 'member_removed',
        title: 'Removed from team',
        message: `You have been removed from team "${teamInfo?.name ?? 'Unknown'}".`,
    })

    res.json({ data: { message: 'Member removed' } })
})

// POST /api/teams/:teamId/invite/regenerate
router.post('/:teamId/invite/regenerate', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string
    const isLeader = await isTeamLeader(teamId, req.userId!)
    if (!isLeader) { res.status(403).json({ error: 'Only the leader can regenerate the invite code' }); return }

    const invite_code = generateInviteCode()
    await supabaseAdmin.from('teams').update({ invite_code }).eq('id', teamId)
    res.json({ data: { invite_code } })
})

export default router
