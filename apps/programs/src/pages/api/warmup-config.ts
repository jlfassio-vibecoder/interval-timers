/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API: Daily Warm-Up config with enriched slots (imageUrl, instructions from GeneratedExercise).
 */

import type { APIRoute } from 'astro';
import { getWarmupConfigServer } from '@/lib/supabase/admin/warmup-config';
import { getGeneratedExerciseByIdServer } from '@/lib/supabase/public/generated-exercise-service';
import { extractExecutionProtocolFromDeepDiveHtml } from '@/lib/parse-execution-protocol';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
} from '@/components/react/interval-timers/interval-timer-warmup';

export interface WarmupConfigEnrichedSlot {
  name: string;
  detail: string;
  imageUrl?: string;
  instructions?: string[];
}

export interface WarmupConfigResponse {
  slots: WarmupConfigEnrichedSlot[];
  durationPerExercise: number;
}

const CACHE_MAX_AGE = 0;

export const GET: APIRoute = async () => {
  try {
    const config = await getWarmupConfigServer();

    if (!config || !config.slots.length) {
      const fallback: WarmupConfigResponse = {
        slots: WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail })),
        durationPerExercise: WARMUP_DURATION_PER_EXERCISE,
      };
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
        },
      });
    }

    const durationPerExercise = config.durationPerExercise;
    const enrichedSlots: WarmupConfigEnrichedSlot[] = await Promise.all(
      config.slots
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(async (slot) => {
          const base: WarmupConfigEnrichedSlot = {
            name: slot.exerciseName,
            detail: slot.detail,
          };
          if (slot.generatedExerciseId) {
            const ex = await getGeneratedExerciseByIdServer(slot.generatedExerciseId);
            if (ex) {
              if (ex.imageUrl) base.imageUrl = ex.imageUrl;
              const executionProtocolSteps = ex.deepDiveHtmlContent
                ? extractExecutionProtocolFromDeepDiveHtml(ex.deepDiveHtmlContent)
                : [];
              if (executionProtocolSteps.length > 0) {
                base.instructions = executionProtocolSteps;
              } else if (
                Array.isArray(slot.fallbackInstructions) &&
                slot.fallbackInstructions.length > 0
              ) {
                base.instructions = slot.fallbackInstructions;
              }
            } else {
              if (slot.fallbackImageUrl) base.imageUrl = slot.fallbackImageUrl;
              if (slot.fallbackInstructions?.length) base.instructions = slot.fallbackInstructions;
            }
          } else {
            if (slot.fallbackImageUrl) base.imageUrl = slot.fallbackImageUrl;
            if (slot.fallbackInstructions?.length) base.instructions = slot.fallbackInstructions;
          }
          return base;
        })
    );

    const body: WarmupConfigResponse = {
      slots: enrichedSlots,
      durationPerExercise,
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/warmup-config] Error:', error);
    }
    const fallback: WarmupConfigResponse = {
      slots: WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail })),
      durationPerExercise: WARMUP_DURATION_PER_EXERCISE,
    };
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0',
      },
    });
  }
};
