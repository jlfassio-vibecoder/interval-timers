import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { getSupabaseUserClient } from '@/lib/supabase/admin/auth';
import {
  computeTotalActiveMultiplier,
  legacyActivityLevelFromLifestyle,
  LIFESTYLE_BASELINE_IDS,
  WORKOUT_ROUTINE_IDS,
} from '@/lib/met';

const lifestyleSchema = z.enum(LIFESTYLE_BASELINE_IDS);
const workoutSchema = z.enum(WORKOUT_ROUTINE_IDS);

export const server = {
  updateActivityLevel: defineAction({
    input: z.object({
      lifestyle_baseline: lifestyleSchema,
      workout_routine: workoutSchema,
    }),
    handler: async (input, context) => {
      try {
        const { supabase, uid } = await getSupabaseUserClient(
          context.request,
          context.cookies
        );
        const tam = computeTotalActiveMultiplier(
          input.lifestyle_baseline,
          input.workout_routine
        );
        const patch = {
          lifestyle_baseline: input.lifestyle_baseline,
          workout_routine: input.workout_routine,
          total_active_multiplier: tam,
          activity_level_baseline: legacyActivityLevelFromLifestyle(
            input.lifestyle_baseline
          ),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Local Database type incomplete vs supabase-js Table inference
        const { error } = await (supabase as any).from('profiles').update(patch).eq('id', uid);
        if (error) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }
        return { total_active_multiplier: tam };
      } catch (e) {
        if (e instanceof ActionError) throw e;
        if (e instanceof Error && e.message === 'UNAUTHENTICATED') {
          throw new ActionError({
            code: 'UNAUTHORIZED',
            message: 'Sign in required',
          });
        }
        throw e;
      }
    },
  }),
};
