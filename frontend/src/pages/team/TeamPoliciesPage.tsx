import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeamPolicies, publishTeamPolicy } from '@/lib/policyApi'
import { useAuthStore } from '@/stores/authStore'
import type {
  DetectionConfidence,
  HsdHeuristics,
  PolicyCategory,
  PolicyComponentCode,
  SecuritySeverity,
  TeamPolicyResponse,
} from '@/types/policies'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileJson,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'

type EditableRule = {
  id: string
  name: string
  enabled: boolean
  securitySeverity: SecuritySeverity
  confidence: DetectionConfidence
  category: PolicyCategory
  description: string
  remediation: string
  cwe?: string

  // HSD
  pattern?: string
  secretType?: string
  provider?: string

  // NET / IDS / IIV
  checkKey?: string

  // NET
  messageTemplate?: string

  // IDS / IIV
  requiresImport?: string[]
  targetFunctions?: string[]

  // IIV
  sourceFunctions?: string[]
  sinkFunctions?: string[]
  validatorFunctions?: string[]
}

type ComponentEditor = {
  policy_name: string
  policy_description: string
  notes: string
  rules_json: EditableRule[]
  heuristics_json?: HsdHeuristics | null
}

type EditorState = Record<PolicyComponentCode, ComponentEditor>

const COMPONENTS: PolicyComponentCode[] = ['HSD', 'NET', 'IDS', 'IIV']

const DEFAULT_HSD_HEURISTICS: HsdHeuristics = {
  minLength: 10,
  minContextLength: 6,
  minEntropy: 3.3,
  placeholderMarkers: [
    'changeme',
    'change_me',
    'replace_me',
    'placeholder',
    'your_api_key',
    'your_secret',
    'your_token',
    'your_password',
    'not_a_real',
    'example_key',
    'example_token',
    'example_secret',
    'dummy_key',
    'dummy_token',
    'dummy_secret',
    'fake_key',
    'fake_token',
    'fake_secret',
    'your_service_role_key',
    'service_role_key_here',
    'insert_secret_here',
  ],
  sensitiveKeywords: [
    'password',
    'client_secret',
    'secret_access_key',
    'access_token',
    'refresh_token',
    'session_token',
    'auth_token',
    'api_key',
    'private_key',
    'signing_key',
    'encryption_key',
    'service_role',
  ],
}

function csvToArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function arrayToCsv(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function optionalString(value: unknown) {
  const text = stringOrEmpty(value).trim()
  return text || undefined
}

function normalizeSeverity(value: unknown): SecuritySeverity {
  const normalized = String(value ?? 'medium').toLowerCase()
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return 'medium'
}

function normalizeConfidence(value: unknown): DetectionConfidence {
  const normalized = String(value ?? 'medium').toLowerCase()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return 'medium'
}

function normalizeCategory(value: unknown): PolicyCategory {
  return value === 'secure_coding' ? 'secure_coding' : 'vulnerability'
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function blankRule(component: PolicyComponentCode): EditableRule {
  const base: EditableRule = {
    id: `FLUSEC.${component}.`,
    name: '',
    enabled: true,
    securitySeverity: 'medium',
    confidence: 'medium',
    category: 'vulnerability',
    description: '',
    remediation: '',
  }

  if (component === 'HSD') {
    return {
      ...base,
      pattern: '',
      secretType: 'GENERIC_SECRET',
      provider: '',
      cwe: 'CWE-798',
    }
  }

  if (component === 'NET') {
    return {
      ...base,
      checkKey: '',
      messageTemplate: '',
      cwe: 'CWE-319',
    }
  }

  if (component === 'IDS') {
    return {
      ...base,
      checkKey: '',
      targetFunctions: [],
      requiresImport: [],
      cwe: 'CWE-312',
    }
  }

  return {
    ...base,
    checkKey: '',
    targetFunctions: [],
    sourceFunctions: [],
    sinkFunctions: [],
    validatorFunctions: [],
    cwe: 'CWE-20',
  }
}

function emptyEditor(): EditorState {
  return {
    HSD: {
      policy_name: 'Default HSD Policy',
      policy_description: '',
      notes: '',
      rules_json: [],
      heuristics_json: structuredClone(DEFAULT_HSD_HEURISTICS),
    },
    NET: {
      policy_name: 'Default NET Policy',
      policy_description: '',
      notes: '',
      rules_json: [],
    },
    IDS: {
      policy_name: 'Default IDS Policy',
      policy_description: '',
      notes: '',
      rules_json: [],
    },
    IIV: {
      policy_name: 'Default IIV Policy',
      policy_description: '',
      notes: '',
      rules_json: [],
    },
  }
}

function normalizeRule(component: PolicyComponentCode, raw: unknown): EditableRule {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}

  return {
    id: stringOrEmpty(source.id),
    name: stringOrEmpty(source.name),
    enabled: source.enabled !== false,
    securitySeverity: normalizeSeverity(source.securitySeverity),
    confidence: normalizeConfidence(source.confidence ?? source.defaultConfidence),
    category: normalizeCategory(source.category),
    description: stringOrEmpty(source.description),
    remediation: stringOrEmpty(source.remediation),
    cwe: optionalString(source.cwe),

    pattern: source.pattern != null ? String(source.pattern) : undefined,
    secretType: source.secretType != null ? String(source.secretType) : undefined,
    provider: source.provider == null ? '' : String(source.provider),

    checkKey: source.checkKey != null ? String(source.checkKey) : undefined,
    messageTemplate: source.messageTemplate != null ? String(source.messageTemplate) : undefined,

    requiresImport: normalizeStringArray(source.requiresImport),
    targetFunctions: normalizeStringArray(source.targetFunctions),
    sourceFunctions: normalizeStringArray(source.sourceFunctions),
    sinkFunctions: normalizeStringArray(source.sinkFunctions),
    validatorFunctions: normalizeStringArray(source.validatorFunctions),
  }
}

function normalizeHsdHeuristics(raw: unknown): HsdHeuristics {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}

  const placeholderSource = Array.isArray(source.placeholderMarkers)
    ? source.placeholderMarkers
    : source.benignMarkers

  return {
    minLength: Number(source.minLength ?? DEFAULT_HSD_HEURISTICS.minLength),
    minContextLength: Number(source.minContextLength ?? DEFAULT_HSD_HEURISTICS.minContextLength),
    minEntropy: Number(source.minEntropy ?? DEFAULT_HSD_HEURISTICS.minEntropy),
    placeholderMarkers: Array.isArray(placeholderSource)
      ? normalizeStringArray(placeholderSource)
      : [...DEFAULT_HSD_HEURISTICS.placeholderMarkers],
    sensitiveKeywords: Array.isArray(source.sensitiveKeywords)
      ? normalizeStringArray(source.sensitiveKeywords)
      : [...DEFAULT_HSD_HEURISTICS.sensitiveKeywords],
  }
}

