/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import {
  fetchWorkoutDocument,
  updateWorkoutSet,
  deleteWorkoutSet,
} from '@/lib/supabase/admin/workout-sets';
import type { WorkoutSetTemplate, WorkoutConfig } from '@/types/ai-workout';

export const GET: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const workoutId = params.workoutId;
    if (!workoutId) {
      return new Response(JSON.stringify({ error: 'Workout ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const doc = await fetchWorkoutDocument(workoutId);
    return new Response(JSON.stringify(doc), {
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
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/workouts] Error fetching workout:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch workout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const workoutId = params.workoutId;
    if (!workoutId) {
      return new Response(JSON.stringify({ error: 'Workout ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      status?: 'draft' | 'published';
      workoutSet?: WorkoutSetTemplate;
      workoutConfig?: WorkoutConfig;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await updateWorkoutSet(workoutId, {
      status: body.status,
      workoutSet: body.workoutSet,
      workoutConfig: body.workoutConfig,
    });

    return new Response(JSON.stringify({ ok: true }), {
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
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/workouts] Error updating workout:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update workout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const workoutId = params.workoutId;
    if (!workoutId) {
      return new Response(JSON.stringify({ error: 'Workout ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteWorkoutSet(workoutId);
    return new Response(JSON.stringify({ ok: true }), {
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
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/workouts] Error deleting workout:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to delete workout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
