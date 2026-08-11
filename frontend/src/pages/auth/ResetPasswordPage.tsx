import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInternalPath } from '@/lib/authNavigation'
import { Lock, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = safeInternalPath(params.get('returnTo'))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="card max-w-sm w-full p-7">
        <h1 className="text-xl font-bold text-white">Choose a new password</h1>
        <p className="text-sm text-gray-400 mt-2 mb-6">Use at least 8 characters.</p>
        <form onSubmit={submit} className="space-y-4">
          <PasswordField label="New password" value={password} setValue={setPassword} />
          <PasswordField label="Confirm password" value={confirmPassword} setValue={setConfirmPassword} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="btn-primary w-full justify-center">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordField({
  label,
  value,
  setValue,
}: {
  label: string
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="password"
          minLength={8}
          className="input pl-10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>
    </div>
  )
}
