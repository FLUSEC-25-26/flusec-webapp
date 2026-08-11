import type {
  DetectionConfidence,
  FlusecComponent,
  NormalizedFinding,
  RawFinding,
  SecuritySeverity,
  TaintFlowStep,
} from '../types'

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? value as T[] : null
}

function workspaceRelativePath(value: unknown): string | null {
  const path = asString(value)?.replace(/\\/g, '/') ?? null
  if (!path) return null
  if (path.startsWith('/') || /^[A-Za-z]:\//.test(path)) {
    throw new Error('Finding file_path must be workspace-relative; absolute machine paths are not accepted')
  }
  if (path.split('/').includes('..')) {
    throw new Error('Finding file_path may not escape the workspace')
  }
  return path.replace(/^\.\//, '')
}

function normalizeComponent(raw: unknown): FlusecComponent {
  const value = String(raw ?? '').trim().toUpperCase()
  if (value === 'HSD' || value === 'NET' || value === 'IDS' || value === 'IIV') {
    return value
  }
  throw new Error(`Unsupported FLUSEC component: ${value || '(empty)'}`)
}

function normalizeSecuritySeverity(raw: unknown): SecuritySeverity {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  throw new Error(`Invalid securitySeverity: ${value || '(empty)'}`)
}

function normalizeConfidence(raw: unknown): DetectionConfidence {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'high' || value === 'medium' || value === 'low') return value
  throw new Error(`Invalid confidence: ${value || '(empty)'}`)
}

function normalizeFingerprint(raw: unknown): string {
  const value = asString(raw)?.toLowerCase() ?? ''
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error('Every finding must include the 64-character SHA-256 fingerprint emitted by the FLUSEC analyzer')
  }
  return value
}

function normalizeMaintainabilityLevel(raw: unknown): string | null {
  const value = asString(raw)?.toLowerCase().replace(/[\s-]+/g, '_') ?? null
  if (!value) return null
  return ['low', 'moderate', 'high', 'very_high'].includes(value) ? value : null
}

export function normalizeFinding(finding: RawFinding): NormalizedFinding {
  const component = normalizeComponent(finding.component)

  // Security impact is analyzer metadata only. Complexity, nesting depth,
  // function size and MCS are contextual maintainability metrics and never
  // participate in this value.
  const securitySeverity = normalizeSecuritySeverity(
    finding.securitySeverity ?? finding.security_severity,
  )

  return {
    component,
    fingerprint: normalizeFingerprint(finding.fingerprint),
    rule_id: asString(finding.ruleId ?? finding.rule_id),
    title: asString(finding.title ?? finding.message) ?? 'Security finding',
    description: asString(finding.description ?? finding.message),
    // Current FLUSEC security diagnostics are always warnings in the editor.
    diagnostic_severity: 'warning',
    security_severity: securitySeverity,
    confidence: normalizeConfidence(finding.confidence),
    category: asString(finding.category),
    cwe: asString(finding.cwe),
    remediation: asString(finding.remediation),
    evidence: asObject(finding.evidence),
    file_path: workspaceRelativePath(finding.file ?? finding.filePath ?? finding.file_path),
    line_number: asNumber(finding.line ?? finding.lineNumber ?? finding.line_number),
    column_number: asNumber(finding.column ?? finding.columnNumber ?? finding.column_number),
    code_snippet: asString(finding.codeSnippet ?? finding.code_snippet ?? finding.snippet),
    function_name: asString(finding.functionName ?? finding.function_name),
    complexity: asNumber(finding.complexity),
    nesting_depth: asNumber(finding.nestingDepth ?? finding.nesting_depth),
    function_loc: asNumber(finding.functionLoc ?? finding.function_loc),
    maintainability_score: asNumber(
      finding.maintainabilityScore ?? finding.maintainability_score,
    ),
    maintainability_level: normalizeMaintainabilityLevel(
      finding.maintainabilityLevel ?? finding.maintainability_level,
    ),
    secret_type:
      component === 'HSD' ? asString(finding.secretType ?? finding.secret_type) : null,
    taint_flow:
      component === 'HSD'
        ? asArray<TaintFlowStep>(finding.taintFlow ?? finding.taint_flow)
        : null,
    data_type:
      component === 'IDS' ? asString(finding.dataType ?? finding.data_type) : null,
    storage_context:
      component === 'IDS'
        ? asString(finding.storageContext ?? finding.storage_context)
        : null,
  }
}
