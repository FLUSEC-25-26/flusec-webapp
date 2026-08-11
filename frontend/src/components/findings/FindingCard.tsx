import type { Finding, SecuritySeverity } from '@/types'
import { AlertTriangle, Braces, Database, ExternalLink, KeyRound, Network, ShieldCheck } from 'lucide-react'

const COMPONENT_ICON = {
  HSD: KeyRound,
  NET: Network,
  IDS: Database,
  IIV: ShieldCheck,
}

export function severityBadgeClass(severity: SecuritySeverity) {
  if (severity === 'critical') return 'badge-critical'
  if (severity === 'high') return 'badge-high'
  if (severity === 'medium') return 'badge-medium'
  return 'badge-low'
}

export function componentChipClass(component: Finding['component']) {
  return `chip-${component.toLowerCase()}`
}

export function shortPath(path?: string | null) {
  if (!path) return 'Unknown file'
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.slice(-2).join('/') || normalized
}

function EvidenceGrid({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([key, value]) =>
    key !== 'maintainabilityContext' && value !== undefined && value !== null && value !== ''
  )
  if (entries.length === 0) return <p className="text-sm text-gray-500">No additional structured evidence.</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {entries.slice(0, 14).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-surface-border bg-surface-tertiary p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">{key}</p>
          <p className="text-xs text-gray-200 mt-1 break-words font-mono">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function Maintainability({ finding }: { finding: Finding }) {
  const hasContext = [
    finding.complexity,
    finding.nesting_depth,
    finding.function_loc,
    finding.maintainability_score,
  ].some((value) => typeof value === 'number')

  if (!hasContext) return <p className="text-sm text-gray-500">No enclosing function-level maintainability context is available for this finding.</p>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Metric label="MCS" value={finding.maintainability_score ?? '—'} suffix={typeof finding.maintainability_score === 'number' ? '/100' : ''} />
        <Metric label="Level" value={finding.maintainability_level ?? '—'} />
        <Metric label="Complexity" value={finding.complexity ?? '—'} />
        <Metric label="Nesting" value={finding.nesting_depth ?? '—'} />
        <Metric label="Function LOC" value={finding.function_loc ?? '—'} />
      </div>
      <p className="text-xs text-gray-500">Maintainability context is independent of security severity and detection confidence.</p>
    </div>
  )
}

function Metric({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
  return <div className="rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p><p className="text-sm font-semibold text-gray-200 mt-1 capitalize">{value}{suffix}</p></div>
}

export default function FindingCard({ finding, compact = false }: { finding: Finding; compact?: boolean }) {
  const Icon = COMPONENT_ICON[finding.component]
  const evidence = finding.evidence && typeof finding.evidence === 'object' ? finding.evidence : {}

  return (
    <article className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={severityBadgeClass(finding.security_severity)}>{finding.security_severity}</span>
            <span className={componentChipClass(finding.component)}><Icon className="w-3 h-3" />{finding.component}</span>
            <span className="badge-info">Confidence: {finding.confidence}</span>
            <span className="text-xs font-mono text-gray-500">{finding.rule_id ?? 'Rule unavailable'}</span>
          </div>
          <h3 className="text-base font-semibold text-white break-words">{finding.title}</h3>
          {finding.description && finding.description !== finding.title && <p className="text-sm text-gray-400 mt-1">{finding.description}</p>}
        </div>
        <span className={`badge ${finding.status === 'resolved' ? 'badge-low' : finding.status === 'in_progress' ? 'badge-medium' : 'badge-info'}`}>{finding.status.replace('_', ' ')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
        <span>{shortPath(finding.file_path)}{finding.line_number ? `:${finding.line_number}` : ''}{finding.column_number ? `:${finding.column_number}` : ''}</span>
        {finding.function_name && <span className="font-mono">{finding.function_name}()</span>}
        {finding.cwe && <span className="font-mono">{finding.cwe}</span>}
      </div>

      {finding.remediation && (
        <div className="rounded-lg border border-brand-700/30 bg-brand-600/5 p-3">
          <p className="text-xs font-semibold text-brand-300 mb-1">Recommended remediation</p>
          <p className="text-sm text-gray-300">{finding.remediation}</p>
        </div>
      )}

      {!compact && (
        <div className="space-y-2">
          <details className="rounded-lg border border-surface-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-gray-500" />Evidence</summary>
            <div className="mt-3"><EvidenceGrid evidence={evidence} /></div>
          </details>

          <details className="rounded-lg border border-surface-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-200 flex items-center gap-2"><Braces className="w-4 h-4 text-gray-500" />Maintainability Context</summary>
            <div className="mt-3"><Maintainability finding={finding} /></div>
          </details>

          {finding.component === 'HSD' && Array.isArray(finding.taint_flow) && finding.taint_flow.length > 0 && (
            <details className="rounded-lg border border-surface-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-200">Taint Flow · {finding.taint_flow.length} steps</summary>
              <ol className="mt-3 space-y-3 border-l border-surface-border ml-2 pl-4">
                {finding.taint_flow.map((step, index) => (
                  <li key={`${step.type}-${step.line}-${index}`} className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-500" />
                    <p className="text-xs font-semibold text-gray-200">{step.type ?? 'FLOW STEP'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.description ?? 'Secret-derived value propagated.'}</p>
                    {step.line && <p className="text-[10px] text-gray-600 mt-1">Line {step.line}{step.column ? `, column ${step.column}` : ''}</p>}
                  </li>
                ))}
              </ol>
            </details>
          )}

          <details className="rounded-lg border border-surface-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-200">Technical Details</summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
              <Metric label="Fingerprint" value={finding.fingerprint} />
              <Metric label="Diagnostic Severity" value={finding.diagnostic_severity} />
              <Metric label="Category" value={finding.category ?? '—'} />
              <Metric label="First Seen" value={new Date(finding.first_seen_at).toLocaleString()} />
              <Metric label="Last Seen" value={new Date(finding.last_seen_at).toLocaleString()} />
              <Metric label="Uploader" value={finding.profile?.full_name ?? finding.uploaded_by} />
            </div>
          </details>
        </div>
      )}
    </article>
  )
}

export function EmptyFindings({ label = 'No findings match the current filters.' }: { label?: string }) {
  return <div className="card text-center py-12"><ShieldCheck className="w-10 h-10 text-brand-400 mx-auto" /><p className="text-sm font-semibold text-white mt-3">No findings</p><p className="text-sm text-gray-500 mt-1">{label}</p></div>
}
