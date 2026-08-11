import type { FlusecComponent, SecuritySeverity } from '../types'

export interface FindingStatRow {
  component: FlusecComponent | string
  security_severity: SecuritySeverity | string
  last_seen_at?: string | null
  status?: string | null
}

export function summarizeFindings(rows: FindingStatRow[]) {
  const openRows = rows.filter((row) => row.status !== 'resolved')
  const by_component: Record<FlusecComponent, number> = {
    HSD: 0,
    NET: 0,
    IDS: 0,
    IIV: 0,
  }

  const counts = {
    total: openRows.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  for (const row of openRows) {
    const severity = String(row.security_severity ?? 'low').toLowerCase()
    if (severity === 'critical') counts.critical += 1
    else if (severity === 'high') counts.high += 1
    else if (severity === 'medium') counts.medium += 1
    else counts.low += 1

    const component = String(row.component ?? '').toUpperCase() as FlusecComponent
    if (component in by_component) by_component[component] += 1
  }

  const last_scanned_at = [...rows]
    .map((row) => row.last_seen_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

  return { ...counts, by_component, last_scanned_at }
}
