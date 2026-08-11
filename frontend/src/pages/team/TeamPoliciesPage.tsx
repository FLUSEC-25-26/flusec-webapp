import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeamPolicies, publishTeamPolicy } from '@/lib/policyApi'
import { useAuthStore } from '@/stores/authStore'
import type { PolicyComponentCode, TeamPolicyResponse } from '@/types/policies'
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'

type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low'
type DetectionConfidence = 'high' | 'medium' | 'low'

type Rule = {
  id: string
  name: string
  severity: 'warning'
  securitySeverity: SecuritySeverity
  defaultConfidence: DetectionConfidence
  category: string
  description: string
  remediation: string
  cwe?: string
  enabled?: boolean
  pattern?: string
  secretType?: string
  checkKey?: string
  messageTemplate?: string
  patterns?: string[]
  dataTypes?: string[]
  requiresImport?: string[]
  targetFunctions?: string[]
  [key: string]: unknown
}

type HsdHeuristics = {
  minLength: number
  minEntropy: number
  benignMarkers: string[]
  sensitiveKeywords: string[]
}

type ComponentEditor = {
  policy_name: string
  policy_description: string
  notes: string
  rules_json: Rule[]
  heuristics_json?: HsdHeuristics | null
}

type EditorState = Record<PolicyComponentCode, ComponentEditor>

const COMPONENTS: PolicyComponentCode[] = ['HSD', 'NET', 'IDS', 'IIV']
const DEFAULT_CATEGORY: Record<PolicyComponentCode, string> = {
  HSD: 'vulnerability',
  NET: 'vulnerability',
  IDS: 'vulnerability',
  IIV: 'vulnerability',
}

