/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET trainer-scoped client calendar (program events + coach schedule instances).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  buildTrainerClientCalendarPayload,
  validateCalendarRange,
} from '@/lib/supabase/admin/trainer-client-calendar';

export const GET: APIRoute = async ({ request, cookies, params, url }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const rangeCheck = validateCalendarRange(from, to);
    if (!rangeCheck.ok) {
      return new Response(JSON.stringify({ error: rangeCheck.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await buildTrainerClientCalendarPayload(viewerId, userId, role, from, to);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
      console.error('[trainer/clients/.../calendar GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load calendar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
