import { supabase } from '@/lib/supabase'
import type { FindingsUploadPayload, ApiResponse, Finding, MemberStats, TimelineDataPoint } from '@/types'

const API_BASE = '/api'

async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
    }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers } })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Request failed')
    return json
}

// ─── Teams ────────────────────────────────────────────────────
export const createTeam = (name: string, description?: string) =>
    request<ApiResponse<{ team_id: string; invite_code: string }>>('/teams', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
    })

export const joinTeam = (invite_code: string) =>
    request<ApiResponse<{ team_id: string }>>('/teams/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code }),
    })

export const getTeam = (teamId: string) =>
    request<ApiResponse<{ team: object; members: object[] }>>(`/teams/${teamId}`)

export const getTeamMembers = (teamId: string) =>
    request<ApiResponse<object[]>>(`/teams/${teamId}/members`)

export const regenerateInvite = (teamId: string) =>
    request<ApiResponse<{ invite_code: string }>>(`/teams/${teamId}/invite/regenerate`, { method: 'POST' })

// ─── Findings ─────────────────────────────────────────────────
export const uploadFindings = (payload: FindingsUploadPayload) =>
    request<ApiResponse<{ session_id: string; findings_count: number }>>('/findings/upload', {
        method: 'POST',
        body: JSON.stringify(payload),
    })

export const getMyFindings = (params?: { module?: string; severity?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return request<ApiResponse<Finding[]>>(`/findings/me${qs}`)
}

export const getTeamFindings = (teamId: string) =>
    request<ApiResponse<Finding[]>>(`/findings/team/${teamId}`)

export const getMemberFindings = (userId: string) =>
    request<ApiResponse<Finding[]>>(`/findings/member/${userId}`)

// ─── Member Stats ─────────────────────────────────────────────
export const getMemberStats = (userId: string) =>
    request<ApiResponse<MemberStats>>(`/members/${userId}/stats`)

export const getMemberTimeline = (userId: string) =>
    request<ApiResponse<TimelineDataPoint[]>>(`/members/${userId}/timeline`)