function csvToArray(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function arrayToCsv(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function blankRule(component: PolicyComponentCode): Rule {
  const base: Rule = {
    id: `FLUSEC.${component}.`,
    name: '',
    severity: 'warning',
    securitySeverity: 'medium',
    defaultConfidence: 'medium',
    category: DEFAULT_CATEGORY[component],
    description: '',
    remediation: '',
    enabled: true,
  }
  if (component === 'HSD') return { ...base, pattern: '', secretType: 'GENERIC_SECRET', cwe: 'CWE-798' }
  if (component === 'NET') return { ...base, checkKey: '', messageTemplate: '', cwe: 'CWE-319' }
  if (component === 'IDS') return { ...base, checkKey: '', patterns: [], dataTypes: [], requiresImport: [], targetFunctions: [], cwe: 'CWE-312' }
  return { ...base, checkKey: '', targetFunctions: [], cwe: 'CWE-20' }
}

function emptyEditor(): EditorState {
  return {
    HSD: {
      policy_name: 'Default HSD Policy',
      policy_description: '',
      notes: '',
      rules_json: [],
      heuristics_json: { minLength: 10, minEntropy: 3.3, benignMarkers: [], sensitiveKeywords: [] },
    },
    NET: { policy_name: 'Default NET Policy', policy_description: '', notes: '', rules_json: [] },
    IDS: { policy_name: 'Default IDS Policy', policy_description: '', notes: '', rules_json: [] },
    IIV: { policy_name: 'Default IIV Policy', policy_description: '', notes: '', rules_json: [] },
  }
}

function normalizeRule(component: PolicyComponentCode, raw: unknown): Rule {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    ...source,
    id: String(source.id ?? ''),
    name: String(source.name ?? ''),
    severity: 'warning',
    securitySeverity: String(source.securitySeverity ?? 'medium').toLowerCase() as SecuritySeverity,
    defaultConfidence: String(source.defaultConfidence ?? source.confidence ?? 'medium').toLowerCase() as DetectionConfidence,
    category: String(source.category ?? DEFAULT_CATEGORY[component]),
    description: String(source.description ?? ''),
    remediation: String(source.remediation ?? ''),
    cwe: source.cwe ? String(source.cwe) : undefined,
    enabled: source.enabled !== false,
    pattern: source.pattern != null ? String(source.pattern) : undefined,
    secretType: source.secretType != null ? String(source.secretType) : undefined,
    checkKey: source.checkKey != null ? String(source.checkKey) : undefined,
    messageTemplate: source.messageTemplate != null ? String(source.messageTemplate) : undefined,
    patterns: Array.isArray(source.patterns) ? source.patterns.map(String) : undefined,
    dataTypes: Array.isArray(source.dataTypes) ? source.dataTypes.map(String) : undefined,
    requiresImport: Array.isArray(source.requiresImport) ? source.requiresImport.map(String) : undefined,
    targetFunctions: Array.isArray(source.targetFunctions) ? source.targetFunctions.map(String) : undefined,
  }
}

function buildEditor(data: TeamPolicyResponse): EditorState {
  const result = emptyEditor()
  for (const component of COMPONENTS) {
    const item = data.policies[component]
    if (!item) continue
    result[component] = {
      policy_name: item.policy_name,
      policy_description: item.policy_description ?? '',
      notes: item.notes ?? '',
      rules_json: (item.rules_json ?? []).map((rule) => normalizeRule(component, rule)),
      heuristics_json:
        component === 'HSD'
          ? {
              minLength: Number((item.heuristics_json as any)?.minLength ?? 10),
              minEntropy: Number((item.heuristics_json as any)?.minEntropy ?? 3.3),
              benignMarkers: Array.isArray((item.heuristics_json as any)?.benignMarkers)
                ? (item.heuristics_json as any).benignMarkers.map(String)
                : [],
              sensitiveKeywords: Array.isArray((item.heuristics_json as any)?.sensitiveKeywords)
                ? (item.heuristics_json as any).sensitiveKeywords.map(String)
                : [],
            }
          : null,
    }
  }
  return result
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>
}

function RuleCard({
  component,
  rule,
  onChange,
  onDelete,
}: {
  component: PolicyComponentCode
  rule: Rule
  onChange: (rule: Rule) => void
  onDelete: () => void
}) {
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch, severity: 'warning' })

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{rule.name || 'New rule'}</p>
          <p className="text-xs text-gray-500 font-mono mt-1">{rule.id || 'Rule ID required'}</p>
        </div>
        <button type="button" onClick={onDelete} className="btn-secondary px-3"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Rule ID"><input className="input" value={rule.id} onChange={(e) => set({ id: e.target.value })} /></Field>
        <Field label="Name"><input className="input" value={rule.name} onChange={(e) => set({ name: e.target.value })} /></Field>

        {component === 'HSD' ? (
          <Field label="Pattern"><input className="input font-mono" value={rule.pattern ?? ''} onChange={(e) => set({ pattern: e.target.value })} /></Field>
        ) : (
          <Field label="Check Key"><input className="input font-mono" value={rule.checkKey ?? ''} onChange={(e) => set({ checkKey: e.target.value })} /></Field>
        )}

        {component === 'HSD' && (
          <Field label="Secret Type"><input className="input" value={rule.secretType ?? ''} onChange={(e) => set({ secretType: e.target.value })} /></Field>
        )}

        <Field label="Security Severity">
          <select className="input" value={rule.securitySeverity} onChange={(e) => set({ securitySeverity: e.target.value as SecuritySeverity })}>
            <option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </Field>

        <Field label="Default Confidence">
          <select className="input" value={rule.defaultConfidence} onChange={(e) => set({ defaultConfidence: e.target.value as DetectionConfidence })}>
            <option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
          </select>
        </Field>

        <Field label="Category"><input className="input" value={rule.category} onChange={(e) => set({ category: e.target.value })} /></Field>
        <Field label="CWE"><input className="input" value={rule.cwe ?? ''} onChange={(e) => set({ cwe: e.target.value || undefined })} /></Field>
      </div>

      {component === 'NET' && (
        <Field label="Message Template"><input className="input" value={rule.messageTemplate ?? ''} onChange={(e) => set({ messageTemplate: e.target.value })} /></Field>
      )}

      {component === 'IDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Patterns (comma separated)"><input className="input" value={arrayToCsv(rule.patterns)} onChange={(e) => set({ patterns: csvToArray(e.target.value) })} /></Field>
          <Field label="Data Types (comma separated)"><input className="input" value={arrayToCsv(rule.dataTypes)} onChange={(e) => set({ dataTypes: csvToArray(e.target.value) })} /></Field>
          <Field label="Requires Import (comma separated)"><input className="input" value={arrayToCsv(rule.requiresImport)} onChange={(e) => set({ requiresImport: csvToArray(e.target.value) })} /></Field>
          <Field label="Target Functions (comma separated)"><input className="input" value={arrayToCsv(rule.targetFunctions)} onChange={(e) => set({ targetFunctions: csvToArray(e.target.value) })} /></Field>
        </div>
      )}

      {component === 'IIV' && (
        <Field label="Target Functions (comma separated)"><input className="input" value={arrayToCsv(rule.targetFunctions)} onChange={(e) => set({ targetFunctions: csvToArray(e.target.value) })} /></Field>
      )}

      <Field label="Description"><textarea className="input min-h-20" value={rule.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Remediation"><textarea className="input min-h-20" value={rule.remediation} onChange={(e) => set({ remediation: e.target.value })} /></Field>

      <div className="rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-xs text-gray-400">
        VS Code diagnostic severity is fixed to <span className="font-mono text-gray-200">warning</span>. Security Severity and Confidence are stored separately.
      </div>
    </div>
  )
}

