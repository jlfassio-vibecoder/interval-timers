/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — trainer’s workouts (picker for Performance Lab assignments).
 * POST — save AI Workout Factory output to public.workouts (Mission Control P0).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest, verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { createTrainerAiWorkoutsFromFactory } from '@/lib/supabase/admin/trainer-ai-workouts';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getFactoryMetabolicModeFromAiChainMetadata } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import type { WorkoutChainMetadata, WorkoutConfig, WorkoutSetTemplate } from '@/types/ai-workout';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, source, visibility, duration_minutes, blocks, ai_chain_metadata')
      .eq('trainer_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[trainer/workouts]', error);
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (data ?? []).map((w) => {
      const row = w as {
        id: string;
        title: string | null;
        source?: string | null;
        visibility?: string | null;
        duration_minutes?: number | null;
        blocks?: unknown;
        ai_chain_metadata?: unknown | null;
      };
      const title = typeof row.title === 'string' && row.title.trim() ? row.title : 'Workout';
      const source = typeof row.source === 'string' && row.source ? row.source : undefined;
      const visibility =
        typeof row.visibility === 'string' && row.visibility
          ? (row.visibility as 'draft' | 'ready' | 'assigned')
          : undefined;
      const durationMinutes =
        typeof row.duration_minutes === 'number' && Number.isFinite(row.duration_minutes)
          ? row.duration_minutes
          : null;
      const factoryMetabolicMode = getFactoryMetabolicModeFromAiChainMetadata(
        row.ai_chain_metadata
      );
      return {
        id: row.id,
        title,
        factoryMetabolicMode,
        ...(source !== undefined ? { source } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(durationMinutes != null ? { durationMinutes } : {}),
        ...(row.blocks !== undefined && row.blocks !== null ? { blocks: row.blocks } : {}),
      };
    });

    return new Response(JSON.stringify(list), {
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
      console.error('[trainer/workouts]', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function normalizeVisibility(raw: unknown): 'draft' | 'ready' | 'assigned' {
  if (raw === 'ready' || raw === 'assigned' || raw === 'draft') return raw;
  return 'draft';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid } = await verifyTrainerOrAdminRequest(request, cookies);

    let body: {
      workoutSet?: WorkoutSetTemplate;
      workoutConfig?: WorkoutConfig;
      chainMetadata?: WorkoutChainMetadata;
      visibility?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.workoutSet || !body.workoutConfig) {
      return new Response(JSON.stringify({ error: 'Missing workoutSet or workoutConfig' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.workoutConfig.targetAudience) {
      return new Response(JSON.stringify({ error: 'Missing workoutConfig.targetAudience' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const visibility = normalizeVisibility(body.visibility);

    const ids = await createTrainerAiWorkoutsFromFactory(
      uid,
      body.workoutSet,
      body.workoutConfig,
      body.chainMetadata,
      visibility
    );

    return new Response(JSON.stringify({ ids }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Trainer or admin access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Forbidden. Trainer or admin access required.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workouts POST]', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to save workouts';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
