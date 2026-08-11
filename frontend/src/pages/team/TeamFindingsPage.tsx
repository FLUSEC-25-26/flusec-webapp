import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeam, getTeamFindings } from '@/lib/api'
import type { DetectionConfidence, Finding, FindingStatus, FlusecComponent, SecuritySeverity, Team } from '@/types'
import FindingCard, { EmptyFindings } from '@/components/findings/FindingCard'
import { ArrowLeft, RefreshCw, Search } from 'lucide-react'

type AllOr<T extends string> = 'ALL' | T

const severityOrder: Record<SecuritySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const confidenceOrder: Record<DetectionConfidence, number> = { high: 3, medium: 2, low: 1 }

export default function TeamFindingsPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [component, setComponent] = useState<AllOr<FlusecComponent>>('ALL')
  const [severity, setSeverity] = useState<AllOr<SecuritySeverity>>('ALL')
  const [confidence, setConfidence] = useState<AllOr<DetectionConfidence>>('ALL')
  const [status, setStatus] = useState<AllOr<FindingStatus>>('ALL')
  const [sort, setSort] = useState<'severity' | 'confidence' | 'latest' | 'file'>('severity')

  async function load() {
    if (!teamId) return
    setLoading(true); setError('')
    try {
      const [teamResponse, findingsResponse] = await Promise.all([
        getTeam(teamId),
        getTeamFindings(teamId, { limit: 2000 }),
      ])
      setTeam(teamResponse.data)
      setFindings(findingsResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team findings')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [teamId])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = findings.filter((finding) => {
      if (component !== 'ALL' && finding.component !== component) return false
      if (severity !== 'ALL' && finding.security_severity !== severity) return false
      if (confidence !== 'ALL' && finding.confidence !== confidence) return false
      if (status !== 'ALL' && finding.status !== status) return false
      if (!term) return true
      const evidence = finding.evidence ? JSON.stringify(finding.evidence) : ''
      return [finding.title, finding.description, finding.rule_id, finding.cwe, finding.file_path, finding.function_name, finding.profile?.full_name, evidence]
        .some((value) => String(value ?? '').toLowerCase().includes(term))
    })

    return result.sort((a, b) => {
      if (sort === 'latest') return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
      if (sort === 'file') return String(a.file_path ?? '').localeCompare(String(b.file_path ?? ''))
      if (sort === 'confidence') return confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
      const severityDifference = severityOrder[b.security_severity] - severityOrder[a.security_severity]
      return severityDifference || confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    })
  }, [findings, search, component, severity, confidence, status, sort])

  const counts = {
    critical: findings.filter((f) => f.status !== 'resolved' && f.security_severity === 'critical').length,
    high: findings.filter((f) => f.status !== 'resolved' && f.security_severity === 'high').length,
    medium: findings.filter((f) => f.status !== 'resolved' && f.security_severity === 'medium').length,
    low: findings.filter((f) => f.status !== 'resolved' && f.security_severity === 'low').length,
  }
  const openCount = findings.filter((f) => f.status !== 'resolved').length

  if (loading) return <div className="page-container flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" onClick={() => navigate(`/team/${teamId}`)} className="btn-secondary"><ArrowLeft className="w-4 h-4" />Back to Team</button>
          <div><p className="text-sm text-brand-400 font-medium">Team Findings</p><h1 className="text-3xl font-bold text-white">{team?.name ?? 'Findings'}</h1><p className="text-sm text-gray-400 mt-1">Canonical security findings deduplicated by fingerprint across scan sessions.</p></div>
        </div>
        <div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" />Refresh</button><Link to={`/team/${teamId}/communication`} className="btn-secondary">Communication</Link></div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat label="Open" value={openCount} />
        <Stat label="Critical" value={counts.critical} color="text-red-400" />
        <Stat label="High" value={counts.high} color="text-orange-400" />
        <Stat label="Medium" value={counts.medium} color="text-yellow-400" />
        <Stat label="Low" value={counts.low} color="text-blue-400" />
        <Stat label="Filtered" value={filtered.length} color="text-brand-400" />
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="xl:col-span-2"><label className="label">Search</label><div className="relative"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /><input className="input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rule, file, CWE, function, evidence..." /></div></div>
        <Select label="Component" value={component} onChange={setComponent} values={['ALL', 'HSD', 'NET', 'IDS', 'IIV']} />
        <Select label="Security Severity" value={severity} onChange={setSeverity} values={['ALL', 'critical', 'high', 'medium', 'low']} />
        <Select label="Confidence" value={confidence} onChange={setConfidence} values={['ALL', 'high', 'medium', 'low']} />
        <Select label="Status" value={status} onChange={setStatus} values={['ALL', 'open', 'in_progress', 'resolved']} />
        <Select label="Sort" value={sort} onChange={setSort} values={['severity', 'confidence', 'latest', 'file']} />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? <EmptyFindings /> : filtered.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${color}`}>{value}</p></div>
}

function Select<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return <div><label className="label">{label}</label><select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>{values.map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
}
