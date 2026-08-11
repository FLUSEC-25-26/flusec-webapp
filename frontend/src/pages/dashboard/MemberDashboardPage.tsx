import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMemberFindings, getMemberStats, getMemberTimeline, getTeam, getTeamMembers } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { Finding, MemberStats, Team, TeamMember, TimelineDataPoint } from '@/types'
import FindingCard, { EmptyFindings } from '@/components/findings/FindingCard'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function MemberDashboardPage({ isLeaderView = false }: { isLeaderView?: boolean }) {
  const params = useParams<{ teamId: string; userId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const teamId = params.teamId ?? ''
  const userId = params.userId ?? user?.id ?? ''

  const [team, setTeam] = useState<Team | null>(null)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [stats, setStats] = useState<MemberStats | null>(null)
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!teamId || !userId) return
    setLoading(true); setError('')
    try {
      const [teamResponse, memberResponse, findingResponse, statsResponse, timelineResponse] = await Promise.all([
        getTeam(teamId), getTeamMembers(teamId), getMemberFindings(teamId, userId), getMemberStats(teamId, userId), getMemberTimeline(teamId, userId),
      ])
      setTeam(teamResponse.data)
      setMember(memberResponse.data.find((item) => item.user_id === userId) ?? null)
      setFindings(findingResponse.data)
      setStats(statsResponse.data)
      setTimeline(timelineResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load member security data')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [teamId, userId])

  const openFindings = useMemo(() => findings.filter((finding) => finding.status !== 'resolved'), [findings])
  const priorityFindings = [...openFindings]
    .sort((a, b) => severityRank(b.security_severity) - severityRank(a.security_severity) || new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
    .slice(0, 8)

  if (loading) return <div className="page-container flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/team/${teamId}`)}><ArrowLeft className="w-4 h-4" />Back to Team</button>
          <div><p className="text-sm text-brand-400 font-medium">{isLeaderView ? 'Member Security View' : 'My Security View'}</p><h1 className="text-3xl font-bold text-white">{member?.profile?.full_name ?? user?.full_name ?? 'Member'}</h1><p className="text-sm text-gray-400 mt-1">{team?.name} · Current canonical findings and scan activity.</p></div>
        </div>
        <button className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" />Refresh</button>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat label="Open" value={stats?.total ?? openFindings.length} />
        <Stat label="Critical" value={stats?.critical ?? 0} color="text-red-400" />
        <Stat label="High" value={stats?.high ?? 0} color="text-orange-400" />
        <Stat label="Medium" value={stats?.medium ?? 0} color="text-yellow-400" />
        <Stat label="Low" value={stats?.low ?? 0} color="text-blue-400" />
        <Stat label="Scans" value={timeline.length} color="text-brand-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-white">Findings by component</h2>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {(['HSD', 'NET', 'IDS', 'IIV'] as const).map((component) => <div key={component} className="rounded-lg bg-surface-tertiary border border-surface-border p-3"><span className={`chip-${component.toLowerCase()}`}>{component}</span><p className="text-2xl font-bold text-white mt-3">{stats?.by_component?.[component] ?? openFindings.filter((f) => f.component === component).length}</p></div>)}
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-white">Recent scan activity</h2>
          <div className="space-y-2 mt-4">
            {timeline.slice(-6).reverse().map((point) => <div key={point.date} className="rounded-lg bg-surface-tertiary border border-surface-border p-3 flex items-center justify-between"><div><p className="text-xs text-gray-300">{new Date(point.date).toLocaleString()}</p><p className="text-[10px] text-gray-600 mt-1">{point.total} findings observed</p></div><div className="text-xs flex gap-3"><span className="text-red-400">{point.critical} critical</span><span className="text-orange-400">{point.high} high</span></div></div>)}
            {timeline.length === 0 && <p className="text-sm text-gray-500">No scan history yet.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Priority findings</h2><p className="text-xs text-gray-500 mt-1">No synthetic risk score is used. Findings are ordered by security severity.</p></div><Link to={`/team/${teamId}/findings`} className="text-xs text-brand-400">Team findings</Link></div>
        {priorityFindings.length === 0 ? <EmptyFindings label="No open findings are recorded for this member." /> : priorityFindings.map((finding) => <FindingCard key={finding.id} finding={finding} compact />)}
      </div>
    </div>
  )
}

function severityRank(value: Finding['security_severity']) { return value === 'critical' ? 4 : value === 'high' ? 3 : value === 'medium' ? 2 : 1 }
function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) { return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${color}`}>{value}</p></div> }
