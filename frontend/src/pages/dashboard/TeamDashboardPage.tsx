import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyTeams, getTeamFindings, getTeamMembers } from '@/lib/api'
import type { Finding, FlusecComponent, TeamMember, TeamWithRole } from '@/types'
import FindingCard, { EmptyFindings } from '@/components/findings/FindingCard'
import { Database, KeyRound, Network, RefreshCw, ShieldCheck, Users } from 'lucide-react'

const COMPONENTS: Array<{ code: FlusecComponent; label: string; icon: typeof KeyRound }> = [
  { code: 'HSD', label: 'Hardcoded Secrets', icon: KeyRound },
  { code: 'NET', label: 'Network Security', icon: Network },
  { code: 'IDS', label: 'Insecure Data Storage', icon: Database },
  { code: 'IIV', label: 'Input Validation', icon: ShieldCheck },
]

export default function TeamDashboardPage() {
  const [teams, setTeams] = useState<TeamWithRole[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null

  async function loadTeams() {
    setLoading(true); setError('')
    try {
      const response = await getMyTeams()
      setTeams(response.data)
      setSelectedTeamId((current) => current && response.data.some((t) => t.id === current) ? current : (response.data[0]?.id ?? ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load teams')
      setTeams([])
    } finally { setLoading(false) }
  }

  async function loadTeamData(teamId: string) {
    if (!teamId) { setMembers([]); setFindings([]); return }
    setLoading(true); setError('')
    try {
      const [memberResponse, findingResponse] = await Promise.all([
        getTeamMembers(teamId),
        getTeamFindings(teamId, { limit: 1000 }),
      ])
      setMembers(memberResponse.data)
      setFindings(findingResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team dashboard')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadTeams() }, [])
  useEffect(() => { if (selectedTeamId) void loadTeamData(selectedTeamId) }, [selectedTeamId])

  const openFindings = useMemo(() => findings.filter((finding) => finding.status !== 'resolved'), [findings])
  const recentImportant = [...openFindings]
    .sort((a, b) => severityRank(b.security_severity) - severityRank(a.security_severity) || new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
    .slice(0, 5)

  if (loading && teams.length === 0) return <div className="page-container flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></div>

  if (teams.length === 0) {
    return <div className="page-container"><div className="card text-center py-12"><Users className="w-10 h-10 text-brand-400 mx-auto" /><h1 className="text-xl font-bold text-white mt-4">Create or join a team</h1><p className="text-sm text-gray-400 mt-2">FLUSEC cloud findings and policies are team-scoped.</p><div className="flex justify-center gap-3 mt-6"><Link to="/create-team" className="btn-primary">Create Team</Link><Link to="/join-team" className="btn-secondary">Join Team</Link></div></div></div>
  }

  return (
    <div className="page-container space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div><p className="text-sm text-brand-400 font-medium">Security Overview</p><h1 className="text-3xl font-bold text-white">{selectedTeam?.name ?? 'FLUSEC Team Dashboard'}</h1><p className="text-sm text-gray-400 mt-1">Normalized findings from HSD, NET, IDS and IIV. Maintainability context is reported separately from security severity.</p></div>
        <div className="flex flex-wrap gap-3 items-end"><div><label className="label">Team</label><select className="input min-w-56" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.myRole}</option>)}</select></div><button className="btn-secondary" onClick={() => void loadTeamData(selectedTeamId)}><RefreshCw className="w-4 h-4" />Refresh</button></div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Stat label="Open" value={openFindings.length} />
        <Stat label="Critical" value={openFindings.filter((f) => f.security_severity === 'critical').length} color="text-red-400" />
        <Stat label="High" value={openFindings.filter((f) => f.security_severity === 'high').length} color="text-orange-400" />
        <Stat label="Medium" value={openFindings.filter((f) => f.security_severity === 'medium').length} color="text-yellow-400" />
        <Stat label="Low" value={openFindings.filter((f) => f.security_severity === 'low').length} color="text-blue-400" />
        <Stat label="Members" value={members.length} color="text-brand-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COMPONENTS.map(({ code, label, icon: Icon }) => {
          const componentFindings = openFindings.filter((finding) => finding.component === code)
          return <Link key={code} to={`/team/${selectedTeamId}/components/${code}`} className="card-hover"><div className="flex items-center justify-between"><span className={`chip-${code.toLowerCase()}`}>{code}</span><Icon className="w-5 h-5 text-gray-600" /></div><p className="text-sm font-semibold text-white mt-4">{label}</p><p className="text-3xl font-extrabold text-white mt-2">{componentFindings.length}</p><div className="flex gap-3 text-xs text-gray-500 mt-2"><span>{componentFindings.filter((f) => f.security_severity === 'critical').length} critical</span><span>{componentFindings.filter((f) => f.security_severity === 'high').length} high</span></div></Link>
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Team members</h2><p className="text-xs text-gray-500 mt-1">Open findings by security severity.</p></div><Link to={`/team/${selectedTeamId}`} className="text-xs text-brand-400">Open team</Link></div>
          <div className="space-y-3 mt-4">
            {members.map((member) => <Link key={member.id} to={`/team/${selectedTeamId}/member/${member.user_id}`} className="block rounded-lg border border-surface-border bg-surface p-3 hover:border-brand-700"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{member.profile?.full_name ?? 'Member'}</p><p className="text-xs text-gray-500 capitalize">{member.role}</p></div><div className="flex gap-3 text-xs"><span className="text-gray-300">{member.stats?.total ?? 0} open</span><span className="text-red-400">{member.stats?.critical ?? 0} critical</span><span className="text-orange-400">{member.stats?.high ?? 0} high</span></div></div></Link>)}
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white">Cloud finding model</h2>
          <div className="space-y-3 mt-4 text-sm text-gray-400"><p><span className="text-gray-200 font-medium">Security Severity</span> describes vulnerability impact.</p><p><span className="text-gray-200 font-medium">Confidence</span> describes how certain FLUSEC is about the detection.</p><p><span className="text-gray-200 font-medium">Maintainability Context</span> describes surrounding code complexity, nesting and function size. It does not change security severity.</p><p><span className="text-gray-200 font-medium">Fingerprint</span> identifies the canonical finding across repeated scan uploads.</p></div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Priority findings</h2><p className="text-xs text-gray-500 mt-1">Sorted by security severity, then latest observation.</p></div><Link to={`/team/${selectedTeamId}/findings`} className="text-xs text-brand-400">View all findings</Link></div>
        {recentImportant.length === 0 ? <EmptyFindings label="No open findings are currently recorded for this team." /> : recentImportant.map((finding) => <FindingCard key={finding.id} finding={finding} compact />)}
      </div>
    </div>
  )
}

function severityRank(value: Finding['security_severity']) { return value === 'critical' ? 4 : value === 'high' ? 3 : value === 'medium' ? 2 : 1 }
function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) { return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${color}`}>{value}</p></div> }
