import { supabase } from '@/lib/supabase'
import type {
  ApiResponse,
  Finding,
  FlusecComponent,
  MemberStats,
  SecuritySeverity,
  Team,
  TeamMember,
  TeamWithRole,
  TimelineDataPoint,
} from '@/types'
import type {
  TeamChatMessage,
  TeamMessageKind,
  TeamRoomPayload,
  TeamThreadCollection,
} from '@/types/chat'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001'
const API_PREFIX = '/api/v1'

async function readSessionToken(refresh = false): Promise<string> {
  if (refresh) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? 'Session expired. Please sign in again.')
    }
    return data.session.access_token
  }

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? 'Not authenticated')
  }
  return data.session.access_token
}

async function executeRequest<T>(path: string, options: RequestInit | undefined, token: string) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    })

    const text = await response.text()
    let body: any = {}
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }

    return { response, body }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    let token = await readSessionToken(false)
    let result = await executeRequest<T>(path, options, token)

    if (result.response.status === 401) {
      token = await readSessionToken(true)
      result = await executeRequest<T>(path, options, token)
    }

    if (!result.response.ok) {
      throw new Error(result.body?.error ?? `Request failed: ${result.response.status}`)
    }
    return result.body as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('API request timed out')
    }
    throw error
  }
}

// Retained so older store imports do not break; tokens are no longer cached.
export function clearApiTokenCache() {}

export const createTeam = (name: string, description?: string) =>
  apiRequest<ApiResponse<{ team_id: string; team_code?: string; invite_code: string }>>(
    `${API_PREFIX}/teams`,
    { method: 'POST', body: JSON.stringify({ name, description }) }
  )

export const joinTeam = (invite_code: string) =>
  apiRequest<ApiResponse<{ team_id: string; team_code?: string; team_name: string }>>(
    `${API_PREFIX}/teams/join`,
    { method: 'POST', body: JSON.stringify({ invite_code }) }
  )

export const getMyTeams = () =>
  apiRequest<ApiResponse<TeamWithRole[]>>(`${API_PREFIX}/teams/my-teams`)

export const getTeam = (teamId: string) =>
  apiRequest<ApiResponse<Team>>(`${API_PREFIX}/teams/${teamId}`)

export const getTeamMembers = (teamId: string) =>
  apiRequest<ApiResponse<TeamMember[]>>(`${API_PREFIX}/teams/${teamId}/members`)

export const regenerateInvite = (teamId: string) =>
  apiRequest<ApiResponse<Team>>(`${API_PREFIX}/teams/${teamId}/invite/regenerate`, {
    method: 'POST',
  })

export const updateTeam = (
  teamId: string,
  payload: { name?: string; description?: string | null }
) =>
  apiRequest<ApiResponse<Team>>(`${API_PREFIX}/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const removeTeamMember = (teamId: string, userId: string) =>
  apiRequest<ApiResponse<{ message: string }>>(
    `${API_PREFIX}/teams/${teamId}/members/${userId}`,
    { method: 'DELETE' }
  )

export const getMyFindings = (params?: {
  component?: FlusecComponent
  security_severity?: SecuritySeverity
  status?: string
  limit?: number
}) => {
  const qs = toQuery(params)
  return apiRequest<ApiResponse<Finding[]>>(`${API_PREFIX}/findings/me${qs}`)
}

export const getTeamFindings = (
  teamId: string,
  params?: {
    component?: FlusecComponent
    security_severity?: SecuritySeverity
    status?: string
    uploaded_by?: string
    limit?: number
  }
) => apiRequest<ApiResponse<Finding[]>>(`${API_PREFIX}/findings/team/${teamId}${toQuery(params)}`)

export const getMemberFindings = (teamId: string, userId: string) =>
  apiRequest<ApiResponse<Finding[]>>(
    `${API_PREFIX}/findings/member/${userId}?team_id=${encodeURIComponent(teamId)}`
  )

export const getFinding = (id: string) =>
  apiRequest<ApiResponse<Finding>>(`${API_PREFIX}/findings/${id}`)

export const getTeamThreads = (teamId: string) =>
  apiRequest<ApiResponse<TeamThreadCollection>>(`${API_PREFIX}/chat/team/${teamId}/threads`)

export const getTeamRoomMessages = (
  teamId: string,
  params?: { finding_id?: string; limit?: number }
) =>
  apiRequest<ApiResponse<TeamRoomPayload>>(
    `${API_PREFIX}/chat/team/${teamId}/messages${toQuery(params)}`
  )

export const sendTeamMessage = (
  teamId: string,
  payload: {
    message_text: string
    finding_id?: string | null
    reply_to_message_id?: string | null
    message_kind?: TeamMessageKind
  }
) =>
  apiRequest<ApiResponse<TeamChatMessage>>(`${API_PREFIX}/chat/team/${teamId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const editTeamMessage = (messageId: string, message_text: string) =>
  apiRequest<ApiResponse<TeamChatMessage>>(`${API_PREFIX}/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ message_text }),
  })

export const deleteTeamMessage = (messageId: string) =>
  apiRequest<ApiResponse<{ message: string }>>(`${API_PREFIX}/chat/messages/${messageId}`, {
    method: 'DELETE',
  })

export const getMemberStats = (teamId: string, userId: string) =>
  apiRequest<ApiResponse<MemberStats>>(
    `${API_PREFIX}/members/${userId}/stats?team_id=${encodeURIComponent(teamId)}`
  )

export const getMemberTimeline = (teamId: string, userId: string) =>
  apiRequest<ApiResponse<TimelineDataPoint[]>>(
    `${API_PREFIX}/members/${userId}/timeline?team_id=${encodeURIComponent(teamId)}`
  )

function toQuery(params?: object): string {
  if (!params) return ''
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}
