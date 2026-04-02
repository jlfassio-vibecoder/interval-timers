/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generate public-facing title and description from the finished program.
 * Uses scaffold + schedule to produce phase-by-phase copy.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  assertUserCanAccessProgram,
  PROGRAM_ACCESS_FORBIDDEN,
  fetchFullProgram,
  getProgramScaffold,
} from '@/lib/supabase/admin/program-server';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { buildPublicCopyPrompt, validatePublicCopyOutput } from '@/lib/prompt-chain';
import { callVertexAI, getVertexAICredentials } from '@/lib/vertex-ai-client';

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

    const body = (await request.json()) as { programId?: string };
    const programId = body?.programId;
    if (!programId || typeof programId !== 'string') {
      return new Response(JSON.stringify({ error: 'programId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await assertUserCanAccessProgram(programId, caller.uid);
    } catch (accessErr) {
      if (accessErr instanceof Error && accessErr.message === PROGRAM_ACCESS_FORBIDDEN) {
        return new Response(
          JSON.stringify({ error: 'Forbidden. You do not have access to this program.' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      if (accessErr instanceof Error && accessErr.message.includes('not found')) {
        return new Response(JSON.stringify({ error: accessErr.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw accessErr;
    }

    const creds = await getVertexAICredentials('[generate-public-copy]');
    if ('error' in creds) return creds.error;
    const { projectId, region, accessToken } = creds;

    const [program, scaffold] = await Promise.all([
      fetchFullProgram(programId),
      getProgramScaffold(programId).catch(() => null),
    ]);

    if (!program) {
      return new Response(JSON.stringify({ error: 'Program not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const schedule = program.schedule ?? [];
    if (!schedule.length) {
      return new Response(
        JSON.stringify({
          error: 'Program has no schedule; add workouts before generating public copy.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userPrompt = buildPublicCopyPrompt(program, scaffold);

    const response = await callVertexAI({
      systemPrompt:
        'You are a fitness content writer. Output ONLY valid JSON with "title" and "description" keys. No markdown, no explanations.',
      userPrompt,
      accessToken,
      projectId,
      region,
      temperature: 0.5,
      maxTokens: 2048,
      logPrefix: '[generate-public-copy]',
    });

    const parsed = parseJSONWithRepair(response);
    const validation = validatePublicCopyOutput(parsed.data);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: `Invalid response: ${validation.error}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(validation.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-public-copy] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate public title and description';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
