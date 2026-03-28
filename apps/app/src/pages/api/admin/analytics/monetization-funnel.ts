/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin analytics: monetization funnel from get_monetization_funnel_stats RPC.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { getMonetizationFunnelStats } from '@/lib/supabase/admin/analytics-monetization-funnel';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const days = Math.min(
      366,
      Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30)
    );
    const stats = await getMonetizationFunnelStats(days);

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
      console.error('[admin/analytics/monetization-funnel] Error:', error);
    }
    return new Response(
      JSON.stringify({ error: 'Failed to fetch monetization funnel analytics' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
