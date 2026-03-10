import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createTeam, joinTeam } from '@/lib/api'
import {
    ShieldCheck, Users, Plus, Hash, Loader2, AlertCircle,
    Crown, User, ArrowRight, Copy, CheckCheck, RefreshCw, Trash2
} from 'lucide-react'

interface MyTeam {
    id: string
    name: string
    description: string | null
    invite_code: string
    leader_id: string
    created_at: string
    myRole: 'leader' | 'member'
}

type PanelMode = null | 'create' | 'join'

export default function TeamOverviewPage() {
    const navigate = useNavigate()
    const [teams, setTeams] = useState<MyTeam[]>([])
    const [loadingTeams, setLoadingTeams] = useState(true)
    const [panel, setPanel] = useState<PanelMode>(null)

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmTeam, setConfirmTeam] = useState<MyTeam | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteErr, setDeleteErr] = useState('')

    // Create-team form state
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [createdCode, setCreatedCode] = useState('')
    const [copied, setCopied] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createErr, setCreateErr] = useState('')

    // Join-team form state
    const [joinCode, setJoinCode] = useState('')
    const [joining, setJoining] = useState(false)
    const [joinErr, setJoinErr] = useState('')

    async function loadTeams() {
        setLoadingTeams(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/teams/my-teams', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            if (res.ok) {
                const json = await res.json() as { data: MyTeam[] }
                setTeams(json.data)
            }
        } finally {
            setLoadingTeams(false)
        }
    }

    useEffect(() => { loadTeams() }, [])

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setCreateErr('')
        setCreating(true)
        try {
            const res = await createTeam(newName, newDesc)
            setCreatedCode(res.data.invite_code)
            setNewName('')
            setNewDesc('')
            await loadTeams()
        } catch (err: unknown) {
            setCreateErr(err instanceof Error ? err.message : 'Failed to create team')
        } finally {
            setCreating(false)
        }
    }

    async function handleJoin(e: React.FormEvent) {
        e.preventDefault()
        setJoinErr('')
        setJoining(true)
        try {
            await joinTeam(joinCode.toUpperCase().trim())
            setJoinCode('')
            setPanel(null)
            await loadTeams()
        } catch (err: unknown) {
            setJoinErr(err instanceof Error ? err.message : 'Invalid invite code')
        } finally {
            setJoining(false)
        }
    }

    async function handleDeleteConfirm() {
        if (!confirmTeam) return
        setDeleteLoading(true)
        setDeleteErr('')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`/api/teams/${confirmTeam.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session?.access_token}` }
            })
            if (!res.ok) {
                const json = await res.json() as { error: string }
                setDeleteErr(json.error ?? 'Failed to delete team')
                return
            }
            setConfirmTeam(null)
            await loadTeams()
        } catch {
            setDeleteErr('Network error. Please try again.')
        } finally {
            setDeleteLoading(false)
            setDeletingId(null)
        }
    }

    function handleCopy() {
        navigator.clipboard.writeText(createdCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const myLeaderTeams = teams.filter(t => t.myRole === 'leader')
    const myMemberTeams = teams.filter(t => t.myRole === 'member')

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">

            {/* ── Delete confirmation modal ── */}
            {confirmTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-surface-secondary border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Delete Team</h3>
                                <p className="text-xs text-gray-400">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-300">
                            Are you sure you want to delete <span className="font-semibold text-white">"{confirmTeam.name}"</span>?
                            All members, findings, and scan sessions will be permanently removed.
                        </p>
                        {deleteErr && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />{deleteErr}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setConfirmTeam(null); setDeleteErr('') }}
                                className="btn-secondary flex-1 justify-center"
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
                            >
                                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {deleteLoading ? 'Deleting…' : 'Delete Team'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Team Hub</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Manage your security teams, create new ones or join existing ones.
                    </p>
                </div>
                <button onClick={loadTeams} className="btn-secondary" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                    onClick={() => setPanel(panel === 'create' ? null : 'create')}
                    className={`card flex items-center gap-4 text-left transition-all ${panel === 'create' ? 'border-brand-500/50 bg-brand-500/5' : 'hover:border-brand-500/30'}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow-brand">
                        <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-semibold text-white">Create a Team</p>
                        <p className="text-xs text-gray-400">Start a new security team and invite members</p>
                    </div>
                </button>

                <button
                    onClick={() => setPanel(panel === 'join' ? null : 'join')}
                    className={`card flex items-center gap-4 text-left transition-all ${panel === 'join' ? 'border-brand-500/50 bg-brand-500/5' : 'hover:border-brand-500/30'}`}
                >
                    <div className="w-10 h-10 rounded-xl bg-surface-tertiary border border-surface-border flex items-center justify-center flex-shrink-0">
                        <Hash className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-white">Join a Team</p>
                        <p className="text-xs text-gray-400">Enter an invite code from your team leader</p>
                    </div>
                </button>
            </div>

            {/* Create team panel */}
            {panel === 'create' && (
                <div className="card space-y-4 animate-slide-up">
                    {createdCode ? (
                        <div className="text-center space-y-4">
                            <div className="flex justify-center">
                                <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
                                    <ShieldCheck className="w-7 h-7 text-brand-400" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Team Created! 🎉</h3>
                                <p className="text-sm text-gray-400">Share this invite code with your members</p>
                            </div>
                            <div className="bg-surface-tertiary rounded-xl p-4 border border-surface-border">
                                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Invite Code</p>
                                <p className="text-3xl font-extrabold font-mono text-brand-400 tracking-[0.25em]">
                                    {createdCode}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleCopy} className="btn-secondary flex-1 justify-center">
                                    {copied ? <><CheckCheck className="w-4 h-4 text-green-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
                                </button>
                                <button onClick={() => { setCreatedCode(''); setPanel(null) }} className="btn-primary flex-1 justify-center">
                                    Done <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="font-semibold text-white">Create New Team</h3>
                            <form onSubmit={handleCreate} className="space-y-3">
                                <div>
                                    <label className="label">Team Name</label>
                                    <input className="input" placeholder="e.g. Flutter App Security Team"
                                        value={newName} onChange={e => setNewName(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="label">Description <span className="text-gray-600 normal-case font-normal">(optional)</span></label>
                                    <textarea className="input resize-none h-16" placeholder="What is this team working on?"
                                        value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                                </div>
                                {createErr && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />{createErr}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setPanel(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                                    <button type="submit" disabled={creating} className="btn-primary flex-1 justify-center">
                                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {creating ? 'Creating…' : 'Create Team'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            )}

            {/* Join team panel */}
            {panel === 'join' && (
                <div className="card space-y-4 animate-slide-up">
                    <h3 className="font-semibold text-white">Join a Team</h3>
                    <form onSubmit={handleJoin} className="space-y-3">
                        <div>
                            <label className="label">Invite Code</label>
                            <input
                                className="input text-center font-mono text-xl tracking-[0.3em] uppercase"
                                placeholder="ABC123"
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value)}
                                maxLength={6}
                                required
                            />
                        </div>
                        {joinErr && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />{joinErr}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setPanel(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                            <button type="submit" disabled={joining || joinCode.length < 6} className="btn-primary flex-1 justify-center">
                                {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                                {joining ? 'Joining…' : 'Join Team'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Teams list */}
            {loadingTeams ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                </div>
            ) : teams.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-surface-border flex items-center justify-center mx-auto">
                        <Users className="w-7 h-7 text-gray-500" />
                    </div>
                    <p className="text-white font-semibold">No teams yet</p>
                    <p className="text-sm text-gray-400">Create a new team or join one using an invite code above.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {myLeaderTeams.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Crown className="w-4 h-4 text-yellow-500" /> Teams I Lead
                            </h2>
                            <div className="space-y-3">
                                {myLeaderTeams.map(team => (
                                    <TeamCard
                                        key={team.id}
                                        team={team}
                                        deleting={deletingId === team.id}
                                        onClick={() => navigate(`/team/${team.id}`)}
                                        onDelete={() => { setConfirmTeam(team); setDeletingId(team.id) }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {myMemberTeams.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <User className="w-4 h-4 text-brand-400" /> Teams I've Joined
                            </h2>
                            <div className="space-y-3">
                                {myMemberTeams.map(team => (
                                    <TeamCard
                                        key={team.id}
                                        team={team}
                                        deleting={false}
                                        onClick={() => navigate(`/team/${team.id}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function TeamCard({
    team, onClick, onDelete, deleting
}: {
    team: MyTeam
    onClick: () => void
    onDelete?: () => void
    deleting: boolean
}) {
    return (
        <div className="card flex items-center justify-between hover:border-brand-500/30 transition-all group">
            <button onClick={onClick} className="flex items-center gap-4 flex-1 text-left min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-glow-brand/50">
                    <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-white truncate">{team.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${team.myRole === 'leader'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            }`}>
                            {team.myRole === 'leader' ? '👑 Leader' : 'Member'}
                        </span>
                    </div>
                    {team.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{team.description}</p>}
                </div>
            </button>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {/* Delete button — leaders only */}
                {onDelete && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete() }}
                        disabled={deleting}
                        title="Delete team"
                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
                <button onClick={onClick} className="p-1">
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                </button>
            </div>
        </div>
    )
}
