import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyTeams, getTeam, getTeamMembers, getTeamFindings } from '@/lib/api'
import type { AdvisorModule, Finding, Team, TeamMember, TeamWithRole } from '@/types'
import {
    AlertTriangle,
    ChevronRight,
    Database,
    Globe,
    KeyRound,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Users,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell,
} from 'recharts'

type DashboardComponentCode = 'HSD' | 'NET' | 'IDS' | 'IIV'

const COMPONENTS: Array<{
    code: DashboardComponentCode
    module: AdvisorModule
    label: string
    description: string
    color: string
}> = [
    {
        code: 'HSD',
        module: 'HSD',
        label: 'Hardcoded Secrets',
        description: 'Secrets and tokens embedded in source code',
        color: '#a855f7',
    },
    {
        code: 'NET',
        module: 'SNC',
        label: 'Network Security',
        description: 'Unsafe transport and insecure network usage',
        color: '#06b6d4',
    },
    {
        code: 'IDS',
        module: 'SDS',
        label: 'Data Storage',
        description: 'Insecure local storage and sensitive persistence issues',
        color: '#14b8a6',
    },
    {
        code: 'IIV',
        module: 'IVS',
        label: 'Input Validation',
        description: 'Missing validation and unsafe input handling',
        color: '#ec4899',
    },
]

function firstName(value?: string | null) {
    if (!value) return 'Member'
    return value.split(' ')[0] ?? value
}

function clampScore(score: number) {
    return Math.max(0, Math.min(100, Math.round(score)))
}

function getFindingScore(finding: Finding) {
    if (typeof finding.risk_score === 'number') {
        return finding.risk_score
    }

    if (finding.severity === 'critical') return 95
    if (finding.severity === 'high') return 75
    if (finding.severity === 'medium') return 55
    return 30
}

function calculateTeamRiskScore(findings: Finding[], members: TeamMember[]) {
    if (findings.length === 0) return 0

    const total = findings.length
    const openCount = findings.filter((finding) => finding.status === 'open').length
    const criticalCount = findings.filter((finding) => finding.severity === 'critical').length
    const averageFindingRisk =
        findings.reduce((sum, finding) => sum + getFindingScore(finding), 0) / total

    const openRatio = openCount / total
    const criticalPressure = Math.min(100, criticalCount * 6)
    const volumePressure = Math.min(100, Math.log10(total + 1) * 35)

    const affectedMemberCount = new Set(findings.map((finding) => finding.uploaded_by)).size
    const memberCoverage =
        members.length > 0 ? (affectedMemberCount / members.length) * 100 : 0

    const score =
        averageFindingRisk * 0.45 +
        openRatio * 100 * 0.2 +
        criticalPressure * 0.2 +
        volumePressure * 0.1 +
        memberCoverage * 0.05

    return clampScore(score)
}

function getComponentIcon(code: DashboardComponentCode) {
    if (code === 'HSD') return <KeyRound className="w-5 h-5" />
    if (code === 'NET') return <Globe className="w-5 h-5" />
    if (code === 'IDS') return <Database className="w-5 h-5" />
    return <ShieldAlert className="w-5 h-5" />
}

