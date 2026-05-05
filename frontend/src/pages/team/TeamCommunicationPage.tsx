import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
    deleteTeamMessage,
    editTeamMessage,
    getTeam,
    getTeamRoomMessages,
    getTeamThreads,
    sendTeamMessage,
} from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { Team } from '@/types'
import type {
    TeamChatMessage,
    TeamMessageKind,
    TeamRoomPayload,
    TeamThreadCollection,
    TeamThreadSummary,
} from '@/types/chat'
import {
    AlertTriangle,
    ArrowLeft,
    FileCode2,
    Loader2,
    Megaphone,
    MessageSquare,
    Pencil,
    RefreshCw,
    Reply,
    Search,
    Send,
    ShieldCheck,
    Trash2,
    Users,
    X,
} from 'lucide-react'

type SelectedRoom =
    | { kind: 'general' }
    | { kind: 'finding'; findingId: string }

function formatTime(value: string | null | undefined) {
    if (!value) return 'No activity yet'
    return new Date(value).toLocaleString()
}

function firstName(value?: string | null) {
    if (!value) return 'Member'
    return value.split(' ')[0] ?? value
}

function severityBadge(severity?: string | null) {
    const value = (severity ?? '').toLowerCase()
    if (value === 'critical') return 'badge-critical'
    if (value === 'high') return 'badge-high'
    if (value === 'medium') return 'badge-medium'
    return 'badge-low'
}

