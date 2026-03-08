import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import { getGeneratedExerciseById } from '@/lib/supabase/admin/generated-exercises-server';
import { generateBiomechanicsForExercise, type BiomechanicsFocus } from '@/lib/gemini-server';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const POST: APIRoute = async ({ request, params, cookies }) => {
  const { id } = params ?? {};

  if (!id) {
    return jsonError('Exercise ID is required', 400);
  }

  try {
    await verifyAdminRequest(request, cookies);

    let body: { focus?: string };
    try {
      body = (await request.json()) ?? {};
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const focus = (
      body.focus === 'biomechanicalAnalysis'
        ? 'biomechanicalAnalysis'
        : body.focus === 'commonMistakes'
          ? 'commonMistakes'
          : 'all'
    ) as BiomechanicsFocus;

    const exerciseData = await getGeneratedExerciseById(id);
    if (!exerciseData) {
      return jsonError('Exercise not found', 404);
    }

    const exerciseName = exerciseData.exerciseName ?? '';
    const existingBio = exerciseData.biomechanics;

    const result = await generateBiomechanicsForExercise(exerciseName, existingBio, focus);

    return new Response(
      JSON.stringify({
        biomechanicalPoints: result.biomechanicalPoints,
        searchResults: result.searchResults,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-biomechanics]', safeMessage, error);

    if (
      error instanceof Error &&
      (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED')
    ) {
      return jsonError('Unauthorized', 401);
    }

    return jsonError('Internal Server Error', 500);
  }
};
