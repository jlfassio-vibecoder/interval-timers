/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified 4-Step Prompt Chain for Program Generation
 * Orchestrates: Architect → Biomechanist → Coach → Mathematician
 */

import type { APIRoute } from 'astro';
import type {
  ProgramPersona,
  ProgramTemplate,
  ArchitectBlueprint,
  PatternSkeleton,
  ExerciseSelection,
  PromptChainMetadata,
  ChainGenerationResponse,
} from '@/types/ai-program';
import {
  getZoneByIdServer,
  getAllEquipmentItemsServer,
} from '@/lib/supabase/admin/server-equipment';
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
import { normalizeProgramSchedule } from '@/lib/program-schedule-utils';
import { callVertexAI } from '@/lib/vertex-ai-client';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

// ============================================================================
// Main Endpoint
// ============================================================================

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as ProgramPersona & {
      architectBlueprint?: ArchitectBlueprint;
    };
    const { architectBlueprint: providedArchitect, ...persona } = body;

    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const durationWeeks = persona.durationWeeks || 6;

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
        console.error('[generate-program-chain] Zone fetch error:', err);
      }
    }

    // Get credentials
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
      console.error('[generate-program-chain] Auth error:', err);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed. Run: gcloud auth application-default login',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 1: THE ARCHITECT (or use provided blueprint from two-phase flow)
    // ========================================================================
    let architect: ArchitectBlueprint;
    if (providedArchitect) {
      const validation = validateArchitectOutput(providedArchitect);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: `Invalid architectBlueprint: ${validation.error}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      architect = validation.data;
      console.warn('[generate-program-chain] Using provided architect blueprint');
    } else {
      console.warn('[generate-program-chain] Step 1: Architect...');
      const step1Prompt = buildArchitectPrompt(persona, zoneContext);
      const step1Response = await callVertexAI({
        systemPrompt:
          'You are the Macro-Cycle Architect with a PhD in Exercise Physiology. Output ONLY valid JSON.',
        userPrompt: step1Prompt,
        accessToken,
        projectId,
        region,
        temperature: 0.5,
        maxTokens: 2048,
        logPrefix: '[generate-program-chain]',
      });

      const step1Parsed = parseJSONWithRepair(step1Response);
      const step1Validation = validateArchitectOutput(step1Parsed.data);
      if (!step1Validation.valid) {
        return new Response(
          JSON.stringify({ error: `Step 1 (Architect) failed: ${step1Validation.error}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      architect = step1Validation.data;
    }
    console.warn('[generate-program-chain] Step 1 complete:', architect.program_name);

    // ========================================================================
    // STEP 2: THE BIOMECHANIST
    // ========================================================================
    console.warn('[generate-program-chain] Step 2: Biomechanist...');
    const step2Prompt = buildBiomechanistPrompt(architect);
    const step2Response = await callVertexAI({
      systemPrompt:
        'You are the Biomechanist. Map movement patterns for structural balance. Output ONLY valid JSON.',
      userPrompt: step2Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 2048,
      logPrefix: '[generate-program-chain]',
    });

    const step2Parsed = parseJSONWithRepair(step2Response);
    const step2Validation = validateBiomechanistOutput(
      step2Parsed.data,
      architect.split.days_per_week
    );
    if (!step2Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Step 2 (Biomechanist) failed: ${step2Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const patterns: PatternSkeleton = step2Validation.data;
    console.warn('[generate-program-chain] Step 2 complete:', patterns.days.length, 'days mapped');

    // ========================================================================
    // STEP 3: THE COACH
    // ========================================================================
    console.warn('[generate-program-chain] Step 3: Coach...');
    const step3Prompt = buildCoachPrompt(patterns, availableEquipment);
    const step3Response = await callVertexAI({
      systemPrompt:
        'You are the Equipment Coach. Select specific exercises based on available equipment. Output ONLY valid JSON.',
      userPrompt: step3Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.4,
      maxTokens: 3072,
      logPrefix: '[generate-program-chain]',
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
    console.warn(
      '[generate-program-chain] Step 3 complete:',
      exercises.reduce((acc, d) => acc + d.exercises.length, 0),
      'exercises selected'
    );

    // ========================================================================
    // STEP 4: THE MATHEMATICIAN
    // ========================================================================
    console.warn('[generate-program-chain] Step 4: Mathematician...');
    const step4Prompt = buildMathematicianPrompt(architect, exercises, durationWeeks);
    const step4Response = await callVertexAI({
      systemPrompt:
        'You are the Progression Mathematician. Generate week-by-week numbers. Output ONLY valid JSON.',
      userPrompt: step4Prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.3,
      maxTokens: 16384, // Large token limit for full schedule
      timeoutMs: 900000, // 15 minutes timeout for large schedule generation
      logPrefix: '[generate-program-chain]',
    });

    const step4Parsed = parseJSONWithRepair(step4Response);
    const step4Validation = validateMathematicianOutput(step4Parsed.data);
    if (!step4Validation.valid) {
      return new Response(
        JSON.stringify({ error: `Step 4 (Mathematician) failed: ${step4Validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const schedule = step4Validation.data;
    console.warn('[generate-program-chain] Step 4 complete:', schedule.length, 'weeks generated');

    // ========================================================================
    // COMBINE RESULTS
    // ========================================================================
    const program: ProgramTemplate = normalizeProgramSchedule({
      title: persona.title || architect.program_name,
      description: persona.description || architect.rationale,
      difficulty: persona.demographics.experienceLevel,
      durationWeeks,
      schedule,
    });

    const chainMetadata: PromptChainMetadata = {
      step1_architect: architect,
      step2_biomechanist: patterns,
      step3_coach: exercises,
      generated_at: new Date(),
      model_used: 'deepseek-v3.2',
    };

    const response: ChainGenerationResponse = {
      program,
      chain_metadata: chainMetadata,
    };

    const elapsedMs = Date.now() - startTime;
    console.warn(`[generate-program-chain] Complete in ${elapsedMs}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-program-chain] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate program';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
