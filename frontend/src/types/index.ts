// Shared TypeScript types used across frontend and backend

// ─── User & Auth ──────────────────────────────────────────────
export type UserRole = 'leader' | 'member' | 'viewer';

export interface Profile {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: UserRole;
    created_at: string;
}

// ─── Teams ────────────────────────────────────────────────────
export interface Team {
    id: string;
    name: string;
    description?: string;
    invite_code: string;
    leader_id: string;
    created_at: string;
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

// ─── Projects ─────────────────────────────────────────────────
export interface Project {
    id: string;
    team_id: string;
    name: string;
    description?: string;
    created_at: string;
}

// ─── Findings & Scans ─────────────────────────────────────────
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type AdvisorModule = 'HSD' | 'SNC' | 'SDS' | 'IVS';
export type FindingStatus = 'open' | 'in_progress' | 'resolved';

export interface Finding {
    id: string;
    session_id: string;
    team_id: string;
    uploaded_by: string;
    module: AdvisorModule;
    rule_id?: string;
    title: string;
    description?: string;
    severity: SeverityLevel;
    file_path?: string;
    line_number?: number;
    code_snippet?: string;
    owasp_category?: string;
    status: FindingStatus;
    created_at: string;
    profile?: Profile;
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

// ─── Stats & Charts ───────────────────────────────────────────
export interface MemberStats {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    by_module: Record<AdvisorModule, number>;
    last_scanned_at?: string;
    risk_score: number; // 0–100
}

export interface TimelineDataPoint {
    date: string;     // ISO date string
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

// ─── Fix Tasks ────────────────────────────────────────────────
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

// ─── API Response Wrappers ─────────────────────────────────────
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ApiError {
    error: string;
    code?: string;
}

// ─── Upload Payload (from VS Code extension) ──────────────────
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
    severity: SeverityLevel;
    file_path?: string;
    line_number?: number;
    code_snippet?: string;
}
