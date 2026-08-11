import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import { getTeamMembership, requireFindingAccess, requireTeamMember } from '../middleware/accessControl'
import { normalizeFinding } from '../services/findingNormalizer'
import type { RawFinding, ScanScope, SecuritySeverity } from '../types'

const router = Router()

interface UploadBody {
  team_id: string
  project_id?: string | null
  workspace_id: string
  scan_scope: ScanScope
  scanned_target: string
  findings: RawFinding[]
}

function isScanScope(value: unknown): value is ScanScope {
  return value === 'file' || value === 'project'
}

function countSeverities(findings: ReturnType<typeof normalizeFinding>[]) {
  const counts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  for (const finding of findings) counts[finding.security_severity] += 1
  return counts
}

async function validateProject(teamId: string, projectId?: string | null) {
  if (!projectId) return true
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function writeArchiveBestEffort(
  teamId: string,
  userId: string,
  sessionId: string,
  payload: unknown
): Promise<string | null> {
  const storagePath = `${teamId}/${userId}/${sessionId}.json`
  const { error } = await supabaseAdmin.storage
    .from('findings')
    .upload(storagePath, JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) {
    console.warn('[FLUSEC] Findings archive upload skipped:', error.message)
    return null
  }
  return storagePath
}

// POST /api/v1/findings/upload
router.post('/upload', authMiddleware, requireTeamMember, async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as UploadBody
    const teamId = String(body.team_id ?? '').trim()
    const workspaceId = String(body.workspace_id ?? '').trim()
    const scannedTarget = String(body.scanned_target ?? '').trim()

    if (!teamId || !workspaceId || !scannedTarget || !Array.isArray(body.findings)) {
      res.status(400).json({
        error: 'team_id, workspace_id, scanned_target, and findings are required',
      })
      return
    }
    if (!isScanScope(body.scan_scope)) {
      res.status(400).json({ error: 'scan_scope must be "file" or "project"' })
      return
    }
    if (scannedTarget !== '.' && (
      scannedTarget.startsWith('/') ||
      /^[A-Za-z]:[\\/]/.test(scannedTarget) ||
      scannedTarget.split(/[\\/]+/).includes('..')
    )) {
      res.status(400).json({ error: 'scanned_target must be a workspace-relative path' })
      return
    }
    if (!(await validateProject(teamId, body.project_id))) {
      res.status(400).json({ error: 'project_id does not belong to this team' })
      return
    }

    if (body.findings.length > 10000) {
      res.status(413).json({ error: 'A single scan session cannot upload more than 10,000 findings' })
      return
    }

    let processed: ReturnType<typeof normalizeFinding>[]
    try {
      processed = body.findings.map(normalizeFinding)
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid finding payload',
      })
      return
    }

    const counts = countSeverities(processed)
    const now = new Date().toISOString()

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('scan_sessions')
      .insert({
        team_id: teamId,
        project_id: body.project_id ?? null,
        uploaded_by: req.userId!,
        workspace_id: workspaceId,
        scan_scope: body.scan_scope,
        scanned_target: scannedTarget,
        total_count: processed.length,
        critical_count: counts.critical,
        high_count: counts.high,
        medium_count: counts.medium,
        low_count: counts.low,
        scanned_at: now,
      })
      .select('*')
      .single()

    if (sessionError || !session) {
      res.status(500).json({ error: sessionError?.message ?? 'Failed to create scan session' })
      return
    }

    const archivePath = await writeArchiveBestEffort(teamId, req.userId!, session.id, {
      team_id: teamId,
      project_id: body.project_id ?? null,
      workspace_id: workspaceId,
      scan_scope: body.scan_scope,
      scanned_target: scannedTarget,
      scanned_at: now,
      findings: processed,
    })

    if (archivePath) {
      await supabaseAdmin
        .from('scan_sessions')
        .update({ storage_path: archivePath })
        .eq('id', session.id)
    }

    let upserted: Array<{ id: string; fingerprint: string }> = []

    if (processed.length > 0) {
      const fingerprints = processed.map((finding) => finding.fingerprint)
      const { data: previousRows, error: previousRowsError } = await supabaseAdmin
        .from('findings')
        .select('fingerprint, status')
        .eq('team_id', teamId)
        .eq('uploaded_by', req.userId!)
        .eq('workspace_id', workspaceId)
        .in('fingerprint', fingerprints)

      if (previousRowsError) {
        res.status(500).json({ error: previousRowsError.message })
        return
      }

      const previousStatus = new Map(
        (previousRows ?? []).map((row) => [row.fingerprint, row.status as string]),
      )

      const rows = processed.map((finding) => ({
        ...finding,
        team_id: teamId,
        project_id: body.project_id ?? null,
        uploaded_by: req.userId!,
        workspace_id: workspaceId,
        last_session_id: session.id,
        // Preserve a user's explicit in-progress state. A previously resolved
        // finding that reappears is reopened automatically.
        status: previousStatus.get(finding.fingerprint) === 'in_progress' ? 'in_progress' : 'open',
        last_seen_at: now,
        resolved_at: null,
      }))

      const { data, error } = await supabaseAdmin
        .from('findings')
        .upsert(rows, {
          onConflict: 'team_id,uploaded_by,workspace_id,fingerprint',
          ignoreDuplicates: false,
        })
        .select('id, fingerprint')

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }
      upserted = data ?? []

      if (upserted.length > 0) {
        const occurrences = upserted.map((finding) => ({
          session_id: session.id,
          finding_id: finding.id,
          observed_at: now,
        }))
        const { error: occurrenceError } = await supabaseAdmin
          .from('scan_finding_occurrences')
          .upsert(occurrences, { onConflict: 'session_id,finding_id' })
        if (occurrenceError) {
          res.status(500).json({ error: occurrenceError.message })
          return
        }
      }
    }

    let resolvedCount = 0
    const canResolveScope = body.scan_scope === 'project' || scannedTarget !== '.'
    if (canResolveScope) {
      let existingQuery = supabaseAdmin
        .from('findings')
        .select('id, fingerprint, file_path')
        .eq('team_id', teamId)
        .eq('uploaded_by', req.userId!)
        .eq('workspace_id', workspaceId)
        .neq('status', 'resolved')

      // A full-project scan can resolve any finding missing from that workspace.
      // A single-file scan can safely resolve only findings previously attached
      // to the exact file that was rescanned. It never affects other files.
      if (body.scan_scope === 'file') {
        existingQuery = existingQuery.eq('file_path', scannedTarget)
      }

      const { data: existing, error: existingError } = await existingQuery
      if (existingError) {
        res.status(500).json({ error: existingError.message })
        return
      }

      const current = new Set(processed.map((finding) => finding.fingerprint))
      const staleIds = (existing ?? [])
        .filter((finding) => !current.has(finding.fingerprint))
        .map((finding) => finding.id)

      if (staleIds.length > 0) {
        const { error: resolveError } = await supabaseAdmin
          .from('findings')
          .update({ status: 'resolved', resolved_at: now })
          .in('id', staleIds)
        if (resolveError) {
          res.status(500).json({ error: resolveError.message })
          return
        }
        resolvedCount = staleIds.length
      }
    }

    res.status(201).json({
      data: {
        session_id: session.id,
        findings_count: processed.length,
        canonical_findings_updated: upserted.length,
        resolved_count: resolvedCount,
        archive_path: archivePath,
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/findings/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from('team_members')
    .select('team_id')
    .eq('user_id', req.userId!)

  if (membershipsError) {
    res.status(500).json({ error: membershipsError.message })
    return
  }

  const teamIds = (memberships ?? []).map((membership) => membership.team_id)
  if (teamIds.length === 0) {
    res.json({ data: [] })
    return
  }

  let query = supabaseAdmin
    .from('findings')
    .select('*')
    .eq('uploaded_by', req.userId!)
    .in('team_id', teamIds)
    .order('last_seen_at', { ascending: false })

  if (req.query.security_severity) {
    query = query.eq('security_severity', String(req.query.security_severity).toLowerCase())
  }
  if (req.query.component) {
    query = query.eq('component', String(req.query.component).toUpperCase())
  }
  if (req.query.status) query = query.eq('status', String(req.query.status))
  if (req.query.limit) query = query.limit(Number(req.query.limit))

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: data ?? [] })
})

