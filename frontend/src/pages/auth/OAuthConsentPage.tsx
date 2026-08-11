import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type AuthorizationDetails = {
  authorization_id: string
  client: {
    id?: string
    name?: string
  }
  scope?: string
  redirect_uri?: string
}

export default function OAuthConsentPage() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id') ?? ''
  const [details, setDetails] = useState<AuthorizationDetails | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAuthorizationDetails() {
      if (!authorizationId) {
        setError('Missing authorization_id.')
        return
      }

      const { data, error: detailsError } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

      if (cancelled) return

      if (detailsError || !data) {
        setError(detailsError?.message ?? 'Invalid authorization request.')
        return
      }

      // Supabase returns a redirect immediately if the user has already
      // consented to this OAuth client.
      if (!('authorization_id' in data)) {
        window.location.assign(data.redirect_url)
        return
      }

      setDetails(data as AuthorizationDetails)
    }

    void loadAuthorizationDetails()
    return () => {
      cancelled = true
    }
  }, [authorizationId])

  async function decide(approve: boolean) {
    if (!authorizationId || working) return

    setWorking(true)
    setError('')

    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId)

      if (result.error || !result.data) {
        throw result.error ?? new Error('Authorization failed.')
      }

      window.location.assign(result.data.redirect_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed.')
      setWorking(false)
    }
  }

  const scopes = (details?.scope ?? '').split(/\s+/).filter(Boolean)

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="card max-w-lg w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              FLUSEC authorization
            </p>
            <h1 className="text-xl font-bold text-white">
              Connect {details?.client?.name ?? 'VS Code'}
            </h1>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {!details && !error ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading authorization request...
          </div>
        ) : details ? (
          <>
            <p className="text-sm text-gray-300">
              This application is requesting access to your FLUSEC account. It
              will use your authenticated identity to call the FLUSEC API and
              access only teams you are already a member of.
            </p>

            <div className="mt-5 rounded-lg border border-surface-border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Requested scopes
              </p>
              <div className="flex flex-wrap gap-2">
                {scopes.length > 0 ? (
                  scopes.map((scope) => (
                    <span key={scope} className="badge-low">
                      {scope}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">Account access</span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                type="button"
                disabled={working}
                onClick={() => void decide(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => void decide(true)}
                className="btn-primary"
              >
                {working && <Loader2 className="w-4 h-4 animate-spin" />}
                Authorize
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
