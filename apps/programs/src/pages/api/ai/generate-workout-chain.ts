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
  WorkoutPersona,
  WorkoutArchitectBlueprint,
  WorkoutSetTemplate,
  WorkoutChainMetadata,
  WorkoutInSet,
  BlockOptions,
  HiitOptions,
  HiitCircuitStructure,
} from '@/types/ai-workout';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import { parseJSONWithRepair } from '@/lib/json-parser';
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
import { callVertexAI } from '@/lib/vertex-ai-client';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

export interface WorkoutChainGenerationResponse {
  workoutSet: WorkoutSetTemplate;
  chain_metadata: WorkoutChainMetadata;
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const shouldLog = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true';

  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const defaultBlockOptions: BlockOptions = {
      includeWarmup: true,
      mainBlockCount: 1,
      includeFinisher: false,
      includeCooldown: false,
    };

    let body: WorkoutPersona & {
      architectBlueprint?: WorkoutArchitectBlueprint;
      blockOptions?: BlockOptions;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const {
      architectBlueprint: providedArchitect,
      blockOptions: requestBlockOptions,
      ...persona
    } = body;
    const blockOptions: BlockOptions =
      requestBlockOptions && typeof requestBlockOptions === 'object'
        ? {
            includeWarmup: !!requestBlockOptions.includeWarmup,
            mainBlockCount:
              typeof requestBlockOptions.mainBlockCount === 'number' &&
              requestBlockOptions.mainBlockCount >= 1 &&
              requestBlockOptions.mainBlockCount <= 5
                ? (requestBlockOptions.mainBlockCount as 1 | 2 | 3 | 4 | 5)
                : 1,
            includeFinisher: !!requestBlockOptions.includeFinisher,
            includeCooldown: !!requestBlockOptions.includeCooldown,
          }
        : defaultBlockOptions;

    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (
      typeof persona.weeklyTimeMinutes !== 'number' ||
      persona.weeklyTimeMinutes < 30 ||
      persona.weeklyTimeMinutes > 600
    ) {
      return new Response(
        JSON.stringify({ error: 'weeklyTimeMinutes must be between 30 and 600' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (
      typeof persona.sessionsPerWeek !== 'number' ||
      persona.sessionsPerWeek < 1 ||
      persona.sessionsPerWeek > 7
    ) {
      return new Response(JSON.stringify({ error: 'sessionsPerWeek must be between 1 and 7' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const hiitMode = !!persona.hiitMode;
    const defaultHiitCircuitStructure: HiitCircuitStructure = {
      includeWarmup: true,
      circuit1: true,
      circuit2: false,
      circuit3: false,
      includeCooldown: true,
    };
    const defaultHiitOptions: HiitOptions = {
      protocolFormat: 'standard_ratio',
      workRestRatio: '1:1',
      circuitStructure: defaultHiitCircuitStructure,
      sessionDurationTier: 'standard_interval',
      primaryGoal: 'fat_oxidation',
    };
    const hiitOptions: HiitOptions | undefined = hiitMode
      ? persona.hiitOptions && typeof persona.hiitOptions === 'object'
        ? {
            protocolFormat: persona.hiitOptions.protocolFormat ?? defaultHiitOptions.protocolFormat,
            workRestRatio: persona.hiitOptions.workRestRatio,
            circuitStructure: persona.hiitOptions.circuitStructure ?? defaultHiitCircuitStructure,
            sessionDurationTier:
              persona.hiitOptions.sessionDurationTier ?? defaultHiitOptions.sessionDurationTier,
            primaryGoal: persona.hiitOptions.primaryGoal ?? defaultHiitOptions.primaryGoal,
          }
        : defaultHiitOptions
      : undefined;

    if (typeof persona.sessionDurationMinutes !== 'number') {
      return new Response(JSON.stringify({ error: 'sessionDurationMinutes is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (hiitMode) {
      if (persona.sessionDurationMinutes < 4 || persona.sessionDurationMinutes > 30) {
        return new Response(
          JSON.stringify({ error: 'sessionDurationMinutes must be between 4 and 30 in HIIT mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (persona.sessionDurationMinutes < 15 || persona.sessionDurationMinutes > 180) {
      return new Response(
        JSON.stringify({ error: 'sessionDurationMinutes must be between 15 and 180' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!persona.splitType || typeof persona.lifestyle !== 'string') {
      return new Response(JSON.stringify({ error: 'splitType and lifestyle are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch zone context
    let zoneContext: ZoneContext | undefined;
    let availableEquipment: string[] = ['Bodyweight'];
    if (persona.zoneId) {
      try {
        const zone = await getZoneByIdServer(persona.zoneId);
        if (zone) {
          const equipmentItems = await getAllEquipmentItemsServer();
          const equipmentMap = new Map(equipmentItems.map((item) => [item.id, item.name]));
          const equipmentIdsToUse = persona.selectedEquipmentIds?.length
            ? persona.selectedEquipmentIds
            : zone.equipmentIds;
          availableEquipment = equipmentIdsToUse
            .map((id) => equipmentMap.get(id))
            .filter((name): name is string => name !== undefined);
          if (availableEquipment.length === 0) {
            availableEquipment = ['Bodyweight'];
          }
          zoneContext = {
            zoneName: zone.name,
            availableEquipment,
            biomechanicalConstraints: zone.biomechanicalConstraints || [],
          };
        }
      } catch (err) {
        if (shouldLog) console.error('[generate-workout-chain] Zone fetch error:', err);
      }
    }

    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_PROJECT_ID environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const region = import.meta.env.GOOGLE_LOCATION || 'global';

    let accessToken: string;
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId,
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) throw new Error('Failed to get access token');
      accessToken = tokenResponse.token;
    } catch (err) {
      if (shouldLog) console.error('[generate-workout-chain] Auth error:', err);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed. Run: gcloud auth application-default login',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 1: WORKOUT ARCHITECT
    // ========================================================================
    let workoutArchitect: WorkoutArchitectBlueprint;
    if (providedArchitect) {
      const validation = validateWorkoutArchitectOutput(providedArchitect, hiitMode);
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
      const step1Prompt = buildWorkoutArchitectPrompt(persona, zoneContext, hiitOptions);
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
      const step1Validation = validateWorkoutArchitectOutput(step1Parsed.data, hiitMode);
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
    const step3Prompt = buildCoachPrompt(patterns, availableEquipment, hiitMode);
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
    const step4Prompt = buildWorkoutMathematicianPrompt(
      workoutArchitect,
      exercises,
      blockOptions,
      hiitMode,
      hiitOptions
    );
    const step4Response = await callVertexAI({
      systemPrompt: hiitMode
        ? 'You are the Workout Mathematician. Generate one set of HIIT workouts with workSeconds, restSeconds, rounds per exercise. Output ONLY valid JSON.'
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
      hiitOptions
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
    if (shouldLog) console.error('[generate-workout-chain] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
