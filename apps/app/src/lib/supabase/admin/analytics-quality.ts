/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quality analytics: frontend error counts by page, top errors, time series.
 * Uses service role to read errors_frontend (RLS allows only INSERT for anon/authenticated).
 */

import { getSupabaseServer } from '../server';

const MESSAGE_NORMALIZE_LENGTH = 100;
const TOP_PAGES_LIMIT = 20;
const TOP_ERRORS_LIMIT = 15;

export interface QualityStats {
  errorsByPage: { page: string; count: number }[];
  totalErrors: number;
  topErrors: { message: string; count: number }[];
  errorsByDay: { date: string; count: number }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeMessage(msg: string): string {
  const t = msg.trim();
  if (t.length <= MESSAGE_NORMALIZE_LENGTH) return t;
  return t.slice(0, MESSAGE_NORMALIZE_LENGTH);
}

const EMPTY_STATS: QualityStats = {
  errorsByPage: [],
  totalErrors: 0,
  topErrors: [],
  errorsByDay: [],
};

export async function getQualityStats(days: number): Promise<QualityStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const { data: rows, error } = await supabase
    .from('errors_frontend')
    .select('message, page, occurred_at')
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso);

  if (error) {
    const msg = error.message ?? '';
    const code = (error as { code?: string }).code ?? '';
    const missingTable =
      /relation .* does not exist/i.test(msg) ||
      code === '42P01' ||
      /permission denied/i.test(msg) ||
      code === '42501';
    if (missingTable) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.warn('[analytics-quality] errors_frontend not available:', error.message);
      }
      return EMPTY_STATS;
    }
    throw error;
  }

  const list = rows ?? [];
  const totalErrors = list.length;

  const pageCounts = new Map<string, number>();
  const messageCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const row of list) {
    const page = (row as { page: string | null }).page ?? 'Unknown';
    pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1);

    const msg = (row as { message: string }).message;
    const normalized = normalizeMessage(msg);
    messageCounts.set(normalized, (messageCounts.get(normalized) ?? 0) + 1);

    const occurredAt = (row as { occurred_at: string }).occurred_at;
    const day = occurredAt ? occurredAt.slice(0, 10) : dateKey(toDate);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const errorsByPage = Array.from(pageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_PAGES_LIMIT);

  const topErrors = Array.from(messageCounts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_ERRORS_LIMIT);

  const sortedDays = Array.from(dayCounts.entries()).sort(([a], [b]) => a.localeCompare(b));
  const errorsByDay = sortedDays.map(([date, count]) => ({ date, count }));

  return {
    errorsByPage,
    totalErrors,
    topErrors,
    errorsByDay,
  };
}
