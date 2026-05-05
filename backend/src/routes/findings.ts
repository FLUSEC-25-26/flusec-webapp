import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type {
    AdvisorModule,
    RawFinding,
    RiskLevel,
    SeverityLevel,
    TaintFlowStep,
} from '../types'

const router = Router()

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asArray<T = unknown>(value: unknown): T[] | null {
    return Array.isArray(value) ? (value as T[]) : null
}

function normalizeModule(finding: RawFinding): AdvisorModule {
    const raw = String(finding.module ?? finding.component ?? 'HSD').trim().toUpperCase()

    if (raw === 'HSD') return 'HSD'
    if (raw === 'NET' || raw === 'SNC') return 'SNC'
    if (raw === 'IDS' || raw === 'SDS') return 'SDS'
    if (raw === 'IIV' || raw === 'IVS') return 'IVS'

    return 'HSD'
}

function normalizeOriginalSeverity(finding: RawFinding): string {
    return (
        asString(finding.original_severity) ??
        asString(finding.originalSeverity) ??
        asString(finding.severity) ??
        asString(finding.risk_level) ??
        asString(finding.riskLevel) ??
        'warning'
    ).toLowerCase()
}

function normalizeRiskLevelLike(raw: string | null): RiskLevel | null {
    const value = (raw ?? '').trim().toLowerCase()

    if (!value) return null
    if (value === 'critical' || value === 'error') return 'critical'
    if (value === 'high') return 'high'
    if (value === 'medium' || value === 'med') return 'medium'
    if (value === 'low' || value === 'warning' || value === 'info') return 'low'

    return null
}

function levelToScore(level: RiskLevel): number {
    if (level === 'critical') return 95
    if (level === 'high') return 75
    if (level === 'medium') return 55
    return 30
}

function scoreToLevel(score: number): RiskLevel {
    if (score >= 85) return 'critical'
    if (score >= 65) return 'high'
    if (score >= 45) return 'medium'
    return 'low'
}

function clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)))
}

function complexityPoints(value: number | null): number {
    if (value == null) return 0
    if (value <= 2) return 1
    if (value <= 5) return 2
    return 3
}

function nestingPoints(value: number | null): number {
    if (value == null) return 0
    if (value <= 1) return 1
    if (value <= 3) return 2
    return 3
}

function locPoints(value: number | null): number {
    if (value == null) return 0
    if (value <= 15) return 1
    if (value <= 30) return 2
    return 3
}

function taintPoints(value: TaintFlowStep[] | null): number {
    if (!value || value.length === 0) return 0
    if (value.length === 1) return 1
    if (value.length <= 3) return 2
    return 3
}

function secretPoints(secretType: string | null): number {
    const value = (secretType ?? '').toUpperCase()
    if (!value) return 0

    if (
        value.includes('PASSWORD') ||
        value.includes('SECRET_KEY') ||
        value.includes('ENCRYPTION_KEY') ||
        value.includes('PRIVATE_KEY') ||
        value.includes('ACCESS_KEY') ||
        value.includes('JWT_TOKEN') ||
        value.includes('TOKEN')
    ) {
        return 1
    }

    return 0
}

function deriveHsdRisk(finding: RawFinding): {
    severity: SeverityLevel
    riskLevel: RiskLevel
    riskScore: number
} {
    const complexity = asNumber(finding.complexity)
    const nestingDepth = asNumber(finding.nesting_depth ?? finding.nestingDepth)
    const functionLoc = asNumber(finding.function_loc ?? finding.functionLoc)
    const secretType = asString(finding.secret_type ?? finding.secretType)
    const taintFlow = asArray<TaintFlowStep>(finding.taint_flow ?? finding.taintFlow)

    const total =
        complexityPoints(complexity) +
        nestingPoints(nestingDepth) +
        locPoints(functionLoc) +
        taintPoints(taintFlow) +
        secretPoints(secretType)

    let riskLevel: RiskLevel
    let riskScore: number

    if (total <= 4) {
        riskLevel = 'low'
        riskScore = 24 + total * 4
    } else if (total <= 6) {
        riskLevel = 'medium'
        riskScore = 40 + (total - 4) * 10
    } else {
        riskLevel = 'high'
        riskScore = 70 + Math.min(25, (total - 6) * 10)
    }

    return {
        severity: riskLevel,
        riskLevel,
        riskScore: clampScore(riskScore),
    }
}

