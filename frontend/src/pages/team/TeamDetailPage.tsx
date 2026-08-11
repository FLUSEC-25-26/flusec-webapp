import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeam, getTeamFindings, getTeamMembers } from '@/lib/api'
import type { Finding, FlusecComponent, Team, TeamMember } from '@/types'
import FindingCard, { EmptyFindings } from '@/components/findings/FindingCard'
import { ArrowLeft, MessageSquare, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'

const COMPONENTS: Array<{ code: FlusecComponent; label: string }> = [
  { code: 'HSD', label: 'Hardcoded Secrets' },
  { code: 'NET', label: 'Network Security' },
  { code: 'IDS', label: 'Insecure Data Storage' },
  { code: 'IIV', label: 'Input Validation' },
]

export default function TeamDetailPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!teamId) return
    setLoading(true); setError('')
    try {
      const [teamResponse, memberResponse, findingResponse] = await Promise.all([
        getTeam(teamId),
        getTeamMembers(teamId),
        getTeamFindings(teamId, { limit: 1000 }),
      ])
      setTeam(teamResponse.data)
      setMembers(memberResponse.data)
      setFindings(findingResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [teamId])

  const openFindings = useMemo(() => findings.filter((finding) => finding.status !== 'resolved'), [findings])
  const recentCritical = openFindings.filter((finding) => finding.security_severity === 'critical').slice(0, 5)

  if (loading) return <div className="page-container flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></div>

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/team')}><ArrowLeft className="w-4 h-4" />All Teams</button>
          <div><p className="text-sm text-brand-400 font-medium">Team Security Workspace</p><h1 className="text-3xl font-bold text-white">{team?.name ?? 'Team'}</h1><p className="text-sm text-gray-400 mt-1 max-w-2xl">{team?.description || 'Manage findings, component policies, members and security discussions from one team-scoped workspace.'}</p></div>
        </div>
        <div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" />Refresh</button><Link to={`/team/${teamId}/communication`} className="btn-secondary"><MessageSquare className="w-4 h-4" />Communication</Link><Link to={`/team/${teamId}/settings`} className="btn-secondary"><Settings className="w-4 h-4" />Settings</Link></div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat label="Open Findings" value={openFindings.length} />
        <Stat label="Critical" value={openFindings.filter((f) => f.security_severity === 'critical').length} color="text-red-400" />
        <Stat label="High" value={openFindings.filter((f) => f.security_severity === 'high').length} color="text-orange-400" />
        <Stat label="Medium" value={openFindings.filter((f) => f.security_severity === 'medium').length} color="text-yellow-400" />
        <Stat label="Low" value={openFindings.filter((f) => f.security_severity === 'low').length} color="text-blue-400" />
        <Stat label="Members" value={members.length} color="text-brand-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {COMPONENTS.map(({ code, label }) => {
          const count = openFindings.filter((finding) => finding.component === code).length
          return <Link key={code} to={`/team/${teamId}/components/${code}`} className="card-hover"><div className="flex items-center justify-between"><div><span className={`chip-${code.toLowerCase()}`}>{code}</span><p className="text-sm font-semibold text-white mt-3">{label}</p><p className="text-xs text-gray-500 mt-1">{count} open finding{count === 1 ? '' : 's'}</p></div><ShieldCheck className="w-5 h-5 text-gray-600" /></div></Link>
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link to={`/team/${teamId}/findings`} className="card-hover flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-brand-600/15 border border-brand-600/30 flex items-center justify-center"><SlidersHorizontal className="w-5 h-5 text-brand-400" /></div><div><p className="text-sm font-semibold text-white">Browse all findings</p><p className="text-xs text-gray-500 mt-1">Filter by component, security severity, confidence and status.</p></div></Link>
        <Link to={`/team/${teamId}/policies`} className="card-hover flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-brand-600/15 border border-brand-600/30 flex items-center justify-center"><Settings className="w-5 h-5 text-brand-400" /></div><div><p className="text-sm font-semibold text-white">Policy Manager</p><p className="text-xs text-gray-500 mt-1">Publish HSD, NET, IDS and IIV rules for extension synchronization.</p></div></Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3"><div><h2 className="text-sm font-semibold text-white">Members</h2><p className="text-xs text-gray-500 mt-1">Current open-finding counts only; no synthetic risk score.</p></div><Users className="w-4 h-4 text-gray-600" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((member) => (
            <Link key={member.id} to={`/team/${teamId}/member/${member.user_id}`} className="card-hover">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-sm font-bold">{member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}</div><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{member.profile?.full_name ?? 'Team member'}</p><p className="text-xs text-gray-500 capitalize">{member.role}</p></div></div>
              <div className="grid grid-cols-3 gap-2 mt-4"><Mini label="Open" value={member.stats?.total ?? 0} /><Mini label="Critical" value={member.stats?.critical ?? 0} /><Mini label="High" value={member.stats?.high ?? 0} /></div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div><h2 className="text-sm font-semibold text-white">Open critical findings</h2><p className="text-xs text-gray-500 mt-1">Most urgent findings currently recorded for the team.</p></div>
        {recentCritical.length === 0 ? <EmptyFindings label="No open critical findings are currently recorded." /> : recentCritical.map((finding) => <FindingCard key={finding.id} finding={finding} compact />)}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${color}`}>{value}</p></div>
}
function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-surface-tertiary px-2 py-2 text-center"><p className="text-sm font-semibold text-gray-200">{value}</p><p className="text-[10px] text-gray-600 uppercase">{label}</p></div>
}