// GET /api/v1/findings/team/:teamId
router.get('/team/:teamId', authMiddleware, requireTeamMember, async (req: AuthRequest, res) => {
  const teamId = String(req.params.teamId)
  let query = supabaseAdmin
    .from('findings')
    .select('*, profile:profiles!uploaded_by(*)')
    .eq('team_id', teamId)
    .order('last_seen_at', { ascending: false })

  if (req.query.security_severity) {
    query = query.eq('security_severity', String(req.query.security_severity).toLowerCase())
  }
  if (req.query.component) {
    query = query.eq('component', String(req.query.component).toUpperCase())
  }
  if (req.query.status) query = query.eq('status', String(req.query.status))
  if (req.query.uploaded_by) query = query.eq('uploaded_by', String(req.query.uploaded_by))
  if (req.query.limit) query = query.limit(Number(req.query.limit))

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: data ?? [] })
})

// GET /api/v1/findings/member/:userId?team_id=<uuid>
router.get('/member/:userId', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = String(req.params.userId)
    const teamId = typeof req.query.team_id === 'string' ? req.query.team_id : ''

    if (targetUserId !== req.userId && !teamId) {
      res.status(400).json({ error: 'team_id is required when viewing another member' })
      return
    }

    if (teamId) {
      const requester = await getTeamMembership(teamId, req.userId!)
      const target = await getTeamMembership(teamId, targetUserId)
      if (!requester || !target) {
        res.status(403).json({ error: 'Users do not share access to this team' })
        return
      }
    }

    let query = supabaseAdmin
      .from('findings')
      .select('*, profile:profiles!uploaded_by(*)')
      .eq('uploaded_by', targetUserId)
      .order('last_seen_at', { ascending: false })

    if (teamId) query = query.eq('team_id', teamId)

    const { data, error } = await query
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
    res.json({ data: data ?? [] })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/findings/:id
router.get('/:id', authMiddleware, requireFindingAccess, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('findings')
    .select('*, profile:profiles!uploaded_by(*)')
    .eq('id', req.params.id)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Finding not found' })
    return
  }
  res.json({ data })
})

export default router
