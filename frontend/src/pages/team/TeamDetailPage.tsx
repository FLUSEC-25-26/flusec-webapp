import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getTeamMembers, getTeamFindings } from '@/lib/api'
import type { TeamMember, Finding } from '@/types'
import { supabase } from '@/lib/supabase'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts'
import {
    Users, ShieldAlert, ChevronRight, Clock, AlertTriangle,
    ArrowLeft, Settings, Crown, Copy, CheckCheck, Loader2,
    ShieldCheck, Hash
} from 'lucide-react'

const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e'
}
const MODULE_COLORS: Record<string, string> = {
    HSD: '#a855f7', SNC: '#06b6d4', SDS: '#14b8a6', IVS: '#ec4899'
}

function riskColor(score: number) {
    if (score >= 70) return { bar: '#ef4444', text: 'text-red-400' }
    if (score >= 40) return { bar: '#f97316', text: 'text-orange-400' }
    return { bar: '#22c55e', text: 'text-green-400' }
}

interface TeamInfo {
    id: string
    name: string
    description: string | null
    invite_code: string
    leader_id: string
    created_at: string
}

export default function TeamDetailPage() {
    const { teamId } = useParams<{ teamId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const [team, setTeam] = useState<TeamInfo | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [findings, setFindings] = useState<Finding[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const [copiedId, setCopiedId] = useState(false)

    const isLeader = team ? (user?.id === team.leader_id) : false

    function copyTeamId() {
        navigator.clipboard.writeText(team?.id ?? '')
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
    }

    useEffect(() => {
        if (!teamId) return

        async function load() {
            setLoading(true)
            setError('')
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                // Fetch team info, members and findings in parallel
                const [teamRes, membersData, findingsData] = await Promise.all([
                    fetch(`/api/teams/${teamId}`, {
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    }).then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
                    getTeamMembers(teamId!),
                    getTeamFindings(teamId!),
                ])

                setTeam(teamRes.data)
                setMembers(membersData.data as TeamMember[])
                setFindings(findingsData.data)
            } catch (e) {
                setError('Could not load team data. You may not have access to this team.')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [teamId])

    // ─── Derived data ─────────────────────────────────────────────
    const totalFindings = findings.length
    const criticalCount = findings.filter(f => f.severity === 'critical').length
    const highCount = findings.filter(f => f.severity === 'high').length
    const resolvedCount = findings.filter(f => f.status === 'resolved').length

    const memberChartData = members.map(m => ({
        name: m.profile?.full_name?.split(' ')[0] ?? 'Member',
        total: m.stats?.total ?? 0,
        critical: m.stats?.critical ?? 0,
    }))

    const moduleMap: Record<string, number> = {}
    findings.forEach(f => { moduleMap[f.module] = (moduleMap[f.module] ?? 0) + 1 })
    const moduleData = Object.entries(moduleMap).map(([name, value]) => ({ name, value }))

    const sevMap: Record<string, number> = {}
    findings.forEach(f => { sevMap[f.severity] = (sevMap[f.severity] ?? 0) + 1 })
    const sevData = ['critical', 'high', 'medium', 'low']
        .filter(s => sevMap[s])
        .map(s => ({ name: s, value: sevMap[s] }))

    const topFindings = findings
        .filter(f => f.severity === 'critical' && f.status === 'open')
        .slice(0, 5)

    function copyCode() {
        if (!team) return
        navigator.clipboard.writeText(team.invite_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ─── States ───────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    if (error || !team) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <ShieldAlert className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400">{error || 'Team not found.'}</p>
                <button onClick={() => navigate('/team')} className="btn-secondary">
                    <ArrowLeft className="w-4 h-4" /> Back to Teams
                </button>
            </div>
        )
    }

    // ─── UI ───────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/team')}
                        className="btn-ghost p-2 text-gray-400 hover:text-white" title="Back">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-brand flex-shrink-0">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold text-white">{team.name}</h1>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLeader
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                                }`}>
                                {isLeader ? '👑 Leader' : 'Member'}
                            </span>
                        </div>
                        {team.description && (
                            <p className="text-sm text-gray-400 mt-1">{team.description}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                            Created {new Date(team.created_at).toLocaleDateString()}
                            &nbsp;·&nbsp;{members.length} member{members.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Right side — Team ID + Settings */}
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={copyTeamId}
                        title="Click to copy Team ID"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 hover:border-brand-500/40 transition-all group"
                    >
                        <span className="text-xs text-brand-400 font-bold uppercase tracking-widest">Team ID</span>
                        <span className="text-sm font-mono text-gray-200 group-hover:text-white transition-colors">
                            {team.id}
                        </span>
                        {copiedId
                            ? <CheckCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                            : <Copy className="w-4 h-4 text-brand-500 group-hover:text-brand-300 flex-shrink-0 transition-colors" />}
                    </button>
                    {isLeader && (
                        <Link to={`/team/${teamId}/settings`} className="btn-secondary flex-shrink-0">
                            <Settings className="w-4 h-4" /> Settings
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Invite code (leader only) ── */}
            {isLeader && (
                <div className="card flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface-tertiary border border-surface-border flex items-center justify-center">
                            <Hash className="w-4 h-4 text-brand-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Team Invite Code</p>
                            <p className="text-xl font-extrabold font-mono text-brand-400 tracking-[0.2em]">
                                {team.invite_code}
                            </p>
                        </div>
                    </div>
                    <button onClick={copyCode} className="btn-secondary">
                        {copied
                            ? <><CheckCheck className="w-4 h-4 text-green-400" /> Copied!</>
                            : <><Copy className="w-4 h-4" /> Copy Code</>}
                    </button>
                </div>
            )}

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Members', value: members.length, color: 'text-white' },
                    { label: 'Total Findings', value: totalFindings, color: 'text-white' },
                    { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                    { label: 'Resolved', value: resolvedCount, color: 'text-green-400' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="stat-card">
                        <p className="stat-label">{label}</p>
                        <p className={`stat-value ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Charts ── */}
            {(memberChartData.length > 0 || moduleData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Findings per member */}
                    <div className="card">
                        <p className="text-sm font-semibold text-white mb-4">Findings per Member</p>
                        {memberChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={memberChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }} />
                                    <Bar dataKey="total" fill="#05ccba" radius={[4, 4, 0, 0]} name="Total" />
                                    <Bar dataKey="critical" fill="#ef4444" radius={[4, 4, 0, 0]} name="Critical" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data yet</div>}
                    </div>

                    {/* Severity breakdown */}
                    <div className="card">
                        <p className="text-sm font-semibold text-white mb-4">Severity Breakdown</p>
                        {sevData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={sevData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={55} />
                                    <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {sevData.map(entry => <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? '#6b7280'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No findings yet</div>}
                    </div>
                </div>
            )}

            {/* ── Member cards ── */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-brand-400" />
                    <p className="text-sm font-semibold text-white">Team Members ({members.length})</p>
                </div>
                {members.length === 0 ? (
                    <div className="card text-center py-8 text-gray-500 text-sm">No members yet.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.map(member => {
                            const score = member.stats?.risk_score ?? 0
                            const { bar: barColor, text: textColor } = riskColor(score)
                            const isML = member.user_id === team.leader_id
                            return (
                                <button
                                    key={member.id}
                                    onClick={() => navigate(`/team/${teamId}/member/${member.user_id}`)}
                                    className="card-hover text-left space-y-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                            {member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {member.profile?.full_name ?? 'Unknown'}
                                                </p>
                                                {isML && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                                            </div>
                                            <span className={`badge ${member.role === 'leader' ? 'badge-info' : 'badge-low'}`}>
                                                {member.role}
                                            </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    </div>

                                    <div className="grid grid-cols-4 gap-1 text-center">
                                        {[
                                            { label: 'Total', value: member.stats?.total ?? 0, color: 'text-white' },
                                            { label: 'Critical', value: member.stats?.critical ?? 0, color: 'text-red-400' },
                                            { label: 'High', value: member.stats?.high ?? 0, color: 'text-orange-400' },
                                            { label: 'Med/Low', value: (member.stats?.medium ?? 0) + (member.stats?.low ?? 0), color: 'text-yellow-400' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-surface-tertiary rounded-lg py-2">
                                                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                                <p className="text-[9px] text-gray-500 font-semibold uppercase">{s.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Risk Score</p>
                                            <p className={`text-sm font-bold ${textColor}`}>{score}/100</p>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${score}%`, backgroundColor: barColor }} />
                                        </div>
                                    </div>

                                    {member.stats?.last_scanned_at && (
                                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                            <Clock className="w-3 h-3" />
                                            Last scan: {new Date(member.stats.last_scanned_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Module distribution ── */}
            {moduleData.length > 0 && (
                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Module Distribution (Team-wide)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {moduleData.map(({ name, value }) => (
                            <div key={name} className="bg-surface-tertiary rounded-xl p-4 text-center border border-surface-border">
                                <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                                    style={{ backgroundColor: `${MODULE_COLORS[name] ?? '#6b7280'}20` }}>
                                    <span className="text-xs font-bold" style={{ color: MODULE_COLORS[name] ?? '#6b7280' }}>{name}</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{value}</p>
                                <p className="text-xs text-gray-500 mt-0.5">findings</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Top critical findings ── */}
            {topFindings.length > 0 && (
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <p className="text-sm font-semibold text-white">Top Critical Open Findings</p>
                    </div>
                    <div className="space-y-2">
                        {topFindings.map(f => (
                            <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary border border-surface-border">
                                <span className="badge-critical flex-shrink-0">{f.severity}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{f.title}</p>
                                    {f.file_path && <p className="text-xs text-gray-500 font-mono truncate">{f.file_path}</p>}
                                </div>
                                <span className={`chip-${f.module?.toLowerCase()} flex-shrink-0 text-xs`}>{f.module}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {findings.length === 0 && members.length > 0 && (
                <div className="card text-center py-12 space-y-3">
                    <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto" />
                    <p className="text-white font-semibold">No findings synced yet</p>
                    <p className="text-sm text-gray-400">
                        Ask your team to run the FluSec VS Code extension and sync their findings.
                    </p>
                </div>
            )}
        </div>
    )
}
