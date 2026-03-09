import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
    User, Mail, Lock, Save, CheckCheck, AlertCircle,
    Loader2, ShieldCheck, Calendar, Activity, ArrowLeft, Trash2
} from 'lucide-react'

export default function ProfilePage() {
    const { user, setUser } = useAuthStore()
    const navigate = useNavigate()

    // ── Edit name ─────────────────────────────────────────────
    const [name, setName] = useState(user?.full_name ?? '')
    const [nameSaving, setNameSaving] = useState(false)
    const [nameSaved, setNameSaved] = useState(false)
    const [nameError, setNameError] = useState('')

    // ── Change password ───────────────────────────────────────
    const [newPassword, setNewPassword] = useState('')
    const [confirmPass, setConfirmPass] = useState('')
    const [passSaving, setPassSaving] = useState(false)
    const [passSaved, setPassSaved] = useState(false)
    const [passError, setPassError] = useState('')

    // ── Delete account ────────────────────────────────────────
    const [deleteConfirm, setDeleteConfirm] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // ── Personal stats ────────────────────────────────────────
    const [stats, setStats] = useState<{
        total_findings: number
        teams_count: number
        critical_findings: number
    } | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)

    // ── Email from session ────────────────────────────────────
    const [email, setEmail] = useState('')
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setEmail(session?.user?.email ?? '')
        })
    }, [])

    // ── Load personal stats ───────────────────────────────────
    useEffect(() => {
        if (!user?.id) return
        async function loadStats() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            try {
                const [findingsRes, teamsRes] = await Promise.all([
                    fetch('/api/findings/me', { headers: { Authorization: `Bearer ${session.access_token}` } }),
                    fetch('/api/teams/my-teams', { headers: { Authorization: `Bearer ${session.access_token}` } }),
                ])
                const findingsJson = await findingsRes.json() as { data: { severity: string }[] }
                const teamsJson = await teamsRes.json() as { data: unknown[] }
                const findings = findingsJson.data ?? []
                setStats({
                    total_findings: findings.length,
                    critical_findings: findings.filter((f: { severity: string }) => f.severity === 'critical').length,
                    teams_count: teamsJson.data?.length ?? 0,
                })
            } catch { /* ignore */ } finally {
                setStatsLoading(false)
            }
        }
        loadStats()
    }, [user?.id])

    // ── Save full name ────────────────────────────────────────
    async function saveName(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) { setNameError('Name cannot be empty'); return }
        setNameSaving(true); setNameError(''); setNameSaved(false)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ full_name: name.trim() }),
        })
        setNameSaving(false)
        if (res.ok) {
            const json = await res.json() as { data: { full_name: string } }
            setUser({ ...user!, full_name: json.data.full_name })
            setNameSaved(true)
            setTimeout(() => setNameSaved(false), 3000)
        } else {
            setNameError('Failed to update name. Try again.')
        }
    }

    // ── Change password ───────────────────────────────────────
    async function changePassword(e: React.FormEvent) {
        e.preventDefault()
        if (newPassword.length < 8) { setPassError('Password must be at least 8 characters'); return }
        if (newPassword !== confirmPass) { setPassError('Passwords do not match'); return }
        setPassSaving(true); setPassError(''); setPassSaved(false)
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        setPassSaving(false)
        if (error) {
            setPassError(error.message)
        } else {
            setPassSaved(true)
            setNewPassword(''); setConfirmPass('')
            setTimeout(() => setPassSaved(false), 3000)
        }
    }

    // ── Delete account ────────────────────────────────────────
    async function deleteAccount() {
        if (deleteConfirm !== 'DELETE') return
        setDeleteLoading(true); setDeleteError('')
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/auth/account', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
        setDeleteLoading(false)
        if (res.ok) {
            await supabase.auth.signOut()
            navigate('/login')
        } else {
            const json = await res.json() as { error: string }
            setDeleteError(json.error ?? 'Failed to delete account')
        }
    }

    const initials = (user?.full_name ?? email)
        ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'

    return (
        <div className="page-container space-y-6 animate-slide-up max-w-2xl">

            {/* Header with back button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-ghost p-2 text-gray-400 hover:text-white"
                    title="Back to Dashboard"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <h1 className="section-title flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-400" />
                        My Profile
                    </h1>
                    <p className="section-subtitle">Manage your account settings</p>
                </div>
            </div>

            {/* Avatar + overview card */}
            <div className="card flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-glow-brand">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white">{user?.full_name ?? 'Unknown'}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">{email}</p>
                    <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="w-3.5 h-3.5" />
                            Member since {user?.created_at
                                ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                                : '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {user?.role ?? 'member'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Personal stats */}
            <div className="grid grid-cols-3 gap-4">
                {statsLoading
                    ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card animate-pulse h-20" />)
                    : [
                        { label: 'Total Findings', value: stats?.total_findings ?? 0, color: 'text-white', icon: <Activity className="w-4 h-4 text-brand-400" /> },
                        { label: 'Critical Findings', value: stats?.critical_findings ?? 0, color: 'text-red-400', icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
                        { label: 'Teams', value: stats?.teams_count ?? 0, color: 'text-brand-400', icon: <ShieldCheck className="w-4 h-4 text-brand-400" /> },
                    ].map(s => (
                        <div key={s.label} className="card text-center">
                            <div className="flex justify-center mb-2">{s.icon}</div>
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))
                }
            </div>

            {/* Edit display name */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-400" /> Display Name
                </h3>
                <form onSubmit={saveName} className="space-y-3">
                    <div>
                        <label className="label">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your full name"
                            className="input"
                            maxLength={80}
                        />
                    </div>
                    {nameError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />{nameError}
                        </p>
                    )}
                    <button type="submit" disabled={nameSaving} className="btn-primary flex items-center gap-2">
                        {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            nameSaved ? <CheckCheck className="w-4 h-4 text-green-400" /> :
                                <Save className="w-4 h-4" />}
                        {nameSaving ? 'Saving…' : nameSaved ? 'Saved!' : 'Save Name'}
                    </button>
                </form>
            </div>

            {/* Email (read-only) */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-brand-400" /> Email Address
                </h3>
                <div>
                    <label className="label">Email</label>
                    <div className="input bg-surface-tertiary text-gray-400 cursor-not-allowed flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        {email || '—'}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5">
                        Email is managed through your authentication provider and cannot be changed here.
                    </p>
                </div>
            </div>

            {/* Change password */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-400" /> Change Password
                </h3>
                <form onSubmit={changePassword} className="space-y-3">
                    <div>
                        <label className="label">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            placeholder="Re-enter new password"
                            className="input"
                        />
                    </div>
                    {passError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />{passError}
                        </p>
                    )}
                    <button type="submit" disabled={passSaving || !newPassword} className="btn-primary flex items-center gap-2">
                        {passSaving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            passSaved ? <CheckCheck className="w-4 h-4 text-green-400" /> :
                                <Lock className="w-4 h-4" />}
                        {passSaving ? 'Updating…' : passSaved ? 'Password Updated!' : 'Update Password'}
                    </button>
                </form>
            </div>

            {/* ── Danger Zone ── */}
            <div className="card border border-red-500/20 bg-red-500/5 space-y-4">
                <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Permanently delete your account and all associated data — teams you lead,
                    findings, scan sessions, and notifications. <strong className="text-white">This action cannot be undone.</strong>
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="label text-red-400/80">Type <span className="font-mono font-bold text-red-300">DELETE</span> to confirm</label>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={e => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                            className="input border-red-500/30 focus:border-red-500/60"
                        />
                    </div>
                    {deleteError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />{deleteError}
                        </p>
                    )}
                    <button
                        onClick={deleteAccount}
                        disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                            bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {deleteLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        {deleteLoading ? 'Deleting account…' : 'Delete My Account'}
                    </button>
                </div>
            </div>

        </div>
    )
}
