import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
    Bell, X, Check, CheckCheck, Trash2, Loader2,
    Users, AlertTriangle, ShieldAlert, UserMinus
} from 'lucide-react'

interface Notification {
    id: string
    type: 'findings_synced' | 'critical_finding' | 'member_joined' | 'member_removed'
    title: string
    message: string
    team_id: string | null
    is_read: boolean
    created_at: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
    findings_synced: <ShieldAlert className="w-4 h-4 text-brand-400" />,
    critical_finding: <AlertTriangle className="w-4 h-4 text-red-400" />,
    member_joined: <Users className="w-4 h-4 text-green-400" />,
    member_removed: <UserMinus className="w-4 h-4 text-orange-400" />,
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
    const navigate = useNavigate()
    const panelRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unread, setUnread] = useState(0)
    const [loading, setLoading] = useState(false)
    const [token, setToken] = useState('')

    // ─── Auth token ──────────────────────────────────────────────
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setToken(session.access_token)
        })
    }, [])

    // ─── Fetch unread count (poll every 30s) ─────────────────────
    const fetchCount = useCallback(async () => {
        if (!token) return
        const res = await fetch('/api/notifications/unread-count', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            const json = await res.json() as { data: { count: number } }
            setUnread(json.data.count)
        }
    }, [token])

    useEffect(() => {
        fetchCount()
        const interval = setInterval(fetchCount, 30000)
        return () => clearInterval(interval)
    }, [fetchCount])

    // ─── Fetch full list when panel opens ────────────────────────
    async function fetchNotifications() {
        if (!token) return
        setLoading(true)
        const res = await fetch('/api/notifications', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
            const json = await res.json() as { data: Notification[] }
            setNotifications(json.data)
        }
        setLoading(false)
    }

    function togglePanel() {
        if (!open) fetchNotifications()
        setOpen(o => !o)
    }

    // ─── Mark all read ────────────────────────────────────────────
    async function markAllRead() {
        if (!token) return
        await fetch('/api/notifications/read-all', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        })
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnread(0)
    }

    // ─── Mark single read ─────────────────────────────────────────
    async function markRead(id: string) {
        await fetch(`/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        })
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnread(prev => Math.max(0, prev - 1))
    }

    // ─── Clear read ───────────────────────────────────────────────
    async function clearRead() {
        await fetch('/api/notifications/clear', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })
        setNotifications(prev => prev.filter(n => !n.is_read))
    }

    // ─── Click notification → navigate to team ────────────────────
    async function handleClick(n: Notification) {
        if (!n.is_read) await markRead(n.id)
        if (n.team_id) navigate(`/team/${n.team_id}`)
        setOpen(false)
    }

    // ─── Close on outside click ───────────────────────────────────
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)
    }, [])

    const hasRead = notifications.some(n => n.is_read)

    return (
        <div ref={panelRef} className="relative">
            {/* ── Bell button ── */}
            <button
                onClick={togglePanel}
                className="btn-ghost p-2 relative"
                title="Notifications"
            >
                <Bell className={`w-4 h-4 transition-colors ${open ? 'text-brand-400' : ''}`} />
                {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center px-0.5 leading-none">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {/* ── Panel ── */}
            {open && (
                <div className="absolute right-0 top-10 w-96 max-h-[480px] flex flex-col bg-surface-secondary border border-surface-border rounded-2xl shadow-2xl z-50 animate-slide-up overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-brand-400" />
                            <span className="text-sm font-semibold text-white">Notifications</span>
                            {unread > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">
                                    {unread} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unread > 0 && (
                                <button onClick={markAllRead} title="Mark all as read"
                                    className="btn-ghost p-1.5 text-gray-500 hover:text-brand-400 text-xs flex items-center gap-1">
                                    <CheckCheck className="w-3.5 h-3.5" /> All read
                                </button>
                            )}
                            {hasRead && (
                                <button onClick={clearRead} title="Clear read notifications"
                                    className="btn-ghost p-1.5 text-gray-500 hover:text-red-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="btn-ghost p-1.5 text-gray-500 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                                <Bell className="w-8 h-8 opacity-30" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-border">
                                {notifications.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => handleClick(n)}
                                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-surface-hover ${!n.is_read ? 'bg-brand-500/5' : ''
                                            }`}
                                    >
                                        {/* Icon */}
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${!n.is_read ? 'bg-surface-tertiary' : 'bg-surface-tertiary/50'
                                            }`}>
                                            {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-gray-400" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-medium leading-tight ${!n.is_read ? 'text-white' : 'text-gray-400'}`}>
                                                    {n.title}
                                                </p>
                                                <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                                                    {timeAgo(n.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                        </div>

                                        {/* Unread dot */}
                                        {!n.is_read && (
                                            <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-2" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
