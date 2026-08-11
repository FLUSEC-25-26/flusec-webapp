export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low'
export type DetectionConfidence = 'high' | 'medium' | 'low'
export type DiagnosticSeverity = 'warning'
export type FlusecComponent = 'HSD' | 'NET' | 'IDS' | 'IIV'
export type FindingStatus = 'open' | 'in_progress' | 'resolved'
export type ScanScope = 'file' | 'project'

export interface TaintFlowStep {
  type?: string
  line?: number | null
  column?: number | null
  description?: string | null
}

/**
 * Finding payload accepted by the versioned API. The extension sends the
 * canonical snake_case fields; camelCase aliases remain only for analyzer/web
 * migration safety during this release.
 */
export interface RawFinding {
  component?: string
  fingerprint?: string
  ruleId?: string
  rule_id?: string

  title?: string
  message?: string
  description?: string

  severity?: string
  diagnosticSeverity?: string
  diagnostic_severity?: string
  securitySeverity?: string
  security_severity?: string
  confidence?: string
  category?: string
  cwe?: string
  remediation?: string
  evidence?: Record<string, unknown> | null

  file?: string
  filePath?: string
  file_path?: string
  line?: number
  lineNumber?: number
  line_number?: number
  column?: number
  columnNumber?: number
  column_number?: number
  codeSnippet?: string
  code_snippet?: string
  snippet?: string

  functionName?: string | null
  function_name?: string | null
  complexity?: number | null
  nestingDepth?: number | null
  nesting_depth?: number | null
  functionLoc?: number | null
  function_loc?: number | null
  maintainabilityScore?: number | null
  maintainability_score?: number | null
  maintainabilityLevel?: string | null
  maintainability_level?: string | null

  secretType?: string | null
  secret_type?: string | null
  taintFlow?: TaintFlowStep[] | null
  taint_flow?: TaintFlowStep[] | null

  dataType?: string | null
  data_type?: string | null
  storageContext?: string | null
  storage_context?: string | null
}

export interface NormalizedFinding {
  component: FlusecComponent
  fingerprint: string
  rule_id: string | null
  title: string
  description: string | null
  diagnostic_severity: DiagnosticSeverity
  security_severity: SecuritySeverity
  confidence: DetectionConfidence
  category: string | null
  cwe: string | null
  remediation: string | null
  evidence: Record<string, unknown>
  file_path: string | null
  line_number: number | null
  column_number: number | null
  code_snippet: string | null
  function_name: string | null
  complexity: number | null
  nesting_depth: number | null
  function_loc: number | null
  maintainability_score: number | null
  maintainability_level: string | null
  secret_type: string | null
  taint_flow: TaintFlowStep[] | null
  data_type: string | null
  storage_context: string | null
}
