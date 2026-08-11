import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const returnTo = safeInternalPath(searchParams.get('returnTo'))

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (loginError) throw loginError
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: 'github' | 'google') {
    setError('')
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (oauthError) setError(oauthError.message)
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

        <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-gray-400 mb-8">Sign in to your FLUSEC account</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={() => void handleOAuth('github')} className="btn-secondary justify-center text-xs py-2.5">GitHub</button>
          <button onClick={() => void handleOAuth('google')} className="btn-secondary justify-center text-xs py-2.5">Google</button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-surface-border" />
          <span className="text-xs text-gray-500">or continue with email</span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link to={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`} className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"><AlertCircle className="w-4 h-4" />{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Don't have an account? <Link to={`/signup?returnTo=${encodeURIComponent(returnTo)}`} className="text-brand-400 hover:text-brand-300 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
