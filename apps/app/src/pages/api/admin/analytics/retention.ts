/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin analytics retention API: cohort retention matrix from get_retention_cohort_stats RPC.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  getRetentionStats,
  type RetentionGranularity,
} from '@/lib/supabase/admin/analytics-retention';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const days = Math.min(
      180,
      Math.max(7, parseInt(url.searchParams.get('days') ?? '30', 10) || 30)
    );
    const g = url.searchParams.get('granularity') ?? 'week';
    const granularity: RetentionGranularity = g === 'month' ? 'month' : 'week';
    const maxPeriods = Math.min(
      24,
      Math.max(1, parseInt(url.searchParams.get('maxPeriods') ?? '8', 10) || 8)
    );
    const stats = await getRetentionStats(days, granularity, maxPeriods);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ((error as { message?: string })?.message ?? '');
    if (message === 'UNAUTHENTICATED' || message === 'UNAUTHORIZED') {
      return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/analytics/retention] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch retention analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
