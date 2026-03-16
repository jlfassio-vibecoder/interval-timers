/**
 * Phase 3 handoff: log timer session to workout_logs when user signs up/logs in
 * after "Save to account" from a spoke (Tabata, AMRAP, Daily Warm-Up).
 */

import { supabase } from '../supabase-instance';
import { HANDOFF_MAX_AGE_MS } from '@interval-timers/handoff';
import type { StoredHandoff } from '@interval-timers/handoff';

const SAVE_SESSION_INTENT = 'save_session';

const ALLOWED_SOURCES = new Set(['tabata', 'amrap', 'daily-warmup']);

const SOURCE_TO_WORKOUT_NAME: Record<string, string> = {
  tabata: 'Tabata',
  amrap: 'AMRAP',
  'daily-warmup': 'Daily Warm-Up',
};

/**
 * Parse handoff.time to seconds. Supports "15m"/"15min" (minutes) and numeric seconds.
 * Invalid input returns null (avoids storing wrong durations from malformed data).
 */
function parseTimeToSeconds(time: string | null | undefined): number | null {
  if (time == null || typeof time !== 'string') return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  const minMatch = trimmed.match(/^(\d+)m(in)?$/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1]!, 10);
    return Number.isFinite(mins) && mins >= 0 ? mins * 60 : null;
  }
  const secs = parseInt(trimmed, 10);
  return Number.isFinite(secs) && secs >= 0 ? secs : null;
}

/** SHA-256 of input string, hex-encoded (for handoff_dedupe_key). */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface LogHandoffResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate handoff and insert one row into workout_logs. Idempotent: duplicate
 * handoff_dedupe_key results in success (no second row).
 */
export async function logHandoffSession(
  handoff: StoredHandoff,
  userId: string
): Promise<LogHandoffResult> {
  if (handoff.intent !== SAVE_SESSION_INTENT) {
    return { ok: false, error: 'Invalid intent' };
  }
  if (!ALLOWED_SOURCES.has(handoff.source)) {
    return { ok: false, error: 'Invalid source' };
  }
  const now = Date.now();
  const age = handoff.timestamp ? now - handoff.timestamp : 0;
  if (age > HANDOFF_MAX_AGE_MS) {
    return { ok: false, error: 'Handoff too old' };
  }

  const workoutName = SOURCE_TO_WORKOUT_NAME[handoff.source] ?? handoff.source;
  const dateIso = new Date().toISOString().slice(0, 10);
  const durationSeconds = parseTimeToSeconds(handoff.time);
  const dedupePayload = `${userId}|${handoff.intent}|${handoff.source}|${handoff.timestamp ?? now}`;
  const handoff_dedupe_key = await sha256Hex(dedupePayload);

  const row = {
    user_id: userId,
    workout_id: null,
    workout_name: workoutName,
    date: dateIso,
    effort: 5,
    rating: 3,
    notes: '',
    duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    calories:
      handoff.calories != null && Number.isFinite(handoff.calories) ? handoff.calories : null,
    rounds: handoff.rounds != null && Number.isFinite(handoff.rounds) ? handoff.rounds : null,
    source: handoff.source,
    handoff_dedupe_key,
  };

  const { error } = await supabase.from('workout_logs').insert(row);

  if (error) {
    if (error.code === '23505') {
      return { ok: true };
    }
    if (import.meta.env.DEV) console.error('[logHandoffSession]', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