export default function TeamDashboardPage() {
    const navigate = useNavigate()

    const [teams, setTeams] = useState<TeamWithRole[]>([])
    const [selectedTeamId, setSelectedTeamId] = useState('')
    const [team, setTeam] = useState<Team | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [findings, setFindings] = useState<Finding[]>([])
    const [loadingTeams, setLoadingTeams] = useState(true)
    const [loadingDashboard, setLoadingDashboard] = useState(true)
    const [error, setError] = useState('')

    const selectedTeamSummary = useMemo(
        () => teams.find((item) => item.id === selectedTeamId) ?? null,
        [teams, selectedTeamId]
    )

    async function loadTeams() {
        setLoadingTeams(true)
        setError('')

        try {
            const res = await getMyTeams()
            setTeams(res.data)

            setSelectedTeamId((prev) => {
                if (prev && res.data.some((teamRow) => teamRow.id === prev)) return prev
                return res.data[0]?.id ?? ''
            })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load your teams')
        } finally {
            setLoadingTeams(false)
        }
    }

    async function loadDashboard(teamId: string) {
        setLoadingDashboard(true)
        setError('')

        try {
            const [teamRes, membersRes, findingsRes] = await Promise.all([
                getTeam(teamId),
                getTeamMembers(teamId),
                getTeamFindings(teamId),
            ])

            setTeam(teamRes.data)
            setMembers(membersRes.data)
            setFindings(findingsRes.data)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load team dashboard')
            setTeam(null)
            setMembers([])
            setFindings([])
        } finally {
            setLoadingDashboard(false)
        }
    }

    useEffect(() => {
        void loadTeams()
    }, [])

    useEffect(() => {
        if (!selectedTeamId) {
            setTeam(null)
            setMembers([])
            setFindings([])
            setLoadingDashboard(false)
            return
        }

        void loadDashboard(selectedTeamId)
    }, [selectedTeamId])

    const openCount = findings.filter((f) => f.status === 'open').length
    const criticalCount = findings.filter((f) => f.severity === 'critical').length
    const resolvedCount = findings.filter((f) => f.status === 'resolved').length
    const riskScore = calculateTeamRiskScore(findings, members)

    const activeMembersThisWeek = members.filter((member) => {
        if (!member.stats?.last_scanned_at) return false
        const scannedAt = new Date(member.stats.last_scanned_at).getTime()
        return scannedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000
    }).length

    const lastSyncAt = findings[0]?.created_at ?? null

    const componentData = COMPONENTS.map((component) => {
        const componentFindings = findings.filter((finding) => finding.module === component.module)
        return {
            code: component.code,
            label: component.label,
            description: component.description,
            color: component.color,
            total: componentFindings.length,
            critical: componentFindings.filter((finding) => finding.severity === 'critical').length,
            open: componentFindings.filter((finding) => finding.status === 'open').length,
        }
    })

    const severityData = [
        { name: 'critical', value: findings.filter((f) => f.severity === 'critical').length, color: '#ef4444' },
        { name: 'high', value: findings.filter((f) => f.severity === 'high').length, color: '#f97316' },
        { name: 'medium', value: findings.filter((f) => f.severity === 'medium').length, color: '#eab308' },
        { name: 'low', value: findings.filter((f) => f.severity === 'low').length, color: '#22c55e' },
    ].filter((row) => row.value > 0)

    const trendData = useMemo(() => {
        const days: string[] = []
        const buckets: Record<string, { date: string; total: number; critical: number }> = {}

        for (let i = 6; i >= 0; i -= 1) {
            const day = new Date()
            day.setHours(0, 0, 0, 0)
            day.setDate(day.getDate() - i)
            const key = day.toISOString().split('T')[0]
            days.push(key)
            buckets[key] = {
                date: key.slice(5),
                total: 0,
                critical: 0,
            }
        }

        findings.forEach((finding) => {
            const key = finding.created_at.split('T')[0]
            if (!buckets[key]) return
            buckets[key].total += 1
            if (finding.severity === 'critical') buckets[key].critical += 1
        })

        return days.map((day) => buckets[day])
    }, [findings])

    const topRiskMembers = [...members]
        .sort((a, b) => (b.stats?.risk_score ?? 0) - (a.stats?.risk_score ?? 0))
        .slice(0, 6)

    const latestCritical = findings
        .filter((finding) => finding.severity === 'critical' && finding.status === 'open')
        .slice(0, 5)

    if (loadingTeams || loadingDashboard) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    if (teams.length === 0) {
        return (
            <div className="max-w-5xl mx-auto card text-center py-16 space-y-4">
                <ShieldCheck className="w-12 h-12 text-gray-500 mx-auto" />
                <h1 className="text-2xl font-bold text-white">No teams yet</h1>
                <p className="text-sm text-gray-400">
                    Create a team or join one from Team Hub to start seeing team-wide security analytics.
                </p>
                <div className="flex justify-center">
                    <Link to="/team" className="btn-primary">
                        Go to Team Hub
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-brand-400 font-medium">Team Dashboard</p>
                    <h1 className="text-3xl font-bold text-white">
                        {team?.name ?? 'Security Overview'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Team-wide analytics from findings synced through the FLUSEC VS Code extension.
                    </p>
                    {lastSyncAt && (
                        <p className="text-xs text-gray-500 mt-2">
                            Last synced finding: {new Date(lastSyncAt).toLocaleString()}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        className="input min-w-[240px]"
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                        {teams.map((teamRow) => (
                            <option key={teamRow.id} value={teamRow.id}>
                                {teamRow.name} {teamRow.team_code ? `(${teamRow.team_code})` : ''}
                            </option>
                        ))}
                    </select>

                    <button type="button" onClick={() => void loadTeams()} className="btn-secondary">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error}
                </div>
            )}

            {selectedTeamId && (
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate(`/team/${selectedTeamId}`)}
                    >
                        Open Team
                    </button>

                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate(`/team/${selectedTeamId}/findings`)}
                    >
                        <Search className="w-4 h-4" />
                        View Findings
                    </button>

                    {selectedTeamSummary?.myRole === 'leader' && (
                        <>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => navigate(`/team/${selectedTeamId}/settings`)}
                            >
                                Team Settings
                            </button>

                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => navigate(`/team/${selectedTeamId}/policies`)}
                            >
                                Policies
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Findings', value: findings.length, color: 'text-white' },
                    { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                    { label: 'Open', value: openCount, color: 'text-orange-400' },
                    { label: 'Resolved', value: resolvedCount, color: 'text-green-400' },
                    { label: 'Risk Score', value: riskScore, color: 'text-brand-400' },
                    { label: 'Active This Week', value: activeMembersThisWeek, color: 'text-white' },
                ].map((item) => (
                    <div key={item.label} className="stat-card">
                        <p className="stat-label">{item.label}</p>
                        <p className={`stat-value ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {componentData.map((component) => (
                    <Link
                        key={component.code}
                        to={`/team/${selectedTeamId}/components/${component.code}`}
                        className="card hover:border-brand-500/30 transition-all group"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${component.color}20`, color: component.color }}
                            >
                                {getComponentIcon(component.code)}
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400" />
                        </div>

                        <div className="mt-4 space-y-2">
                            <p className="text-base font-semibold text-white">{component.label}</p>
                            <p className="text-xs text-gray-400">{component.description}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-white">{component.total}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Total</p>
                            </div>
                            <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-red-400">{component.critical}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Critical</p>
                            </div>
                            <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-orange-400">{component.open}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Open</p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">7-Day Findings Trend</p>
                    {trendData.some((row) => row.total > 0) ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e2535',
                                        border: '1px solid #2a3347',
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Line type="monotone" dataKey="total" stroke="#05ccba" strokeWidth={2} />
                                <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                            No recent findings to display.
                        </div>
                    )}
                </div>

                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Four-Component Comparison</p>
                    {componentData.some((row) => row.total > 0) ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={componentData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                                <XAxis dataKey="code" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e2535',
                                        border: '1px solid #2a3347',
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                    {componentData.map((row) => (
                                        <Cell key={row.code} fill={row.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                            No component findings yet.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Severity Breakdown</p>
                    {severityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={severityData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
                                    width={70}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e2535',
                                        border: '1px solid #2a3347',
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {severityData.map((row) => (
                                        <Cell key={row.name} fill={row.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-56 flex items-center justify-center text-sm text-gray-500">
                            No severity data yet.
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-brand-400" />
                        <p className="text-sm font-semibold text-white">Top Risk Members</p>
                    </div>

                    {topRiskMembers.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-sm text-gray-500">
                            No member scan data yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topRiskMembers.map((member) => (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => navigate(`/team/${selectedTeamId}/member/${member.user_id}`)}
                                    className="w-full text-left rounded-xl border border-surface-border bg-surface p-4 hover:border-brand-500/30 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">
                                                {member.profile?.full_name ?? 'Unknown'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {member.stats?.total ?? 0} findings
                                            </p>
                                        </div>
                                        <p className="text-lg font-bold text-brand-400">
                                            {member.stats?.risk_score ?? 0}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-semibold text-white">Latest Critical Open Findings</p>
                </div>

                {latestCritical.length === 0 ? (
                    <div className="text-sm text-gray-500 py-6">
                        No critical open findings.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {latestCritical.map((finding) => (
                            <button
                                key={finding.id}
                                type="button"
                                onClick={() => navigate(`/team/${selectedTeamId}/findings`)}
                                className="w-full text-left rounded-xl border border-surface-border bg-surface p-4 hover:border-brand-500/30 transition-all"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-white">{finding.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {finding.profile?.full_name ?? 'Unknown member'}
                                            {finding.file_path ? ` · ${finding.file_path}` : ''}
                                            {finding.line_number ? `:${finding.line_number}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="badge-critical">critical</span>
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}