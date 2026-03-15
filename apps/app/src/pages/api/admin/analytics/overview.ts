/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin analytics overview API: total events and distinct users in range.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { getAnalyticsOverview } from '@/lib/supabase/admin/analytics-overview';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const days = Math.min(
      90,
      Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30)
    );
    const overview = await getAnalyticsOverview(days);

    return new Response(JSON.stringify(overview), {
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
      console.error('[admin/analytics/overview] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics overview' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
