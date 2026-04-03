/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH reschedule coach schedule instance (scheduled_at only).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { patchCoachScheduleInstance } from '@/lib/supabase/admin/trainer-client-calendar';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    const instanceId = params.instanceId;
    if (!userId || !instanceId) {
      return new Response(JSON.stringify({ error: 'User ID and instance ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { scheduledAt?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
    if (!scheduledAt) {
      return new Response(JSON.stringify({ error: 'scheduledAt required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await patchCoachScheduleInstance(
      viewerId,
      userId,
      role,
      instanceId,
      scheduledAt
    );
    if (!result.ok) {
      const notFound =
        result.error === 'Client not found or not in your roster' ||
        result.error === 'Instance not found';
      return new Response(JSON.stringify({ error: result.error }), {
        status: notFound ? 404 : 400,
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
      console.error('[trainer/clients/.../calendar/instances PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