function serializeRule(component: PolicyComponentCode, rule: EditableRule): Record<string, unknown> {
  const common = {
    id: rule.id.trim(),
    name: rule.name.trim(),
    enabled: rule.enabled,
    securitySeverity: rule.securitySeverity,
    category: rule.category,
    ...(rule.cwe?.trim() ? { cwe: rule.cwe.trim() } : {}),
    description: rule.description.trim(),
    remediation: rule.remediation.trim(),
  }

  if (component === 'HSD') {
    return {
      ...common,
      pattern: rule.pattern ?? '',
      secretType: rule.secretType?.trim() ?? '',
      provider: rule.provider?.trim() || null,
      confidence: rule.confidence,
    }
  }

  const staticRule = {
    ...common,
    checkKey: rule.checkKey?.trim() ?? '',
    severity: 'warning',
    defaultConfidence: rule.confidence,
  }

  if (component === 'NET') {
    return {
      ...staticRule,
      messageTemplate: rule.messageTemplate?.trim() ?? '',
    }
  }

  if (component === 'IDS') {
    return {
      ...staticRule,
      targetFunctions: rule.targetFunctions ?? [],
      requiresImport: rule.requiresImport ?? [],
    }
  }

  const targetFunctions = rule.targetFunctions ?? []
  const sourceFunctions = rule.sourceFunctions ?? []
  const sinkFunctions = rule.sinkFunctions ?? []
  const validatorFunctions = rule.validatorFunctions ?? []

  return {
    ...staticRule,
    ...(targetFunctions.length ? { targetFunctions } : {}),
    ...(sourceFunctions.length ? { sourceFunctions } : {}),
    ...(sinkFunctions.length ? { sinkFunctions } : {}),
    ...(validatorFunctions.length ? { validatorFunctions } : {}),
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
      heuristics_json: component === 'HSD'
        ? normalizeHsdHeuristics(item.heuristics_json)
        : null,
    }
  }

  return result
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function EnabledToggle({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-4 w-4 accent-brand-500"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={enabled ? 'text-sm text-green-300' : 'text-sm text-gray-400'}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </label>
  )
}