export default function TeamCommunicationPage() {
    const { teamId } = useParams<{ teamId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const [team, setTeam] = useState<Team | null>(null)
    const [threads, setThreads] = useState<TeamThreadCollection | null>(null)
    const [roomData, setRoomData] = useState<TeamRoomPayload | null>(null)

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')

    const [threadSearch, setThreadSearch] = useState('')
    const [messageText, setMessageText] = useState('')
    const [selectedRoom, setSelectedRoom] = useState<SelectedRoom>({ kind: 'general' })
    const [replyTo, setReplyTo] = useState<TeamChatMessage | null>(null)
    const [editingMessage, setEditingMessage] = useState<TeamChatMessage | null>(null)
    const [announcementMode, setAnnouncementMode] = useState(false)

    const myUserId = user?.id ?? ''
    const isLeader = team?.leader_id === user?.id

    const selectedFindingThread = useMemo(() => {
        if (!threads || selectedRoom.kind !== 'finding') return null
        return (
            threads.findingThreads.find(
                (thread) => thread.finding?.id === selectedRoom.findingId
            ) ?? null
        )
    }, [threads, selectedRoom])

    const filteredFindingThreads = useMemo(() => {
        const term = threadSearch.trim().toLowerCase()
        if (!threads) return []

        if (!term) return threads.findingThreads

        return threads.findingThreads.filter((thread) => {
            const title = thread.finding?.title?.toLowerCase() ?? ''
            const file = thread.finding?.file_path?.toLowerCase() ?? ''
            const last = thread.last_message_text?.toLowerCase() ?? ''
            return title.includes(term) || file.includes(term) || last.includes(term)
        })
    }, [threadSearch, threads])

    async function loadThreads(targetTeamId: string) {
        const threadsRes = await getTeamThreads(targetTeamId)
        setThreads(threadsRes.data)
        return threadsRes.data
    }

    async function loadRoom(targetTeamId: string, room: SelectedRoom) {
        const roomRes = await getTeamRoomMessages(
            targetTeamId,
            room.kind === 'finding'
                ? { finding_id: room.findingId, limit: 150 }
                : { limit: 150 }
        )
        setRoomData(roomRes.data)
        return roomRes.data
    }

    async function loadPage(targetRoom?: SelectedRoom) {
        if (!teamId) return

        setLoading(true)
        setError('')

        try {
            const findingIdFromQuery = searchParams.get('findingId')
            const initialRoom =
                targetRoom ??
                (findingIdFromQuery ? { kind: 'finding' as const, findingId: findingIdFromQuery } : selectedRoom)

            const [teamRes, threadsRes] = await Promise.all([
                getTeam(teamId),
                getTeamThreads(teamId),
            ])

            setTeam(teamRes.data)
            setThreads(threadsRes.data)
            setSelectedRoom(initialRoom)

            const roomRes = await getTeamRoomMessages(
                teamId,
                initialRoom.kind === 'finding'
                    ? { finding_id: initialRoom.findingId, limit: 150 }
                    : { limit: 150 }
            )

            setRoomData(roomRes.data)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load collaboration center')
        } finally {
            setLoading(false)
        }
    }

    async function refreshNow() {
        if (!teamId) return

        setRefreshing(true)
        try {
            await loadThreads(teamId)
            await loadRoom(teamId, selectedRoom)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to refresh communication data')
        } finally {
            setRefreshing(false)
        }
    }

    useEffect(() => {
        void loadPage()
    }, [teamId])

    useEffect(() => {
        if (!teamId) return

        const findingId = searchParams.get('findingId')
        if (findingId && (selectedRoom.kind !== 'finding' || selectedRoom.findingId !== findingId)) {
            const nextRoom: SelectedRoom = { kind: 'finding', findingId }
            setSelectedRoom(nextRoom)
            void loadRoom(teamId, nextRoom)
        }
    }, [searchParams, teamId])

    useEffect(() => {
        if (!teamId) return

        const interval = setInterval(() => {
            void loadThreads(teamId)
            void loadRoom(teamId, selectedRoom)
        }, 4000)

        return () => clearInterval(interval)
    }, [teamId, selectedRoom])

    function selectGeneralRoom() {
        const nextRoom: SelectedRoom = { kind: 'general' }
        setSelectedRoom(nextRoom)
        setSearchParams({})
        setReplyTo(null)
        setEditingMessage(null)
        setAnnouncementMode(false)
        if (teamId) void loadRoom(teamId, nextRoom)
    }

    function selectFindingRoom(findingId: string) {
        const nextRoom: SelectedRoom = { kind: 'finding', findingId }
        setSelectedRoom(nextRoom)
        setSearchParams({ findingId })
        setReplyTo(null)
        setEditingMessage(null)
        setAnnouncementMode(false)
        if (teamId) void loadRoom(teamId, nextRoom)
    }

    async function handleSendOrSave() {
        if (!teamId) return

        const text = messageText.trim()
        if (!text) return

        setSending(true)
        setError('')

        try {
            if (editingMessage) {
                await editTeamMessage(editingMessage.id, text)
            } else {
                const payload: {
                    message_text: string
                    finding_id?: string | null
                    reply_to_message_id?: string | null
                    message_kind?: TeamMessageKind
                } = {
                    message_text: text,
                    reply_to_message_id: replyTo?.id ?? null,
                }

                if (selectedRoom.kind === 'finding') {
                    payload.finding_id = selectedRoom.findingId
                } else if (announcementMode && isLeader) {
                    payload.message_kind = 'announcement'
                }

                await sendTeamMessage(teamId, payload)
            }

            setMessageText('')
            setReplyTo(null)
            setEditingMessage(null)
            setAnnouncementMode(false)

            await loadThreads(teamId)
            await loadRoom(teamId, selectedRoom)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to send message')
        } finally {
            setSending(false)
        }
    }

    function beginReply(message: TeamChatMessage) {
        setReplyTo(message)
        setEditingMessage(null)
    }

    function beginEdit(message: TeamChatMessage) {
        setEditingMessage(message)
        setReplyTo(null)
        setAnnouncementMode(message.message_kind === 'announcement')
        setMessageText(message.message_text)
    }

    function cancelComposerState() {
        setReplyTo(null)
        setEditingMessage(null)
        setAnnouncementMode(false)
        setMessageText('')
    }

    async function handleDelete(message: TeamChatMessage) {
        const confirmed = window.confirm('Delete this message?')
        if (!confirmed) return

        setError('')

        try {
            await deleteTeamMessage(message.id)

            if (editingMessage?.id === message.id || replyTo?.id === message.id) {
                cancelComposerState()
            }

            if (teamId) {
                await loadThreads(teamId)
                await loadRoom(teamId, selectedRoom)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete message')
        }
    }

    const messages = roomData?.messages ?? []
    const selectedFinding = roomData?.roomFinding ?? selectedFindingThread?.finding ?? null

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="btn-secondary inline-flex"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <div>
                        <p className="text-sm text-brand-400 font-medium">Collaboration Center</p>
                        <h1 className="text-3xl font-bold text-white">
                            {team?.name ?? 'Team Communication'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            General team room, finding-linked discussion threads, announcements, replies, and message history.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    {teamId && (
                        <>
                            <Link to={`/team/${teamId}`} className="btn-secondary">
                                Team Overview
                            </Link>
                            <Link to={`/team/${teamId}/findings`} className="btn-secondary">
                                Findings
                            </Link>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => void refreshNow()}
                        className="btn-secondary"
                        disabled={refreshing}
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-4">
                <div className="card space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-white">Rooms & Threads</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Use the general room for team-wide communication and finding threads for issue-specific discussion.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="label">Search Finding Threads</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                className="input pl-10"
                                value={threadSearch}
                                onChange={(e) => setThreadSearch(e.target.value)}
                                placeholder="Search by title or file..."
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={selectGeneralRoom}
                        className={`w-full text-left rounded-2xl border p-4 transition-all ${
                            selectedRoom.kind === 'general'
                                ? 'border-brand-500/40 bg-brand-500/5'
                                : 'border-surface-border bg-surface hover:border-brand-500/25'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">General Room</p>
                                    <p className="text-xs text-gray-500">
                                        {threads?.generalThread.message_count ?? 0} messages
                                    </p>
                                </div>
                            </div>

                            {threads?.generalThread.last_message_at && (
                                <p className="text-[10px] text-gray-500 text-right">
                                    {formatTime(threads.generalThread.last_message_at)}
                                </p>
                            )}
                        </div>

                        {threads?.generalThread.last_message_text && (
                            <p className="text-xs text-gray-400 mt-3 truncate">
                                {threads.generalThread.last_sender_name
                                    ? `${firstName(threads.generalThread.last_sender_name)}: `
                                    : ''}
                                {threads.generalThread.last_message_text}
                            </p>
                        )}
                    </button>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Finding Discussions
                        </p>

                        {filteredFindingThreads.length === 0 ? (
                            <div className="rounded-xl border border-surface-border bg-surface p-4 text-sm text-gray-500">
                                No discussion threads yet.
                            </div>
                        ) : (
                            filteredFindingThreads.map((thread) => {
                                const isSelected =
                                    selectedRoom.kind === 'finding' &&
                                    selectedRoom.findingId === thread.finding?.id

                                return (
                                    <button
                                        key={thread.key}
                                        type="button"
                                        onClick={() => thread.finding && selectFindingRoom(thread.finding.id)}
                                        className={`w-full text-left rounded-2xl border p-4 transition-all ${
                                            isSelected
                                                ? 'border-brand-500/40 bg-brand-500/5'
                                                : 'border-surface-border bg-surface hover:border-brand-500/25'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {thread.finding?.title ?? 'Finding Thread'}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate mt-1">
                                                    {thread.finding?.file_path ?? 'Unknown file'}
                                                    {thread.finding?.line_number ? `:${thread.finding.line_number}` : ''}
                                                </p>
                                            </div>

                                            {thread.finding?.severity && (
                                                <span className={severityBadge(thread.finding.severity)}>
                                                    {thread.finding.severity}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between gap-3 mt-3">
                                            <p className="text-xs text-gray-400 truncate">
                                                {thread.last_sender_name
                                                    ? `${firstName(thread.last_sender_name)}: `
                                                    : ''}
                                                {thread.last_message_text ?? 'No messages'}
                                            </p>
                                            <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                {thread.message_count}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="card flex flex-col min-h-[720px]">
                    <div className="border-b border-surface-border pb-4 mb-4">
                        {selectedRoom.kind === 'general' ? (
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-brand-400" />
                                        <p className="text-sm font-semibold text-white">General Room</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Team-wide planning, coordination, and announcement space.
                                    </p>
                                </div>

                                {isLeader && (
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={announcementMode}
                                            onChange={(e) => setAnnouncementMode(e.target.checked)}
                                        />
                                        Post as announcement
                                    </label>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-brand-400" />
                                        <p className="text-sm font-semibold text-white">Finding Discussion</p>
                                    </div>
                                    <p className="text-base font-semibold text-white mt-2">
                                        {selectedFinding?.title ?? 'Selected finding'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use this thread to coordinate analysis, ownership, and remediation.
                                    </p>
                                </div>

                                {selectedFinding?.severity && (
                                    <span className={severityBadge(selectedFinding.severity)}>
                                        {selectedFinding.severity}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                        {messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-500">
                                No messages yet. Start the discussion.
                            </div>
                        ) : (
                            messages.map((message) => {
                                const mine = message.sender_id === myUserId
                                const canEdit = mine
                                const canDelete = mine || isLeader

                                return (
                                    <div
                                        key={message.id}
                                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
                                                message.message_kind === 'announcement'
                                                    ? 'bg-yellow-500/10 border-yellow-500/20'
                                                    : mine
                                                        ? 'bg-brand-500/10 border-brand-500/20'
                                                        : 'bg-surface border-surface-border'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-xs font-semibold text-white">
                                                            {mine ? 'You' : message.sender?.full_name ?? 'Unknown member'}
                                                        </p>
                                                        {message.message_kind === 'announcement' && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                                announcement
                                                            </span>
                                                        )}
                                                        {message.edited_at && (
                                                            <span className="text-[10px] text-gray-500">
                                                                edited
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-[10px] text-gray-500 mt-1">
                                                        {formatTime(message.created_at)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn-ghost p-1.5"
                                                        title="Reply"
                                                        onClick={() => beginReply(message)}
                                                    >
                                                        <Reply className="w-3.5 h-3.5" />
                                                    </button>

                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            className="btn-ghost p-1.5"
                                                            title="Edit"
                                                            onClick={() => beginEdit(message)}
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            className="btn-ghost p-1.5 hover:text-red-400"
                                                            title="Delete"
                                                            onClick={() => void handleDelete(message)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {message.reply_to && (
                                                <div className="mt-3 rounded-xl border border-surface-border bg-surface-secondary/50 p-3">
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                                                        Replying to {message.reply_to.sender_name ?? 'member'}
                                                    </p>
                                                    <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                                                        {message.reply_to.message_text}
                                                    </p>
                                                </div>
                                            )}

                                            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words mt-3">
                                                {message.message_text}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="border-t border-surface-border pt-4 mt-4 space-y-3">
                        {(replyTo || editingMessage) && (
                            <div className="rounded-xl border border-surface-border bg-surface p-3 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-white">
                                        {editingMessage ? 'Editing message' : 'Replying'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                        {editingMessage?.message_text ?? replyTo?.message_text}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="btn-ghost p-1.5"
                                    onClick={cancelComposerState}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <textarea
                            className="input min-h-[120px] resize-none"
                            placeholder={
                                selectedRoom.kind === 'general'
                                    ? 'Write a team message...'
                                    : 'Write a finding discussion message...'
                            }
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            maxLength={2000}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-500">
                                {messageText.trim().length}/2000 characters
                            </p>

                            <button
                                type="button"
                                onClick={() => void handleSendOrSave()}
                                disabled={sending || !messageText.trim()}
                                className="btn-primary"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingMessage ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                                {editingMessage ? 'Save Changes' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card space-y-4 h-fit">
                    <div>
                        <p className="text-sm font-semibold text-white">Context Panel</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Room and discussion context for better team coordination.
                        </p>
                    </div>

                    {selectedRoom.kind === 'general' ? (
                        <>
                            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">General Room Stats</p>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Messages: {threads?.generalThread.message_count ?? 0}
                                </p>
                                <p className="text-sm text-gray-300">
                                    Finding threads: {threads?.findingThreads.length ?? 0}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Last activity: {formatTime(threads?.generalThread.last_message_at)}
                                </p>
                            </div>

                            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Leader Announcements</p>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Team leaders can post announcement-style messages in the general room to highlight urgent actions, deadlines, or policy updates.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Selected Finding</p>
                                </div>

                                <p className="text-sm font-semibold text-white">
                                    {selectedFinding?.title ?? 'No finding selected'}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {selectedFinding?.severity && (
                                        <span className={severityBadge(selectedFinding.severity)}>
                                            {selectedFinding.severity}
                                        </span>
                                    )}
                                    {selectedFinding?.status && (
                                        <span className="badge-low">{selectedFinding.status}</span>
                                    )}
                                    {selectedFinding?.module && (
                                        <span className="badge-low">{selectedFinding.module}</span>
                                    )}
                                </div>

                                <p className="text-xs text-gray-500">
                                    {selectedFinding?.file_path ?? 'Unknown file'}
                                    {selectedFinding?.line_number ? `:${selectedFinding.line_number}` : ''}
                                </p>

                                {selectedFinding?.id && (
                                    <Link
                                        to={`/team/${teamId}/findings`}
                                        className="btn-secondary inline-flex"
                                    >
                                        <FileCode2 className="w-4 h-4" />
                                        Open Findings Page
                                    </Link>
                                )}
                            </div>

                            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-brand-400" />
                                    <p className="text-sm font-semibold text-white">Thread Guidance</p>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Use replies for targeted follow-ups, share remediation steps, and keep issue-specific discussion inside the finding thread instead of the general room.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}