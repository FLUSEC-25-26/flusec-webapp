import { supabase } from '@/lib/supabase'
import type { PublishPolicyRequest, TeamPolicyResponse } from '@/types/policies'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001'

let cachedAccessToken: string | null = null

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    console.log('[policyApi] using cached access token')
    return cachedAccessToken
  }

  console.log('[policyApi] getting session...')

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  if (!session?.access_token) {
    throw new Error('No active session found')
  }

  cachedAccessToken = session.access_token
  console.log('[policyApi] session ok')
  return cachedAccessToken
}

export function clearPolicyApiTokenCache() {
  cachedAccessToken = null
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const url = `${API_BASE_URL}${path}`

  console.log('[policyApi] start ->', method, url)

  const accessToken = await getAccessToken()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    console.log('[policyApi] request ->', method, url)

    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    })

    const text = await res.text()
    let json: any = {}

    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = { raw: text }
    }

    console.log('[policyApi] response <-', res.status, url, json)

    if (res.status === 401) {
      cachedAccessToken = null
    }

    if (!res.ok) {
      throw new Error(json?.error ?? `Request failed: ${res.status}`)
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

export async function getTeamPolicies(teamId: string) {
  return apiFetch<{ data: TeamPolicyResponse }>(`/api/policies/team/${teamId}`)
}

export async function publishTeamPolicy(teamId: string, payload: PublishPolicyRequest) {
  return apiFetch<{ message: string; data: TeamPolicyResponse }>(
    `/api/policies/team/${teamId}/publish`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}