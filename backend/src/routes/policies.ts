import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type {
    ActivePoliciesResponse,
    PolicyComponentCode,
    PublishPolicyRequest,
    TeamPolicyResponse,
} from '../types/policies'

const router = Router()

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field} is required`)
    }
}

function assertRulesArray(value: unknown) {
    if (!Array.isArray(value)) {
        throw new Error('rules_json must be an array')
    }
}

function validateHsdRules(rules: unknown[]) {
    for (const [index, rule] of rules.entries()) {
        if (!isPlainObject(rule)) throw new Error(`HSD rule ${index + 1} must be an object`)
        assertString(rule.id, `HSD rule ${index + 1}.id`)
        assertString(rule.name, `HSD rule ${index + 1}.name`)
        assertString(rule.pattern, `HSD rule ${index + 1}.pattern`)
        assertString(rule.severity, `HSD rule ${index + 1}.severity`)
        assertString(rule.description, `HSD rule ${index + 1}.description`)
    }
}

function validateNetRules(rules: unknown[]) {
    for (const [index, rule] of rules.entries()) {
        if (!isPlainObject(rule)) throw new Error(`NET rule ${index + 1} must be an object`)
        assertString(rule.id, `NET rule ${index + 1}.id`)
        assertString(rule.name, `NET rule ${index + 1}.name`)
        assertString(rule.checkKey, `NET rule ${index + 1}.checkKey`)
        assertString(rule.severity, `NET rule ${index + 1}.severity`)
        assertString(rule.messageTemplate, `NET rule ${index + 1}.messageTemplate`)
        assertString(rule.description, `NET rule ${index + 1}.description`)
    }
}

function validateIdsRules(rules: unknown[]) {
    for (const [index, rule] of rules.entries()) {
        if (!isPlainObject(rule)) throw new Error(`IDS rule ${index + 1} must be an object`)
        assertString(rule.id, `IDS rule ${index + 1}.id`)
        assertString(rule.name, `IDS rule ${index + 1}.name`)
        assertString(rule.checkKey, `IDS rule ${index + 1}.checkKey`)
        assertString(rule.severity, `IDS rule ${index + 1}.severity`)
        assertString(rule.category, `IDS rule ${index + 1}.category`)
        assertString(rule.riskLevel, `IDS rule ${index + 1}.riskLevel`)
        assertString(rule.description, `IDS rule ${index + 1}.description`)
        assertString(rule.remediation, `IDS rule ${index + 1}.remediation`)

        if (!Array.isArray(rule.patterns)) {
            throw new Error(`IDS rule ${index + 1}.patterns must be an array`)
        }
        if (!Array.isArray(rule.dataTypes)) {
            throw new Error(`IDS rule ${index + 1}.dataTypes must be an array`)
        }
        if (!Array.isArray(rule.requiresImport)) {
            throw new Error(`IDS rule ${index + 1}.requiresImport must be an array`)
        }
    }
}

function validateIivRules(rules: unknown[]) {
    for (const [index, rule] of rules.entries()) {
        if (!isPlainObject(rule)) throw new Error(`IIV rule ${index + 1} must be an object`)
        assertString(rule.id, `IIV rule ${index + 1}.id`)
        assertString(rule.name, `IIV rule ${index + 1}.name`)
        assertString(rule.checkKey, `IIV rule ${index + 1}.checkKey`)
        assertString(rule.severity, `IIV rule ${index + 1}.severity`)
        assertString(rule.description, `IIV rule ${index + 1}.description`)
        assertString(rule.remediation, `IIV rule ${index + 1}.remediation`)
        if (!Array.isArray(rule.targetFunctions)) {
            throw new Error(`IIV rule ${index + 1}.targetFunctions must be an array`)
        }
    }
}

function validatePolicyPayload(body: PublishPolicyRequest) {
    assertRulesArray(body.rules_json)

    switch (body.component_code) {
        case 'HSD':
            validateHsdRules(body.rules_json)
            if (body.heuristics_json != null && !isPlainObject(body.heuristics_json)) {
                throw new Error('HSD heuristics_json must be an object')
            }
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
        default:
            throw new Error('Unsupported component_code')
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

// Extension endpoint
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

// Web app policy read
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

// Web app policy publish
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

        const policyName =
            body.policy_name?.trim() || `Default ${body.component_code} Policy`

        const policyDescription =
            body.policy_description?.trim() ||
            `Managed from the FluSec web policy manager for ${body.component_code}.`

        const { data: versionId, error: rpcError } = await supabaseAdmin.rpc(
            'create_component_policy_version',
            {
                p_component_code: body.component_code,
                p_policy_name: policyName,
                p_policy_description: policyDescription,
                p_rules_json: body.rules_json,
                p_heuristics_json:
                    body.component_code === 'HSD'
                        ? body.heuristics_json ?? {}
                        : null,
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