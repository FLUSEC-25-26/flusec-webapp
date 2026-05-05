import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getTeam, getTeamMembers, regenerateInvite, removeTeamMember, updateTeam } from '@/lib/api'
import type { Team, TeamMember } from '@/types'
import {
    Settings,
    Copy,
    CheckCheck,
    RefreshCw,
    Users,
    Loader2,
    ArrowLeft,
    Save,
    AlertCircle,
    Hash,
    ShieldCheck,
    Trash2,
    Crown,
} from 'lucide-react'

export default function TeamSettingsPage() {
    const { teamId } = useParams<{ teamId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const [team, setTeam] = useState<Team | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [regenerating, setRegenerating] = useState(false)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const isLeader = useMemo(() => {
        return Boolean(team?.leader_id && user?.id === team.leader_id)
    }, [team?.leader_id, user?.id])

    async function load() {
        if (!teamId) return

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const [teamRes, membersRes] = await Promise.all([
                getTeam(teamId),
                getTeamMembers(teamId),
            ])

            setTeam(teamRes.data)
            setMembers(membersRes.data)
            setName(teamRes.data.name ?? '')
            setDescription(teamRes.data.description ?? '')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load team settings')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [teamId])

    const hasChanges = useMemo(() => {
        if (!team) return false
        return name !== team.name || description !== (team.description ?? '')
    }, [team, name, description])

    function handleCopy() {
        if (!team?.invite_code) return
        navigator.clipboard.writeText(team.invite_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    async function handleSave() {
        if (!teamId || !isLeader) return

        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const res = await updateTeam(teamId, {
                name,
                description,
            })

            setTeam(res.data)
            setName(res.data.name ?? '')
            setDescription(res.data.description ?? '')
            setSuccess('Team settings updated successfully.')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update team settings')
        } finally {
            setSaving(false)
        }
    }

    async function handleRegenerateInvite() {
        if (!teamId || !isLeader) return

        setRegenerating(true)
        setError('')
        setSuccess('')

        try {
            const res = await regenerateInvite(teamId)
            setTeam(res.data)
            setSuccess('Invite code regenerated successfully.')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to regenerate invite code')
        } finally {
            setRegenerating(false)
        }
    }

    async function handleRemoveMember(member: TeamMember) {
        if (!teamId || !isLeader) return
        if (member.user_id === team?.leader_id) return

        const confirmed = window.confirm(
            `Remove ${member.profile?.full_name ?? 'this member'} from the team?`
        )
        if (!confirmed) return

        setError('')
        setSuccess('')

        try {
            await removeTeamMember(teamId, member.user_id)
            setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
            setSuccess('Member removed successfully.')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to remove member')
        }
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    if (!team) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <button
                    type="button"
                    onClick={() => navigate('/team')}
                    className="btn-secondary inline-flex"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Team Hub
                </button>
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error || 'Team not found.'}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => navigate(`/team/${team.id}`)}
                        className="btn-secondary inline-flex"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Team
                    </button>

                    <div>
                        <p className="text-sm text-brand-400 font-medium">Team Settings</p>
                        <h1 className="text-3xl font-bold text-white">{team.name}</h1>
                        {team.description && (
                            <p className="text-sm text-gray-400 mt-1">{team.description}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary" onClick={() => void load()}>
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>

                    <button
                        type="button"
                        className="btn-primary"
                        disabled={!isLeader || !hasChanges || saving}
                        onClick={() => void handleSave()}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>

            {!isLeader && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    You can view team settings, but only the team leader can change them.
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-300">
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-surface-border bg-surface-secondary p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-brand-400" />
                        <h2 className="text-base font-semibold text-white">General Details</h2>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="text-sm text-gray-300">Team Name</span>
                        <input
                            className="input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!isLeader}
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="text-sm text-gray-300">Description</span>
                        <textarea
                            className="input min-h-24"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!isLeader}
                        />
                    </label>

                    <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-brand-400" />
                            <p className="text-sm font-medium text-white">Team ID</p>
                        </div>
                        <p className="text-sm font-mono text-brand-400">
                            {team.team_code ?? 'Not available'}
                        </p>
                        <p className="text-xs text-gray-500">
                            This is the public team code used by the VS Code extension login.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-surface-border bg-surface-secondary p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-brand-400" />
                        <h2 className="text-base font-semibold text-white">Invite Code</h2>
                    </div>

                    <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Current Invite Code</p>
                        <p className="text-2xl font-extrabold font-mono text-brand-400 tracking-[0.25em]">
                            {team.invite_code}
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={handleCopy} className="btn-secondary">
                                {copied ? (
                                    <>
                                        <CheckCheck className="w-4 h-4 text-green-400" /> Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" /> Copy
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleRegenerateInvite()}
                                disabled={!isLeader || regenerating}
                                className="btn-secondary"
                            >
                                {regenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                Regenerate
                            </button>
                        </div>

                        <p className="text-xs text-gray-500">
                            Share this code with new members so they can join your team.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-surface-border bg-surface-secondary p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-400" />
                    <h2 className="text-base font-semibold text-white">
                        Team Members ({members.length})
                    </h2>
                </div>

                {members.length === 0 ? (
                    <div className="rounded-xl border border-surface-border bg-surface p-4 text-sm text-gray-400">
                        No members found.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {members.map((member) => {
                            const isLeaderMember = member.user_id === team.leader_id

                            return (
                                <div
                                    key={member.id}
                                    className="rounded-xl border border-surface-border bg-surface p-4 flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {member.profile?.full_name ?? 'Unknown'}
                                            </p>
                                            {isLeaderMember && <Crown className="w-4 h-4 text-yellow-400" />}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Joined {new Date(member.joined_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            member.role === 'leader'
                                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                                : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                                        }`}
                                    >
                                        {member.role}
                                    </span>

                                    {isLeader && !isLeaderMember && (
                                        <button
                                            type="button"
                                            onClick={() => void handleRemoveMember(member)}
                                            className="btn-secondary"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Remove
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}