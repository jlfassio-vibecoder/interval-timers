/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-origin handoff for Universal Activity Hub → main app.
 * Stores workoutSet + scheduledAt in memory with TTL; GET consumes once.
 * Multi-instance production: replace with Redis/DB table.
 */

import type { APIRoute } from 'astro';
import type { WorkoutInSet, WorkoutSetTemplate } from '@/types/ai-workout';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';

const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface ScheduleHandoffPayload {
  workoutSet: WorkoutSetTemplate;
  scheduledAt: string;
}

const store = new Map<string, { payload: ScheduleHandoffPayload; expiresAt: number }>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateWorkoutSet(data: unknown): WorkoutSetTemplate | null {
  if (!data || typeof data !== 'object' || !('workouts' in data)) return null;
  const raw = data as Record<string, unknown>;
  const workouts = raw.workouts;
  if (!Array.isArray(workouts) || workouts.length === 0) return null;
  const validWorkouts = workouts.filter(
    (w): w is WorkoutInSet =>
      w &&
      typeof w === 'object' &&
      (('exerciseBlocks' in w && Array.isArray((w as WorkoutInSet).exerciseBlocks)) ||
        ('blocks' in w && Array.isArray((w as WorkoutInSet).blocks)) ||
        ('title' in w && typeof (w as WorkoutInSet).title === 'string'))
  );
  if (validWorkouts.length === 0) return null;
  const title = typeof raw.title === 'string' ? raw.title : 'Pasted Workout';
  const description = typeof raw.description === 'string' ? raw.description : '';
  const difficulty =
    typeof raw.difficulty === 'string' &&
    ['beginner', 'intermediate', 'advanced'].includes(raw.difficulty)
      ? (raw.difficulty as 'beginner' | 'intermediate' | 'advanced')
      : 'intermediate';
  return normalizeWorkoutSet({
    title,
    description,
    difficulty,
    workouts: validWorkouts,
  });
}

/** Validate scheduledAt: non-empty, valid date, not unreasonably in past (allow 5 min skew). */
function validateScheduledAt(s: unknown): string | null {
  if (typeof s !== 'string' || !s.trim()) return null;
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  if (d.getTime() < fiveMinutesAgo) return null;
  return d.toISOString();
}

function randomId(): string {
  return crypto.randomUUID();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!request.body) {
      return jsonResponse({ error: 'Request body is required' }, 400);
    }
    let body: { workoutSet?: unknown; scheduledAt?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
    const workoutSet = validateWorkoutSet(body.workoutSet);
    if (!workoutSet) {
      return jsonResponse({ error: 'Invalid workoutSet: must have workouts array' }, 400);
    }
    const scheduledAt = validateScheduledAt(body.scheduledAt);
    if (!scheduledAt) {
      return jsonResponse(
        { error: 'Invalid scheduledAt: must be a future (or near-future) ISO datetime' },
        400
      );
    }
    const id = randomId();
    store.set(id, {
      payload: { workoutSet, scheduledAt },
      expiresAt: Date.now() + TTL_MS,
    });
    return jsonResponse({ handoffId: id }, 200);
  } catch (err) {
    console.error('[schedule-workout-handoff] POST error:', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
};

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
  store.delete(id); // One-time consume
  return jsonResponse(entry.payload, 200);
};
