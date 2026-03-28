/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retention cohort stats: RPC get_retention_cohort_stats (profiles.created_at cohorts).
 */

import { getSupabaseServer } from '../server';

export type RetentionGranularity = 'week' | 'month';

export interface RetentionPeriod {
  offset: number;
  activeCount: number;
  retentionRate: number;
}

export interface RetentionCohortRow {
  cohortStart: string;
  label: string;
  cohortSize: number;
  periods: RetentionPeriod[];
}

export interface RetentionStats {
  from: string;
  to: string;
  granularity: RetentionGranularity;
  maxPeriods: number;
  cohortAnchor: string;
  activeDefinition: string;
  cohorts: RetentionCohortRow[];
}

export async function getRetentionStats(
  days: number,
  granularity: RetentionGranularity,
  maxPeriods: number = 8
): Promise<RetentionStats> {
  const supabase = getSupabaseServer();

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_retention_cohort_stats', {
    p_days: days,
    p_granularity: granularity,
    p_max_periods: maxPeriods,
  });

  if (rpcError) throw rpcError;

  const raw = (rpcData ?? {}) as Record<string, unknown>;

  const cohortsRaw = raw.cohorts;
  const cohorts: RetentionCohortRow[] = Array.isArray(cohortsRaw)
    ? (cohortsRaw as Array<Record<string, unknown>>).map((row) => ({
        cohortStart: String(row.cohortStart ?? ''),
        label: String(row.label ?? ''),
        cohortSize: Number(row.cohortSize ?? 0),
        periods: Array.isArray(row.periods)
          ? (row.periods as Array<Record<string, unknown>>).map((p) => ({
              offset: Number(p.offset ?? 0),
              activeCount: Number(p.activeCount ?? 0),
              retentionRate: Number(p.retentionRate ?? 0),
            }))
          : [],
      }))
    : [];

  return {
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    granularity: (raw.granularity === 'month' ? 'month' : 'week') as RetentionGranularity,
    maxPeriods: Number(raw.maxPeriods ?? maxPeriods),
    cohortAnchor: String(raw.cohortAnchor ?? 'profiles.created_at'),
    activeDefinition: String(
      raw.activeDefinition ??
        'distinct user_id with >=1 analytics_events or web_events in bucket; anonymous excluded'
    ),
    cohorts,
  };
}