function RuleCard({
  component,
  rule,
  onChange,
  onDelete,
}: {
  component: PolicyComponentCode
  rule: EditableRule
  onChange: (rule: EditableRule) => void
  onDelete: () => void
}) {
  const set = (patch: Partial<EditableRule>) => onChange({ ...rule, ...patch })

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{rule.name || 'New rule'}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] border ${
              rule.enabled
                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                : 'border-gray-600 bg-gray-700/30 text-gray-400'
            }`}>
              {rule.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-1">{rule.id || 'Rule ID required'}</p>
        </div>
        <div className="flex items-center gap-3">
          <EnabledToggle enabled={rule.enabled} onChange={(enabled) => set({ enabled })} />
          <button type="button" onClick={onDelete} className="btn-secondary px-3" title="Delete rule">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Rule ID">
          <input className="input font-mono" value={rule.id} onChange={(e) => set({ id: e.target.value })} />
        </Field>
        <Field label="Name">
          <input className="input" value={rule.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>

        {component === 'HSD' ? (
          <Field label="Pattern" hint="Keep the regex exactly as it appears in hardcoded_secrets_rules.json.">
            <input className="input font-mono" value={rule.pattern ?? ''} onChange={(e) => set({ pattern: e.target.value })} />
          </Field>
        ) : (
          <Field label="Check Key">
            <input className="input font-mono" value={rule.checkKey ?? ''} onChange={(e) => set({ checkKey: e.target.value })} />
          </Field>
        )}

        {component === 'HSD' && (
          <>
            <Field label="Secret Type">
              <input className="input font-mono" value={rule.secretType ?? ''} onChange={(e) => set({ secretType: e.target.value })} />
            </Field>
            <Field label="Provider" hint="Leave empty for provider-independent rules such as private key material.">
              <input className="input" value={rule.provider ?? ''} onChange={(e) => set({ provider: e.target.value })} />
            </Field>
          </>
        )}

        <Field label="Security Severity">
          <select
            className="input"
            value={rule.securitySeverity}
            onChange={(e) => set({ securitySeverity: e.target.value as SecuritySeverity })}
          >
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </Field>

        <Field label="Confidence" hint={component === 'HSD' ? 'Stored as confidence for HSD.' : 'Stored as defaultConfidence for this component.'}>
          <select
            className="input"
            value={rule.confidence}
            onChange={(e) => set({ confidence: e.target.value as DetectionConfidence })}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </Field>

        <Field label="Category">
          <select
            className="input"
            value={rule.category}
            onChange={(e) => set({ category: e.target.value as PolicyCategory })}
          >
            <option value="vulnerability">vulnerability</option>
            <option value="secure_coding">secure_coding</option>
          </select>
        </Field>

        <Field label="CWE" hint="Optional for rules that do not currently define a CWE.">
          <input className="input font-mono" value={rule.cwe ?? ''} onChange={(e) => set({ cwe: e.target.value || undefined })} />
        </Field>
      </div>

      {component === 'NET' && (
        <Field label="Message Template">
          <input className="input" value={rule.messageTemplate ?? ''} onChange={(e) => set({ messageTemplate: e.target.value })} />
        </Field>
      )}

      {component === 'IDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Target Functions (comma separated)">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.targetFunctions)}
              onChange={(e) => set({ targetFunctions: csvToArray(e.target.value) })}
            />
          </Field>
          <Field label="Requires Import (comma separated)" hint="Examples: dart:io, package:sqflite/sqflite.dart">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.requiresImport)}
              onChange={(e) => set({ requiresImport: csvToArray(e.target.value) })}
            />
          </Field>
        </div>
      )}

      {component === 'IIV' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Target Functions (comma separated)">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.targetFunctions)}
              onChange={(e) => set({ targetFunctions: csvToArray(e.target.value) })}
            />
          </Field>
          <Field label="Source Functions (comma separated)">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.sourceFunctions)}
              onChange={(e) => set({ sourceFunctions: csvToArray(e.target.value) })}
            />
          </Field>
          <Field label="Sink Functions (comma separated)">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.sinkFunctions)}
              onChange={(e) => set({ sinkFunctions: csvToArray(e.target.value) })}
            />
          </Field>
          <Field label="Validator Functions (comma separated)">
            <textarea
              className="input min-h-20 font-mono text-sm"
              value={arrayToCsv(rule.validatorFunctions)}
              onChange={(e) => set({ validatorFunctions: csvToArray(e.target.value) })}
            />
          </Field>
        </div>
      )}

      <Field label="Description">
        <textarea className="input min-h-20" value={rule.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Remediation">
        <textarea className="input min-h-20" value={rule.remediation} onChange={(e) => set({ remediation: e.target.value })} />
      </Field>

      <div className="rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-xs text-gray-400">
        Editor diagnostics remain <span className="font-mono text-gray-200">warning</span>. Security Severity and Confidence are independent policy metadata.
      </div>
    </div>
  )
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`${file.name} is not valid JSON`)
  }
}

function validateImportedRuleIds(component: PolicyComponentCode, rules: EditableRule[]) {
  const ids = new Set<string>()
  for (const [index, rule] of rules.entries()) {
    const number = index + 1
    if (!rule.id.trim()) throw new Error(`Imported rule ${number} has no id`)
    if (!rule.id.startsWith(`FLUSEC.${component}.`)) {
      throw new Error(`Imported rule ${rule.id} does not belong to ${component}`)
    }
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id in imported JSON: ${rule.id}`)
    ids.add(rule.id)
  }
}

