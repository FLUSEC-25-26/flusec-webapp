import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import type { TeamMember } from '@/types'
import {
    Settings, Copy, CheckCheck, RefreshCw, Users, Loader2,
    ArrowLeft, Save, Trash2, AlertTriangle, UserMinus, ShieldCheck, Crown
} from 'lucide-react'

interface TeamInfo {
    id: string
    name: string
    description: string | null
    invite_code: string
    leader_id: string
}

export default function TeamSettingsPage() {
    const { teamId } = useParams<{ teamId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const [team, setTeam] = useState<TeamInfo | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState('')

    const isLeader = team ? user?.id === team.leader_id : false

    // Edit form state
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')

    // Invite code state
    const [inviteCode, setInviteCode] = useState('')
    const [copied, setCopied] = useState(false)
    const [regenerating, setRegenerating] = useState(false)

    // Remove member state
    const [removingId, setRemovingId] = useState<string | null>(null)

    // Delete team state
    const [showDelete, setShowDelete] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteErr, setDeleteErr] = useState('')

    async function load() {
        if (!teamId) return
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        setToken(session.access_token)

        const [teamRes, membersRes] = await Promise.all([
            fetch(`/api/teams/${teamId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            }).then(r => r.json()),
            fetch(`/api/teams/${teamId}/members`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            }).then(r => r.json()),
        ])
        if (teamRes.data) {
            setTeam(teamRes.data)
            setEditName(teamRes.data.name)
            setEditDesc(teamRes.data.description ?? '')
            setInviteCode(teamRes.data.invite_code)
        }
        if (membersRes.data) setMembers(membersRes.data as TeamMember[])
        setLoading(false)
    }

    useEffect(() => { load() }, [teamId])

    // ─── Save team info ─────────────────────────────────────────
    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!team) return
        setSaving(true)
        setSaveMsg('')
        const res = await fetch(`/api/teams/${teamId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: editName, description: editDesc }),
        })
        if (res.ok) {
            const json = await res.json() as { data: TeamInfo }
            setTeam(json.data)
            setSaveMsg('✅ Changes saved!')
            setTimeout(() => setSaveMsg(''), 3000)
        }
        setSaving(false)
    }

    // ─── Regenerate invite code ──────────────────────────────────
    async function handleRegen() {
        if (!team) return
        setRegenerating(true)
        const res = await fetch(`/api/teams/${teamId}/invite/regenerate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            const json = await res.json() as { data: { invite_code: string } }
            setInviteCode(json.data.invite_code)
        }
        setRegenerating(false)
    }

    function handleCopy() {
        navigator.clipboard.writeText(inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ─── Remove member ───────────────────────────────────────────
    async function handleRemove(userId: string) {
        setRemovingId(userId)
        await fetch(`/api/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        setMembers(prev => prev.filter(m => m.user_id !== userId))
        setRemovingId(null)
    }

    // ─── Delete team ─────────────────────────────────────────────
    async function handleDelete() {
        setDeleteLoading(true)
        setDeleteErr('')
        const res = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            navigate('/team')
        } else {
            const json = await res.json() as { error: string }
            setDeleteErr(json.error ?? 'Failed to delete team')
            setDeleteLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    if (!team) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-gray-400">Team not found.</p>
                <button onClick={() => navigate('/team')} className="btn-secondary">
                    <ArrowLeft className="w-4 h-4" /> Back to Teams
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(`/team/${teamId}`)} className="btn-ghost p-2 text-gray-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Team Settings</h1>
                        <p className="text-sm text-gray-400">{team.name}</p>
                    </div>
                </div>
            </div>

            {/* ── General Info ── */}
            <div className="card space-y-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                    <h2 className="text-sm font-semibold text-white">General Information</h2>
                </div>
                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="label">Team Name</label>
                        <input
                            className="input"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            disabled={!isLeader}
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Description <span className="text-gray-600 font-normal normal-case">(optional)</span></label>
                        <textarea
                            className="input resize-none h-16"
                            placeholder="What is this team working on?"
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            disabled={!isLeader}
                        />
                    </div>
                    {isLeader && (
                        <div className="flex items-center gap-3">
                            <button type="submit" disabled={saving} className="btn-primary">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                            {saveMsg && <p className="text-sm text-green-400">{saveMsg}</p>}
                        </div>
                    )}
                </form>
            </div>

            {/* ── Invite Code ── */}
            <div className="card space-y-4">
                <h2 className="text-sm font-semibold text-white">Invite Code</h2>
                <div className="flex items-center gap-3">
                    <div className="flex-1 bg-surface-tertiary border border-surface-border rounded-lg px-4 py-3 font-mono text-2xl text-brand-400 font-extrabold tracking-[0.25em] text-center">
                        {inviteCode}
                    </div>
                    <button onClick={handleCopy} className="btn-secondary flex-shrink-0">
                        {copied ? <><CheckCheck className="w-4 h-4 text-green-400" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                    </button>
                </div>
                <p className="text-xs text-gray-500">Share this code with developers to join your team.</p>
                {isLeader && (
                    <button onClick={handleRegen} disabled={regenerating} className="btn-ghost text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1.5">
                        {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerate code (current code will stop working)
                    </button>
                )}
            </div>

            {/* ── Members ── */}
            <div className="card space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-brand-400" />
                    <h2 className="text-sm font-semibold text-white">Members ({members.length})</h2>
                </div>
                {members.map(member => {
                    const isMemberLeader = member.user_id === team.leader_id
                    return (
                        <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary border border-surface-border">
                            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-white truncate">{member.profile?.full_name ?? 'Unknown'}</p>
                                    {isMemberLeader && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-500">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`badge ${member.role === 'leader' ? 'badge-info' : 'badge-low'} flex-shrink-0`}>
                                {member.role}
                            </span>
                            {/* Remove button — leaders can remove non-leader members */}
                            {isLeader && !isMemberLeader && (
                                <button
                                    onClick={() => handleRemove(member.user_id)}
                                    disabled={removingId === member.user_id}
                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                                    title="Remove member"
                                >
                                    {removingId === member.user_id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <UserMinus className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ── Danger Zone ── */}
            {isLeader && (
                <div className="card border-red-500/20 space-y-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
                    </div>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-sm font-medium text-white">Delete this team</p>
                            <p className="text-xs text-gray-400">Permanently removes all members, findings, and scan data.</p>
                        </div>
                        <button
                            onClick={() => setShowDelete(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex-shrink-0"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Team
                        </button>
                    </div>

                    {showDelete && (
                        <div className="bg-surface-tertiary rounded-xl p-4 border border-red-500/20 space-y-3">
                            <p className="text-sm text-gray-300">
                                Type <span className="font-mono font-bold text-red-400">{team.name}</span> to confirm deletion.
                            </p>
                            {deleteErr && (
                                <p className="text-xs text-red-400">{deleteErr}</p>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => setShowDelete(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteLoading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all"
                                >
                                    {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {deleteLoading ? 'Deleting…' : 'Confirm Delete'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
