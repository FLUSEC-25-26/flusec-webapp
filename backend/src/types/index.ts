// Shared types for backend — mirrors frontend types/index.ts
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'
export type AdvisorModule = 'HSD' | 'SNC' | 'SDS' | 'IVS'
export type FindingStatus = 'open' | 'in_progress' | 'resolved'

export interface RawFinding {
    module: AdvisorModule
    rule_id?: string
    title: string
    description?: string
    severity: SeverityLevel
    file_path?: string
    line_number?: number
    code_snippet?: string
}
