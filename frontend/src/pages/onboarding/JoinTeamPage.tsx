import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { joinTeam, getTeam } from '@/lib/api'
import { useTeamStore } from '@/stores/teamStore'
import type { Team } from '@/types'
import { ShieldCheck, Hash, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function JoinTeamPage() {
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()
    const { setTeam, setMyRole } = useTeamStore()

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await joinTeam(code.toUpperCase().trim())
            // Fetch full team and store it so TeamGuard lets us through
            const teamRes = await getTeam(res.data.team_id)
            setTeam(teamRes.data as unknown as Team)
            setMyRole('member')
            setSuccess(true)
            setTimeout(() => navigate('/dashboard'), 1500)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Invalid invite code')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-8">
            <div className="w-full max-w-sm animate-slide-up">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-9 h-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-brand">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-white">FluSec</span>
                </div>

                <h1 className="text-2xl font-bold text-white mb-1">Join a Team</h1>
                <p className="text-sm text-gray-400 mb-8">Enter the invite code from your Team Leader</p>

                {success ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <CheckCircle2 className="w-12 h-12 text-brand-400" />
                        <p className="text-white font-semibold">Joined successfully!</p>
                        <p className="text-sm text-gray-400">Redirecting to your dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <div>
                            <label className="label">Invite Code</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    className="input pl-10 text-center font-mono text-xl tracking-[0.3em] uppercase"
                                    placeholder="ABC123"
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    maxLength={6}
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5">6-character code from your team leader</p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                            </div>
                        )}

                        <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full justify-center py-3">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Joining...' : 'Join Team'}
                        </button>
                    </form>
                )}

                <p className="text-sm text-gray-500 text-center mt-6">
                    Want to create a new team?{' '}
                    <Link to="/create-team" className="text-brand-400 hover:text-brand-300 font-medium">Create team</Link>
                </p>
            </div>
        </div>
    )
}
