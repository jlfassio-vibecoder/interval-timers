/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH coach schedule instance (scheduled_at and/or assignment_id).
 * DELETE remove coach schedule instance.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  deleteCoachScheduleInstance,
  patchCoachScheduleInstance,
} from '@/lib/supabase/admin/trainer-client-calendar';

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

    let body: {
      scheduledAt?: string;
      assignmentId?: string;
      preflight?: boolean;
      allowOverlap?: boolean;
      trainerLiveSessionId?: string | null;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';
    const hasLiveKey = 'trainerLiveSessionId' in body;
    if (!scheduledAt && !assignmentId && !hasLiveKey) {
      return new Response(
        JSON.stringify({ error: 'scheduledAt, assignmentId, or trainerLiveSessionId required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const preflight = body.preflight === true;
    const allowOverlap = body.allowOverlap === true;

    let trainerLiveSessionPatch: string | null | undefined = undefined;
    if (hasLiveKey) {
      const v = body.trainerLiveSessionId;
      if (v === null) {
        trainerLiveSessionPatch = null;
      } else if (typeof v === 'string') {
        const t = v.trim();
        if (!t) {
          return new Response(
            JSON.stringify({ error: 'trainerLiveSessionId must be null or a non-empty string' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        trainerLiveSessionPatch = t;
      } else {
        return new Response(
          JSON.stringify({ error: 'trainerLiveSessionId must be null or a string' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const result = await patchCoachScheduleInstance(
      viewerId,
      userId,
      role,
      instanceId,
      {
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        ...(hasLiveKey ? { trainerLiveSessionId: trainerLiveSessionPatch } : {}),
      },
      { preflight, allowOverlap }
    );
    if (!result.ok) {
      if (result.error === 'Scheduling conflict' && 'conflicts' in result) {
        return new Response(JSON.stringify({ error: result.error, conflicts: result.conflicts }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const notFound =
        result.error === 'Client not found or not in your roster' ||
        result.error === 'Instance not found' ||
        result.error === 'Live session not found';
      const asg404 = result.error === 'Assignment not found';
      return new Response(JSON.stringify({ error: result.error }), {
        status: notFound || asg404 ? 404 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ('preflight' in result && result.preflight) {
      return new Response(JSON.stringify({ ok: true, conflicts: result.conflicts }), {
        status: 200,
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

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
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

    const result = await deleteCoachScheduleInstance(viewerId, userId, role, instanceId);
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
      console.error('[trainer/clients/.../calendar/instances DELETE]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to delete instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
