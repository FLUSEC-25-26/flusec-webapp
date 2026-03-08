import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type { RawFinding } from '../types'
import { createNotification } from './notifications'

const router = Router()

// POST /api/findings/upload — main VS Code extension endpoint
router.post('/upload', authMiddleware, async (req: AuthRequest, res) => {
    const { team_id, project_id, scanned_file, findings } = req.body as {
        team_id: string
        project_id?: string
        scanned_file: string
        findings: RawFinding[]
    }

    if (!team_id || !scanned_file || !Array.isArray(findings)) {
        res.status(400).json({ error: 'team_id, scanned_file, and findings are required' })
        return
    }

    // Verify user is a team member
    const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', req.userId!)
        .single()
    if (!membership) { res.status(403).json({ error: 'Not a member of this team' }); return }

    // Severity counts
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    findings.forEach(f => { if (f.severity in counts) counts[f.severity as keyof typeof counts]++ })

    // Store raw JSON in Supabase Storage
    const storagePath = `${team_id}/${req.userId}/${Date.now()}_findings.json`
    await supabaseAdmin.storage.from('findings').upload(storagePath, JSON.stringify(findings), {
        contentType: 'application/json', upsert: false
    })

    // Create scan session
    const { data: session, error: sessionErr } = await supabaseAdmin
        .from('scan_sessions')
        .insert({
            team_id, project_id: project_id ?? null,
            uploaded_by: req.userId!,
            scanned_file, storage_path: storagePath,
            total_count: findings.length,
            critical_count: counts.critical,
            high_count: counts.high,
            medium_count: counts.medium,
            low_count: counts.low,
        })
        .select()
        .single()
    if (sessionErr) { res.status(500).json({ error: sessionErr.message }); return }

    // Insert individual findings
    if (findings.length > 0) {
        const rows = findings.map(f => ({
            session_id: session.id,
            team_id,
            uploaded_by: req.userId!,
            module: f.module,
            rule_id: f.rule_id ?? null,
            title: f.title,
            description: f.description ?? null,
            severity: f.severity,
            file_path: f.file_path ?? null,
            line_number: f.line_number ?? null,
            code_snippet: f.code_snippet ?? null,
            status: 'open',
        }))

        const { error: findErr } = await supabaseAdmin.from('findings').insert(rows)
        if (findErr) { res.status(500).json({ error: findErr.message }); return }
    }

    res.status(201).json({
        data: { session_id: session.id, findings_count: findings.length }
    })

    // ── Fire notifications (non-blocking, after response) ──────
    // Get uploader's name and team leader
    const [profileRes, teamRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('full_name').eq('id', req.userId!).single(),
        supabaseAdmin.from('teams').select('leader_id, name').eq('id', team_id).single(),
    ])
    const uploaderName = profileRes.data?.full_name ?? 'A team member'
    const team = teamRes.data

    if (team && team.leader_id !== req.userId) {
        // Notify leader: new findings synced
        await createNotification({
            userId: team.leader_id,
            teamId: team_id,
            type: 'findings_synced',
            title: 'New findings synced',
            message: `${uploaderName} synced ${findings.length} finding${findings.length !== 1 ? 's' : ''} in ${team.name}.`,
        })

        // Extra alert if any are critical
        if (counts.critical > 0) {
            await createNotification({
                userId: team.leader_id,
                teamId: team_id,
                type: 'critical_finding',
                title: '🚨 Critical findings detected',
                message: `${uploaderName} uploaded ${counts.critical} critical finding${counts.critical !== 1 ? 's' : ''} in ${team.name}. Immediate review recommended.`,
            })
        }
    }
})

// GET /api/findings/me — own findings
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
    let query = supabaseAdmin
        .from('findings')
        .select('*')
        .eq('uploaded_by', req.userId!)
        .order('created_at', { ascending: false })

    if (req.query['severity']) query = query.eq('severity', req.query['severity'] as string)
    if (req.query['module']) query = query.eq('module', req.query['module'] as string)
    if (req.query['limit']) query = query.limit(parseInt(req.query['limit'] as string))

    const { data, error } = await query
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: data ?? [] })
})

// GET /api/findings/team/:teamId — all team findings (leader only)
router.get('/team/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const { teamId } = req.params

    // Only leader or member can see team findings
    const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.userId!)
        .single()
    if (!membership) { res.status(403).json({ error: 'Not a member of this team' }); return }

    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('*, profiles!uploaded_by(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: data ?? [] })
})

// GET /api/findings/member/:userId — leader views specific member's findings
router.get('/member/:userId', authMiddleware, async (req: AuthRequest, res) => {
    const { userId } = req.params

    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('*')
        .eq('uploaded_by', userId)
        .order('created_at', { ascending: false })
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json({ data: data ?? [] })
})

// GET /api/findings/:id — single finding detail
router.get('/:id', authMiddleware, async (_req, res) => {
    const { id } = _req.params
    const { data, error } = await supabaseAdmin.from('findings').select('*').eq('id', id).single()
    if (error) { res.status(404).json({ error: 'Finding not found' }); return }
    res.json({ data })
})

export default router