export default function TeamPoliciesPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const rulesFileRef = useRef<HTMLInputElement>(null)
  const heuristicsFileRef = useRef<HTMLInputElement>(null)

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
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await getTeamPolicies(teamId)
      const next = buildEditor(response.data)
      setData(response.data)
      setEditor(next)
      setInitial(structuredClone(next))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load policies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [teamId])

  const current = editor[tab]
  const activePolicy = data?.policies[tab]
  const dirty = useMemo(
    () => JSON.stringify(editor[tab]) !== JSON.stringify(initial[tab]),
    [editor, initial, tab]
  )
  const isLeader = Boolean(user?.id && data?.team.leader_id === user.id)

  function updateCurrent(next: ComponentEditor) {
    setEditor((value) => ({ ...value, [tab]: next }))
  }

  async function publish() {
    if (!teamId) return
    if (current.rules_json.length === 0) {
      setError(`Add or import at least one ${tab} rule before publishing.`)
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await publishTeamPolicy(teamId, {
        component_code: tab,
        policy_name: current.policy_name.trim() || `Default ${tab} Policy`,
        policy_description: current.policy_description.trim() || null,
        rules_json: current.rules_json.map((rule) => serializeRule(tab, rule)),
        heuristics_json: tab === 'HSD'
          ? ({ ...(current.heuristics_json ?? DEFAULT_HSD_HEURISTICS) } as Record<string, unknown>)
          : null,
        notes: current.notes.trim() || null,
      })

      const next = buildEditor(response.data)
      setData(response.data)
      setEditor(next)
      setInitial(structuredClone(next))
      setSuccess(`${tab} policy published and assigned to this team successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish policy')
    } finally {
      setSaving(false)
    }
  }

  async function importRules(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setSuccess('')

    try {
      const parsed = await readJsonFile(file)
      if (!Array.isArray(parsed)) {
        throw new Error(`${file.name} must contain a JSON array of ${tab} rules`)
      }
      if (parsed.length === 0) {
        throw new Error(`${file.name} contains no rules`)
      }

      const rules = parsed.map((rule) => normalizeRule(tab, rule))
      validateImportedRuleIds(tab, rules)

      if (
        current.rules_json.length > 0 &&
        !window.confirm(`Replace the ${current.rules_json.length} currently loaded ${tab} rules with ${rules.length} rules from ${file.name}?`)
      ) {
        return
      }

      updateCurrent({ ...current, rules_json: rules })
      setSuccess(`${rules.length} ${tab} rules imported from ${file.name}. Review them, then click Publish ${tab}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import rules JSON')
    }
  }

  async function importHsdHeuristics(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setSuccess('')

    try {
      const parsed = await readJsonFile(file)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${file.name} must contain a JSON object`)
      }

      const heuristics = normalizeHsdHeuristics(parsed)
      updateCurrent({ ...current, heuristics_json: heuristics })
      setSuccess(`HSD heuristics imported from ${file.name}. Review them, then click Publish HSD.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import HSD heuristics JSON')
    }
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/team/${teamId}`)}>
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </button>
          <div>
            <p className="text-sm text-brand-400 font-medium">Team Policies</p>
            <h1 className="text-3xl font-bold text-white">{data?.team.name ?? 'FLUSEC Policy Manager'}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Import the analyzer's canonical JSON, review it, and publish a version. Published policies are automatically assigned to this team and synchronized to connected extensions.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link to={`/team/${teamId}/findings`} className="btn-secondary">Findings</Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300 flex gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="card p-2 flex flex-wrap gap-2">
        {COMPONENTS.map((component) => (
          <button
            key={component}
            type="button"
            onClick={() => {
              setTab(component)
              setError('')
              setSuccess('')
            }}
            className={tab === component ? 'btn-primary' : 'btn-ghost'}
          >
            {component}
          </button>
        ))}
      </div>

      <div className="card space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{tab} Policy</h2>
              {activePolicy && (
                <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-xs text-brand-300">
                  Active version {activePolicy.version_no}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {current.rules_json.length} rule{current.rules_json.length === 1 ? '' : 's'} loaded
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={rulesFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importRules(event)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!isLeader}
              onClick={() => rulesFileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Import Rules JSON
            </button>

            {tab === 'HSD' && (
              <>
                <input
                  ref={heuristicsFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => void importHsdHeuristics(event)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!isLeader}
                  onClick={() => heuristicsFileRef.current?.click()}
                >
                  <FileJson className="w-4 h-4" />
                  Import Heuristics JSON
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-200">
          Importing JSON loads it into the editor only. Nothing is written to Supabase until the team leader clicks <strong>Publish {tab}</strong>.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Policy Name">
            <input
              className="input"
              value={current.policy_name}
              onChange={(e) => updateCurrent({ ...current, policy_name: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={current.notes}
              onChange={(e) => updateCurrent({ ...current, notes: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Policy Description">
          <textarea
            className="input min-h-20"
            value={current.policy_description}
            onChange={(e) => updateCurrent({ ...current, policy_description: e.target.value })}
          />
        </Field>

        {tab === 'HSD' && current.heuristics_json && (
          <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">HSD Heuristics</h2>
              <p className="text-xs text-gray-500 mt-1">
                These fields match hardcoded_secrets_heuristics.json. Legacy benignMarkers are read for compatibility but new versions publish placeholderMarkers only.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Minimum Length">
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={current.heuristics_json.minLength}
                  onChange={(e) => updateCurrent({
                    ...current,
                    heuristics_json: {
                      ...current.heuristics_json!,
                      minLength: Number(e.target.value),
                    },
                  })}
                />
              </Field>

              <Field label="Minimum Context Length">
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={current.heuristics_json.minContextLength}
                  onChange={(e) => updateCurrent({
                    ...current,
                    heuristics_json: {
                      ...current.heuristics_json!,
                      minContextLength: Number(e.target.value),
                    },
                  })}
                />
              </Field>

              <Field label="Minimum Entropy">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="input"
                  value={current.heuristics_json.minEntropy}
                  onChange={(e) => updateCurrent({
                    ...current,
                    heuristics_json: {
                      ...current.heuristics_json!,
                      minEntropy: Number(e.target.value),
                    },
                  })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Placeholder Markers (comma separated)">
                <textarea
                  className="input min-h-32 font-mono text-sm"
                  value={current.heuristics_json.placeholderMarkers.join(', ')}
                  onChange={(e) => updateCurrent({
                    ...current,
                    heuristics_json: {
                      ...current.heuristics_json!,
                      placeholderMarkers: csvToArray(e.target.value),
                    },
                  })}
                />
              </Field>

              <Field label="Sensitive Keywords (comma separated)">
                <textarea
                  className="input min-h-32 font-mono text-sm"
                  value={current.heuristics_json.sensitiveKeywords.join(', ')}
                  onChange={(e) => updateCurrent({
                    ...current,
                    heuristics_json: {
                      ...current.heuristics_json!,
                      sensitiveKeywords: csvToArray(e.target.value),
                    },
                  })}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {current.rules_json.length === 0 ? (
          <div className="card text-center py-10">
            <FileJson className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <h3 className="text-white font-medium">No {tab} rules loaded</h3>
            <p className="text-sm text-gray-500 mt-1">
              Import the canonical {tab} rules JSON from the extension, or add a rule manually.
            </p>
          </div>
        ) : (
          current.rules_json.map((rule, index) => (
            <RuleCard
              key={`${rule.id}-${index}`}
              component={tab}
              rule={rule}
              onChange={(nextRule) => {
                const rules = [...current.rules_json]
                rules[index] = nextRule
                updateCurrent({ ...current, rules_json: rules })
              }}
              onDelete={() => {
                if (!window.confirm(`Delete ${rule.id || 'this rule'} from the editor?`)) return
                const rules = current.rules_json.filter((_, i) => i !== index)
                updateCurrent({ ...current, rules_json: rules })
              }}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={!isLeader}
          onClick={() => updateCurrent({
            ...current,
            rules_json: [...current.rules_json, blankRule(tab)],
          })}
        >
          <Plus className="w-4 h-4" />
          Add {tab} Rule
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={!dirty}
            onClick={() => setEditor((value) => ({
              ...value,
              [tab]: structuredClone(initial[tab]),
            }))}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={saving || !dirty || !isLeader || current.rules_json.length === 0}
            onClick={() => void publish()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish {tab}
          </button>
        </div>
      </div>

      {!isLeader && (
        <div className="text-xs text-gray-500 flex gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          Only the team leader can import, edit, or publish policies.
        </div>
      )}
    </div>
  )
}
