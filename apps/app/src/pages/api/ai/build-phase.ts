/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Build a single phase of a program: Architect → Biomechanist → Coach → Mathematician for that phase only.
 * Reads scaffold from program; writes program_weeks for the phase.
 */

import type { APIRoute } from 'astro';
import type {
  ProgramPersona,
  ArchitectBlueprint,
  PatternSkeleton,
  ExerciseSelection,
  ProgramSchedule,
  PromptChainMetadata,
  BuildPhaseResponse,
  PhaseScaffold,
} from '@/types/ai-program';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
import {
  assertUserCanAccessProgram,
  PROGRAM_ACCESS_FORBIDDEN,
  getProgramScaffold,
  upsertPhaseWeeks,
  fetchFullProgram,
} from '@/lib/supabase/admin/program-server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { parseJSONWithRepair } from '@/lib/json-parser';
import {
  buildArchitectPrompt,
  validateArchitectOutput,
  buildBiomechanistPrompt,
  validateBiomechanistOutput,
  buildCoachPrompt,
  validateCoachOutput,
  buildMathematicianPrompt,
  validateMathematicianOutput,
} from '@/lib/prompt-chain';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let caller: { uid: string };
  try {
    caller = await verifyTrainerOrAdminRequest(request, cookies);
  } catch (e) {
    if (e instanceof Error && (e.message === 'UNAUTHENTICATED' || e.message === 'UNAUTHORIZED')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Sign in as a trainer or admin.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      programId: string;
      phaseIndex: number;
      persona: ProgramPersona;
      previousPhaseWorkouts?: ProgramSchedule[];
    };
    const { programId, phaseIndex, persona, previousPhaseWorkouts: bodyPrevious } = body;

    if (!programId || typeof phaseIndex !== 'number' || phaseIndex < 1) {
      return new Response(
        JSON.stringify({ error: 'programId and phaseIndex (1-based) are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!persona?.demographics || !persona?.medical || !persona?.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scaffold = await getProgramScaffold(programId);
    const phase = scaffold.phases.find((p) => p.phaseIndex === phaseIndex);
    if (!phase) {
      return new Response(
        JSON.stringify({ error: `Phase ${phaseIndex} not found in scaffold` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Previous phase workouts for context (client sends edited schedule; fallback to DB when omitted)
    let previousPhaseWorkouts: ProgramSchedule[] | undefined = bodyPrevious;
    if (phaseIndex > 1 && (!previousPhaseWorkouts || previousPhaseWorkouts.length === 0)) {
      try {
        const fullProgram = await fetchFullProgram(programId);
        previousPhaseWorkouts = fullProgram.schedule ?? [];
      } catch {
        previousPhaseWorkouts = [];
      }
    }

    try {
      await assertUserCanAccessProgram(programId, caller.uid);
    } catch (accessErr) {
      if (accessErr instanceof Error && accessErr.message === PROGRAM_ACCESS_FORBIDDEN) {
        return new Response(JSON.stringify({ error: 'Forbidden. You do not have access to this program.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (accessErr instanceof Error && accessErr.message.includes('not found')) {
        return new Response(JSON.stringify({ error: accessErr.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw accessErr;
    }

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
          if (availableEquipment.length === 0) availableEquipment = ['Bodyweight'];
          zoneContext = {
            zoneName: zone.name,
            availableEquipment,
            biomechanicalConstraints: zone.biomechanicalConstraints || [],
          };
        }
      } catch (err) {
        console.error('[build-phase] Zone fetch error:', err);
      }
    }

    const creds = await getVertexAICredentials('[build-phase]');
    if ('error' in creds) return creds.error;
    const { projectId, region, accessToken } = creds;

    const phaseContext: PhaseScaffold = phase;

    // Step 1: Architect (phase-scoped; optional previous phase context)
    const step1Prompt = buildArchitectPrompt(
      persona,
      zoneContext,
      phaseContext,
      previousPhaseWorkouts
    );
    const step1Response = await callVertexAI({
      systemPrompt: 'You are the Macro-Cycle Architect. Output ONLY valid JSON.',
      userPrompt: step1Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.5,
      maxTokens: 2048,
      logPrefix: '[build-phase]',
    });
    const step1Parsed = parseJSONWithRepair(step1Response);
    const step1Validation = validateArchitectOutput(step1Parsed.data);
    if (!step1Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Architect failed: ${step1Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const architect: ArchitectBlueprint = step1Validation.data;

    // Step 2: Biomechanist
    const step2Prompt = buildBiomechanistPrompt(architect);
    const step2Response = await callVertexAI({
      systemPrompt: 'You are the Biomechanist. Output ONLY valid JSON.',
      userPrompt: step2Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 2048,
      logPrefix: '[build-phase]',
    });
    const step2Parsed = parseJSONWithRepair(step2Response);
    const step2Validation = validateBiomechanistOutput(
      step2Parsed.data,
      architect.split.days_per_week
    );
    if (!step2Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Biomechanist failed: ${step2Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const patterns: PatternSkeleton = step2Validation.data;

    // Step 3: Coach (optional previous phase exercises for progression)
    const step3Prompt = buildCoachPrompt(
      patterns,
      availableEquipment,
      undefined,
      previousPhaseWorkouts
    );
    const step3Response = await callVertexAI({
      systemPrompt: 'You are the Equipment Coach. Output ONLY valid JSON.',
      userPrompt: step3Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 3072,
      logPrefix: '[build-phase]',
    });
    const step3Parsed = parseJSONWithRepair(step3Response);
    const step3Validation = validateCoachOutput(step3Parsed.data, patterns.days.length);
    if (!step3Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Coach failed: ${step3Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const exercises: ExerciseSelection[] = step3Validation.data;

    // Step 4: Mathematician (phase weeks only; optional previous phase baselines)
    const phaseWeeks = phase.weeks;
    const step4Prompt = buildMathematicianPrompt(
      architect,
      exercises,
      phaseWeeks,
      previousPhaseWorkouts
    );
    const step4Options = {
      systemPrompt: 'You are the Progression Mathematician. Output ONLY valid JSON.',
      userPrompt: step4Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 300000,
      logPrefix: '[build-phase]',
    };
    let step4Response: string;
    try {
      step4Response = await callVertexAI(step4Options);
    } catch (step4Err) {
      const msg = step4Err instanceof Error ? step4Err.message : String(step4Err);
      const isRetryable = /non-JSON|upstream|timeout|gateway/i.test(msg);
      if (isRetryable) {
        await new Promise((r) => setTimeout(r, 5000));
        step4Response = await callVertexAI(step4Options);
      } else {
        throw step4Err;
      }
    }
    const step4Parsed = parseJSONWithRepair(step4Response);
    const step4Validation = validateMathematicianOutput(step4Parsed.data);
    if (!step4Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Mathematician failed: ${step4Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const localSchedule: ProgramSchedule[] = step4Validation.data;

    // Map local week numbers (1..phaseWeeks) to global
    let startWeek = 1;
    for (const p of scaffold.phases) {
      if (p.phaseIndex === phaseIndex) break;
      startWeek += p.weeks;
    }
    const schedule: ProgramSchedule[] = localSchedule.map((week, i) => ({
      weekNumber: startWeek + i,
      workouts: week.workouts,
    }));

    await upsertPhaseWeeks(programId, phaseIndex, schedule);

    const chainMetadata: PromptChainMetadata = {
      step1_architect: architect,
      step2_biomechanist: patterns,
      step3_coach: exercises,
      generated_at: new Date(),
      model_used: 'deepseek-v3.2',
    };

    // Update chain_metadata on program (client at point of use to avoid relying on supabase from ~200 lines above)
    const { error: updateMetaError } = await getSupabaseServer()
      .from('programs')
      .update({
        chain_metadata: {
          step1_architect: chainMetadata.step1_architect,
          step2_biomechanist: chainMetadata.step2_biomechanist,
          step3_coach: chainMetadata.step3_coach,
          generated_at: chainMetadata.generated_at,
          model_used: chainMetadata.model_used,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', programId);
    if (updateMetaError) {
      console.warn('[build-phase] Failed to update chain_metadata:', updateMetaError.message);
    }

    const response: BuildPhaseResponse = { schedule, chain_metadata: chainMetadata };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[build-phase] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to build phase';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
