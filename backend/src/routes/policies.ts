import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type {
    ActivePoliciesResponse,
    DetectionConfidence,
    HsdHeuristics,
    PolicyCategory,
    PolicyComponentCode,
    PublishPolicyRequest,
    SecuritySeverity,
    TeamPolicyResponse,
} from '../types/policies'

const router = Router()

const COMPONENTS: PolicyComponentCode[] = ['HSD', 'NET', 'IDS', 'IIV']
const SECURITY_SEVERITIES: SecuritySeverity[] = ['critical', 'high', 'medium', 'low']
const CONFIDENCE_LEVELS: DetectionConfidence[] = ['high', 'medium', 'low']
const POLICY_CATEGORIES: PolicyCategory[] = ['vulnerability', 'secure_coding']

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field} is required`)
    }
}

function assertOptionalString(value: unknown, field: string) {
    if (value != null && typeof value !== 'string') {
        throw new Error(`${field} must be a string or null`)
    }
}

function assertBooleanWhenProvided(value: unknown, field: string) {
    if (value != null && typeof value !== 'boolean') {
        throw new Error(`${field} must be a boolean`)
    }
}

function assertRulesArray(value: unknown): asserts value is unknown[] {
    if (!Array.isArray(value)) {
        throw new Error('rules_json must be an array')
    }
    if (value.length === 0) {
        throw new Error('At least one rule is required before publishing a policy')
    }
}

function assertNumberAtLeast(value: unknown, field: string, minimum: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
        throw new Error(`${field} must be a number greater than or equal to ${minimum}`)
    }
}

function assertIntegerAtLeast(value: unknown, field: string, minimum: number) {
    assertNumberAtLeast(value, field, minimum)
    if (!Number.isInteger(value)) {
        throw new Error(`${field} must be an integer`)
    }
}

function assertStringArray(value: unknown, field: string, options?: { required?: boolean; nonEmpty?: boolean }) {
    if (value == null && !options?.required) return
    if (!Array.isArray(value)) {
        throw new Error(`${field} must be an array`)
    }
    if (options?.nonEmpty && value.length === 0) {
        throw new Error(`${field} must contain at least one value`)
    }
    for (const [index, item] of value.entries()) {
        if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`${field}[${index}] must be a non-empty string`)
        }
    }
}

function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw new Error(`${field} must be one of: ${allowed.join(', ')}`)
    }
    return value as T
}

function optionalTrimmedString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed || undefined
}

function nullableTrimmedString(value: unknown): string | null {
    return optionalTrimmedString(value) ?? null
}

function cleanStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
}

function assertSecurityMetadata(
    rule: Record<string, unknown>,
    label: string,
    component: PolicyComponentCode
) {
    assertOneOf(rule.securitySeverity, SECURITY_SEVERITIES, `${label}.securitySeverity`)

    const confidence = component === 'HSD'
        ? rule.confidence ?? rule.defaultConfidence
        : rule.defaultConfidence ?? rule.confidence
    assertOneOf(confidence, CONFIDENCE_LEVELS, `${label}.${component === 'HSD' ? 'confidence' : 'defaultConfidence'}`)

    assertOneOf(rule.category, POLICY_CATEGORIES, `${label}.category`)
    assertOptionalString(rule.cwe, `${label}.cwe`)
    assertString(rule.description, `${label}.description`)
    assertString(rule.remediation, `${label}.remediation`)
    assertBooleanWhenProvided(rule.enabled, `${label}.enabled`)
}

function validateRuleIdentity(component: PolicyComponentCode, rule: Record<string, unknown>, label: string) {
    assertString(rule.id, `${label}.id`)
    assertString(rule.name, `${label}.name`)

    const id = String(rule.id).trim()
    if (!id.startsWith(`FLUSEC.${component}.`)) {
        throw new Error(`${label}.id must start with FLUSEC.${component}.`)
    }
}

function validateUniqueRuleIds(component: PolicyComponentCode, rules: unknown[]) {
    const ids = new Set<string>()
    for (const [index, raw] of rules.entries()) {
        if (!isPlainObject(raw)) {
            throw new Error(`${component} rule ${index + 1} must be an object`)
        }
        const id = typeof raw.id === 'string' ? raw.id.trim() : ''
        if (!id) continue
        if (ids.has(id)) {
            throw new Error(`Duplicate ${component} rule id: ${id}`)
        }
        ids.add(id)
    }
}

function validateHsdRules(rules: unknown[]) {
    validateUniqueRuleIds('HSD', rules)
    for (const [index, raw] of rules.entries()) {
        if (!isPlainObject(raw)) throw new Error(`HSD rule ${index + 1} must be an object`)
        const label = `HSD rule ${index + 1}`
        validateRuleIdentity('HSD', raw, label)
        assertString(raw.pattern, `${label}.pattern`)
        assertString(raw.secretType, `${label}.secretType`)
        assertOptionalString(raw.provider, `${label}.provider`)
        assertSecurityMetadata(raw, label, 'HSD')
    }
}

function validateNetRules(rules: unknown[]) {
    validateUniqueRuleIds('NET', rules)
    for (const [index, raw] of rules.entries()) {
        if (!isPlainObject(raw)) throw new Error(`NET rule ${index + 1} must be an object`)
        const label = `NET rule ${index + 1}`
        validateRuleIdentity('NET', raw, label)
        assertString(raw.checkKey, `${label}.checkKey`)
        assertString(raw.messageTemplate, `${label}.messageTemplate`)
        assertSecurityMetadata(raw, label, 'NET')
    }
}

function validateIdsRules(rules: unknown[]) {
    validateUniqueRuleIds('IDS', rules)
    for (const [index, raw] of rules.entries()) {
        if (!isPlainObject(raw)) throw new Error(`IDS rule ${index + 1} must be an object`)
        const label = `IDS rule ${index + 1}`
        validateRuleIdentity('IDS', raw, label)
        assertString(raw.checkKey, `${label}.checkKey`)
        assertSecurityMetadata(raw, label, 'IDS')
        assertStringArray(raw.targetFunctions, `${label}.targetFunctions`, { required: true, nonEmpty: true })
        assertStringArray(raw.requiresImport, `${label}.requiresImport`, { required: true })
    }
}

function validateIivRules(rules: unknown[]) {
    validateUniqueRuleIds('IIV', rules)
    for (const [index, raw] of rules.entries()) {
        if (!isPlainObject(raw)) throw new Error(`IIV rule ${index + 1} must be an object`)
        const label = `IIV rule ${index + 1}`
        validateRuleIdentity('IIV', raw, label)
        assertString(raw.checkKey, `${label}.checkKey`)
        assertSecurityMetadata(raw, label, 'IIV')

        assertStringArray(raw.targetFunctions, `${label}.targetFunctions`)
        assertStringArray(raw.sourceFunctions, `${label}.sourceFunctions`)
        assertStringArray(raw.sinkFunctions, `${label}.sinkFunctions`)
        assertStringArray(raw.validatorFunctions, `${label}.validatorFunctions`)

        const hasDetectionFunctions = [
            raw.targetFunctions,
            raw.sourceFunctions,
            raw.sinkFunctions,
        ].some((value) => Array.isArray(value) && value.length > 0)

        if (!hasDetectionFunctions) {
            throw new Error(`${label} must define targetFunctions, sourceFunctions, or sinkFunctions`)
        }
    }
}

function normalizeHsdHeuristics(raw: unknown): HsdHeuristics {
    if (!isPlainObject(raw)) {
        throw new Error('HSD heuristics_json must be an object')
    }

    const placeholderSource = Array.isArray(raw.placeholderMarkers)
        ? raw.placeholderMarkers
        : raw.benignMarkers

    const heuristics: HsdHeuristics = {
        minLength: Number(raw.minLength),
        minContextLength: Number(raw.minContextLength),
        minEntropy: Number(raw.minEntropy),
        placeholderMarkers: cleanStringArray(placeholderSource),
        sensitiveKeywords: cleanStringArray(raw.sensitiveKeywords),
    }

    assertIntegerAtLeast(heuristics.minLength, 'HSD heuristics.minLength', 1)
    assertIntegerAtLeast(heuristics.minContextLength, 'HSD heuristics.minContextLength', 1)
    assertNumberAtLeast(heuristics.minEntropy, 'HSD heuristics.minEntropy', 0)
    assertStringArray(heuristics.placeholderMarkers, 'HSD heuristics.placeholderMarkers', { required: true })
    assertStringArray(heuristics.sensitiveKeywords, 'HSD heuristics.sensitiveKeywords', { required: true })

    return heuristics
}

function canonicalizeRule(component: PolicyComponentCode, raw: unknown): Record<string, unknown> {
    if (!isPlainObject(raw)) {
        throw new Error(`${component} rule must be an object`)
    }

    const common = {
        id: String(raw.id).trim(),
        name: String(raw.name).trim(),
        enabled: raw.enabled !== false,
        securitySeverity: assertOneOf(raw.securitySeverity, SECURITY_SEVERITIES, `${raw.id}.securitySeverity`),
        category: assertOneOf(raw.category, POLICY_CATEGORIES, `${raw.id}.category`),
        ...(optionalTrimmedString(raw.cwe) ? { cwe: optionalTrimmedString(raw.cwe) } : {}),
        description: String(raw.description).trim(),
        remediation: String(raw.remediation).trim(),
    }

    if (component === 'HSD') {
        return {
            ...common,
            pattern: String(raw.pattern),
            secretType: String(raw.secretType).trim(),
            provider: nullableTrimmedString(raw.provider),
            confidence: assertOneOf(
                raw.confidence ?? raw.defaultConfidence,
                CONFIDENCE_LEVELS,
                `${raw.id}.confidence`
            ),
        }
    }

    const withStaticDiagnosticContract = {
        ...common,
        severity: 'warning' as const,
        checkKey: String(raw.checkKey).trim(),
        defaultConfidence: assertOneOf(
            raw.defaultConfidence ?? raw.confidence,
            CONFIDENCE_LEVELS,
            `${raw.id}.defaultConfidence`
        ),
    }

    if (component === 'NET') {
        return {
            ...withStaticDiagnosticContract,
            messageTemplate: String(raw.messageTemplate).trim(),
        }
    }

    if (component === 'IDS') {
        return {
            ...withStaticDiagnosticContract,
            targetFunctions: cleanStringArray(raw.targetFunctions),
            requiresImport: cleanStringArray(raw.requiresImport),
        }
    }

    const targetFunctions = cleanStringArray(raw.targetFunctions)
    const sourceFunctions = cleanStringArray(raw.sourceFunctions)
    const sinkFunctions = cleanStringArray(raw.sinkFunctions)
    const validatorFunctions = cleanStringArray(raw.validatorFunctions)

    return {
        ...withStaticDiagnosticContract,
        ...(targetFunctions.length ? { targetFunctions } : {}),
        ...(sourceFunctions.length ? { sourceFunctions } : {}),
        ...(sinkFunctions.length ? { sinkFunctions } : {}),
        ...(validatorFunctions.length ? { validatorFunctions } : {}),
    }
}

function validatePolicyPayload(body: PublishPolicyRequest) {
    if (!body || !COMPONENTS.includes(body.component_code)) {
        throw new Error('Unsupported component_code')
    }

    assertRulesArray(body.rules_json)

    switch (body.component_code) {
        case 'HSD':
            validateHsdRules(body.rules_json)
            normalizeHsdHeuristics(body.heuristics_json)
            break
        case 'NET':
            validateNetRules(body.rules_json)
            break
        case 'IDS':
            validateIdsRules(body.rules_json)
            break
        case 'IIV':
            validateIivRules(body.rules_json)
            break
    }
}

function canonicalizePolicyPayload(body: PublishPolicyRequest) {
    return {
        rulesJson: body.rules_json.map((rule) => canonicalizeRule(body.component_code, rule)),
        heuristicsJson: body.component_code === 'HSD'
            ? normalizeHsdHeuristics(body.heuristics_json)
            : null,
    }
}

async function getMembership(teamId: string, userId: string) {
    const { data, error } = await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

async function getTeam(teamId: string) {
    const { data, error } = await supabaseAdmin
        .from('teams')
        .select('id, name, description, leader_id')
        .eq('id', teamId)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

async function ensureTeamMember(teamId: string, userId: string) {
    const membership = await getMembership(teamId, userId)
    if (!membership) {
        throw new Error('FORBIDDEN_TEAM')
    }

    const team = await getTeam(teamId)
    if (!team) {
        throw new Error('TEAM_NOT_FOUND')
    }

    return { membership, team }
}

async function buildTeamPolicyResponse(teamId: string): Promise<TeamPolicyResponse> {
    const team = await getTeam(teamId)
    if (!team) {
        throw new Error('TEAM_NOT_FOUND')
    }

    const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('team_policy_assignments')
        .select(`
            team_id,
            component_code,
            assigned_at,
            assigned_by,
            component_policy_versions (
                id,
                version_no,
                status,
                rules_json,
                heuristics_json,
                notes,
                created_at,
                published_at,
                component_policies (
                    id,
                    component_code,
                    name,
                    description
                )
            )
        `)
        .eq('team_id', teamId)

    if (assignmentsError) {
        throw new Error(assignmentsError.message)
    }

    const policies: TeamPolicyResponse['policies'] = {
        HSD: null,
        NET: null,
        IDS: null,
        IIV: null,
    }

    for (const row of assignments ?? []) {
        const componentCode = row.component_code as PolicyComponentCode
        const version = Array.isArray(row.component_policy_versions)
            ? row.component_policy_versions[0]
            : row.component_policy_versions

        if (!version) continue

        const policy = Array.isArray(version.component_policies)
            ? version.component_policies[0]
            : version.component_policies

        if (!policy) continue

        policies[componentCode] = {
            component_code: componentCode,
            policy_id: policy.id,
            policy_name: policy.name,
            policy_description: policy.description ?? null,
            policy_version_id: version.id,
            version_no: version.version_no,
            status: version.status,
            rules_json: Array.isArray(version.rules_json) ? version.rules_json : [],
            heuristics_json:
                version.heuristics_json && typeof version.heuristics_json === 'object'
                    ? version.heuristics_json
                    : null,
            notes: version.notes ?? null,
            assigned_at: row.assigned_at,
            published_at: version.published_at ?? null,
        }
    }

    return {
        team: {
            id: team.id,
            name: team.name,
            description: team.description ?? null,
            leader_id: team.leader_id,
        },
        policies,
    }
}

// Extension endpoint: returns the currently assigned published policies for a team.
router.get('/active', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.userId!
    const teamId = String(req.query['team_id'] ?? '').trim()

    if (!teamId) {
        res.status(400).json({ error: 'team_id query parameter is required' })
        return
    }

    try {
        await ensureTeamMember(teamId, userId)
        const response = await buildTeamPolicyResponse(teamId)

        const extensionResponse: ActivePoliciesResponse = {
            team: {
                id: response.team.id,
                name: response.team.name,
                description: response.team.description,
            },
            policies: response.policies,
        }

        res.json({ data: extensionResponse })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load active policies'

        if (message === 'FORBIDDEN_TEAM') {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        if (message === 'TEAM_NOT_FOUND') {
            res.status(404).json({ error: 'Team not found' })
            return
        }

        res.status(500).json({ error: message })
    }
})

// Web app policy read.
router.get('/team/:teamId', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.userId!
    const teamId = String(req.params.teamId)

    try {
        await ensureTeamMember(teamId, userId)
        const response = await buildTeamPolicyResponse(teamId)
        res.json({ data: response })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load team policies'

        if (message === 'FORBIDDEN_TEAM') {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        if (message === 'TEAM_NOT_FOUND') {
            res.status(404).json({ error: 'Team not found' })
            return
        }

        res.status(500).json({ error: message })
    }
})

// Web app policy publish. The backend canonicalizes the JSON before persistence so
// HSD keeps `confidence`, while NET/IDS/IIV keep `defaultConfidence`.
router.post('/team/:teamId/publish', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.userId!
    const teamId = String(req.params.teamId)
    const body = req.body as PublishPolicyRequest

    try {
        const { team } = await ensureTeamMember(teamId, userId)

        if (team.leader_id !== userId) {
            res.status(403).json({ error: 'Only the team leader can manage policies' })
            return
        }

        if (!body?.component_code) {
            res.status(400).json({ error: 'component_code is required' })
            return
        }

        validatePolicyPayload(body)
        const canonical = canonicalizePolicyPayload(body)

        const policyName =
            body.policy_name?.trim() || `Default ${body.component_code} Policy`

        const policyDescription =
            body.policy_description?.trim() ||
            `Managed from the FLUSEC web policy manager for ${body.component_code}.`

        const { data: versionId, error: rpcError } = await supabaseAdmin.rpc(
            'create_component_policy_version',
            {
                p_component_code: body.component_code,
                p_policy_name: policyName,
                p_policy_description: policyDescription,
                p_rules_json: canonical.rulesJson,
                p_heuristics_json: canonical.heuristicsJson,
                p_created_by: userId,
                p_status: 'published',
                p_notes: body.notes ?? null,
            }
        )

        if (rpcError) {
            res.status(500).json({ error: rpcError.message })
            return
        }

        const { error: assignError } = await supabaseAdmin
            .from('team_policy_assignments')
            .upsert(
                {
                    team_id: teamId,
                    component_code: body.component_code,
                    policy_version_id: versionId,
                    assigned_by: userId,
                    assigned_at: new Date().toISOString(),
                },
                {
                    onConflict: 'team_id,component_code',
                }
            )

        if (assignError) {
            res.status(500).json({ error: assignError.message })
            return
        }

        await supabaseAdmin.from('policy_audit_logs').insert({
            team_id: teamId,
            component_code: body.component_code,
            policy_version_id: versionId,
            actor_user_id: userId,
            action: 'team_assignment_changed',
            details_json: {
                source: 'web_policy_manager',
                policy_name: policyName,
                rule_count: canonical.rulesJson.length,
            },
        })

        const response = await buildTeamPolicyResponse(teamId)
        res.status(201).json({
            message: 'Policy published and assigned successfully',
            data: response,
        })
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Failed to publish policy'

        if (message === 'FORBIDDEN_TEAM') {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        if (message === 'TEAM_NOT_FOUND') {
            res.status(404).json({ error: 'Team not found' })
            return
        }

        res.status(400).json({ error: message })
    }
})

export default router
