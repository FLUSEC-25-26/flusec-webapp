export type UserRole = 'leader' | 'member' | 'viewer';

export interface Profile {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: UserRole;
    created_at: string;
}

export interface Team {
    id: string;
    team_code?: string | null;
    name: string;
    description?: string | null;
    invite_code: string;
    leader_id: string;
    created_at: string;
}

export interface TeamWithRole extends Team {
    myRole: 'leader' | 'member';
}

export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: UserRole;
    joined_at: string;
    profile?: Profile;
    stats?: MemberStats;
}

export interface Project {
    id: string;
    team_id: string;
    name: string;
    description?: string;
    created_at: string;
}

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type AdvisorModule = 'HSD' | 'SNC' | 'SDS' | 'IVS';
export type FindingStatus = 'open' | 'in_progress' | 'resolved';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface TaintFlowStep {
    type?: string;
    line?: number | null;
    column?: number | null;
    description?: string | null;
}

export interface Finding {
    id: string;
    session_id: string;
    team_id: string;
    uploaded_by: string;
    module: AdvisorModule;
    rule_id?: string | null;
    title: string;
    description?: string | null;
    severity: SeverityLevel;
    original_severity?: string | null;
    risk_level?: RiskLevel | null;
    risk_score?: number | null;
    file_path?: string | null;
    line_number?: number | null;
    column_number?: number | null;
    code_snippet?: string | null;
    function_name?: string | null;
    complexity?: number | null;
    nesting_depth?: number | null;
    function_loc?: number | null;
    secret_type?: string | null;
    taint_flow?: TaintFlowStep[] | null;
    data_type?: string | null;
    storage_context?: string | null;
    owasp_category?: string;
    status: FindingStatus;
    created_at: string;
    profile?: Profile | null;
}

export interface ScanSession {
    id: string;
    team_id: string;
    project_id?: string;
    uploaded_by: string;
    scanned_file: string;
    storage_path: string;
    total_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    scanned_at: string;
}

export interface MemberStats {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    by_module: Record<AdvisorModule, number>;
    last_scanned_at?: string;
    risk_score: number;
}

export interface TimelineDataPoint {
    date: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'open' | 'in_progress' | 'done';

export interface FixTask {
    id: string;
    finding_id: string;
    team_id: string;
    assigned_to: string;
    assigned_by: string;
    title: string;
    priority: TaskPriority;
    due_date?: string;
    status: TaskStatus;
    notes?: string;
    created_at: string;
    finding?: Finding;
    assignee?: Profile;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ApiError {
    error: string;
    code?: string;
}

export interface FindingsUploadPayload {
    team_id: string;
    project_id?: string;
    scanned_file: string;
    findings: RawFinding[];
}

export interface RawFinding {
    module: AdvisorModule;
    rule_id?: string;
    title: string;
    description?: string;
    severity: string;
    original_severity?: string | null;
    file_path?: string;
    line_number?: number;
    column_number?: number;
    code_snippet?: string;
    function_name?: string | null;
    complexity?: number | null;
    nesting_depth?: number | null;
    function_loc?: number | null;
    secret_type?: string | null;
    taint_flow?: TaintFlowStep[] | null;
    risk_level?: string | null;
    data_type?: string | null;
    storage_context?: string | null;
}