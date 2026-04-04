/**
 * POST — fork trainer library workout: new_lineage (copy as new card) or new_version (same lineage).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  forkTrainerLibraryWorkout,
  type ForkMode,
} from '@/lib/supabase/admin/trainer-workouts-library';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return json({ error: 'Not available for host role' }, 403);
    }

    const workoutId = params.workoutId;
    if (!workoutId) return json({ error: 'Workout ID required' }, 400);

    let body: {
      mode?: ForkMode;
      title?: string;
      description?: string | null;
      durationMinutes?: number | null;
      blocks?: unknown;
      difficultyLevel?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const mode = body.mode;
    if (mode !== 'new_lineage' && mode !== 'new_version') {
      return json({ error: 'mode must be new_lineage or new_version' }, 400);
    }
    if (body.blocks === undefined) {
      return json({ error: 'blocks required' }, 400);
    }

    const result = await forkTrainerLibraryWorkout(uid, workoutId, mode, {
      title: typeof body.title === 'string' ? body.title : '',
      description: body.description ?? null,
      durationMinutes:
        typeof body.durationMinutes === 'number' && Number.isFinite(body.durationMinutes)
          ? body.durationMinutes
          : null,
      blocks: body.blocks,
      difficultyLevel: body.difficultyLevel ?? null,
    });

    if (!result.ok) {
      const notFound = result.error === 'Workout not found';
      return json({ error: result.error }, notFound ? 404 : 400);
    }

    return json({ ok: true, id: result.id }, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return json({ error: 'Unauthorized. Mission Control access required.' }, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workouts/:id/fork POST]', error);
    }
    return json({ error: 'Failed to fork workout' }, 500);
  }
};
