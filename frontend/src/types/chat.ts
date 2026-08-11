import type { FlusecComponent, SecuritySeverity } from '@/types'

export type TeamMessageKind = 'general' | 'finding' | 'announcement'

export interface TeamChatSender {
  id: string
  full_name: string
  avatar_url?: string | null
}

export interface TeamChatReplyPreview {
  id: string
  message_text: string
  sender_name: string | null
}

export interface TeamDiscussionFinding {
  id: string
  component: FlusecComponent
  title: string
  security_severity: SecuritySeverity
  status: string
  file_path: string | null
  line_number: number | null
}

export interface TeamChatMessage {
  id: string
  team_id: string
  sender_id: string
  finding_id: string | null
  reply_to_message_id: string | null
  message_kind: TeamMessageKind
  message_text: string
  created_at: string
  edited_at: string | null
  sender: TeamChatSender | null
  reply_to: TeamChatReplyPreview | null
}

export interface TeamThreadSummary {
  kind: 'general' | 'finding'
  key: string
  message_count: number
  last_message_at: string | null
  last_message_text: string | null
  last_sender_name: string | null
  finding: TeamDiscussionFinding | null
}

export interface TeamThreadCollection {
  generalThread: TeamThreadSummary
  findingThreads: TeamThreadSummary[]
}

export interface TeamRoomPayload {
  messages: TeamChatMessage[]
  roomFinding: TeamDiscussionFinding | null
}