export default function TeamPoliciesPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<PolicyComponentCode>('HSD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [data, setData] = useState<TeamPolicyResponse | null>(null)
  const [editor, setEditor] = useState<EditorState>(emptyEditor())
  const [initial, setInitial] = useState<EditorState>(emptyEditor())

  async function load() {
    if (!teamId) return
    setLoading(true); setError(''); setSuccess('')
    try {
      const response = await getTeamPolicies(teamId)
      const next = buildEditor(response.data)
      setData(response.data); setEditor(next); setInitial(structuredClone(next))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load policies')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [teamId])

  const current = editor[tab]
  const dirty = useMemo(() => JSON.stringify(editor[tab]) !== JSON.stringify(initial[tab]), [editor, initial, tab])
  const isLeader = Boolean(user?.id && data?.team.leader_id === user.id)

  async function publish() {
    if (!teamId) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const response = await publishTeamPolicy(teamId, {
        component_code: tab,
        policy_name: current.policy_name.trim() || `Default ${tab} Policy`,
        policy_description: current.policy_description.trim() || null,
        rules_json: current.rules_json.map((rule) => ({ ...rule, severity: 'warning' })),
        heuristics_json: tab === 'HSD' ? (current.heuristics_json ?? null) : null,
        notes: current.notes.trim() || null,
      })
      const next = buildEditor(response.data)
      setData(response.data); setEditor(next); setInitial(structuredClone(next))
      setSuccess(`${tab} policy published successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish policy')
    } finally { setSaving(false) }
  }

  function updateCurrent(next: ComponentEditor) {
    setEditor((value) => ({ ...value, [tab]: next }))
  }

  if (loading) return <div className="page-container flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/team/${teamId}`)}><ArrowLeft className="w-4 h-4" />Back to Team</button>
          <div><p className="text-sm text-brand-400 font-medium">Team Policies</p><h1 className="text-3xl font-bold text-white">{data?.team.name ?? 'FLUSEC Policy Manager'}</h1><p className="text-sm text-gray-400 mt-1">Published policies are synchronized to connected VS Code extensions. Security severity and detection confidence remain independent.</p></div>
        </div>
        <div className="flex gap-3"><button type="button" className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" />Refresh</button><Link to={`/team/${teamId}/findings`} className="btn-secondary">Findings</Link></div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>}
      {success && <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">{success}</div>}

      <div className="card p-2 flex flex-wrap gap-2">
        {COMPONENTS.map((component) => <button key={component} type="button" onClick={() => setTab(component)} className={tab === component ? 'btn-primary' : 'btn-ghost'}>{component}</button>)}
      </div>

      <div className="card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name"><input className="input" value={current.policy_name} onChange={(e) => updateCurrent({ ...current, policy_name: e.target.value })} /></Field>
          <Field label="Notes"><input className="input" value={current.notes} onChange={(e) => updateCurrent({ ...current, notes: e.target.value })} /></Field>
        </div>
        <Field label="Policy Description"><textarea className="input min-h-20" value={current.policy_description} onChange={(e) => updateCurrent({ ...current, policy_description: e.target.value })} /></Field>

        {tab === 'HSD' && current.heuristics_json && (
          <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-4">
            <h2 className="text-sm font-semibold text-white">HSD Heuristics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Minimum Length"><input type="number" className="input" value={current.heuristics_json.minLength} onChange={(e) => updateCurrent({ ...current, heuristics_json: { ...current.heuristics_json!, minLength: Number(e.target.value) } })} /></Field>
              <Field label="Minimum Entropy"><input type="number" step="0.1" className="input" value={current.heuristics_json.minEntropy} onChange={(e) => updateCurrent({ ...current, heuristics_json: { ...current.heuristics_json!, minEntropy: Number(e.target.value) } })} /></Field>
              <Field label="Benign Markers"><input className="input" value={current.heuristics_json.benignMarkers.join(', ')} onChange={(e) => updateCurrent({ ...current, heuristics_json: { ...current.heuristics_json!, benignMarkers: csvToArray(e.target.value) } })} /></Field>
              <Field label="Sensitive Keywords"><input className="input" value={current.heuristics_json.sensitiveKeywords.join(', ')} onChange={(e) => updateCurrent({ ...current, heuristics_json: { ...current.heuristics_json!, sensitiveKeywords: csvToArray(e.target.value) } })} /></Field>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {current.rules_json.map((rule, index) => (
          <RuleCard
            key={`${rule.id}-${index}`}
            component={tab}
            rule={rule}
            onChange={(nextRule) => { const rules = [...current.rules_json]; rules[index] = nextRule; updateCurrent({ ...current, rules_json: rules }) }}
            onDelete={() => { if (!window.confirm('Delete this rule?')) return; const rules = current.rules_json.filter((_, i) => i !== index); updateCurrent({ ...current, rules_json: rules }) }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => updateCurrent({ ...current, rules_json: [...current.rules_json, blankRule(tab)] })}><Plus className="w-4 h-4" />Add {tab} Rule</button>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" disabled={!dirty} onClick={() => setEditor((value) => ({ ...value, [tab]: structuredClone(initial[tab]) }))}><RotateCcw className="w-4 h-4" />Reset</button>
          <button type="button" className="btn-primary" disabled={saving || !dirty || !isLeader} onClick={() => void publish()}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Publish {tab}</button>
        </div>
      </div>

      {!isLeader && <div className="text-xs text-gray-500 flex gap-2"><Lock className="w-4 h-4" />Only the team leader can publish policies.</div>}
    </div>
  )
}
