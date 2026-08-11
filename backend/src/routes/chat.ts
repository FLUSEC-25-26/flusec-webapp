import { Router } from 'express'
import { supabaseAdmin } from '../services/supabaseAdmin'
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware'

const router = Router()

type TeamMessageKind = 'general' | 'finding' | 'announcement'

type TeamMemberAccess = {
    id: string
    role: 'leader' | 'member' | 'viewer'
}

type FindingSummary = {
    id: string
    component: string
    title: string
    security_severity: string
    status: string
    file_path: string | null
    line_number: number | null
}

type MessageRow = {
    id: string
    team_id: string
    sender_id: string
    finding_id: string | null
    reply_to_message_id: string | null
    message_kind: TeamMessageKind
    message_text: string
    created_at: string
    edited_at: string | null
}

function clampLimit(value: unknown, fallback = 120) {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(Math.max(num, 1), 200)
}

async function ensureTeamMember(teamId: string, userId: string): Promise<TeamMemberAccess | null> {
    const { data, error } = await supabaseAdmin
        .from('team_members')
        .select('id, role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as TeamMemberAccess | null) ?? null
}

async function getFindingSummary(teamId: string, findingId: string): Promise<FindingSummary | null> {
    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('id, component, title, security_severity, status, file_path, line_number')
        .eq('id', findingId)
        .eq('team_id', teamId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as FindingSummary | null) ?? null
}

async function getFindingsMap(teamId: string, findingIds: string[]) {
    if (findingIds.length === 0) {
        return new Map<string, FindingSummary>()
    }

    const { data, error } = await supabaseAdmin
        .from('findings')
        .select('id, component, title, security_severity, status, file_path, line_number')
        .eq('team_id', teamId)
        .in('id', findingIds)

    if (error) throw new Error(error.message)

    return new Map(
        (data ?? []).map((finding) => [
            finding.id,
            {
                id: finding.id,
                component: finding.component,
                title: finding.title,
                security_severity: finding.security_severity,
                status: finding.status,
                file_path: finding.file_path ?? null,
                line_number: finding.line_number ?? null,
            } satisfies FindingSummary,
        ])
    )
}

async function getProfilesMap(userIds: string[]) {
    if (userIds.length === 0) {
        return new Map<string, { id: string; full_name: string; avatar_url: string | null }>()
    }

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)

    if (error) throw new Error(error.message)

    return new Map(
        (data ?? []).map((profile) => [
            profile.id,
            {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url ?? null,
            },
        ])
    )
}

async function getMessageById(messageId: string): Promise<MessageRow | null> {
    const { data, error } = await supabaseAdmin
        .from('team_messages')
        .select('id, team_id, sender_id, finding_id, reply_to_message_id, message_kind, message_text, created_at, edited_at')
        .eq('id', messageId)
        .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as MessageRow | null) ?? null
}

// GET /api/chat/team/:teamId/threads
router.get('/team/:teamId/threads', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string

    try {
        const membership = await ensureTeamMember(teamId, req.userId!)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        const { data: recentMessages, error } = await supabaseAdmin
            .from('team_messages')
            .select('id, team_id, sender_id, finding_id, reply_to_message_id, message_kind, message_text, created_at, edited_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
            .limit(500)

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        const messages = (recentMessages ?? []) as MessageRow[]
        const senderIds = [...new Set(messages.map((message) => message.sender_id))]
        const profilesMap = await getProfilesMap(senderIds)

        const generalMessages = messages.filter((message) => !message.finding_id)
        const latestGeneral = generalMessages[0] ?? null

        const grouped = new Map<
            string,
            {
                message_count: number
                last_message_at: string
                last_message_text: string
                last_sender_name: string | null
            }
        >()

        for (const message of messages) {
            if (!message.finding_id) continue

            const existing = grouped.get(message.finding_id)
            const senderName = profilesMap.get(message.sender_id)?.full_name ?? null

            if (!existing) {
                grouped.set(message.finding_id, {
                    message_count: 1,
                    last_message_at: message.created_at,
                    last_message_text: message.message_text,
                    last_sender_name: senderName,
                })
            } else {
                existing.message_count += 1
            }
        }

        const findingIds = [...grouped.keys()]
        const findingsMap = await getFindingsMap(teamId, findingIds)

        const findingThreads = findingIds
            .map((findingId) => {
                const summary = grouped.get(findingId)
                const finding = findingsMap.get(findingId) ?? null
                if (!summary || !finding) return null

                return {
                    kind: 'finding' as const,
                    key: `finding:${findingId}`,
                    message_count: summary.message_count,
                    last_message_at: summary.last_message_at,
                    last_message_text: summary.last_message_text,
                    last_sender_name: summary.last_sender_name,
                    finding,
                }
            })
            .filter(Boolean)
            .sort((a, b) => {
                const aTime = new Date(a!.last_message_at ?? 0).getTime()
                const bTime = new Date(b!.last_message_at ?? 0).getTime()
                return bTime - aTime
            })

        const generalThread = {
            kind: 'general' as const,
            key: 'general',
            message_count: generalMessages.length,
            last_message_at: latestGeneral?.created_at ?? null,
            last_message_text: latestGeneral?.message_text ?? null,
            last_sender_name: latestGeneral
                ? profilesMap.get(latestGeneral.sender_id)?.full_name ?? null
                : null,
            finding: null,
        }

        res.json({
            data: {
                generalThread,
                findingThreads,
            },
        })
    } catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : 'Failed to load communication threads',
        })
    }
})

