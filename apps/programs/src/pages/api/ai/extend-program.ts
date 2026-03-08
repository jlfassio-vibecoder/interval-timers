/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API endpoint to extend a partial program by adding missing weeks.
 * Used when AI returns fewer weeks than requested.
 */

import type { APIRoute } from 'astro';
import type { ProgramTemplate } from '@/types/ai-program';
import { parseJSONWithRepair } from '@/lib/json-parser';
import { normalizeProgramSchedule } from '@/lib/program-schedule-utils';
import { requestScheduleLengthFix } from './generate-program';

interface ExtendProgramRequest {
  program: ProgramTemplate;
  targetWeeks: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: ExtendProgramRequest = await request.json();

    if (!body.program || typeof body.targetWeeks !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: program and targetWeeks are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { program, targetWeeks } = body;
    const currentWeeks = program.schedule?.length ?? 0;

    if (currentWeeks >= targetWeeks) {
      // Program already has enough weeks
      return new Response(JSON.stringify(program), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for required environment variable
    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return new Response(
        JSON.stringify({
          error: 'GOOGLE_PROJECT_ID or PUBLIC_FIREBASE_PROJECT_ID environment variable is not set',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const region = import.meta.env.GOOGLE_LOCATION || 'global';

    // Get access token
    let accessToken: string;
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId: projectId,
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to get access token');
      }
      accessToken = tokenResponse.token;
    } catch (tokenError) {
      console.error('[extend-program] Failed to get access token:', tokenError);
      return new Response(
        JSON.stringify({
          error:
            'Failed to authenticate. Please ensure you have run: gcloud auth application-default login',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call the AI to add missing weeks
    if (import.meta.env.DEV) {
      console.warn(
        `[extend-program] Adding ${targetWeeks - currentWeeks} week(s) to program (${currentWeeks} -> ${targetWeeks})`
      );
    }

    const extendedJson = await requestScheduleLengthFix(
      JSON.stringify(program),
      targetWeeks,
      currentWeeks,
      projectId,
      region,
      accessToken
    );

    // Parse the response
    const parseResult = parseJSONWithRepair(extendedJson);
    const extendedProgram = parseResult.data as ProgramTemplate;

    // Validate the extended program has the right number of weeks
    const extendedWeeks = extendedProgram.schedule?.length ?? 0;
    if (extendedWeeks < targetWeeks) {
      // Still short - return what we have with missingWeeks
      const missingWeeks = targetWeeks - extendedWeeks;
      if (import.meta.env.DEV) {
        console.warn(
          `[extend-program] Still missing ${missingWeeks} week(s) after extension (got ${extendedWeeks} of ${targetWeeks})`
        );
      }
      const normalized = normalizeProgramSchedule({ ...extendedProgram, missingWeeks });
      return new Response(JSON.stringify(normalized), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Success - full program
    if (import.meta.env.DEV) {
      console.warn(`[extend-program] Successfully extended to ${extendedWeeks} weeks`);
    }

    const normalized = normalizeProgramSchedule(extendedProgram);
    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[extend-program] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extend program';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
