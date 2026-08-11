export type UserRole = 'leader' | 'member' | 'viewer'

export interface Profile {
  id: string
  full_name: string
  avatar_url?: string | null
  role: UserRole
  created_at: string
}

export interface Team {
  id: string
  team_code?: string | null
  name: string
  description?: string | null
  invite_code: string
  leader_id: string
  created_at: string
}

export interface TeamWithRole extends Team {
  myRole: UserRole
  joined_at?: string | null
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: UserRole
  joined_at: string
  profile?: Profile
  stats?: MemberStats
}

export interface Project {
  id: string
  team_id: string
  name: string
  description?: string | null
  created_at: string
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low'
export type DetectionConfidence = 'high' | 'medium' | 'low'
export type DiagnosticSeverity = 'warning' | 'error' | 'information' | 'hint'
export type FlusecComponent = 'HSD' | 'NET' | 'IDS' | 'IIV'
export type FindingStatus = 'open' | 'in_progress' | 'resolved'
export type ScanScope = 'file' | 'project'

export interface TaintFlowStep {
  type?: string
  line?: number | null
  column?: number | null
  description?: string | null
}

export interface Finding {
  id: string
  last_session_id?: string | null
  team_id: string
  project_id?: string | null
  uploaded_by: string
  workspace_id: string
  component: FlusecComponent
  rule_id?: string | null
  fingerprint: string
  title: string
  description?: string | null
  diagnostic_severity: DiagnosticSeverity
  security_severity: SecuritySeverity
  confidence: DetectionConfidence
  category?: string | null
  cwe?: string | null
  remediation?: string | null
  evidence?: Record<string, unknown> | null
  file_path?: string | null
  line_number?: number | null
  column_number?: number | null
  code_snippet?: string | null
  function_name?: string | null
  complexity?: number | null
  nesting_depth?: number | null
  function_loc?: number | null
  maintainability_score?: number | null
  maintainability_level?: string | null
  secret_type?: string | null
  taint_flow?: TaintFlowStep[] | null
  data_type?: string | null
  storage_context?: string | null
  status: FindingStatus
  first_seen_at: string
  last_seen_at: string
  resolved_at?: string | null
  created_at: string
  profile?: Profile | null
}

export interface ScanSession {
  id: string
  team_id: string
  project_id?: string | null
  uploaded_by: string
  workspace_id: string
  scan_scope: ScanScope
  scanned_target: string
  storage_path?: string | null
  total_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  scanned_at: string
}

export interface MemberStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  by_component: Record<FlusecComponent, number>
  last_scanned_at?: string | null
}

export interface TimelineDataPoint {
  date: string
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export type TaskPriority = SecuritySeverity
export type TaskStatus = 'open' | 'in_progress' | 'done'

export interface FixTask {
  id: string
  finding_id: string
  team_id: string
  assigned_to: string
  assigned_by: string
  title: string
  priority: TaskPriority
  due_date?: string | null
  status: TaskStatus
  notes?: string | null
  created_at: string
  finding?: Finding
  assignee?: Profile
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  code?: string
}

export interface AuthMeResponse {
  profile: Profile
  teams: TeamWithRole[]
}
