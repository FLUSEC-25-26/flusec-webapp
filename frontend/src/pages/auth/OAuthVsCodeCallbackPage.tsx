import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

interface OAuthBridgeState {
  nonce: string
  scheme: 'vscode' | 'vscode-insiders'
  extensionId: string
}

function decodeState(encoded: string): OAuthBridgeState {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const parsed = JSON.parse(atob(padded)) as Partial<OAuthBridgeState>
  if (!parsed.nonce || !parsed.extensionId || (parsed.scheme !== 'vscode' && parsed.scheme !== 'vscode-insiders')) {
    throw new Error('Invalid VS Code OAuth state.')
  }
  return parsed as OAuthBridgeState
}

export default function OAuthVsCodeCallbackPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const stateParam = params.get('state')
      if (!stateParam) throw new Error('OAuth state was not returned.')
      const state = decodeState(stateParam)

      const allowed = String(import.meta.env.VITE_ALLOWED_VSCODE_EXTENSION_IDS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      if (allowed.length === 0 || !allowed.includes(state.extensionId)) {
        throw new Error('This VS Code extension ID is not allowed by the FLUSEC web callback.')
      }

      const callback = new URL(`${state.scheme}://${state.extensionId}/auth-complete`)
      for (const key of ['code', 'state', 'error', 'error_description']) {
        const value = params.get(key)
        if (value) callback.searchParams.set(key, value)
      }
      window.location.assign(callback.toString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not return authentication to VS Code')
    }
  }, [params])

  return <div className="min-h-screen bg-surface flex items-center justify-center p-8"><div className="card max-w-md w-full p-8 text-center">{error?<><h1 className="text-xl font-bold text-white">Could not return to VS Code</h1><p className="text-sm text-red-400 mt-3">{error}</p></>:<><Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto"/><h1 className="text-xl font-bold text-white mt-4">Returning to VS Code</h1><p className="text-sm text-gray-400 mt-2">If your browser asks permission to open Visual Studio Code, allow it.</p></>}</div></div>
}
