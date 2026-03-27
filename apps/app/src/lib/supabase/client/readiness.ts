/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Readiness check-in (1-5) for Zone 3. Stored in workout_logs with workout_name='Readiness'.
 */

import { supabase } from '../supabase-instance';
import {
  DEFAULT_DAILY_CHECKIN,
  type DailyCheckInFormState,
  clampInt,
} from '@/lib/readiness-daily-check-in';

const READINESS_WORKOUT_NAME = 'Readiness';
const READINESS_NOTES_PREFIX = 'readiness_v1:';
/** Scan recent rows so score-only / legacy rows without parseable notes do not hide an older valid check-in. */
const READINESS_CHECKIN_LOOKBACK = 25;

interface ReadinessRow {
  id: string;
  readiness_score: number | null;
  notes: string | null;
}

function scoreFromEnergyLevel(energyLevel: number): number {
  // Preserve existing 1-5 readiness semantics while storing richer 1-10 inputs.
  return clampInt(Math.round(energyLevel / 2), 1, 5);
}

function parseDailyCheckInNotes(notes: string | null): DailyCheckInFormState | null {
  // Match isReadinessNotesPayload: ignore leading whitespace so detection and parsing stay aligned.
  if (notes == null) return null;
  const trimmed = notes.trimStart();
  if (!trimmed.startsWith(READINESS_NOTES_PREFIX)) return null;
  const raw = trimmed.slice(READINESS_NOTES_PREFIX.length);
  try {
    const parsed = JSON.parse(raw) as Partial<DailyCheckInFormState>;
    return {
      ...DEFAULT_DAILY_CHECKIN,
      ...parsed,
    };
  } catch {
    return null;
  }
}

async function getReadinessRow(userId: string, date: string): Promise<ReadinessRow | null> {
  const { data: rows, error } = await supabase
    .from('workout_logs')
    .select('id, readiness_score, notes')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('workout_name', READINESS_WORKOUT_NAME)
    .limit(1);
  if (error) throw error;
  if (!rows?.[0]) return null;
  return rows[0] as ReadinessRow;
}

/**
 * Save or update readiness score for a date. Uses workout_logs with effort=1, rating=1.
 * Uses .limit(1) so multiple rows for same user/date don't cause maybeSingle() error and an extra insert.
 * A uniqueness constraint on (user_id, date, workout_name) would allow proper upsert.
 */
export async function saveReadiness(userId: string, date: string, score: number): Promise<void> {
  if (score < 1 || score > 5) throw new Error('Readiness score must be 1-5');

  const existing = await getReadinessRow(userId, date);

  if (existing?.id) {
    const { error } = await supabase
      .from('workout_logs')
      .update({ readiness_score: score })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error: insertError } = await supabase.from('workout_logs').insert({
    user_id: userId,
    workout_id: null,
    workout_name: READINESS_WORKOUT_NAME,
    date,
    effort: 1,
    rating: 1,
    readiness_score: score,
  });
  if (insertError) throw insertError;
}

/**
 * Get readiness score for a date, or null if not set.
 */
export async function getReadiness(userId: string, date: string): Promise<number | null> {
  const row = await getReadinessRow(userId, date);
  if (!row?.readiness_score) return null;
  const s = row.readiness_score;
  return s >= 1 && s <= 5 ? s : null;
}

export async function saveDailyReadinessCheckIn(
  userId: string,
  date: string,
  form: DailyCheckInFormState
): Promise<void> {
  const readinessScore = scoreFromEnergyLevel(form.energy_level);
  const notes = `${READINESS_NOTES_PREFIX}${JSON.stringify(form)}`;
  const existing = await getReadinessRow(userId, date);

  if (existing?.id) {
    const { error } = await supabase
      .from('workout_logs')
      .update({ readiness_score: readinessScore, notes })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error: insertError } = await supabase.from('workout_logs').insert({
    user_id: userId,
    workout_id: null,
    workout_name: READINESS_WORKOUT_NAME,
    date,
    effort: 1,
    rating: 1,
    readiness_score: readinessScore,
    notes,
  });
  if (insertError) throw insertError;
}

export async function getDailyReadinessCheckIn(
  userId: string,
  date: string
): Promise<DailyCheckInFormState | null> {
  const row = await getReadinessRow(userId, date);
  if (!row) return null;
  return parseDailyCheckInNotes(row.notes);
}

/** True when `notes` stores the daily readiness JSON payload (not user freeform notes). */
export function isReadinessNotesPayload(notes: string | null | undefined): boolean {
  return Boolean(notes?.trimStart().startsWith(READINESS_NOTES_PREFIX));
}

/**
 * Latest readiness check-in on or before `targetDate` (Training Log workout date).
 * Used by WorkoutSummaryModal when no check-in exists for the exact date.
 */
export async function getMostRecentReadinessCheckIn(
  userId: string,
  targetDate: string
): Promise<{ form: DailyCheckInFormState; readinessDate: string } | null> {
  const { data: rows, error } = await supabase
    .from('workout_logs')
    .select('date, notes')
    .eq('user_id', userId)
    .eq('workout_name', READINESS_WORKOUT_NAME)
    .lte('date', targetDate)
    .order('date', { ascending: false })
    .limit(READINESS_CHECKIN_LOOKBACK);
  if (error) throw error;
  if (!rows?.length) return null;
  for (const row of rows) {
    const r = row as { date: string; notes: string | null };
    const form = parseDailyCheckInNotes(r.notes);
    if (form) return { form, readinessDate: r.date };
  }
  return null;
}
