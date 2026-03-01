import { useState } from 'react'
import { useTeamStore } from '@/stores/teamStore'
import { regenerateInvite } from '@/lib/api'
import { Settings, Copy, CheckCheck, RefreshCw, Users, Loader2 } from 'lucide-react'

export default function TeamSettingsPage() {
    const { currentTeam, members, myRole } = useTeamStore()
    const [copied, setCopied] = useState(false)
    const [regen, setRegen] = useState(false)
    const [newCode, setNewCode] = useState('')

    if (!currentTeam) {
        return (
            <div className="page-container flex items-center justify-center h-64">
                <p className="text-gray-400">No team selected.</p>
            </div>
        )
    }

    const inviteCode = newCode || currentTeam.invite_code

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleRegen = async () => {
        setRegen(true)
        try {
            const res = await regenerateInvite(currentTeam.id)
            setNewCode(res.data.invite_code)
        } catch { /* handle */ }
        finally { setRegen(false) }
    }

    return (
        <div className="page-container space-y-6 max-w-2xl animate-slide-up">
            <div>
                <h1 className="section-title flex items-center gap-2">
                    <Settings className="w-5 h-5 text-brand-400" />
                    Team Settings
                </h1>
                <p className="section-subtitle">{currentTeam.name}</p>
            </div>

            {/* Invite Code */}
            <div className="card space-y-4">
                <p className="text-sm font-semibold text-white">Invite Code</p>
                <div className="flex items-center gap-3">
                    <div className="flex-1 bg-surface-tertiary border border-surface-border rounded-lg px-4 py-3 font-mono text-2xl text-brand-400 font-extrabold tracking-[0.25em] text-center">
                        {inviteCode}
                    </div>
                    <button onClick={handleCopy} className="btn-secondary gap-2 flex-shrink-0">
                        {copied ? <><CheckCheck className="w-4 h-4 text-green-400" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                    </button>
                </div>
                <p className="text-xs text-gray-500">Share this code with developers to join your team.</p>
                {myRole === 'leader' && (
                    <button onClick={handleRegen} disabled={regen} className="btn-ghost text-orange-400 hover:text-orange-300 text-xs">
                        {regen ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerate code (invalidates current)
                    </button>
                )}
            </div>

            {/* Members list */}
            <div className="card space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-brand-400" />
                    <p className="text-sm font-semibold text-white">Team Members ({members.length})</p>
                </div>
                {members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary border border-surface-border">
                        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {member.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{member.profile?.full_name ?? 'Unknown'}</p>
                            <p className="text-xs text-gray-500">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`badge ${member.role === 'leader' ? 'badge-info' : 'badge-low'}`}>{member.role}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
