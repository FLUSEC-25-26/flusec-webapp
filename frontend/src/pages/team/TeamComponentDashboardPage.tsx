import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeam, getTeamFindings, getTeamMembers } from '@/lib/api'
import type { AdvisorModule, Finding, Team, TeamMember } from '@/types'
import {
    AlertTriangle,
    ArrowLeft,
    ChevronRight,
    Database,
    Globe,
    KeyRound,
    Loader2,
    Search,
    ShieldAlert,
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
    Cell,
    LineChart,
    Line,
} from 'recharts'

type DashboardComponentCode = 'HSD' | 'NET' | 'IDS' | 'IIV'

const COMPONENT_META: Record<
    DashboardComponentCode,
    { module: AdvisorModule; label: string; description: string; color: string }
> = {
    HSD: {
        module: 'HSD',
        label: 'Hardcoded Secret Detection',
        description: 'Team-wide analytics for exposed secrets, keys, and credentials.',
        color: '#a855f7',
    },
    NET: {
        module: 'SNC',
        label: 'Network Security',
        description: 'Unsafe HTTP, weak transport usage, and insecure network patterns.',
        color: '#06b6d4',
    },
    IDS: {
        module: 'SDS',
        label: 'Insecure Data Storage',
        description: 'Sensitive storage, persistence, and insecure data handling issues.',
        color: '#14b8a6',
    },
    IIV: {
        module: 'IVS',
        label: 'Input Validation',
        description: 'Missing validation and unsafe input-handling patterns.',
        color: '#ec4899',
    },
}

function getComponentIcon(code: DashboardComponentCode) {
    if (code === 'HSD') return <KeyRound className="w-5 h-5" />
    if (code === 'NET') return <Globe className="w-5 h-5" />
    if (code === 'IDS') return <Database className="w-5 h-5" />
    return <ShieldAlert className="w-5 h-5" />
}

function firstName(value?: string | null) {
    if (!value) return 'Member'
    return value.split(' ')[0] ?? value
}

