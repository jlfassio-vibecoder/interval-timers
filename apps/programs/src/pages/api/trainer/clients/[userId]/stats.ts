/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { fetchClientStats } from '@/lib/supabase/admin/trainer-roster';

export const GET: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: trainerId } = await verifyTrainerOrAdminRequest(request, cookies);
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const stats = await fetchClientStats(trainerId, userId);
    if (!stats) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Trainer or admin access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/clients/:userId/stats] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch client stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
