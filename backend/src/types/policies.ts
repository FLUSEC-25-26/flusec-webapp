export type PolicyComponentCode = 'HSD' | 'NET' | 'IDS' | 'IIV'
export type PolicyVersionStatus = 'draft' | 'published' | 'archived'

export interface ActivePolicyRow {
    team_id: string
    component_code: PolicyComponentCode
    assigned_at: string
    assigned_by: string | null

    policy_id: string
    policy_name: string
    policy_description: string | null

    policy_version_id: string
    version_no: number
    status: PolicyVersionStatus

    rules_json: unknown[]
    heuristics_json: Record<string, unknown> | null
    notes: string | null
    version_created_at: string
    published_at: string | null
}

export interface ActivePolicyComponentPayload {
    component_code: PolicyComponentCode
    policy_id: string
    policy_name: string
    policy_description: string | null
    policy_version_id: string
    version_no: number
    status: PolicyVersionStatus
    rules_json: unknown[]
    heuristics_json: Record<string, unknown> | null
    notes: string | null
    assigned_at: string
    published_at: string | null
}

export interface ActivePoliciesResponse {
    team: {
        id: string
        name: string
        description?: string | null
    }
    policies: Record<PolicyComponentCode, ActivePolicyComponentPayload | null>
}