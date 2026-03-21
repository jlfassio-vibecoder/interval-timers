/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-origin handoff for Universal Activity Hub → main app.
 * Stores WorkoutSetTemplate in memory with TTL; GET consumes once.
 * Multi-instance production: replace with Redis/DB table.
 */

import type { APIRoute } from 'astro';
import { parseWorkoutSetFromHandoffBody } from '@interval-timers/workout-contract';
import type { WorkoutSetTemplate } from '@/types/ai-workout';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { corsPreflightResponse, getJsonResponseHeaders } from '@/lib/api-cors';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';

const TTL_MS = 30 * 60 * 1000; // 30 minutes
/** Delay before deleting after GET so React Strict Mode double-fetch both succeed. */
const DELETE_DELAY_MS = 5000;

const store = new Map<
  string,
  { payload: WorkoutSetTemplate; expiresAt: number }
>();

const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function scheduleDelete(id: string): void {
  const existing = pendingDeletes.get(id);
  if (existing) clearTimeout(existing);
  pendingDeletes.set(
    id,
    setTimeout(() => {
      store.delete(id);
      pendingDeletes.delete(id);
    }, DELETE_DELAY_MS)
  );
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: getJsonResponseHeaders(),
  });
}

function randomId(): string {
  return crypto.randomUUID();
}

export const POST: APIRoute = async ({ request }) => {
  pruneExpired();
  const limit = checkRateLimit('handoff', request);
  if (!limit.allowed) {
    const headers: Record<string, string> = { ...getJsonResponseHeaders() };
    if (limit.retryAfter) headers['Retry-After'] = String(limit.retryAfter);
    return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
  }
  try {
    if (!request.body) {
      return jsonResponse({ error: 'Request body is required' }, 400);
    }
    let body: { workoutSet?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    const extracted = parseWorkoutSetFromHandoffBody(body.workoutSet);
    if (!extracted) {
      return jsonResponse({ error: 'Invalid workoutSet: must have workouts array' }, 400);
    }
    const workoutSet: WorkoutSetTemplate = normalizeWorkoutSet(extracted);
    const id = randomId();
    store.set(id, {
      payload: workoutSet,
      expiresAt: Date.now() + TTL_MS,
    });
    return jsonResponse({ handoffId: id }, 200);
  } catch (err) {
    console.error('[workout-handoff] POST error:', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
};

export const OPTIONS: APIRoute = () =>
  corsPreflightResponse() ?? new Response(null, { status: 204 });

export const GET: APIRoute = async ({ url }) => {
  pruneExpired();
  const id = url.searchParams.get('id');
  if (!id) {
    return jsonResponse({ error: 'Missing id parameter' }, 400);
  }
  const entry = store.get(id);
  if (!entry) {
    return jsonResponse({ error: 'Handoff not found or expired' }, 404);
  }
  scheduleDelete(id);
  return jsonResponse({ workoutSet: entry.payload }, 200);
};
