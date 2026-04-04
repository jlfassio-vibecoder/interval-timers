/**
 * Returns the Step 1 (Workout Architect) user prompt string for review before generation.
 * Same validation and zone resolution as POST /api/ai/generate-workout-chain (no LLM calls).
 */

import type { APIRoute } from 'astro';
import { buildWorkoutArchitectPrompt } from '@/lib/prompt-chain/step1-workout-architect';
import { prepareWorkoutChainRequest } from '@/lib/workout-chain/prepare-workout-chain-request';
import { verifyMissionControlRequest } from '@/lib/supabase/admin/auth';

const SYSTEM_PROMPT_STEP1 =
  'You are the Workout Architect (PhD Exercise Physiology). Output ONLY valid JSON.';

export interface PreviewWorkoutChainPromptResponse {
  step1UserPrompt: string;
  systemPromptStep1: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const shouldLog = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true';

  try {
    await verifyMissionControlRequest(request, cookies);

    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prepared = await prepareWorkoutChainRequest(rawBody, shouldLog);
    if (!prepared.ok) return prepared.response;

    const { persona, zoneContext, hiitOptions, providedArchitect } = prepared.data;

    if (providedArchitect) {
      return new Response(
        JSON.stringify({
          error:
            'Step 1 prompt preview is not available when a workout architect blueprint is supplied.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const step1UserPrompt = buildWorkoutArchitectPrompt(persona, zoneContext, hiitOptions);
    const response: PreviewWorkoutChainPromptResponse = {
      step1UserPrompt,
      systemPromptStep1: SYSTEM_PROMPT_STEP1,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return new Response(JSON.stringify({ error: 'Mission Control access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (shouldLog) console.error('[preview-workout-chain-prompt] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to build prompt preview';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
