/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET /api/mission-control/profile/[userId]
 * Returns profile DTO for Mission Control viewers (host, trainer, admin, super_admin).
 * Authorization: hosts see own; trainers see roster; admins see any.
 */

import type { APIRoute } from 'astro';
import { verifyMissionControlRequest } from '@/lib/supabase/admin/auth';
import { fetchMissionControlProfile } from '@/lib/supabase/admin/mission-control-profile';

export const GET: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: callerId, role: callerRole } = await verifyMissionControlRequest(
      request,
      cookies
    );
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const profile = await fetchMissionControlProfile(callerId, callerRole, userId);
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(profile), {
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
      console.error('[mission-control/profile] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
