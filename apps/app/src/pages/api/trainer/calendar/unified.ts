/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET read-only unified trainer calendar (all program roster clients in range).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { validateCalendarRange } from '@/lib/supabase/admin/trainer-client-calendar';
import { buildTrainerUnifiedCalendarPayload } from '@/lib/supabase/admin/trainer-unified-calendar';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);

    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const rangeCheck = validateCalendarRange(from, to);
    if (!rangeCheck.ok) {
      return new Response(JSON.stringify({ error: rangeCheck.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await buildTrainerUnifiedCalendarPayload(viewerId, role, from, to);

    return new Response(JSON.stringify({ ...payload, from, to }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/calendar/unified GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load unified calendar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
