export type PolicyComponentCode = 'HSD' | 'NET' | 'IDS' | 'IIV'
export type PolicyVersionStatus = 'draft' | 'published' | 'archived'
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low'
export type DetectionConfidence = 'high' | 'medium' | 'low'
export type PolicyCategory = 'vulnerability' | 'secure_coding'

export interface HsdHeuristics {
  minLength: number
  minContextLength: number
  minEntropy: number
  placeholderMarkers: string[]
  sensitiveKeywords: string[]
}

export interface HsdRule {
  id: string
  name: string
  pattern: string
  enabled: boolean
  secretType: string
  provider: string | null
  securitySeverity: SecuritySeverity
  confidence: DetectionConfidence
  category: PolicyCategory
  cwe?: string
  description: string
  remediation: string
}

export interface NetRule {
  id: string
  name: string
  checkKey: string
  enabled: boolean
  severity: 'warning'
  securitySeverity: SecuritySeverity
  defaultConfidence: DetectionConfidence
  category: PolicyCategory
  cwe?: string
  description: string
  messageTemplate: string
  remediation: string
}

export interface IdsRule {
  id: string
  name: string
  checkKey: string
  enabled: boolean
  severity: 'warning'
  securitySeverity: SecuritySeverity
  defaultConfidence: DetectionConfidence
  category: PolicyCategory
  cwe?: string
  description: string
  remediation: string
  targetFunctions: string[]
  requiresImport: string[]
}

export interface IivRule {
  id: string
  name: string
  checkKey: string
  enabled: boolean
  severity: 'warning'
  securitySeverity: SecuritySeverity
  defaultConfidence: DetectionConfidence
  category: PolicyCategory
  cwe?: string
  description: string
  remediation: string
  targetFunctions?: string[]
  sourceFunctions?: string[]
  sinkFunctions?: string[]
  validatorFunctions?: string[]
}

export type PolicyRule = HsdRule | NetRule | IdsRule | IivRule

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

export interface TeamPolicyResponse {
  team: {
    id: string
    name: string
    description?: string | null
    leader_id: string
  }
  policies: Record<PolicyComponentCode, ActivePolicyComponentPayload | null>
}

export interface PublishPolicyRequest {
  component_code: PolicyComponentCode
  policy_name?: string
  policy_description?: string | null
  rules_json: unknown[]
  heuristics_json?: Record<string, unknown> | null
  notes?: string | null
}
