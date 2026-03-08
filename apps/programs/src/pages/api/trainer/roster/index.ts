/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { fetchTrainerRoster } from '@/lib/supabase/admin/trainer-roster';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid } = await verifyTrainerOrAdminRequest(request, cookies);
    const roster = await fetchTrainerRoster(uid);
    return new Response(JSON.stringify(roster), {
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
      console.error('[trainer/roster] Error fetching roster:', error);
    }
    // Return empty roster instead of 500 so UI can show empty state (dev/MVP: no users yet)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
