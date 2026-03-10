import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getMyFindings, getMemberStats, getMemberTimeline, getMemberFindings } from '@/lib/api'
import type { Finding, MemberStats, TimelineDataPoint } from '@/types'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
    ShieldAlert, TrendingUp, Clock,
    AlertTriangle, Activity, Bug, FileCode2
} from 'lucide-react'

const MODULE_COLORS: Record<string, string> = {
    HSD: '#a855f7', SNC: '#06b6d4', SDS: '#14b8a6', IVS: '#ec4899'
}
const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e'
}

interface Props { isLeaderView?: boolean }

export default function MemberDashboardPage({ isLeaderView = false }: Props) {
    const { user } = useAuthStore()
    const { userId } = useParams<{ userId?: string }>()
    const targetUserId = isLeaderView && userId ? userId : user?.id ?? ''

    const [findings, setFindings] = useState<Finding[]>([])
    const [stats, setStats] = useState<MemberStats | null>(null)
    const [timeline, setTimeline] = useState<TimelineDataPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState<string>('all')

    useEffect(() => {
        if (!targetUserId) return
        setLoading(true)
        Promise.all([
            isLeaderView ? getMemberFindings(targetUserId) : getMyFindings(),
            getMemberStats(targetUserId),
            getMemberTimeline(targetUserId),
        ]).then(([f, s, t]) => {
            setFindings(f.data)
            setStats(s.data)
            setTimeline(t.data)
        }).catch(console.error)
            .finally(() => setLoading(false))
    }, [targetUserId, isLeaderView])

    const filteredFindings = activeFilter === 'all'
        ? findings
        : findings.filter(f => f.severity === activeFilter || f.module === activeFilter)

    const moduleData = stats ? Object.entries(stats.by_module).map(([name, value]) => ({ name, value })) : []

    const sevData = stats
        ? [
            { name: 'Critical', value: stats.critical, color: SEV_COLORS.critical },
            { name: 'High', value: stats.high, color: SEV_COLORS.high },
            { name: 'Medium', value: stats.medium, color: SEV_COLORS.medium },
            { name: 'Low', value: stats.low, color: SEV_COLORS.low },
        ].filter(d => d.value > 0)
        : []

    const riskColor = !stats ? 'text-gray-400'
        : stats.risk_score >= 70 ? 'text-red-400'
            : stats.risk_score >= 40 ? 'text-orange-400'
                : 'text-green-400'

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
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="section-title flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-brand-400" />
                        {isLeaderView ? 'Member Dashboard' : 'My Security Dashboard'}
                    </h1>
                    <p className="section-subtitle">
                        {stats?.last_scanned_at
                            ? `Last scan: ${new Date(stats.last_scanned_at).toLocaleString()}`
                            : 'No scans yet — sync from VS Code to see findings'}
                    </p>
                </div>
                {stats && (
                    <div className="card py-3 px-5 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Risk Score</p>
                        <p className={`text-3xl font-extrabold ${riskColor}`}>{stats.risk_score}</p>
                        <p className="text-[10px] text-gray-500">/100</p>
                    </div>
                )}
            </div>

            {/* Stat cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Findings', value: stats.total, icon: Bug, color: 'text-white' },
                        { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: 'text-red-400' },
                        { label: 'High', value: stats.high, icon: TrendingUp, color: 'text-orange-400' },
                        { label: 'Medium / Low', value: stats.medium + stats.low, icon: Activity, color: 'text-yellow-400' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="stat-card">
                            <div className="flex items-center justify-between">
                                <p className="stat-label">{label}</p>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <p className={`stat-value ${color}`}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Timeline */}
                <div className="card lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-4 h-4 text-brand-400" />
                        <p className="text-sm font-semibold text-white">Vulnerability Timeline</p>
                    </div>
                    {timeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={timeline}>
                                <defs>
                                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#05ccba" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#05ccba" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }}
                                    labelStyle={{ color: '#9ca3af' }} itemStyle={{ color: '#05ccba' }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#05ccba" strokeWidth={2} fill="url(#totalGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                            No scan history yet
                        </div>
                    )}
                </div>

                {/* Severity donut */}
                <div className="card">
                    <p className="text-sm font-semibold text-white mb-4">Severity Distribution</p>
                    {sevData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={sevData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                    {sevData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }}
                                />
                                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data</div>
                    )}
                </div>
            </div>

            {/* Module breakdown */}
            {moduleData.length > 0 && (
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <FileCode2 className="w-4 h-4 text-brand-400" />
                        <p className="text-sm font-semibold text-white">Findings by Advisor Module</p>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={moduleData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} width={40} />
                            <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {moduleData.map((entry) => <Cell key={entry.name} fill={MODULE_COLORS[entry.name] ?? '#6b7280'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Findings table */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-white">All Findings</p>
                    <div className="flex gap-2">
                        {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                            <button key={f} onClick={() => setActiveFilter(f)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors
                  ${activeFilter === f ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40' : 'text-gray-500 hover:text-gray-300'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredFindings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        No findings match this filter.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {filteredFindings.map(finding => (
                            <div key={finding.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-tertiary border border-surface-border hover:border-surface-hover transition-colors">
                                <span className={`badge mt-0.5 flex-shrink-0 badge-${finding.severity}`}>{finding.severity}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{finding.title}</p>
                                </div>
                                <span className={`chip-${finding.module.toLowerCase()} flex-shrink-0`}>{finding.module}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
