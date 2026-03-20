/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parse pasted workout/activity text into WorkoutSetTemplate via Vertex AI.
 * Falls back to Gemini (GEMINI_API_KEY) when Vertex is not configured.
 */

import type { APIRoute } from 'astro';
import type { WorkoutInSet, WorkoutSetTemplate } from '@/types/ai-workout';
import { corsPreflightResponse, getJsonResponseHeaders } from '@/lib/api-cors';
import { tryParseWorkoutWithGemini } from '@/lib/gemini-server';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import { buildParsePastedWorkoutPrompt } from '@/lib/prompt-chain/parse-pasted-workout-prompt';
import { callVertexAI } from '@/lib/vertex-ai-client';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: getJsonResponseHeaders(),
  });
}

export const OPTIONS: APIRoute = () =>
  corsPreflightResponse() ?? new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!request.body) {
      return jsonError('Request body is required', 400);
    }

    let body: { rawText?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError('Invalid JSON', 400);
    }

    const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
    if (!rawText) {
      return jsonError('rawText is required and must be non-empty', 400);
    }

    const userPrompt = buildParsePastedWorkoutPrompt(rawText);
    let responseText: string | null = null;

    // Try Vertex AI first (requires GOOGLE_PROJECT_ID + gcloud auth)
    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const region = import.meta.env.GOOGLE_LOCATION || 'global';
      try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          projectId,
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        if (tokenResponse.token) {
          responseText = await callVertexAI({
            systemPrompt: 'You are a fitness data parser. Output ONLY valid JSON, no markdown.',
            userPrompt,
            accessToken: tokenResponse.token,
            projectId,
            region,
            temperature: 0.3,
            maxTokens: 4096,
            logPrefix: '[parse-pasted-workout]',
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[parse-pasted-workout] Vertex auth failed, trying Gemini:', err);
        }
      }
    }

    // Fallback to Gemini when Vertex fails or is not configured
    if (!responseText) {
      responseText = await tryParseWorkoutWithGemini(userPrompt);
    }

    if (!responseText) {
      return jsonError(
        'AI parsing not configured. Set GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS_JSON (base64), or gcloud auth application-default login, or GEMINI_API_KEY in .env.local. See apps/app/VERTEX_AI_SETUP.md and .env.example.',
        503
      );
    }

    const parsed = parseJSONWithRepair(responseText);
    const data = parsed.data as unknown;

    if (!data || typeof data !== 'object' || !('workouts' in data)) {
      return jsonError('AI did not return a valid WorkoutSetTemplate shape', 500);
    }

    const raw = data as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title : 'Pasted Workout';
    const description = typeof raw.description === 'string' ? raw.description : '';
    const difficulty =
      typeof raw.difficulty === 'string' &&
      ['beginner', 'intermediate', 'advanced'].includes(raw.difficulty)
        ? (raw.difficulty as 'beginner' | 'intermediate' | 'advanced')
        : 'intermediate';
    // Same workout shape checks as workout-handoff / schedule-workout-handoff (POST validateWorkoutSet).
    const workouts = Array.isArray(raw.workouts)
      ? (raw.workouts as unknown[]).filter(
          (w): w is WorkoutInSet =>
            w &&
            typeof w === 'object' &&
            (('exerciseBlocks' in w && Array.isArray((w as WorkoutInSet).exerciseBlocks)) ||
              ('blocks' in w && Array.isArray((w as WorkoutInSet).blocks)) ||
              ('title' in w && typeof (w as WorkoutInSet).title === 'string'))
        )
      : [];

    if (workouts.length === 0) {
      return jsonError('AI returned no valid workouts', 500);
    }

    const workoutSet: WorkoutSetTemplate = normalizeWorkoutSet({
      title,
      description,
      difficulty,
      workouts,
    });

    return new Response(JSON.stringify({ workoutSet }), {
      status: 200,
      headers: getJsonResponseHeaders(),
    });
  } catch (error) {
    console.error('[parse-pasted-workout] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse workout';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: getJsonResponseHeaders(),
    });
  }
};
