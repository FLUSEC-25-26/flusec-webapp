import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'
import type {
    ActivePolicyRow,
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

// GET /api/policies/active?team_id=<uuid>
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

        const { data: rows, error: policiesError } = await supabaseAdmin
            .schema('private')
            .from('v_active_team_component_policies')
            .select(`
                team_id,
                component_code,
                assigned_at,
                assigned_by,
                policy_id,
                policy_name,
                policy_description,
                policy_version_id,
                version_no,
                status,
                rules_json,
                heuristics_json,
                notes,
                version_created_at,
                published_at
            `)
            .eq('team_id', teamId)
            .order('component_code', { ascending: true })

        if (policiesError) {
            res.status(500).json({ error: policiesError.message })
            return
        }

        const policies: Record<PolicyComponentCode, ActivePoliciesResponse['policies'][PolicyComponentCode]> = {
            HSD: null,
            NET: null,
            IDS: null,
            IIV: null,
        }

        for (const raw of (rows ?? []) as ActivePolicyRow[]) {
            policies[raw.component_code] = {
                component_code: raw.component_code,
                policy_id: raw.policy_id,
                policy_name: raw.policy_name,
                policy_description: raw.policy_description,
                policy_version_id: raw.policy_version_id,
                version_no: raw.version_no,
                status: raw.status,
                rules_json: Array.isArray(raw.rules_json) ? raw.rules_json : [],
                heuristics_json:
                    raw.heuristics_json && typeof raw.heuristics_json === 'object'
                        ? raw.heuristics_json
                        : null,
                notes: raw.notes,
                assigned_at: raw.assigned_at,
                published_at: raw.published_at,
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