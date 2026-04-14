/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified 4-Step Prompt Chain for Workout Generation (Workout Factory)
 * Orchestrates: Workout Architect → Biomechanist → Coach → Workout Mathematician
 */

import type { APIRoute } from 'astro';
import type { PatternSkeleton, ExerciseSelection } from '@/types/ai-program';
import type {
  WorkoutArchitectBlueprint,
  WorkoutSetTemplate,
  WorkoutChainMetadata,
  WorkoutInSet,
} from '@/types/ai-workout';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { prepareWorkoutChainRequest } from '@/lib/workout-chain/prepare-workout-chain-request';
import {
  buildWorkoutArchitectPrompt,
  validateWorkoutArchitectOutput,
} from '@/lib/prompt-chain/step1-workout-architect';
import {
  buildBiomechanistPrompt,
  validateBiomechanistOutput,
  buildCoachPrompt,
  validateCoachOutput,
} from '@/lib/prompt-chain';
import {
  buildWorkoutMathematicianPrompt,
  validateWorkoutMathematicianOutput,
} from '@/lib/prompt-chain/step4-workout-mathematician';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';
import { verifyMissionControlRequest } from '@/lib/supabase/admin/auth';

export interface WorkoutChainGenerationResponse {
  workoutSet: WorkoutSetTemplate;
  chain_metadata: WorkoutChainMetadata;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const startTime = Date.now();
  const shouldLog = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true';