function idsDataTypeBonus(raw: string | null): number {
    const value = (raw ?? '').toLowerCase()

    if (
        value.includes('password') ||
        value.includes('token') ||
        value.includes('secret') ||
        value.includes('key') ||
        value.includes('credential') ||
        value.includes('encryption')
    ) {
        return 15
    }

    if (
        value.includes('email') ||
        value.includes('phone') ||
        value.includes('address') ||
        value.includes('payment') ||
        value.includes('personal') ||
        value.includes('pii')
    ) {
        return 10
    }

    return 0
}

function idsStorageBonus(raw: string | null): number {
    const value = (raw ?? '').toLowerCase()

    if (
        value.includes('shared_preferences') ||
        value.includes('sqlite') ||
        value.includes('local file') ||
        value.includes('file') ||
        value.includes('plaintext') ||
        value.includes('cache')
    ) {
        return 10
    }

    return 0
}

function deriveIdsRisk(finding: RawFinding): {
    severity: SeverityLevel
    riskLevel: RiskLevel
    riskScore: number
} {
    const incomingLevel =
        normalizeRiskLevelLike(asString(finding.risk_level ?? finding.riskLevel)) ??
        normalizeRiskLevelLike(asString(finding.severity)) ??
        'low'

    const dataType = asString(finding.data_type ?? finding.dataType)
    const storageContext = asString(finding.storage_context ?? finding.storageContext)

    const score = clampScore(
        levelToScore(incomingLevel) +
        idsDataTypeBonus(dataType) +
        idsStorageBonus(storageContext)
    )

    const riskLevel = scoreToLevel(score)

    return {
        severity: riskLevel,
        riskLevel,
        riskScore: score,
    }
}

function deriveStandardRisk(finding: RawFinding): {
    severity: SeverityLevel
    riskLevel: RiskLevel
    riskScore: number
} {
    const level =
        normalizeRiskLevelLike(asString(finding.risk_level ?? finding.riskLevel)) ??
        normalizeRiskLevelLike(asString(finding.severity)) ??
        'low'

    const score = clampScore(levelToScore(level))

    return {
        severity: level,
        riskLevel: level,
        riskScore: score,
    }
}

function normalizeFinding(finding: RawFinding) {
    const module = normalizeModule(finding)
    const originalSeverity = normalizeOriginalSeverity(finding)

    const risk =
        module === 'HSD'
            ? deriveHsdRisk(finding)
            : module === 'SDS'
                ? deriveIdsRisk(finding)
                : deriveStandardRisk(finding)

    return {
        module,
        rule_id: asString(finding.rule_id ?? finding.ruleId),
        title: asString(finding.title ?? finding.message) ?? 'Security finding',
        description: asString(finding.description),
        severity: risk.severity,
        original_severity: originalSeverity,
        risk_level: risk.riskLevel,
        risk_score: risk.riskScore,
        file_path: asString(finding.file_path ?? finding.filePath ?? finding.file),
        line_number: asNumber(finding.line_number ?? finding.lineNumber ?? finding.line),
        column_number: asNumber(finding.column_number ?? finding.columnNumber ?? finding.column),
        code_snippet: asString(finding.code_snippet ?? finding.codeSnippet ?? finding.snippet),
        function_name: asString(finding.function_name ?? finding.functionName),
        complexity: asNumber(finding.complexity),
        nesting_depth: asNumber(finding.nesting_depth ?? finding.nestingDepth),
        function_loc: asNumber(finding.function_loc ?? finding.functionLoc),
        secret_type: asString(finding.secret_type ?? finding.secretType),
        taint_flow: asArray<TaintFlowStep>(finding.taint_flow ?? finding.taintFlow),
        data_type: asString(finding.data_type ?? finding.dataType),
        storage_context: asString(finding.storage_context ?? finding.storageContext),
    }
}

