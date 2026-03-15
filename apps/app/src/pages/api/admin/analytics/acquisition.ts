/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin analytics acquisition API: unique visitors, referrers, UTM, landing pages, device/browser, geo.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { getAcquisitionStats } from '@/lib/supabase/admin/analytics-acquisition';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const daysParam = url.searchParams.get('days');
    const days = Math.min(90, Math.max(1, parseInt(daysParam ?? '30', 10) || 30));
    const stats = await getAcquisitionStats(days);

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
      console.error('[admin/analytics/acquisition] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch acquisition stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
