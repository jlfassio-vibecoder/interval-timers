/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — approved generated exercises (slug + title) for Performance Lab exercise assignments.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { getPublishedExercises } from '@/lib/supabase/public/generated-exercise-service';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { role } = await verifyRosterAccessRequest(request, cookies);
    // Same as /api/trainer/programs|workouts|wods: hosts are not program-trainers for this picker.
    if (role === 'host') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const list = await getPublishedExercises();
    const items = list.map((ex) => ({
      id: ex.slug,
      title:
        typeof ex.exerciseName === 'string' && ex.exerciseName.trim()
          ? ex.exerciseName.trim()
          : ex.slug,
      slug: ex.slug,
    }));
    return new Response(JSON.stringify(items), {
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
      console.error('[trainer/exercises GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load exercises' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
