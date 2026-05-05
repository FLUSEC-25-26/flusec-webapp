import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const navigate = useNavigate()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { data, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        })

        if (signupError) { setError(signupError.message); setLoading(false); return }

        // Insert profile row
        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                full_name: fullName,
                role: 'member',
            })
        }

        setDone(true)
        setTimeout(() => navigate('/create-team'), 1800)
        setLoading(false)
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

                <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
                <p className="text-sm text-gray-400 mb-8">Join your team's security dashboard</p>

                {done ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <CheckCircle2 className="w-12 h-12 text-brand-400" />
                        <p className="text-white font-semibold">Account created!</p>
                        <p className="text-sm text-gray-400">Redirecting to team setup...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label className="label">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="text" className="input pl-10" placeholder="Your name"
                                    value={fullName} onChange={e => setFullName(e.target.value)} required />
                            </div>
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="email" className="input pl-10" placeholder="you@example.com"
                                    value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="password" className="input pl-10" placeholder="At least 8 characters"
                                    value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>
                )}

                <p className="text-sm text-gray-500 text-center mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
                </p>
            </div>
        </div>
    )
}
