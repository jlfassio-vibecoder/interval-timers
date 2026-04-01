/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generate program scaffold (phase structure) only. Creates program record with program_template; no program_weeks.
 */

import type { APIRoute } from 'astro';
import type { ProgramPersona, ProgramTemplateScaffold, ProgramConfig } from '@/types/ai-program';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { buildScaffoldPrompt, validateScaffoldOutput } from '@/lib/prompt-chain';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';
import { createProgramWithScaffold } from '@/lib/supabase/admin/program-server';

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

    const persona = (await request.json()) as ProgramPersona;
    if (!persona.demographics || !persona.medical || !persona.goals) {
      return new Response(JSON.stringify({ error: 'Invalid persona structure' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const durationWeeks = persona.durationWeeks || 6;

    const creds = await getVertexAICredentials('[generate-scaffold]');
    if ('error' in creds) return creds.error;
    const { projectId, region, accessToken } = creds;

    const prompt = buildScaffoldPrompt(persona);
    const response = await callVertexAI({
      systemPrompt:
        'You are the Program Periodization Architect. Output ONLY valid JSON with phases and totalWeeks.',
      userPrompt: prompt,
      accessToken,
      projectId,
      region,
      temperature: 0.5,
      maxTokens: 2048,
      logPrefix: '[generate-scaffold]',
    });

    const parsed = parseJSONWithRepair(response);
    const validation = validateScaffoldOutput(parsed.data, durationWeeks);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: `Scaffold validation failed: ${validation.error}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const scaffold: ProgramTemplateScaffold = validation.data;

    const programConfig: ProgramConfig = {
      programInfo: {
        title: (persona.title ?? '').trim() || 'Untitled Program',
        description: (persona.description ?? '').trim() || '',
      },
      targetAudience: persona.demographics,
      requirements: {
        durationWeeks: durationWeeks <= 6 ? 6 : durationWeeks <= 8 ? 8 : 12,
        daysPerWeek: persona.daysPerWeek,
      },
      goals: persona.goals,
      zoneId: persona.zoneId,
      selectedEquipmentIds: persona.selectedEquipmentIds,
    };

    const programId = await createProgramWithScaffold(
      caller.uid,
      scaffold,
      programConfig
    );

    return new Response(
      JSON.stringify({
        scaffold,
        programId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[generate-scaffold] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate scaffold';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