// GET /api/chat/team/:teamId/messages
router.get('/team/:teamId/messages', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string
    const findingId = typeof req.query['finding_id'] === 'string' ? req.query['finding_id'] : undefined
    const limit = clampLimit(req.query['limit'], 120)

    try {
        const membership = await ensureTeamMember(teamId, req.userId!)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        let roomFinding: FindingSummary | null = null

        let query = supabaseAdmin
            .from('team_messages')
            .select('id, team_id, sender_id, finding_id, reply_to_message_id, message_kind, message_text, created_at, edited_at')
            .eq('team_id', teamId)

        if (findingId) {
            roomFinding = await getFindingSummary(teamId, findingId)
            if (!roomFinding) {
                res.status(404).json({ error: 'Finding discussion not found for this team' })
                return
            }

            query = query.eq('finding_id', findingId)
        } else {
            query = query.is('finding_id', null)
        }

        const { data: messageRows, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        const messages = [...((messageRows ?? []) as MessageRow[])].reverse()

        const replyIds = [...new Set(messages.map((message) => message.reply_to_message_id).filter(Boolean))] as string[]
        const replyRows = replyIds.length > 0
            ? await Promise.all(replyIds.map((id) => getMessageById(id)))
            : []

        const replyMap = new Map(
            replyRows.filter(Boolean).map((row) => [row!.id, row!])
        )

        const senderIds = [
            ...new Set([
                ...messages.map((message) => message.sender_id),
                ...replyRows.filter(Boolean).map((row) => row!.sender_id),
            ]),
        ]

        const profilesMap = await getProfilesMap(senderIds)

        const enriched = messages.map((message) => {
            const reply = message.reply_to_message_id ? replyMap.get(message.reply_to_message_id) ?? null : null
            return {
                ...message,
                sender: profilesMap.get(message.sender_id) ?? null,
                reply_to: reply
                    ? {
                          id: reply.id,
                          message_text: reply.message_text,
                          sender_name: profilesMap.get(reply.sender_id)?.full_name ?? null,
                      }
                    : null,
            }
        })

        res.json({
            data: {
                messages: enriched,
                roomFinding,
            },
        })
    } catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : 'Failed to load room messages',
        })
    }
})

