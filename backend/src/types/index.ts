// Shared backend types

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type AdvisorModule = 'HSD' | 'SNC' | 'SDS' | 'IVS'
export type FindingStatus = 'open' | 'in_progress' | 'resolved'

export interface TaintFlowStep {
    type?: string
    line?: number | null
    column?: number | null
    description?: string | null
}

export interface RawFinding {
    module?: AdvisorModule
    component?: string

    rule_id?: string
    ruleId?: string

    title?: string
    message?: string
    description?: string

    severity?: string
    original_severity?: string | null
    originalSeverity?: string | null

    file_path?: string
    filePath?: string
    file?: string

    line_number?: number
    lineNumber?: number
    line?: number

    column_number?: number
    columnNumber?: number
    column?: number

    code_snippet?: string
    codeSnippet?: string
    snippet?: string

    function_name?: string | null
    functionName?: string | null

    complexity?: number | null

    nesting_depth?: number | null
    nestingDepth?: number | null

    function_loc?: number | null
    functionLoc?: number | null

    secret_type?: string | null
    secretType?: string | null

    taint_flow?: TaintFlowStep[] | null
    taintFlow?: TaintFlowStep[] | null

    risk_level?: string | null
    riskLevel?: string | null
    risk_score?: number | null

    data_type?: string | null
    dataType?: string | null

    storage_context?: string | null
    storageContext?: string | null
}