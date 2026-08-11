import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { MailCheck, Loader2, RefreshCw } from 'lucide-react'

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const returnTo = safeInternalPath(params.get('next'))
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const maskedEmail = useMemo(() => {
    const [name, domain] = email.split('@')
    if (!name || !domain) return email || 'your email address'
    return `${name.slice(0, 2)}***@${domain}`
  }, [email])

  async function resend() {
    if (!email || cooldown > 0) return
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callback },
      })
      if (resendError) throw resendError

      setMessage('A new verification email was sent.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
      const timer = window.setInterval(() => {
        setCooldown((value) => {
          if (value <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return value - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="card max-w-md w-full text-center p-8">
        <MailCheck className="w-12 h-12 text-brand-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white">Verify your email</h1>
        <p className="text-sm text-gray-400 mt-3">
          We sent a confirmation link to <span className="text-gray-200">{maskedEmail}</span>.
          Open that email to activate your FLUSEC account.
        </p>

        {message && <p className="text-sm text-green-400 mt-4">{message}</p>}
        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        <button
          onClick={() => void resend()}
          disabled={!email || cooldown > 0 || loading}
          className="btn-secondary w-full justify-center mt-6"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
        </button>

        <Link
          to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="inline-block text-sm text-brand-400 hover:text-brand-300 mt-5"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
