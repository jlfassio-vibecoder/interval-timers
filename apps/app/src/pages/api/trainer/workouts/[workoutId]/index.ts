/**
 * GET / PATCH — single trainer library workout (public.workouts).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  fetchTrainerLibraryWorkoutOwned,
  patchTrainerLibraryWorkout,
} from '@/lib/supabase/admin/trainer-workouts-library';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return json({ error: 'Not available for host role' }, 404);
    }

    const workoutId = params.workoutId;
    if (!workoutId) return json({ error: 'Workout ID required' }, 400);

    const row = await fetchTrainerLibraryWorkoutOwned(uid, workoutId);
    if (!row) return json({ error: 'Workout not found' }, 404);

    return json({
      id: row.id,
      title: row.title,
      description: row.description,
      durationMinutes: row.durationMinutes,
      difficultyLevel: row.difficultyLevel,
      blocks: row.blocks,
      source: row.source,
      visibility: row.visibility,
      aiChainMetadata: row.aiChainMetadata,
      lineageId: row.lineageId,
      versionIndex: row.versionIndex,
      supersedesWorkoutId: row.supersedesWorkoutId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return json({ error: 'Unauthorized. Mission Control access required.' }, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workouts/:id GET]', error);
    }
    return json({ error: 'Failed to load workout' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return json({ error: 'Not available for host role' }, 403);
    }

    const workoutId = params.workoutId;
    if (!workoutId) return json({ error: 'Workout ID required' }, 400);

    let body: {
      title?: string;
      description?: string | null;
      durationMinutes?: number | null;
      blocks?: unknown;
      visibility?: 'draft' | 'ready' | 'assigned';
      difficultyLevel?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const result = await patchTrainerLibraryWorkout(uid, workoutId, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.blocks !== undefined ? { blocks: body.blocks } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.difficultyLevel !== undefined ? { difficultyLevel: body.difficultyLevel } : {}),
    });

    if (!result.ok) {
      const notFound = result.error === 'Workout not found';
      return json({ error: result.error }, notFound ? 404 : 400);
    }

    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return json({ error: 'Unauthorized. Mission Control access required.' }, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workouts/:id PATCH]', error);
    }
    return json({ error: 'Failed to update workout' }, 500);
  }
};
