/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parse pasted workout/activity text into WorkoutSetTemplate via Vertex AI.
 * Falls back to Gemini (GEMINI_API_KEY) when Vertex is not configured.
 */

import type { APIRoute } from 'astro';
import { parseWorkoutSetFromHandoffBody } from '@interval-timers/workout-contract';
import type { WorkoutInSet, WorkoutSetTemplate } from '@/types/ai-workout';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { corsPreflightResponse, getJsonResponseHeaders } from '@/lib/api-cors';
import { tryParseWorkoutWithGemini } from '@/lib/gemini-server';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { get as getParseCache, set as setParseCache } from '@/lib/parse-pasted-cache';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import { buildParsePastedWorkoutPrompt } from '@/lib/prompt-chain/parse-pasted-workout-prompt';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';

/** Max pasted text length (chars) to cap AI cost and abuse. */
const MAX_RAW_TEXT_LENGTH = 48_000;

const GENERIC_PARSE_ERROR = 'Could not parse this workout. Try editing the text and pasting again.';
const GENERIC_SERVER_ERROR = 'Something went wrong. Please try again.';

/** Returns true if workout has no displayable exercises in exerciseBlocks or blocks. */
function hasNoExercises(w: WorkoutInSet): boolean {
  if (w.exerciseBlocks?.length) {
    const total = w.exerciseBlocks.reduce((sum, b) => sum + (b.exercises?.length ?? 0), 0);
    if (total > 0) return false;
  }
  if ((w.blocks?.length ?? 0) > 0) return false;
  return true;
}

/** When AI puts content in warmup/cooldown but exerciseBlocks are empty, migrate so preview shows it. */
function migrateWarmupCooldownToExerciseBlocks(set: WorkoutSetTemplate): void {
  for (const w of set.workouts) {
    if (!hasNoExercises(w)) continue;
    const warmup =
      (w as { warmupBlocks?: { order: number; exerciseName: string; instructions?: string[] }[] })
        .warmupBlocks ?? [];
    const cooldown =
      (w as { cooldownBlocks?: { order: number; exerciseName: string; instructions?: string[] }[] })
        .cooldownBlocks ?? [];
    if (warmup.length === 0 && cooldown.length === 0) continue;
    const blocks: {
      order: number;
      name: string;
      exercises: {
        order: number;
        exerciseName: string;
        sets: number;
        reps: string;
        restSeconds: number;
        coachNotes: string;
      }[];
    }[] = [];
    if (warmup.length > 0) {
      blocks.push({
        order: 1,
        name: 'Warm-up',
        exercises: warmup.map((item, i) => ({
          order: i + 1,
          exerciseName: item.exerciseName || 'Warm-up exercise',
          sets: 1,
          reps: '',
          restSeconds: 0,
          coachNotes: Array.isArray(item.instructions) ? item.instructions.join(' ') : '',
        })),
      });
    }
    if (cooldown.length > 0) {
      blocks.push({
        order: blocks.length + 1,
        name: 'Cool-down',
        exercises: cooldown.map((item, i) => ({
          order: i + 1,
          exerciseName: item.exerciseName || 'Cool-down exercise',
          sets: 1,
          reps: '',
          restSeconds: 0,
          coachNotes: Array.isArray(item.instructions) ? item.instructions.join(' ') : '',
        })),
      });
    }
    (w as { exerciseBlocks?: unknown }).exerciseBlocks = blocks;
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: getJsonResponseHeaders(),
  });
}

export const OPTIONS: APIRoute = () =>
  corsPreflightResponse() ?? new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request }) => {
  const limit = checkRateLimit('parse', request);
  if (!limit.allowed) {
    const headers: Record<string, string> = { ...getJsonResponseHeaders() };
    if (limit.retryAfter) headers['Retry-After'] = String(limit.retryAfter);
    return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
  }

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
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      return jsonError('Text is too long. Please shorten your workout and try again.', 400);
    }

    const cached = getParseCache(rawText);
    if (cached) {
      return new Response(JSON.stringify({ workoutSet: cached }), {
        status: 200,
        headers: getJsonResponseHeaders(),
      });
    }

    const userPrompt = buildParsePastedWorkoutPrompt(rawText);
    let responseText: string | null = null;

    // Try Vertex AI first (service account + project; same path as other /api/ai routes)
    const vertexCreds = await getVertexAICredentials('[parse-pasted-workout]');
    if (!('error' in vertexCreds)) {
      const { projectId, region, accessToken } = vertexCreds;
      try {
        responseText = await callVertexAI({
          systemPrompt: 'You are a fitness data parser. Output ONLY valid JSON, no markdown.',
          userPrompt,
          accessToken,
          projectId,
          region,
          temperature: 0.3,
          maxTokens: 4096,
          logPrefix: '[parse-pasted-workout]',
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[parse-pasted-workout] Vertex call failed, trying Gemini:', err);
        }
      }
    } else if (import.meta.env.DEV) {
      console.warn('[parse-pasted-workout] Vertex unavailable, trying Gemini');
    }

    // Fallback to Gemini when Vertex fails or is not configured
    if (!responseText) {
      responseText = await tryParseWorkoutWithGemini(userPrompt);
    }

    if (!responseText) {
      return jsonError('AI parsing is not available. Please try again later.', 503);
    }

    const parsed = parseJSONWithRepair(responseText);
    const data = parsed.data as unknown;

    if (!data || typeof data !== 'object' || !('workouts' in data)) {
      return jsonError(GENERIC_PARSE_ERROR, 500);
    }

    const extracted = parseWorkoutSetFromHandoffBody(data);
    if (!extracted) {
      return jsonError(GENERIC_PARSE_ERROR, 500);
    }

    migrateWarmupCooldownToExerciseBlocks(extracted);
    const workoutSet: WorkoutSetTemplate = normalizeWorkoutSet(extracted);
    setParseCache(rawText, workoutSet);

    return new Response(JSON.stringify({ workoutSet }), {
      status: 200,
      headers: getJsonResponseHeaders(),
    });
  } catch (error) {
    console.error('[parse-pasted-workout] Error:', error);
    return new Response(JSON.stringify({ error: GENERIC_SERVER_ERROR }), {
      status: 500,
      headers: getJsonResponseHeaders(),
    });
  }
};
