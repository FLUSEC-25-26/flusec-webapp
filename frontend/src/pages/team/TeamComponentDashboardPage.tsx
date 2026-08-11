import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeam, getTeamFindings } from '@/lib/api'
import type { Finding, FlusecComponent, Team } from '@/types'
import FindingCard, { EmptyFindings } from '@/components/findings/FindingCard'
import { ArrowLeft, Database, KeyRound, Network, RefreshCw, ShieldCheck } from 'lucide-react'

const COMPONENT_META: Record<FlusecComponent, { label: string; description: string; icon: typeof KeyRound }> = {
  HSD: { label: 'Hardcoded Secrets', description: 'Credentials and secret material embedded in source code.', icon: KeyRound },
  NET: { label: 'Network Security', description: 'Insecure transport, TLS, WebSocket and network configuration findings.', icon: Network },
  IDS: { label: 'Insecure Data Storage', description: 'Sensitive values persisted without recognized protection.', icon: Database },
  IIV: { label: 'Input Validation', description: 'Security-sensitive input paths without sufficient validation.', icon: ShieldCheck },
}

function isComponent(value: string | undefined): value is FlusecComponent {
  return value === 'HSD' || value === 'NET' || value === 'IDS' || value === 'IIV'
}

export default function TeamComponentDashboardPage() {
  const { teamId = '', component: rawComponent } = useParams<{ teamId: string; component: string }>()
  const navigate = useNavigate()
  const component: FlusecComponent = isComponent(rawComponent?.toUpperCase()) ? rawComponent!.toUpperCase() as FlusecComponent : 'HSD'
  const meta = COMPONENT_META[component]
  const Icon = meta.icon
  const [team, setTeam] = useState<Team | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!teamId) return
    setLoading(true); setError('')
    try {
      const [teamResponse, findingResponse] = await Promise.all([
        getTeam(teamId),
        getTeamFindings(teamId, { component, limit: 1000 }),
      ])
      setTeam(teamResponse.data)
      setFindings(findingResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load component findings')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [teamId, component])

  const openFindings = useMemo(() => findings.filter((finding) => finding.status !== 'resolved'), [findings])
  const counts = {
    critical: openFindings.filter((f) => f.security_severity === 'critical').length,
    high: openFindings.filter((f) => f.security_severity === 'high').length,
    medium: openFindings.filter((f) => f.security_severity === 'medium').length,
    low: openFindings.filter((f) => f.security_severity === 'low').length,
  }
  const avgMcs = (() => {
    const values = openFindings.map((f) => f.maintainability_score).filter((value): value is number => typeof value === 'number')
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  })()

  if (loading) return <div className="page-container flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/team/${teamId}`)}><ArrowLeft className="w-4 h-4" />Back to Team</button>
          <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-lg bg-brand-600/15 border border-brand-600/30 flex items-center justify-center"><Icon className="w-5 h-5 text-brand-400" /></div><div><p className="text-sm text-brand-400 font-medium">{component}</p><h1 className="text-3xl font-bold text-white">{meta.label}</h1><p className="text-sm text-gray-400 mt-1">{meta.description}</p><p className="text-xs text-gray-600 mt-1">{team?.name}</p></div></div>
        </div>
        <div className="flex gap-3"><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" />Refresh</button><Link to={`/team/${teamId}/findings`} className="btn-secondary">All Findings</Link></div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat label="Open" value={openFindings.length} />
        <Stat label="Critical" value={counts.critical} color="text-red-400" />
        <Stat label="High" value={counts.high} color="text-orange-400" />
        <Stat label="Medium" value={counts.medium} color="text-yellow-400" />
        <Stat label="Low" value={counts.low} color="text-blue-400" />
        <Stat label="Avg MCS" value={avgMcs ?? '—'} color="text-gray-200" />
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-white">Component interpretation</h2>
        <p className="text-sm text-gray-400 mt-2">Security Severity describes vulnerability impact. Confidence describes detection certainty. Maintainability Context is shown separately and does not raise or lower vulnerability severity.</p>
      </div>

      <div className="space-y-4">
        {openFindings.length === 0 ? <EmptyFindings label={`No open ${component} findings are currently recorded for this team.`} /> : openFindings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number | string; color?: string }) {
  return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${color}`}>{value}</p></div>
}
