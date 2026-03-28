/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quality analytics: frontend error counts by page, top errors, time series.
 * Uses get_errors_frontend_rollups RPC (Phase P6); service role reads errors_frontend.
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

  const { data, error } = await supabase.rpc('get_errors_frontend_rollups', {
    p_days: days,
    p_top_pages: TOP_PAGES_LIMIT,
    p_top_messages: TOP_ERRORS_LIMIT,
  });

  if (error) {
    const msg = error.message ?? '';
    const code = (error as { code?: string }).code ?? '';
    const missingTable =
      /relation .* does not exist/i.test(msg) ||
      code === '42P01' ||
      /function .* does not exist/i.test(msg) ||
      /permission denied/i.test(msg) ||
      code === '42501';
    if (missingTable) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.warn('[analytics-quality] errors_frontend / RPC not available:', error.message);
      }
      return EMPTY_STATS;
    }
    throw error;
  }

  const row = data as {
    errors_by_page?: unknown;
    top_errors?: unknown;
    errors_by_day?: unknown;
    total_errors?: unknown;
  } | null;

  if (!row || typeof row !== 'object') {
    return EMPTY_STATS;
  }

  const errorsByPage = Array.isArray(row.errors_by_page)
    ? (row.errors_by_page as { page?: string; count?: unknown }[]).map((r) => ({
        page: typeof r.page === 'string' ? r.page : String(r.page ?? ''),
        count: Number(r.count ?? 0),
      }))
    : [];

  const topErrors = Array.isArray(row.top_errors)
    ? (row.top_errors as { message?: string; count?: unknown }[]).map((r) => ({
        message: normalizeMessage(
          typeof r.message === 'string' ? r.message : String(r.message ?? '')
        ),
        count: Number(r.count ?? 0),
      }))
    : [];

  const errorsByDay = Array.isArray(row.errors_by_day)
    ? (row.errors_by_day as { date?: string; count?: unknown }[])
        .map((r) => ({
          date: typeof r.date === 'string' ? r.date : String(r.date ?? ''),
          count: Number(r.count ?? 0),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return {
    errorsByPage,
    totalErrors: Number(row.total_errors ?? 0),
    topErrors,
    errorsByDay,
  };
}
