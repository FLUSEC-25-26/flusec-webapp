import { supabase } from '@/lib/supabase'
import type {
    FindingsUploadPayload,
    ApiResponse,
    Finding,
    MemberStats,
    TimelineDataPoint,
    Team,
    TeamMember,
    TeamWithRole,
} from '@/types'
import type {
    TeamChatMessage,
    TeamMessageKind,
    TeamRoomPayload,
    TeamThreadCollection,
} from '@/types/chat'

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001'

let cachedAccessToken: string | null = null

async function getAccessToken(timeoutMs = 8000): Promise<string> {
    if (cachedAccessToken) {
        return cachedAccessToken
    }

    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timed out while reading Supabase session')), timeoutMs)
    })

    const result = await Promise.race([sessionPromise, timeoutPromise])
    const session = (result as Awaited<ReturnType<typeof supabase.auth.getSession>>).data.session

    if (!session?.access_token) {
        throw new Error('Not authenticated')
    }

    cachedAccessToken = session.access_token
    return cachedAccessToken
}

export function clearApiTokenCache() {
    cachedAccessToken = null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const accessToken = await getAccessToken()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...(options?.headers ?? {}),
            },
        })

        const text = await res.text()
        let json: any = {}

        try {
            json = text ? JSON.parse(text) : {}
        } catch {
            json = { raw: text }
        }

        if (res.status === 401) {
            cachedAccessToken = null
        }

        if (!res.ok) {
            throw new Error(json.error || `Request failed: ${res.status}`)
        }

        return json as T
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('API request timed out')
        }
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

// ─── Teams ────────────────────────────────────────────────────
export const createTeam = (name: string, description?: string) =>
    request<ApiResponse<{ team_id: string; team_code?: string; invite_code: string }>>('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
    })

export const joinTeam = (invite_code: string) =>
    request<ApiResponse<{ team_id: string; team_code?: string; team_name: string }>>('/api/teams/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code }),
    })

export const getMyTeams = () =>
    request<ApiResponse<TeamWithRole[]>>('/api/teams/my-teams')

export const getTeam = (teamId: string) =>
    request<ApiResponse<Team>>(`/api/teams/${teamId}`)

export const getTeamMembers = (teamId: string) =>
    request<ApiResponse<TeamMember[]>>(`/api/teams/${teamId}/members`)

export const regenerateInvite = (teamId: string) =>
    request<ApiResponse<Team>>(`/api/teams/${teamId}/invite/regenerate`, {
        method: 'POST',
    })

export const updateTeam = (
    teamId: string,
    payload: { name?: string; description?: string | null }
) =>
    request<ApiResponse<Team>>(`/api/teams/${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })

export const removeTeamMember = (teamId: string, userId: string) =>
    request<ApiResponse<{ message: string }>>(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
    })

// ─── Findings ─────────────────────────────────────────────────
export const uploadFindings = (payload: FindingsUploadPayload) =>
    request<ApiResponse<{ session_id: string; findings_count: number }>>('/api/findings/upload', {
        method: 'POST',
        body: JSON.stringify(payload),
    })

export const getMyFindings = (params?: { module?: string; severity?: string; limit?: number }) => {
    const qs = params
        ? '?' + new URLSearchParams(params as Record<string, string>).toString()
        : ''
    return request<ApiResponse<Finding[]>>(`/api/findings/me${qs}`)
}

export const getTeamFindings = (
    teamId: string,
    params?: {
        module?: string
        severity?: string
        status?: string
        uploaded_by?: string
        limit?: number
    }
) => {
    const qs = params
        ? '?' + new URLSearchParams(
              Object.entries(params)
                  .filter(([, value]) => value !== undefined && value !== '')
                  .reduce<Record<string, string>>((acc, [key, value]) => {
                      acc[key] = String(value)
                      return acc
                  }, {})
          ).toString()
        : ''

    return request<ApiResponse<Finding[]>>(`/api/findings/team/${teamId}${qs}`)
}

export const getMemberFindings = (userId: string) =>
    request<ApiResponse<Finding[]>>(`/api/findings/member/${userId}`)

export const getFinding = (id: string) =>
    request<ApiResponse<Finding>>(`/api/findings/${id}`)

// ─── Communication ────────────────────────────────────────────
export const getTeamThreads = (teamId: string) =>
    request<ApiResponse<TeamThreadCollection>>(`/api/chat/team/${teamId}/threads`)

export const getTeamRoomMessages = (
    teamId: string,
    params?: { finding_id?: string; limit?: number }
) => {
    const qs = params
        ? '?' + new URLSearchParams(
              Object.entries(params)
                  .filter(([, value]) => value !== undefined && value !== '')
                  .reduce<Record<string, string>>((acc, [key, value]) => {
                      acc[key] = String(value)
                      return acc
                  }, {})
          ).toString()
        : ''

    return request<ApiResponse<TeamRoomPayload>>(`/api/chat/team/${teamId}/messages${qs}`)
}

export const sendTeamMessage = (
    teamId: string,
    payload: {
        message_text: string
        finding_id?: string | null
        reply_to_message_id?: string | null
        message_kind?: TeamMessageKind
    }
) =>
    request<ApiResponse<TeamChatMessage>>(`/api/chat/team/${teamId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })

export const editTeamMessage = (messageId: string, message_text: string) =>
    request<ApiResponse<TeamChatMessage>>(`/api/chat/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message_text }),
    })

export const deleteTeamMessage = (messageId: string) =>
    request<ApiResponse<{ message: string }>>(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
    })

// ─── Member Stats ─────────────────────────────────────────────
export const getMemberStats = (userId: string) =>
    request<ApiResponse<MemberStats>>(`/api/members/${userId}/stats`)

export const getMemberTimeline = (userId: string) =>
    request<ApiResponse<TimelineDataPoint[]>>(`/api/members/${userId}/timeline`)