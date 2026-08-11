import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function complete() {
      const oauthError = params.get('error_description') ?? params.get('error')
      if (oauthError) {
        setError(oauthError)
        return
      }

      const code = params.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError('No authenticated session was created. Please try signing in again.')
        return
      }

      if (!cancelled) navigate(safeInternalPath(params.get('next')), { replace: true })
    }
    void complete()
    return () => { cancelled = true }
  }, [navigate, params])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center">
        {error ? (
          <><h1 className="text-xl font-bold text-white">Authentication could not be completed</h1><p className="text-sm text-red-400 mt-3 max-w-md">{error}</p><Link to="/login" className="text-brand-400 mt-5 inline-block">Return to sign in</Link></>
        ) : (
          <><Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto" /><p className="text-sm text-gray-400 mt-4">Completing authentication...</p></>
        )}
      </div>
    </div>
  )
}
