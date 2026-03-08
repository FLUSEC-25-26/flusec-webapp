import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

// ─── Helper: create a notification ───────────────────────────
export async function createNotification({
    userId,
    teamId,
    type,
    title,
    message,
}: {
    userId: string
    teamId: string | null
    type: string
    title: string
    message: string
}) {
    await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        team_id: teamId,
        type,
        title,
        message,
        is_read: false,
    })
}

// GET /api/notifications — fetch current user's notifications
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    const limit = parseInt(req.query['limit'] as string) || 30

    const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', req.userId!)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: data ?? [] })
})

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res) => {
    const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId!)
        .eq('is_read', false)

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: { count: count ?? 0 } })
})

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res) => {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', req.userId!)
        .eq('is_read', false)

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: { message: 'All notifications marked as read' } })
})

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res) => {
    const { id } = req.params
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', req.userId!)

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: { message: 'Notification marked as read' } })
})

// DELETE /api/notifications/clear — delete all read notifications
router.delete('/clear', authMiddleware, async (req: AuthRequest, res) => {
    const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', req.userId!)
        .eq('is_read', true)

    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: { message: 'Cleared read notifications' } })
})

export default router