// POST /api/chat/team/:teamId/messages
router.post('/team/:teamId/messages', authMiddleware, async (req: AuthRequest, res) => {
    const teamId = req.params.teamId as string
    const {
        message_text,
        finding_id,
        reply_to_message_id,
        message_kind,
    } = req.body as {
        message_text?: string
        finding_id?: string | null
        reply_to_message_id?: string | null
        message_kind?: TeamMessageKind
    }

    const text = message_text?.trim() ?? ''

    if (!text) {
        res.status(400).json({ error: 'Message text is required' })
        return
    }

    if (text.length > 2000) {
        res.status(400).json({ error: 'Message must be 2000 characters or less' })
        return
    }

    try {
        const membership = await ensureTeamMember(teamId, req.userId!)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        let finalKind: TeamMessageKind = 'general'
        let finalFindingId: string | null = null

        if (finding_id) {
            const finding = await getFindingSummary(teamId, finding_id)
            if (!finding) {
                res.status(404).json({ error: 'Finding discussion not found for this team' })
                return
            }

            finalFindingId = finding_id
            finalKind = 'finding'
        } else if (message_kind === 'announcement') {
            if (membership.role !== 'leader') {
                res.status(403).json({ error: 'Only team leaders can post announcements' })
                return
            }
            finalKind = 'announcement'
        }

        let finalReplyToId: string | null = null

        if (reply_to_message_id) {
            const replyTarget = await getMessageById(reply_to_message_id)
            if (!replyTarget || replyTarget.team_id !== teamId) {
                res.status(404).json({ error: 'Reply target not found in this team' })
                return
            }
            finalReplyToId = replyTarget.id
        }

        const { data: inserted, error } = await supabaseAdmin
            .from('team_messages')
            .insert({
                team_id: teamId,
                sender_id: req.userId!,
                finding_id: finalFindingId,
                reply_to_message_id: finalReplyToId,
                message_kind: finalKind,
                message_text: text,
            })
            .select('id, team_id, sender_id, finding_id, reply_to_message_id, message_kind, message_text, created_at, edited_at')
            .single()

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        const profilesMap = await getProfilesMap([req.userId!])
        const replyRow = finalReplyToId ? await getMessageById(finalReplyToId) : null
        const replySenderMap = replyRow ? await getProfilesMap([replyRow.sender_id]) : new Map()

        res.status(201).json({
            data: {
                ...inserted,
                sender: profilesMap.get(req.userId!) ?? null,
                reply_to: replyRow
                    ? {
                          id: replyRow.id,
                          message_text: replyRow.message_text,
                          sender_name: replySenderMap.get(replyRow.sender_id)?.full_name ?? null,
                      }
                    : null,
            },
        })
    } catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : 'Failed to send message',
        })
    }
})

// PATCH /api/chat/messages/:messageId
router.patch('/messages/:messageId', authMiddleware, async (req: AuthRequest, res) => {
    const messageId = req.params.messageId as string
    const { message_text } = req.body as { message_text?: string }

    const text = message_text?.trim() ?? ''

    if (!text) {
        res.status(400).json({ error: 'Message text is required' })
        return
    }

    if (text.length > 2000) {
        res.status(400).json({ error: 'Message must be 2000 characters or less' })
        return
    }

    try {
        const existing = await getMessageById(messageId)
        if (!existing) {
            res.status(404).json({ error: 'Message not found' })
            return
        }

        const membership = await ensureTeamMember(existing.team_id, req.userId!)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        if (existing.sender_id !== req.userId) {
            res.status(403).json({ error: 'Only the sender can edit this message' })
            return
        }

        const { data: updated, error } = await supabaseAdmin
            .from('team_messages')
            .update({
                message_text: text,
                edited_at: new Date().toISOString(),
            })
            .eq('id', messageId)
            .select('id, team_id, sender_id, finding_id, reply_to_message_id, message_kind, message_text, created_at, edited_at')
            .single()

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        const profilesMap = await getProfilesMap([updated.sender_id])
        const replyRow = updated.reply_to_message_id ? await getMessageById(updated.reply_to_message_id) : null
        const replySenderMap = replyRow ? await getProfilesMap([replyRow.sender_id]) : new Map()

        res.json({
            data: {
                ...updated,
                sender: profilesMap.get(updated.sender_id) ?? null,
                reply_to: replyRow
                    ? {
                          id: replyRow.id,
                          message_text: replyRow.message_text,
                          sender_name: replySenderMap.get(replyRow.sender_id)?.full_name ?? null,
                      }
                    : null,
            },
        })
    } catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : 'Failed to edit message',
        })
    }
})

// DELETE /api/chat/messages/:messageId
router.delete('/messages/:messageId', authMiddleware, async (req: AuthRequest, res) => {
    const messageId = req.params.messageId as string

    try {
        const existing = await getMessageById(messageId)
        if (!existing) {
            res.status(404).json({ error: 'Message not found' })
            return
        }

        const membership = await ensureTeamMember(existing.team_id, req.userId!)
        if (!membership) {
            res.status(403).json({ error: 'Not a member of this team' })
            return
        }

        const canDelete = existing.sender_id === req.userId || membership.role === 'leader'
        if (!canDelete) {
            res.status(403).json({ error: 'You are not allowed to delete this message' })
            return
        }

        const { error } = await supabaseAdmin
            .from('team_messages')
            .delete()
            .eq('id', messageId)

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        res.json({ data: { message: 'Message deleted' } })
    } catch (e) {
        res.status(500).json({
            error: e instanceof Error ? e.message : 'Failed to delete message',
        })
    }
})

export default router