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
} from '@interval-timers/timer-core';
import type { InstructionStep } from '@interval-timers/types';

export interface WarmupExercise {
  name: string;
  detail: string;
  imageUrl?: string;
  instructions?: string[];
  /** Step-by-step protocol (title + body). Used by WarmupInstructionsPanel. */
  instructionSteps?: InstructionStep[];
}

export interface WarmupConfig {
  exercises: WarmupExercise[];
  durationPerExercise: number;
  loading: boolean;
  error: string | null;
}

const FALLBACK_EXERCISES: WarmupExercise[] = WARMUP_EXERCISES.map((e) => {
  const imageUrl = getWarmupImageUrl(e.name);
  const instructionSteps = getWarmupInstructions(e.name);
  return {
    name: e.name,
    detail: e.detail,
    ...(imageUrl && { imageUrl }),
    ...(instructionSteps && instructionSteps.length > 0 && { instructionSteps }),
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
      if (slots.length > 0) {
        setExercises(
          slots.map((s) => ({
            name: s.name,
            detail: s.detail,
            ...(s.imageUrl && { imageUrl: s.imageUrl }),
            ...(Array.isArray(s.instructions) &&
              s.instructions.length > 0 && { instructions: s.instructions }),
          }))
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
