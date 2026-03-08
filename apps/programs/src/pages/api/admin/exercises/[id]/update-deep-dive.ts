import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import {
  getGeneratedExerciseById,
  updateGeneratedExerciseDeepDive,
} from '@/lib/supabase/admin/generated-exercises-server';

export const POST: APIRoute = async ({ request, params, cookies }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Exercise ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify Admin Auth
    await verifyAdminRequest(request, cookies);

    // 2. Parse Request Body
    const body = await request.json();
    const { deepDiveHtmlContent } = body;

    if (typeof deepDiveHtmlContent !== 'string') {
      return new Response(
        JSON.stringify({ error: 'deepDiveHtmlContent is required and must be a string' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Check exists and update
    const existing = await getGeneratedExerciseById(id);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Exercise not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await updateGeneratedExerciseDeepDive(id, deepDiveHtmlContent);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating deep dive content:', error);

    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED')
    ) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