  try {
    await verifyMissionControlRequest(request, cookies);

    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prepared = await prepareWorkoutChainRequest(rawBody, shouldLog);
    if (!prepared.ok) return prepared.response;

    const {
      persona,
      blockOptions,
      hiitMode,
      hiitOptions,
      amrapDensityOptions,
      tabataBalancedOptions,
      emomMode: emomFactoryMode,
      emomOptions: emomFactoryOptions,
      zoneContext,
      availableEquipment,
      providedArchitect,
      step1UserPromptOverride,
    } = prepared.data;

    const amrapDensityMode = !!persona.amrapDensityMode;
    const tabataBalancedMode = !!persona.tabataBalancedMode;

    const creds = await getVertexAICredentials('[generate-workout-chain]');
    if ('error' in creds) return creds.error;
    const { projectId, region, accessToken } = creds;

    // ========================================================================
    // STEP 1: WORKOUT ARCHITECT
    // ========================================================================
    let workoutArchitect: WorkoutArchitectBlueprint;
    if (providedArchitect) {
      const validation = validateWorkoutArchitectOutput(
        providedArchitect,
        hiitMode,
        amrapDensityMode,
        tabataBalancedMode,
        tabataBalancedOptions,
        emomFactoryMode,
        emomFactoryOptions
      );
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: `Invalid architectBlueprint: ${validation.error}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      workoutArchitect = validation.data;
      if (shouldLog)
        console.warn('[generate-workout-chain] Using provided workout architect blueprint');
    } else {
      if (shouldLog) console.warn('[generate-workout-chain] Step 1: Workout Architect...');
      const step1Prompt =
        step1UserPromptOverride ?? buildWorkoutArchitectPrompt(persona, zoneContext, hiitOptions);
      const step1Response = await callVertexAI({
        systemPrompt:
          'You are the Workout Architect (PhD Exercise Physiology). Output ONLY valid JSON.',
        userPrompt: step1Prompt,
        accessToken,
        projectId,
        region,
        temperature: 0.5,
        maxTokens: 2048,
        logPrefix: '[generate-workout-chain]',
      });

      const step1Parsed = parseJSONWithRepair(step1Response);
      const step1Validation = validateWorkoutArchitectOutput(
        step1Parsed.data,
        hiitMode,
        amrapDensityMode,
        tabataBalancedMode,
        tabataBalancedOptions,
        emomFactoryMode,
        emomFactoryOptions
      );
      if (!step1Validation.valid) {
        return new Response(
          JSON.stringify({ error: `Step 1 (Workout Architect) failed: ${step1Validation.error}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      workoutArchitect = step1Validation.data;
    }
    if (shouldLog)
      console.warn('[generate-workout-chain] Step 1 complete:', workoutArchitect.workout_set_name);

    // Build architect shape for steps 2–3 (they expect program_name and split)
    const architectForStep2 = {
      ...workoutArchitect,
      program_name: workoutArchitect.workout_set_name,
      rationale: workoutArchitect.rationale,
      split: workoutArchitect.split,
      progression_protocol: workoutArchitect.progression_protocol,
      progression_rules: workoutArchitect.progression_rules,
      volume_landmarks: workoutArchitect.volume_landmarks,
    };

    // ========================================================================
    // STEP 2: BIOMECHANIST
    // ========================================================================
    if (shouldLog) console.warn('[generate-workout-chain] Step 2: Biomechanist...');
    const step2Prompt = buildBiomechanistPrompt(architectForStep2);
    const step2Response = await callVertexAI({
      systemPrompt:
        'You are the Biomechanist. Map movement patterns for structural balance. Output ONLY valid JSON.',
      userPrompt: step2Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 2048,
      logPrefix: '[generate-workout-chain]',
    });

    const step2Parsed = parseJSONWithRepair(step2Response);
    const step2Validation = validateBiomechanistOutput(
      step2Parsed.data,
      workoutArchitect.split.days_per_week
    );
    if (!step2Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Step 2 (Biomechanist) failed: ${step2Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const patterns: PatternSkeleton = step2Validation.data;
    if (shouldLog)
      console.warn(
        '[generate-workout-chain] Step 2 complete:',
        patterns.days.length,
        'sessions mapped'
      );

    // ========================================================================
    // STEP 3: COACH
    // ========================================================================
    if (shouldLog) console.warn('[generate-workout-chain] Step 3: Coach...');
    const biomechanicalForCoach =
      zoneContext?.biomechanicalConstraints?.map((c) => String(c).trim()).filter(Boolean) ?? [];
    const step3Prompt = buildCoachPrompt(
      patterns,
      availableEquipment,
      hiitMode,
      undefined,
      biomechanicalForCoach.length > 0 ? biomechanicalForCoach : undefined,
      biomechanicalForCoach.length > 0 ? zoneContext?.zoneName : undefined
    );
    const step3Response = await callVertexAI({
      systemPrompt:
        'You are the Equipment Coach. Select specific exercises based on available equipment. Output ONLY valid JSON.',
      userPrompt: step3Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 3072,
      logPrefix: '[generate-workout-chain]',
    });

    const step3Parsed = parseJSONWithRepair(step3Response);
    const step3Validation = validateCoachOutput(step3Parsed.data, patterns.days.length);
    if (!step3Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Step 3 (Coach) failed: ${step3Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const exercises: ExerciseSelection[] = step3Validation.data;
    if (shouldLog)
      console.warn(
        '[generate-workout-chain] Step 3 complete:',
        exercises.reduce((acc, d) => acc + d.exercises.length, 0),
        'exercises selected'
      );

    // ========================================================================
    // STEP 4: WORKOUT MATHEMATICIAN
    // ========================================================================
    if (shouldLog) console.warn('[generate-workout-chain] Step 4: Workout Mathematician...');
    const mergedMedicalForBrief =
      persona.medicalNotes?.trim() ||
      [persona.medical.injuries?.trim(), persona.medical.conditions?.trim()].filter(Boolean).join(
        '; '
      ) ||
      '';
    const hasTrainerBrief =
      Boolean(persona.title?.trim()) ||
      Boolean(persona.description?.trim()) ||
      Boolean(mergedMedicalForBrief);
    const trainerBrief = hasTrainerBrief
      ? {
          title: persona.title?.trim() ?? '',
          description: persona.description?.trim() ?? '',
          ...(mergedMedicalForBrief ? { medicalNotes: mergedMedicalForBrief } : {}),
        }
      : undefined;
    const step4Prompt = buildWorkoutMathematicianPrompt(
      workoutArchitect,
      exercises,
      blockOptions,
      hiitMode,
      hiitOptions,
      amrapDensityMode,
      amrapDensityOptions,
      tabataBalancedMode,
      tabataBalancedOptions,
      emomFactoryMode,
      emomFactoryOptions,
      trainerBrief
    );
    const step4Response = await callVertexAI({
      systemPrompt: amrapDensityMode
        ? 'You are the Workout Mathematician. For Density-Based AMRAP: output ONLY one main circuit in exerciseBlocks using fixed repetition counts per station (sets/reps schema). FORBID workSeconds and timed-station prescriptions. restSeconds must be 0 between movements (continuous lap). Primary metric: Total Laps Completed. Do not include warmupBlocks, finisherBlocks, or cooldownBlocks (use empty arrays). Output ONLY valid JSON.'
        : tabataBalancedMode
          ? 'You are the Workout Mathematician. For Balanced Tabata: output exactly ONE block in exerciseBlocks. Each exercise MUST use workSeconds 20, restSeconds 10, and rounds as specified in the user prompt. FORBID sets and reps in the main block. Do not include warmupBlocks, finisherBlocks, or cooldownBlocks (use empty arrays). Output ONLY valid JSON.'
          : emomFactoryMode
            ? 'You are the Workout Mathematician. For EMOM factory mode: output exactly ONE block in exerciseBlocks using TIMER SCHEMA only (workSeconds, restSeconds, rounds) per the user prompt. FORBID sets and reps in the main block. Do not include warmupBlocks, finisherBlocks, or cooldownBlocks (use empty arrays). Output ONLY valid JSON.'
            : hiitMode
            ? hiitOptions?.protocolFormat === 'amrap'
              ? 'You are the Workout Mathematician. For AMRAP: output ONLY the main interval circuit in exerciseBlocks (timer fields: workSeconds, restSeconds, rounds=1 per exercise). Do not include warmupBlocks, finisherBlocks, or cooldownBlocks (use empty arrays). Warm-up and cool-down are not part of this output. Output ONLY valid JSON.'
              : 'You are the Workout Mathematician. Generate one set of HIIT workouts with workSeconds, restSeconds, rounds per exercise. Output ONLY valid JSON.'
            : 'You are the Workout Mathematician. Generate one set of workouts with sets, reps, RPE, rest. Output ONLY valid JSON.',
      userPrompt: step4Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 120000,
      logPrefix: '[generate-workout-chain]',
    });

    const step4Parsed = parseJSONWithRepair(step4Response);
    const step4Validation = validateWorkoutMathematicianOutput(
      step4Parsed.data,
      workoutArchitect.sessions.length,
      blockOptions,
      hiitMode,
      hiitOptions,
      amrapDensityMode,
      tabataBalancedMode,
      tabataBalancedOptions,
      emomFactoryMode,
      emomFactoryOptions
    );
    if (!step4Validation.valid) {
      return new Response(
        JSON.stringify({
          error: `Step 4 (Workout Mathematician) failed: ${step4Validation.error}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const workouts: WorkoutInSet[] = step4Validation.data;
    if (shouldLog)
      console.warn(
        '[generate-workout-chain] Step 4 complete:',
        workouts.length,
        'workouts generated'
      );

    // ========================================================================
    // COMBINE RESULTS
    // ========================================================================
    const workoutSet: WorkoutSetTemplate = normalizeWorkoutSet({
      title: persona.title || workoutArchitect.workout_set_name,
      description: persona.description || workoutArchitect.rationale,
      difficulty: persona.demographics.experienceLevel as 'beginner' | 'intermediate' | 'advanced',
      workouts,
    });

    const chainMetadata: WorkoutChainMetadata = {
      step1_workout_architect: workoutArchitect,
      step2_biomechanist: patterns,
      step3_coach: exercises,
      step4_workout_mathematician: workouts,
      generated_at: new Date(),
      model_used: 'vertex-ai',
    };

    const response: WorkoutChainGenerationResponse = {
      workoutSet,
      chain_metadata: chainMetadata,
    };

    const elapsedMs = Date.now() - startTime;
    if (shouldLog) console.warn(`[generate-workout-chain] Complete in ${elapsedMs}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return new Response(JSON.stringify({ error: 'Mission Control access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (shouldLog) console.error('[generate-workout-chain] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