export default function TeamComponentDashboardPage() {
    const { teamId, component } = useParams<{ teamId: string; component: string }>()
    const navigate = useNavigate()

    const componentCode = (component?.toUpperCase() ?? '') as DashboardComponentCode
    const meta = COMPONENT_META[componentCode]

    const [team, setTeam] = useState<Team | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [findings, setFindings] = useState<Finding[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const currentTeamId = teamId
        if (!currentTeamId || !meta) {
            setLoading(false)
            return
        }

        async function load(validTeamId: string) {
            setLoading(true)
            setError('')

            try {
                const [teamRes, membersRes, findingsRes] = await Promise.all([
                    getTeam(validTeamId),
                    getTeamMembers(validTeamId),
                    getTeamFindings(validTeamId, { module: meta.module }),
                ])

                setTeam(teamRes.data)
                setMembers(membersRes.data)
                setFindings(findingsRes.data)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load component dashboard')
            } finally {
                setLoading(false)
            }
        }

        void load(currentTeamId)
    }, [teamId, meta])

    const severityData = useMemo(
        () =>
            [
                { name: 'critical', value: findings.filter((f) => f.severity === 'critical').length, color: '#ef4444' },
                { name: 'high', value: findings.filter((f) => f.severity === 'high').length, color: '#f97316' },
                { name: 'medium', value: findings.filter((f) => f.severity === 'medium').length, color: '#eab308' },
                { name: 'low', value: findings.filter((f) => f.severity === 'low').length, color: '#22c55e' },
            ].filter((row) => row.value > 0),
        [findings]
    )

    const memberData = useMemo(() => {
        const byUser = new Map<string, { total: number; critical: number }>()

        findings.forEach((finding) => {
            const current = byUser.get(finding.uploaded_by) ?? { total: 0, critical: 0 }
            current.total += 1
            if (finding.severity === 'critical') current.critical += 1
            byUser.set(finding.uploaded_by, current)
        })

        return members
            .map((member) => ({
                name: firstName(member.profile?.full_name),
                total: byUser.get(member.user_id)?.total ?? 0,
                critical: byUser.get(member.user_id)?.critical ?? 0,
            }))
            .filter((row) => row.total > 0)
            .sort((a, b) => b.total - a.total)
    }, [findings, members])

    const fileHotspots = useMemo(() => {
        const counts = new Map<string, number>()

        findings.forEach((finding) => {
            const key = finding.file_path ?? 'Unknown file'
            counts.set(key, (counts.get(key) ?? 0) + 1)
        })

        return [...counts.entries()]
            .map(([file, count]) => ({ file, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [findings])

    const ruleHits = useMemo(() => {
        const counts = new Map<string, number>()

        findings.forEach((finding) => {
            const key = finding.rule_id || finding.title || 'Unknown rule'
            counts.set(key, (counts.get(key) ?? 0) + 1)
        })

        return [...counts.entries()]
            .map(([rule, count]) => ({ rule, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [findings])

    const trendData = useMemo(() => {
        const days: string[] = []
        const buckets: Record<string, { date: string; total: number; critical: number }> = {}

        for (let i = 6; i >= 0; i -= 1) {
            const day = new Date()
            day.setHours(0, 0, 0, 0)
            day.setDate(day.getDate() - i)
            const key = day.toISOString().split('T')[0]
            days.push(key)
            buckets[key] = { date: key.slice(5), total: 0, critical: 0 }
        }

        findings.forEach((finding) => {
            const key = finding.created_at.split('T')[0]
            if (!buckets[key]) return
            buckets[key].total += 1
            if (finding.severity === 'critical') buckets[key].critical += 1
        })

        return days.map((day) => buckets[day])
    }, [findings])

    const affectedMembers = memberData.length
    const openCount = findings.filter((finding) => finding.status === 'open').length
    const criticalCount = findings.filter((finding) => finding.severity === 'critical').length
    const latestFindings = findings.slice(0, 8)

    if (!meta) {
        return (
            <div className="max-w-5xl mx-auto card text-center py-16">
                <p className="text-white font-semibold">Invalid component dashboard.</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="btn-secondary inline-flex"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                        >
                            {getComponentIcon(componentCode)}
                        </div>
                        <div>
                            <p className="text-sm text-brand-400 font-medium">{team?.name ?? 'Team'}</p>
                            <h1 className="text-3xl font-bold text-white">{meta.label}</h1>
                            <p className="text-sm text-gray-400 mt-1">{meta.description}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link to={`/team/${teamId}`} className="btn-secondary">
                        Team Overview
                    </Link>
                    <Link to={`/team/${teamId}/findings`} className="btn-secondary">
                        <Search className="w-4 h-4" />
                        All Findings
                    </Link>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Findings', value: findings.length, color: 'text-white' },
                    { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                    { label: 'Open', value: openCount, color: 'text-orange-400' },
                    { label: 'Affected Members', value: affectedMembers, color: 'text-brand-400' },
                ].map((item) => (
                    <div key={item.label} className="stat-card">
                        <p className="stat-label">{item.label}</p>
                        <p className={`stat-value ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Component Trend (7 Days)</p>
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
                                <Line type="monotone" dataKey="total" stroke={meta.color} strokeWidth={2} />
                                <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                            No recent component findings.
                        </div>
                    )}
                </div>

                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Severity Breakdown</p>
                    {severityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={severityData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={70}
                                    tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
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
                        <div className="h-60 flex items-center justify-center text-sm text-gray-500">
                            No severity data for this component.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-brand-400" />
                        <p className="text-sm font-semibold text-white">Member Distribution</p>
                    </div>

                    {memberData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={memberData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e2535',
                                        border: '1px solid #2a3347',
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                />
                                <Bar dataKey="total" fill={meta.color} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-sm text-gray-500">
                            No member data for this component.
                        </div>
                    )}
                </div>

                <div className="card space-y-4">
                    <p className="text-sm font-semibold text-white">Most Frequent Rules</p>
                    {ruleHits.length === 0 ? (
                        <div className="text-sm text-gray-500">No rule hits yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {ruleHits.map((item) => (
                                <div
                                    key={item.rule}
                                    className="rounded-xl border border-surface-border bg-surface p-4 flex items-center justify-between gap-3"
                                >
                                    <p className="text-sm text-white truncate">{item.rule}</p>
                                    <p className="text-sm font-bold text-brand-400">{item.count}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card space-y-4">
                    <p className="text-sm font-semibold text-white">Hotspot Files</p>
                    {fileHotspots.length === 0 ? (
                        <div className="text-sm text-gray-500">No hotspot files for this component.</div>
                    ) : (
                        <div className="space-y-3">
                            {fileHotspots.map((item) => (
                                <div
                                    key={item.file}
                                    className="rounded-xl border border-surface-border bg-surface p-4 flex items-center justify-between gap-3"
                                >
                                    <p className="text-sm text-white truncate">{item.file}</p>
                                    <p className="text-sm font-bold text-brand-400">{item.count}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card space-y-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <p className="text-sm font-semibold text-white">Latest Findings</p>
                    </div>

                    {latestFindings.length === 0 ? (
                        <div className="text-sm text-gray-500">No findings in this component yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {latestFindings.map((finding) => (
                                <Link
                                    key={finding.id}
                                    to={`/team/${teamId}/findings`}
                                    className="block rounded-xl border border-surface-border bg-surface p-4 hover:border-brand-500/30 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{finding.title}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {finding.profile?.full_name ?? 'Unknown member'}
                                                {finding.file_path ? ` · ${finding.file_path}` : ''}
                                                {finding.line_number ? `:${finding.line_number}` : ''}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}