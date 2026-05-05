import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTeam, getTeamFindings } from '@/lib/api'
import type { Finding, Team, TaintFlowStep } from '@/types'
import {
    AlertTriangle,
    ArrowLeft,
    ChevronRight,
    FileCode2,
    Loader2,
    Search,
    ShieldCheck,
} from 'lucide-react'

type DashboardComponentCode = 'ALL' | 'HSD' | 'NET' | 'IDS' | 'IIV'

function toComponentCode(module: Finding['module']): Exclude<DashboardComponentCode, 'ALL'> {
    if (module === 'HSD') return 'HSD'
    if (module === 'SNC') return 'NET'
    if (module === 'SDS') return 'IDS'
    return 'IIV'
}

function severityClass(severity: Finding['severity']) {
    if (severity === 'critical') return 'badge-critical'
    if (severity === 'high') return 'badge-high'
    if (severity === 'medium') return 'badge-medium'
    return 'badge-low'
}

function riskBadgeClass(level?: Finding['risk_level']) {
    if (level === 'critical') return 'bg-red-500/10 text-red-400 border border-red-500/20'
    if (level === 'high') return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
    if (level === 'medium') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
    return 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
}

function renderTaintFlow(steps?: TaintFlowStep[] | null) {
    if (!steps || steps.length === 0) {
        return <p className="text-sm text-gray-500">No taint flow details available.</p>
    }

    return (
        <div className="space-y-2">
            {steps.map((step, index) => (
                <div
                    key={`${step.type ?? 'flow'}-${index}`}
                    className="rounded-lg border border-surface-border bg-surface p-3"
                >
                    <p className="text-sm font-semibold text-white">
                        {step.type ?? 'Flow'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {step.description ?? 'No description'}
                    </p>
                    {(step.line || step.column) && (
                        <p className="text-xs text-gray-500 mt-1">
                            Line {step.line ?? '-'} · Column {step.column ?? '-'}
                        </p>
                    )}
                </div>
            ))}
        </div>
    )
}

export default function TeamFindingsPage() {
    const { teamId } = useParams<{ teamId: string }>()
    const navigate = useNavigate()

    const [team, setTeam] = useState<Team | null>(null)
    const [findings, setFindings] = useState<Finding[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [search, setSearch] = useState('')
    const [componentFilter, setComponentFilter] = useState<DashboardComponentCode>('ALL')
    const [severityFilter, setSeverityFilter] = useState<'ALL' | Finding['severity']>('ALL')
    const [statusFilter, setStatusFilter] = useState<'ALL' | Finding['status']>('ALL')
    const [memberFilter, setMemberFilter] = useState('ALL')
    const [selectedId, setSelectedId] = useState<string | null>(null)

    async function load() {
        if (!teamId) return

        setLoading(true)
        setError('')

        try {
            const [teamRes, findingsRes] = await Promise.all([
                getTeam(teamId),
                getTeamFindings(teamId),
            ])

            setTeam(teamRes.data)
            setFindings(findingsRes.data)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load team findings')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [teamId])

    const memberOptions = useMemo(() => {
        const map = new Map<string, string>()

        findings.forEach((finding) => {
            map.set(finding.uploaded_by, finding.profile?.full_name ?? 'Unknown member')
        })

        return [...map.entries()].map(([userId, name]) => ({ userId, name }))
    }, [findings])

    const filteredFindings = useMemo(() => {
        const term = search.trim().toLowerCase()

        return findings.filter((finding) => {
            const matchesSearch =
                !term ||
                finding.title.toLowerCase().includes(term) ||
                (finding.description ?? '').toLowerCase().includes(term) ||
                (finding.file_path ?? '').toLowerCase().includes(term) ||
                (finding.rule_id ?? '').toLowerCase().includes(term) ||
                (finding.secret_type ?? '').toLowerCase().includes(term) ||
                (finding.profile?.full_name ?? '').toLowerCase().includes(term)

            const matchesComponent =
                componentFilter === 'ALL' || toComponentCode(finding.module) === componentFilter

            const matchesSeverity =
                severityFilter === 'ALL' || finding.severity === severityFilter

            const matchesStatus =
                statusFilter === 'ALL' || finding.status === statusFilter

            const matchesMember =
                memberFilter === 'ALL' || finding.uploaded_by === memberFilter

            return (
                matchesSearch &&
                matchesComponent &&
                matchesSeverity &&
                matchesStatus &&
                matchesMember
            )
        })
    }, [findings, search, componentFilter, severityFilter, statusFilter, memberFilter])

    useEffect(() => {
        setSelectedId(filteredFindings[0]?.id ?? null)
    }, [search, componentFilter, severityFilter, statusFilter, memberFilter, findings])

    const selectedFinding =
        filteredFindings.find((finding) => finding.id === selectedId) ??
        filteredFindings[0] ??
        null

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

                    <div>
                        <p className="text-sm text-brand-400 font-medium">Team Findings</p>
                        <h1 className="text-3xl font-bold text-white">{team?.name ?? 'Findings'}</h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Full team-wide findings list with filters and detailed risk insight.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary" onClick={() => void load()}>
                        Refresh
                    </button>
                    {teamId && (
                        <Link to={`/team/${teamId}`} className="btn-secondary">
                            Team Overview
                        </Link>
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Total', value: findings.length, color: 'text-white' },
                    { label: 'Critical', value: findings.filter((f) => f.severity === 'critical').length, color: 'text-red-400' },
                    { label: 'Open', value: findings.filter((f) => f.status === 'open').length, color: 'text-orange-400' },
                    { label: 'Resolved', value: findings.filter((f) => f.status === 'resolved').length, color: 'text-green-400' },
                    { label: 'Filtered', value: filteredFindings.length, color: 'text-brand-400' },
                ].map((item) => (
                    <div key={item.label} className="stat-card">
                        <p className="stat-label">{item.label}</p>
                        <p className={`stat-value ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="card grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="xl:col-span-2">
                    <label className="label">Search</label>
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            className="input pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search title, file, secret type, member..."
                        />
                    </div>
                </div>

                <div>
                    <label className="label">Component</label>
                    <select
                        className="input"
                        value={componentFilter}
                        onChange={(e) => setComponentFilter(e.target.value as DashboardComponentCode)}
                    >
                        <option value="ALL">All</option>
                        <option value="HSD">HSD</option>
                        <option value="NET">NET</option>
                        <option value="IDS">IDS</option>
                        <option value="IIV">IIV</option>
                    </select>
                </div>

                <div>
                    <label className="label">Severity</label>
                    <select
                        className="input"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as any)}
                    >
                        <option value="ALL">All</option>
                        <option value="critical">critical</option>
                        <option value="high">high</option>
                        <option value="medium">medium</option>
                        <option value="low">low</option>
                    </select>
                </div>

                <div>
                    <label className="label">Status</label>
                    <select
                        className="input"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="ALL">All</option>
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                    </select>
                </div>

                <div>
                    <label className="label">Member</label>
                    <select
                        className="input"
                        value={memberFilter}
                        onChange={(e) => setMemberFilter(e.target.value)}
                    >
                        <option value="ALL">All</option>
                        {memberOptions.map((member) => (
                            <option key={member.userId} value={member.userId}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
                <div className="card space-y-3">
                    {filteredFindings.length === 0 ? (
                        <div className="text-sm text-gray-500 py-8 text-center">
                            No findings match the selected filters.
                        </div>
                    ) : (
                        filteredFindings.map((finding) => (
                            <button
                                key={finding.id}
                                type="button"
                                onClick={() => setSelectedId(finding.id)}
                                className={`w-full text-left rounded-xl border p-4 transition-all ${
                                    selectedFinding?.id === finding.id
                                        ? 'border-brand-500/40 bg-brand-500/5'
                                        : 'border-surface-border bg-surface hover:border-brand-500/25'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-semibold text-white truncate">
                                            {finding.title}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {finding.profile?.full_name ?? 'Unknown member'}
                                            {finding.file_path ? ` · ${finding.file_path}` : ''}
                                            {finding.line_number ? `:${finding.line_number}` : ''}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={severityClass(finding.severity)}>
                                            {finding.severity}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="badge-low">{toComponentCode(finding.module)}</span>
                                    <span className="badge-low">{finding.status}</span>
                                    {finding.risk_level && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskBadgeClass(finding.risk_level)}`}>
                                            risk: {finding.risk_level}
                                        </span>
                                    )}
                                    {finding.risk_score != null && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-surface-tertiary text-gray-300 border border-surface-border">
                                            score: {finding.risk_score}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="card sticky top-6">
                    {selectedFinding ? (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm text-brand-400 font-medium">Finding Detail</p>
                                </div>
                                <h2 className="text-xl font-bold text-white">{selectedFinding.title}</h2>
                                <p className="text-sm text-gray-400">
                                    {selectedFinding.description || 'No additional description provided.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Component</p>
                                    <p className="text-sm font-semibold text-white">
                                        {toComponentCode(selectedFinding.module)}
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Severity</p>
                                    <p className="text-sm font-semibold text-white">
                                        {selectedFinding.severity}
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Original Severity</p>
                                    <p className="text-sm font-semibold text-white">
                                        {selectedFinding.original_severity ?? 'N/A'}
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                                    <p className="text-sm font-semibold text-white">
                                        {selectedFinding.status}
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Risk Level</p>
                                    <p className="text-sm font-semibold text-white">
                                        {selectedFinding.risk_level ?? 'N/A'}
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl border border-surface-border p-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Risk Score</p>
                                    <p className="text-sm font-semibold text-white">
                                        {selectedFinding.risk_score ?? 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-surface-border bg-surface p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileCode2 className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Location</p>
                                </div>
                                <p className="text-sm text-gray-300 break-all">
                                    {selectedFinding.file_path ?? 'Unknown file'}
                                    {selectedFinding.line_number ? `:${selectedFinding.line_number}` : ''}
                                    {selectedFinding.column_number ? `:${selectedFinding.column_number}` : ''}
                                </p>
                                {selectedFinding.rule_id && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Rule ID: {selectedFinding.rule_id}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-2">
                                    Uploaded: {new Date(selectedFinding.created_at).toLocaleString()}
                                </p>
                            </div>

                            {(selectedFinding.function_name ||
                                selectedFinding.complexity != null ||
                                selectedFinding.nesting_depth != null ||
                                selectedFinding.function_loc != null ||
                                selectedFinding.secret_type) && (
                                <div className="rounded-xl border border-surface-border bg-surface p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck className="w-4 h-4 text-brand-400" />
                                        <p className="text-sm font-semibold text-white">Analysis Context</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Function</p>
                                            <p className="text-sm text-white">{selectedFinding.function_name ?? 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Secret Type</p>
                                            <p className="text-sm text-white">{selectedFinding.secret_type ?? 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Complexity</p>
                                            <p className="text-sm text-white">{selectedFinding.complexity ?? 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Nesting Depth</p>
                                            <p className="text-sm text-white">{selectedFinding.nesting_depth ?? 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Function LOC</p>
                                            <p className="text-sm text-white">{selectedFinding.function_loc ?? 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Data Type</p>
                                            <p className="text-sm text-white">{selectedFinding.data_type ?? 'N/A'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Storage Context</p>
                                            <p className="text-sm text-white">{selectedFinding.storage_context ?? 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-surface-border bg-surface p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Code Snippet</p>
                                </div>

                                {selectedFinding.code_snippet ? (
                                    <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                                        {selectedFinding.code_snippet}
                                    </pre>
                                ) : (
                                    <p className="text-sm text-gray-500">No code snippet available.</p>
                                )}
                            </div>

                            <div className="rounded-xl border border-surface-border bg-surface p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Taint Flow</p>
                                </div>
                                {renderTaintFlow(selectedFinding.taint_flow)}
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-sm text-gray-500">
                            Select a finding to inspect full details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}