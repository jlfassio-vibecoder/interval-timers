/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import { fetchWorkoutLibrary, createWorkoutSet } from '@/lib/supabase/admin/workout-sets';
import type { WorkoutSetTemplate, WorkoutConfig, WorkoutChainMetadata } from '@/types/ai-workout';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);
    const workouts = await fetchWorkoutLibrary();
    return new Response(JSON.stringify(workouts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/workouts] Error listing workouts:', error);
    }
    // Return empty list instead of 500 so UI can show empty state (dev/MVP: no workouts yet)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const adminInfo = await verifyAdminRequest(request, cookies);

    let body: {
      workoutSet: WorkoutSetTemplate;
      workoutConfig: WorkoutConfig;
      authorId: string;
      chainMetadata?: WorkoutChainMetadata;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.workoutSet || !body.workoutConfig || !body.authorId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: workoutSet, workoutConfig, authorId',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.workoutConfig.targetAudience) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: workoutConfig.targetAudience' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.authorId !== adminInfo.uid) {
      return new Response(JSON.stringify({ error: 'Author ID must match authenticated user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const workoutId = await createWorkoutSet(
      body.authorId,
      body.workoutSet,
      body.workoutConfig,
      body.chainMetadata
    );

    return new Response(JSON.stringify({ id: workoutId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/workouts] Error creating workout:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create workout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