// POST /api/findings/upload
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

    const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', req.userId!)
        .single()

    if (!membership) {
        res.status(403).json({ error: 'Not a member of this team' })
        return
    }

    const processedFindings = findings.map(normalizeFinding)

    const counts: Record<SeverityLevel, number> = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
    }

    processedFindings.forEach((finding) => {
        counts[finding.severity] += 1
    })

    const storagePath = `${team_id}/${req.userId}/${Date.now()}_findings.json`

    const storageUpload = await supabaseAdmin.storage
        .from('findings')
        .upload(storagePath, JSON.stringify(processedFindings, null, 2), {
            contentType: 'application/json',
            upsert: false,
        })

    if (storageUpload.error) {
        res.status(500).json({ error: storageUpload.error.message })
        return
    }

    const { data: session, error: sessionErr } = await supabaseAdmin
        .from('scan_sessions')
        .insert({
            team_id,
            project_id: project_id ?? null,
            uploaded_by: req.userId!,
            scanned_file,
            storage_path: storagePath,
            total_count: processedFindings.length,
            critical_count: counts.critical,
            high_count: counts.high,
            medium_count: counts.medium,
            low_count: counts.low,
        })
        .select()
        .single()

    if (sessionErr) {
        res.status(500).json({ error: sessionErr.message })
        return
    }

    if (processedFindings.length > 0) {
        const rows = processedFindings.map((finding) => ({
            session_id: session.id,
            team_id,
            uploaded_by: req.userId!,
            module: finding.module,
            rule_id: finding.rule_id ?? null,
            title: finding.title,
            description: finding.description ?? null,
            severity: finding.severity,
            original_severity: finding.original_severity,
            risk_level: finding.risk_level,
            risk_score: finding.risk_score,
            file_path: finding.file_path ?? null,
            line_number: finding.line_number ?? null,
            column_number: finding.column_number ?? null,
            code_snippet: finding.code_snippet ?? null,
            function_name: finding.function_name ?? null,
            complexity: finding.complexity ?? null,
            nesting_depth: finding.nesting_depth ?? null,
            function_loc: finding.function_loc ?? null,
            secret_type: finding.secret_type ?? null,
            taint_flow: finding.taint_flow ?? null,
            data_type: finding.data_type ?? null,
            storage_context: finding.storage_context ?? null,
            status: 'open',
        }))

        const { error: findErr } = await supabaseAdmin.from('findings').insert(rows)

        if (findErr) {
            res.status(500).json({ error: findErr.message })
            return
        }
    }

    res.status(201).json({
        data: {
            session_id: session.id,
            findings_count: processedFindings.length,
        },
    })
})

// GET /api/findings/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
    let query = supabaseAdmin
        .from('findings')
        .select('*')
        .eq('uploaded_by', req.userId!)
        .order('created_at', { ascending: false })

    if (req.query['severity']) query = query.eq('severity', req.query['severity'] as string)
    if (req.query['module']) query = query.eq('module', req.query['module'] as string)
    if (req.query['limit']) query = query.limit(parseInt(req.query['limit'] as string, 10))

    const { data, error } = await query

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }

    res.json({ data: data ?? [] })
})

// GET /api/findings/team/:teamId
router.get('/team/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string

    const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', req.userId!)
        .single()

    if (!membership) {
        res.status(403).json({ error: 'Not a member of this team' })
        return
    }

    let query = supabaseAdmin
        .from('findings')
        .select('*, profile:profiles!uploaded_by(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

    if (req.query['severity']) query = query.eq('severity', req.query['severity'] as string)
    if (req.query['module']) query = query.eq('module', req.query['module'] as string)
    if (req.query['status']) query = query.eq('status', req.query['status'] as string)
    if (req.query['uploaded_by']) query = query.eq('uploaded_by', req.query['uploaded_by'] as string)
    if (req.query['limit']) query = query.limit(parseInt(req.query['limit'] as string, 10))

    const { data, error } = await query

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }

    res.json({ data: data ?? [] })
})

// GET /api/findings/member/:userId
router.get('/member/:userId', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.params.userId as string

    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('*, profile:profiles!uploaded_by(*)')
        .eq('uploaded_by', userId)
        .order('created_at', { ascending: false })

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }

    res.json({ data: data ?? [] })
})

// GET /api/findings/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    const id = req.params.id as string

    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('*, profile:profiles!uploaded_by(*)')
        .eq('id', id)
        .single()

    if (error) {
        res.status(404).json({ error: 'Finding not found' })
        return
    }

    res.json({ data })
})

export default router