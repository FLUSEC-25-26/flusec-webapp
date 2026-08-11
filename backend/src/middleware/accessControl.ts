import type { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import type { AuthRequest } from './authMiddleware'

export type TeamRole = 'leader' | 'member' | 'viewer'

export interface TeamMembership {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  joined_at?: string | null
}

export async function getTeamMembership(teamId: string, userId: string): Promise<TeamMembership | null> {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, team_id, user_id, role, joined_at')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as TeamMembership | null) ?? null
}

export async function userBelongsToTeam(teamId: string, userId: string): Promise<boolean> {
  return Boolean(await getTeamMembership(teamId, userId))
}

export async function usersShareTeam(leftUserId: string, rightUserId: string): Promise<boolean> {
  if (leftUserId === rightUserId) return true

  const { data: leftMemberships, error: leftError } = await supabaseAdmin
    .from('team_members')
    .select('team_id')
    .eq('user_id', leftUserId)

  if (leftError) throw new Error(leftError.message)
  const teamIds = (leftMemberships ?? []).map((row) => row.team_id)
  if (teamIds.length === 0) return false

  const { data: shared, error: sharedError } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('user_id', rightUserId)
    .in('team_id', teamIds)
    .limit(1)

  if (sharedError) throw new Error(sharedError.message)
  return Boolean(shared?.length)
}

function readTeamId(req: AuthRequest): string {
  const fromParams = req.params?.teamId
  if (typeof fromParams === 'string' && fromParams.trim()) return fromParams.trim()

  const fromBody = req.body?.team_id
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim()

  const fromQuery = req.query?.team_id
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()

  return ''
}

export async function requireTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const teamId = readTeamId(req)
    if (!teamId) {
      res.status(400).json({ error: 'team_id is required' })
      return
    }

    const membership = await getTeamMembership(teamId, req.userId!)
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' })
      return
    }

    req.teamMembership = membership
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireTeamLeader(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const teamId = readTeamId(req)
    if (!teamId) {
      res.status(400).json({ error: 'team_id is required' })
      return
    }

    const membership = await getTeamMembership(teamId, req.userId!)
    if (!membership || membership.role !== 'leader') {
      res.status(403).json({ error: 'Only the team leader can perform this action' })
      return
    }

    req.teamMembership = membership
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireFindingAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const findingId = String(req.params.id ?? '').trim()
    if (!findingId) {
      res.status(400).json({ error: 'Finding id is required' })
      return
    }

    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .select('id, team_id')
      .eq('id', findingId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!finding) {
      res.status(404).json({ error: 'Finding not found' })
      return
    }

    const membership = await getTeamMembership(finding.team_id, req.userId!)
    if (!membership) {
      res.status(403).json({ error: 'You do not have access to this finding' })
      return
    }

    req.teamMembership = membership
    req.findingTeamId = finding.team_id
    next()
  } catch (error) {
    next(error)
  }
}
