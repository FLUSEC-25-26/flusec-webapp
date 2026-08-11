import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { Mail, Loader2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const returnTo = safeInternalPath(params.get('returnTo'))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const resetPage = `/reset-password?returnTo=${encodeURIComponent(returnTo)}`
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetPage)}`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (resetError) throw resetError
      setMessage('If that address belongs to a FLUSEC account, a reset email has been requested. Please check your inbox.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a password reset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="card max-w-sm w-full p-7">
        <h1 className="text-xl font-bold text-white">Reset your password</h1>
        <p className="text-sm text-gray-400 mt-2 mb-6">Enter your account email and FLUSEC will send a reset link.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          {message && <p className="text-sm text-green-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="btn-primary w-full justify-center">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Sending...' : 'Send reset email'}
          </button>
        </form>
        <Link
          to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="text-sm text-brand-400 mt-5 inline-block"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
