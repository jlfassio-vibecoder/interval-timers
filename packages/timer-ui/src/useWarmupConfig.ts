/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fetches Daily Warm-Up config from API (enriched slots with imageUrl, instructions).
 * Falls back to static WARMUP_EXERCISES when fetch fails or returns empty.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
  getWarmupImageUrl,
  getWarmupInstructions,
  getWarmupMistakesCorrections,
  getWarmupSubtitle,
} from '@interval-timers/timer-core';
import type { InstructionStep, MistakeCorrectionRow } from '@interval-timers/types';

/** Vite injects BASE_URL at build time; normalize for concatenation (no trailing slash). */
function getBaseUrl(): string {
  try {
    const base =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      typeof (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL === 'string'
      ? (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
      : '';
    return base ? base.replace(/\/$/, '') : '';
  } catch {
    return '';
  }
}

/** Prefix a root-relative or path-only image URL with the app base so it loads under base path. */
function resolveImageUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const base = getBaseUrl();
  const path = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  return base ? `${base}/${path}` : `/${path}`;
}

export interface WarmupExercise {
  name: string;
  detail: string;
  imageUrl?: string;
  instructions?: string[];
  /** Step-by-step protocol (title + body). Used by WarmupInstructionsPanel. */
  instructionSteps?: InstructionStep[];
  /** Common mistakes and corrections. Used by ExpandableMistakesCorrections. */
  mistakeCorrections?: MistakeCorrectionRow[];
  /** Short subtitle shown above instructions in sidebar. Used by ExerciseSubtitle. */
  subtitle?: string;
}

export interface WarmupConfig {
  exercises: WarmupExercise[];
  durationPerExercise: number;
  loading: boolean;
  error: string | null;
}

const FALLBACK_EXERCISES: WarmupExercise[] = WARMUP_EXERCISES.map((e) => {
  const rawUrl = getWarmupImageUrl(e.name);
  const imageUrl = rawUrl ? resolveImageUrl(rawUrl) : undefined;
  const instructionSteps = getWarmupInstructions(e.name);
  const mistakeCorrections = getWarmupMistakesCorrections(e.name);
  const subtitle = getWarmupSubtitle(e.name);
  return {
    name: e.name,
    detail: e.detail,
    ...(imageUrl && { imageUrl }),
    ...(instructionSteps && instructionSteps.length > 0 && { instructionSteps }),
    ...(mistakeCorrections &&
      mistakeCorrections.length > 0 && { mistakeCorrections }),
    ...(subtitle && { subtitle }),
  };
});

/**
 * Fetches GET /api/warmup-config and returns enriched exercises + duration.
 * On failure or empty, uses WARMUP_EXERCISES and WARMUP_DURATION_PER_EXERCISE.
 */
export function useWarmupConfig(): WarmupConfig {
  const [exercises, setExercises] = useState<WarmupExercise[]>(FALLBACK_EXERCISES);
  const [durationPerExercise, setDurationPerExercise] = useState(WARMUP_DURATION_PER_EXERCISE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/warmup-config', {
        cache: 'no-store',
        headers: { Pragma: 'no-cache' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        slots?: Array<{ name: string; detail: string; imageUrl?: string; instructions?: string[] }>;
        durationPerExercise?: number;
      };
      const slots = data.slots ?? [];
      // Use full protocol when API returns empty or partial config (e.g. one-side-only); ensures 14-min both-sides in production.
      const useFullProtocol = slots.length === 0 || slots.length < WARMUP_EXERCISES.length;
      if (!useFullProtocol && slots.length > 0) {
        setExercises(
          slots.map((s) => {
            const mistakeCorrections = getWarmupMistakesCorrections(s.name);
            const subtitle = getWarmupSubtitle(s.name);
            // API may omit imageUrl/instructions; enrich from static timer-core so production matches local.
            const imageUrl =
              s.imageUrl ? resolveImageUrl(s.imageUrl) : (() => {
                const raw = getWarmupImageUrl(s.name);
                return raw ? resolveImageUrl(raw) : undefined;
              })();
            const instructionSteps =
              Array.isArray(s.instructions) && s.instructions.length > 0
                ? s.instructions.map((body, i) => ({ title: `Step ${i + 1}`, body }))
                : getWarmupInstructions(s.name);
            return {
              name: s.name,
              detail: s.detail,
              ...(imageUrl && { imageUrl }),
              ...(instructionSteps && instructionSteps.length > 0 && { instructionSteps }),
              ...(mistakeCorrections &&
                mistakeCorrections.length > 0 && { mistakeCorrections }),
              ...(subtitle && { subtitle }),
            };
          })
        );
        setDurationPerExercise(
          typeof data.durationPerExercise === 'number' && data.durationPerExercise >= 10
            ? data.durationPerExercise
            : WARMUP_DURATION_PER_EXERCISE
        );
      } else {
        setExercises(FALLBACK_EXERCISES);
        setDurationPerExercise(WARMUP_DURATION_PER_EXERCISE);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warm-up config');
      setExercises(FALLBACK_EXERCISES);
      setDurationPerExercise(WARMUP_DURATION_PER_EXERCISE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    exercises,
    durationPerExercise,
    loading,
    error,
  };
}
