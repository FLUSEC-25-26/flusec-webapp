import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeamStore } from '@/stores/teamStore'
import { getTeamMembers, getTeamFindings } from '@/lib/api'
import type { TeamMember, Finding } from '@/types'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
    Users, ShieldAlert, ChevronRight, Clock, AlertTriangle
} from 'lucide-react'

const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e'
}

function riskScoreColors(score: number) {
    if (score >= 70) return { bar: '#ef4444', text: 'text-red-400' }
    if (score >= 40) return { bar: '#f97316', text: 'text-orange-400' }
    return { bar: '#22c55e', text: 'text-green-400' }
}

export default function LeaderDashboardPage() {
    const { currentTeam } = useTeamStore()
    const [members, setMembers] = useState<TeamMember[]>([])
    const [findings, setFindings] = useState<Finding[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (!currentTeam) return
        Promise.all([
            getTeamMembers(currentTeam.id),
            getTeamFindings(currentTeam.id),
        ]).then(([m, f]) => {
            setMembers(m.data as TeamMember[])
            setFindings(f.data)
        }).catch(console.error)
            .finally(() => setLoading(false))
    }, [currentTeam])

    // Team-wide aggregated stats
    const totalFindings = findings.length
    const criticalCount = findings.filter(f => f.severity === 'critical').length
    const highCount = findings.filter(f => f.severity === 'high').length
    const resolvedCount = findings.filter(f => f.status === 'resolved').length

    // Per-member comparison bar chart data
    const memberChartData = members.map(m => ({
        name: m.profile?.full_name?.split(' ')[0] ?? 'Member',
        total: m.stats?.total ?? 0,
        critical: m.stats?.critical ?? 0,
    }))

    // Module distribution across team
    const moduleMap: Record<string, number> = {}
    findings.forEach(f => { moduleMap[f.module] = (moduleMap[f.module] ?? 0) + 1 })
    const moduleData = Object.entries(moduleMap).map(([name, value]) => ({ name, value }))
    const MODULE_COLORS: Record<string, string> = {
        HSD: '#a855f7', SNC: '#06b6d4', SDS: '#14b8a6', IVS: '#ec4899'
    }

    // Top 5 critical findings
    const topFindings = findings
        .filter(f => f.severity === 'critical' && f.status === 'open')
        .slice(0, 5)

    if (!currentTeam) {
        return (
            <div className="page-container flex flex-col items-center justify-center h-64 gap-4">
                <ShieldAlert className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400">You are not part of a team yet.</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="page-container flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
        )
    }

    return (
        <div className="page-container space-y-6 animate-slide-up">
            {/* Header */}
            <div>
                <h1 className="section-title flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-400" />
                    Team Overview
                </h1>
                <p className="section-subtitle">{currentTeam.name} — Security Intelligence Dashboard</p>
            </div>

            {/* Team-wide stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Findings', value: totalFindings, color: 'text-white' },
                    { label: 'Critical', value: criticalCount, color: 'text-red-400' },
                    { label: 'High', value: highCount, color: 'text-orange-400' },
                    { label: 'Resolved', value: resolvedCount, color: 'text-green-400' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="stat-card">
                        <p className="stat-label">{label}</p>
                        <p className={`stat-value ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Member comparison + module breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Module Distribution (Team)</p>
                    {moduleData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={moduleData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={40} />
                                <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {moduleData.map(entry => <Cell key={entry.name} fill={MODULE_COLORS[entry.name] ?? '#6b7280'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data yet</div>}
                </div>
            </div>

            {/* Member cards grid */}
            <div>
                <p className="text-sm font-semibold text-white mb-3">Team Members</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map(member => {
                        const score = member.stats?.risk_score ?? 0
                        const { bar: barColor, text: textColor } = riskScoreColors(score)
                        return (
                            <button
                                key={member.id}
                                onClick={() => navigate(`/team/member/${member.user_id}`)}
                                className="card-hover text-left space-y-4"
                            >
                                {/* Member header */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{member.profile?.full_name}</p>
                                        <span className={`badge ${member.role === 'leader' ? 'badge-info' : 'badge-low'}`}>{member.role}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400" />
                                </div>

                                {/* Stats row */}
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

                                {/* Risk score bar */}
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

                                {/* Last scanned */}
                                {member.stats?.last_scanned_at && (
                                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                        <Clock className="w-3 h-3" />
                                        {new Date(member.stats.last_scanned_at).toLocaleDateString()}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Top critical findings */}
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
                                <span className={`chip-${f.module.toLowerCase()} flex-shrink-0`}>{f.module}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
