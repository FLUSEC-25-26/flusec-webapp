import { apiRequest } from '@/lib/api'
import type { PublishPolicyRequest, TeamPolicyResponse } from '@/types/policies'

export function clearPolicyApiTokenCache() {}

export async function getTeamPolicies(teamId: string) {
  return apiRequest<{ data: TeamPolicyResponse }>(`/api/v1/policies/team/${teamId}`)
}

export async function publishTeamPolicy(teamId: string, payload: PublishPolicyRequest) {
  return apiRequest<{ message: string; data: TeamPolicyResponse }>(
    `/api/v1/policies/team/${teamId}/publish`,
    { method: 'POST', body: JSON.stringify(payload) }
  )
}
