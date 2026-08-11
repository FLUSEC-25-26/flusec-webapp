import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import { getTeamMembership } from '../middleware/accessControl'
import { summarizeFindings } from '../services/findingStats'

const router = Router()

async function authorizeMemberView(teamId: string, requesterId: string, targetUserId: string) {
  const [requester, target] = await Promise.all([
    getTeamMembership(teamId, requesterId),
    getTeamMembership(teamId, targetUserId),
  ])
  return Boolean(requester && target)
}

router.get('/:userId/stats', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = String(req.params.userId)
    const teamId = typeof req.query.team_id === 'string' ? req.query.team_id : ''

    if (!teamId) {
      res.status(400).json({ error: 'team_id is required' })
      return
    }
    if (!(await authorizeMemberView(teamId, req.userId!, targetUserId))) {
      res.status(403).json({ error: 'You do not have access to this member' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('findings')
      .select('component, security_severity, last_seen_at, status')
      .eq('team_id', teamId)
      .eq('uploaded_by', targetUserId)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ data: summarizeFindings(data ?? []) })
  } catch (error) {
    next(error)
  }
})

router.get('/:userId/timeline', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = String(req.params.userId)
    const teamId = typeof req.query.team_id === 'string' ? req.query.team_id : ''

    if (!teamId) {
      res.status(400).json({ error: 'team_id is required' })
      return
    }
    if (!(await authorizeMemberView(teamId, req.userId!, targetUserId))) {
      res.status(403).json({ error: 'You do not have access to this member' })
      return
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions, error } = await supabaseAdmin
      .from('scan_sessions')
      .select('scanned_at, total_count, critical_count, high_count, medium_count, low_count')
      .eq('team_id', teamId)
      .eq('uploaded_by', targetUserId)
      .gte('scanned_at', thirtyDaysAgo.toISOString())
      .order('scanned_at', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const byDate: Record<
      string,
      { total: number; critical: number; high: number; medium: number; low: number }
    > = {}

    for (const session of sessions ?? []) {
      const date = String(session.scanned_at).split('T')[0]
      byDate[date] ??= { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
      byDate[date].total += session.total_count ?? 0
      byDate[date].critical += session.critical_count ?? 0
      byDate[date].high += session.high_count ?? 0
      byDate[date].medium += session.medium_count ?? 0
      byDate[date].low += session.low_count ?? 0
    }

    res.json({
      data: Object.entries(byDate).map(([date, counts]) => ({ date, ...counts })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
