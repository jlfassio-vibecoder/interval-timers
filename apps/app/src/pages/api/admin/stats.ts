/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { getDashboardStats } from '@/lib/supabase/admin/statistics';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);
    const stats = await getDashboardStats();

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
    if (message === 'STATS_TIMEOUT') {
      console.error('[admin/stats] getDashboardStats timed out after 10s');
      return new Response(
        JSON.stringify({
          error: 'Dashboard statistics temporarily unavailable. Please retry.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/stats] Error fetching dashboard statistics:', error);
    }
    const isInvalidKey =
      typeof message === 'string' &&
      (message.includes('Invalid API key') ||
        message.includes('JWT') ||
        message.toLowerCase().includes('supabase'));
    return new Response(
      JSON.stringify({
        error: isInvalidKey
          ? 'Invalid Supabase API key. In .env.local set SUPABASE_SERVICE_ROLE_KEY to the service_role JWT from Supabase Dashboard → your project → Settings → API (use “service_role” secret, not anon). Ensure the key matches the project whose URL is in PUBLIC_SUPABASE_URL, then restart the dev server.'
          : 'Failed to fetch dashboard statistics',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
