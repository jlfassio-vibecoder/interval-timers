/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET list / POST create coach assignments (programs, workouts, WODs).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  createClientCoachAssignment,
  fetchClientCoachAssignmentsForTrainer,
} from '@/lib/supabase/admin/trainer-client-assignments';

export const GET: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const list = await fetchClientCoachAssignmentsForTrainer(viewerId, userId, role);
    if (list === null) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ assignments: list }), {
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
      console.error('[trainer/clients/.../assignments GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load assignments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      assignmentType?: string;
      resourceId?: string;
      startsOn?: string | null;
      expiresOn?: string | null;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await createClientCoachAssignment(viewerId, userId, role, {
      assignmentType: body.assignmentType ?? '',
      resourceId: body.resourceId ?? '',
      startsOn: body.startsOn,
      expiresOn: body.expiresOn,
    });

    if (!result.ok) {
      const isRoster = result.error === 'Client not found or not in your roster';
      return new Response(JSON.stringify({ error: result.error }), {
        status: isRoster ? 404 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 201,
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
      console.error('[trainer/clients/.../assignments POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create assignment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
