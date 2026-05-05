import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createTeam, getTeam } from '@/lib/api'
import { useTeamStore } from '@/stores/teamStore'
import type { Team } from '@/types'
import { ShieldCheck, Users, Loader2, AlertCircle, Copy, CheckCheck, ArrowRight } from 'lucide-react'

export default function CreateTeamPage() {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [copied, setCopied] = useState(false)
    const { setTeam, setMyRole } = useTeamStore()
    const navigate = useNavigate()

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await createTeam(name, description)
            setInviteCode(res.data.invite_code)
            // Fetch the full team object and store it so TeamGuard lets us through
            const teamRes = await getTeam(res.data.team_id)
            setTeam(teamRes.data as unknown as Team)
            setMyRole('leader')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create team')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-8">
            <div className="w-full max-w-md animate-slide-up">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-9 h-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-brand">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-white">FluSec</span>
                </div>

                {!inviteCode ? (
                    <>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-surface-tertiary border border-surface-border flex items-center justify-center">
                                <Users className="w-4 h-4 text-brand-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white">Create a Team</h1>
                        </div>
                        <p className="text-sm text-gray-400 mb-8 ml-11">
                            Set up a security team and invite members to collaborate.
                        </p>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="label">Team Name</label>
                                <input type="text" className="input" placeholder="e.g. Flutter App Dev Team"
                                    value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div>
                                <label className="label">Description <span className="text-gray-600 normal-case font-normal">(optional)</span></label>
                                <textarea className="input resize-none h-20" placeholder="What is this team working on?"
                                    value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loading ? 'Creating team...' : 'Create Team'}
                            </button>
                        </form>

                        <p className="text-sm text-gray-500 text-center mt-6">
                            Have an invite code?{' '}
                            <Link to="/join-team" className="text-brand-400 hover:text-brand-300 font-medium">Join a team instead</Link>
                        </p>
                    </>
                ) : (
                    <div className="card text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
                                <Users className="w-8 h-8 text-brand-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2">Team Created! 🎉</h2>
                            <p className="text-sm text-gray-400">Share this invite code with your team members</p>
                        </div>
                        <div className="bg-surface-tertiary rounded-xl p-4 border border-surface-border">
                            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Invite Code</p>
                            <p className="text-3xl font-extrabold font-mono text-brand-400 tracking-[0.25em]">{inviteCode}</p>
                        </div>
                        <button onClick={handleCopy} className="btn-secondary w-full justify-center">
                            {copied ? <><CheckCheck className="w-4 h-4 text-green-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
                        </button>
                        <button onClick={() => navigate('/dashboard')} className="btn-primary w-full justify-center">
                            Go to Dashboard <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
