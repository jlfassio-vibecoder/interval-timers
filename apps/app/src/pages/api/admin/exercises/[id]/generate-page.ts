import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  getGeneratedExerciseById,
  updateGeneratedExerciseDeepDive,
} from '@/lib/supabase/admin/generated-exercises-server';
import { generateExerciseHtml } from '@/lib/gemini-server';

export const POST: APIRoute = async ({ request, params, cookies }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Exercise ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const exerciseData = await getGeneratedExerciseById(id);
    if (!exerciseData) {
      return new Response(JSON.stringify({ error: 'Exercise not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const htmlContent = await generateExerciseHtml(
      exerciseData.exerciseName,
      exerciseData.imageUrl,
      exerciseData.biomechanics
    );

    await updateGeneratedExerciseDeepDive(id, htmlContent);

    return new Response(JSON.stringify({ success: true, html: htmlContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-page] Error generating deep dive page:', safeMessage);
    console.error('[generate-page] Full error:', error);

    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED')
    ) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Always return a generic message to avoid leaking sensitive details; real error is logged above
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
