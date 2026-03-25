import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { getSupabaseUserClient } from '@/lib/supabase/admin/auth';
import {
  computeTotalActiveMultiplier,
  legacyActivityLevelFromLifestyle,
  LIFESTYLE_BASELINE_IDS,
  WORKOUT_ROUTINE_IDS,
} from '@/lib/met';
import { FITNESS_GOAL_IDS } from '@/lib/fitness-goal-taxonomy';
import {
  MEDICAL_CONDITION_IDS,
  PHYSICAL_LIMITATION_IDS,
  PREGNANCY_POSTPARTUM_IDS,
  physicalLimitationsToLegacyInjuryTags,
} from '@/lib/profile-health-taxonomy';

const lifestyleSchema = z.enum(LIFESTYLE_BASELINE_IDS);
const workoutSchema = z.enum(WORKOUT_ROUTINE_IDS);

function zodStringIn<const T extends readonly string[]>(allowed: T) {
  return z.string().refine((s): s is T[number] => (allowed as readonly string[]).includes(s));
}

const physicalLimitationItemSchema = zodStringIn(PHYSICAL_LIMITATION_IDS);
const medicalConditionItemSchema = zodStringIn(MEDICAL_CONDITION_IDS);
const pregnancyItemSchema = zodStringIn(PREGNANCY_POSTPARTUM_IDS);

const physicalLimitationsSchema = z
  .array(physicalLimitationItemSchema)
  .max(PHYSICAL_LIMITATION_IDS.length)
  .superRefine((arr, ctx) => {
    if (arr.includes('none') && arr.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'No known limitations cannot be combined with other physical selections',
      });
    }
  });

const medicalConditionsSchema = z
  .array(medicalConditionItemSchema)
  .max(MEDICAL_CONDITION_IDS.length)
  .superRefine((arr, ctx) => {
    if (arr.includes('none') && arr.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'None cannot be combined with other medical selections',
      });
    }
  });

const pregnancyPostpartumSchema = z.array(pregnancyItemSchema).max(1);

const fitnessGoalItemSchema = zodStringIn(FITNESS_GOAL_IDS);
const fitnessGoalRankingSchema = z
  .array(fitnessGoalItemSchema)
  .max(3)
  .superRefine((arr, ctx) => {
    if (new Set(arr).size !== arr.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate goals are not allowed',
      });
    }
  });

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
        // createClient<Database> infers profiles.update as `never` with our partial schema; browser
        // supabase instance stays untyped and accepts the same payload (ProfilePage).
        const { error } = await supabase
          .from('profiles')
          .update(patch as never)
          .eq('id', uid);
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

  updateProfileHealthFilters: defineAction({
    input: z.object({
      physical_limitations: physicalLimitationsSchema,
      medical_conditions: medicalConditionsSchema,
      pregnancy_postpartum: pregnancyPostpartumSchema,
    }),
    handler: async (input, context) => {
      try {
        const { supabase, uid } = await getSupabaseUserClient(
          context.request,
          context.cookies
        );
        const patch = {
          physical_limitations: input.physical_limitations,
          medical_conditions: input.medical_conditions,
          pregnancy_postpartum: input.pregnancy_postpartum,
          injury_limitation_tags: physicalLimitationsToLegacyInjuryTags(
            input.physical_limitations
          ),
        };
        const { error } = await supabase
          .from('profiles')
          .update(patch as never)
          .eq('id', uid);
        if (error) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }
        return { ok: true as const };
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

  updateProfileFitnessGoalRanking: defineAction({
    input: z.object({
      fitness_goal_ranking: fitnessGoalRankingSchema,
    }),
    handler: async (input, context) => {
      try {
        const { supabase, uid } = await getSupabaseUserClient(
          context.request,
          context.cookies
        );
        const ranking = input.fitness_goal_ranking;
        const patch = {
          fitness_goal_ranking: ranking,
          primary_fitness_goal: ranking[0] ?? null,
        };
        const { error } = await supabase
          .from('profiles')
          .update(patch as never)
          .eq('id', uid);
        if (error) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }
        return { ok: true as const };
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
