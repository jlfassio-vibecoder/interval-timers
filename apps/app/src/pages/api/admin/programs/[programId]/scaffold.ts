/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read/update program scaffold (program_template). Trainers (owners) and admins.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  assertUserCanAccessProgram,
  PROGRAM_ACCESS_FORBIDDEN,
  updateProgramScaffold,
  getProgramScaffold,
} from '@/lib/supabase/admin/program-server';
import type { ProgramTemplateScaffold } from '@/types/ai-program';

function scaffoldAuthErrorResponse(e: unknown): Response | null {
  if (!(e instanceof Error)) return null;
  if (e.message === 'UNAUTHENTICATED' || e.message === 'UNAUTHORIZED') {
    return new Response(JSON.stringify({ error: 'Unauthorized. Sign in as a trainer or admin.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (e.message === PROGRAM_ACCESS_FORBIDDEN) {
    return new Response(
      JSON.stringify({ error: 'Forbidden. You do not have access to this program.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (e.message.includes('not found')) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export const PUT: APIRoute = async ({ request, params, cookies }) => {
  try {
    const { uid } = await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { scaffold: ProgramTemplateScaffold };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON with scaffold.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.scaffold || !Array.isArray(body.scaffold.phases)) {
      return new Response(JSON.stringify({ error: 'scaffold.phases is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await assertUserCanAccessProgram(programId, uid);

    // Always derive totalWeeks from phases server-side so duration_weeks stays consistent with scaffold.
    const totalWeeks = body.scaffold.phases.reduce((sum, p) => sum + (p.weeks || 0), 0);
    const scaffold: ProgramTemplateScaffold = {
      phases: body.scaffold.phases,
      totalWeeks,
    };

    await updateProgramScaffold(programId, scaffold);
    const updated = await getProgramScaffold(programId);
    return new Response(JSON.stringify({ scaffold: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const early = scaffoldAuthErrorResponse(e);
    if (early) return early;
    const msg = e instanceof Error ? e.message : 'Failed to update scaffold';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ request, params, cookies }) => {
  try {
    const { uid } = await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await assertUserCanAccessProgram(programId, uid);

    const scaffold = await getProgramScaffold(programId);
    return new Response(JSON.stringify({ scaffold }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const early = scaffoldAuthErrorResponse(e);
    if (early) return early;
    // Manually created / legacy programs have no program_template — 200 + null avoids 404 noise in DevTools.
    if (e instanceof Error && e.message.includes('no scaffold')) {
      return new Response(JSON.stringify({ scaffold: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const msg = e instanceof Error ? e.message : 'Failed to fetch scaffold';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
