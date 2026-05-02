import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type {
    ActivePoliciesResponse,
    PolicyComponentCode,
} from '../types/policies'

const router = Router()

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

router.get('/active', authMiddleware, async (req: AuthRequest, res) => {
    const userId = req.userId!
    const teamId = String(req.query['team_id'] ?? '').trim()

    if (!teamId) {
        res.status(400).json({ error: 'team_id query parameter is required' })
        return
    }

    try {
        const membership = await getMembership(teamId, userId)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('id, name, description')
            .eq('id', teamId)
            .maybeSingle()

        if (teamError) {
            res.status(500).json({ error: teamError.message })
            return
        }

        if (!team) {
            res.status(404).json({ error: 'Team not found' })
            return
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
            res.status(500).json({ error: assignmentsError.message })
            return
        }

        const policies: Record<PolicyComponentCode, ActivePoliciesResponse['policies'][PolicyComponentCode]> = {
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

        const response: ActivePoliciesResponse = {
            team: {
                id: team.id,
                name: team.name,
                description: team.description ?? null,
            },
            policies,
        }

        res.json({ data: response })
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Failed to load active policies'
        res.status(500).json({ error: message })
    }
})

export default router