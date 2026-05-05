import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

// GET /api/members/:userId/stats
router.get('/:userId/stats', authMiddleware, async (req: AuthRequest, res) => {
    const { userId } = req.params

    const { data: findings, error } = await supabaseAdmin
        .from('findings')
        .select('severity, module, created_at')
        .eq('uploaded_by', userId)

    if (error) { res.status(500).json({ error: error.message }); return }

    const total = findings?.length ?? 0
    const critical = findings?.filter(f => f.severity === 'critical').length ?? 0
    const high = findings?.filter(f => f.severity === 'high').length ?? 0
    const medium = findings?.filter(f => f.severity === 'medium').length ?? 0
    const low = findings?.filter(f => f.severity === 'low').length ?? 0

    const by_module: Record<string, number> = {}
    findings?.forEach(f => { by_module[f.module] = (by_module[f.module] ?? 0) + 1 })

    const risk_score = Math.min(100, critical * 25 + high * 10 + medium * 3 + low * 1)

    const sorted = [...(findings ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    res.json({
        data: {
            total, critical, high, medium, low,
            by_module,
            risk_score,
            last_scanned_at: sorted[0]?.created_at ?? null,
        }
    })
})

// GET /api/members/:userId/timeline — scan count per day (last 30 days)
router.get('/:userId/timeline', authMiddleware, async (req: AuthRequest, res) => {
    const { userId } = req.params

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions, error } = await supabaseAdmin
        .from('scan_sessions')
        .select('scanned_at, total_count, critical_count, high_count, medium_count, low_count')
        .eq('uploaded_by', userId)
        .gte('scanned_at', thirtyDaysAgo.toISOString())
        .order('scanned_at', { ascending: true })

    if (error) { res.status(500).json({ error: error.message }); return }

    // Group by date
    const byDate: Record<string, { total: number; critical: number; high: number; medium: number; low: number }> = {}
    sessions?.forEach(s => {
        const date = s.scanned_at.split('T')[0]
        if (!byDate[date]) byDate[date] = { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
        byDate[date].total += s.total_count ?? 0
        byDate[date].critical += s.critical_count ?? 0
        byDate[date].high += s.high_count ?? 0
        byDate[date].medium += s.medium_count ?? 0
        byDate[date].low += s.low_count ?? 0
    })

    const timeline = Object.entries(byDate).map(([date, counts]) => ({ date, ...counts }))
    res.json({ data: timeline })
})

export default router
