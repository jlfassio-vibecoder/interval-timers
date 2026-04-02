/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { endClientEnrollment } from '@/lib/supabase/admin/trainer-client-enrollments';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    const programId = params.programId;
    if (!userId || !programId) {
      return new Response(JSON.stringify({ error: 'User ID and program ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await endClientEnrollment(viewerId, userId, programId, role);
    if (!result.ok) {
      const status = result.error === 'Client not found or not in your roster' ? 404 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
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
      console.error('[trainer/clients/.../enrollments/.../end] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to end enrollment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
