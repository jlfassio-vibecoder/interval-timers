/**
 * GET — all versions of a trainer library workout lineage (public.workouts).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { listTrainerLibraryWorkoutsByLineage } from '@/lib/supabase/admin/trainer-workouts-library';

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
      return json({ versions: [] });
    }

    const lineageId = params.lineageId;
    if (!lineageId) return json({ error: 'lineageId required' }, 400);

    const rows = await listTrainerLibraryWorkoutsByLineage(uid, lineageId);
    return json({
      versions: rows.map((row) => ({
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
      })),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return json({ error: 'Unauthorized. Mission Control access required.' }, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workouts/by-lineage GET]', error);
    }
    return json({ error: 'Failed to load versions' }, 500);
  }
};
