import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { ShieldCheck, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const returnTo = safeInternalPath(searchParams.get('returnTo'))

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: callback,
        },
      })

      if (signupError) throw signupError

      // With email confirmation enabled, Supabase does not issue an authenticated
      // session until the user follows the confirmation link.
      if (!data.session) {
        navigate(
          `/verify-email?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(returnTo)}`,
          { replace: true },
        )
        return
      }

      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="w-full max-w-sm animate-slide-up">
        <Brand />
        <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
        <p className="text-sm text-gray-400 mb-8">Verify your email before joining or creating a team.</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <Field icon={<User />} label="Full Name">
            <input className="input pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field icon={<Mail />} label="Email">
            <input type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field icon={<Lock />} label="Password">
            <input type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>

          {error && <ErrorBox message={error} />}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Already have an account?{' '}
          <Link
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="text-brand-400 hover:text-brand-300 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="w-9 h-9 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow-brand">
        <ShieldCheck className="w-5 h-5 text-white" />
      </div>
      <span className="text-lg font-bold text-white">FluSec</span>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon: React.ReactElement; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </span>
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  )
}
