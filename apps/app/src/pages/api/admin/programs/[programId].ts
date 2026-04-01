/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin program CRUD (GET/PUT/PATCH/DELETE). Authenticated trainers (program owners)
 * or admins. Supabase access_token: Bearer or sb-access-token cookie.
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  assertUserCanAccessProgram,
  PROGRAM_ACCESS_FORBIDDEN,
  fetchFullProgram,
  updateProgram,
  deleteProgram,
  updateProgramStatus,
  updateProgramFeatured,
} from '@/lib/supabase/admin/program-server';
import type { ProgramTemplate, ProgramConfig } from '@/types/ai-program';

function programApiErrorResponse(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
    return new Response(JSON.stringify({ error: 'Unauthorized. Sign in as a trainer or admin.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (error.message === PROGRAM_ACCESS_FORBIDDEN) {
    return new Response(
      JSON.stringify({ error: 'Forbidden. You do not have access to this program.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (error.message.includes('not found')) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

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
    const program = await fetchFullProgram(programId);

    return new Response(JSON.stringify(program), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const early = programApiErrorResponse(error);
    if (early) return early;

    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error fetching program:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to fetch program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, params, cookies }) => {
  try {
    const { uid } = await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { status?: 'draft' | 'published'; featured_on_landing?: boolean };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hasStatus = body.status !== undefined;
    const hasFeatured = typeof body.featured_on_landing === 'boolean';
    if (!hasStatus && !hasFeatured) {
      return new Response(
        JSON.stringify({
          error: 'Provide at least one field: status or featured_on_landing',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (hasStatus && body.status !== 'draft' && body.status !== 'published') {
      return new Response(
        JSON.stringify({
          error: 'Invalid field: status (must be "draft" or "published")',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await assertUserCanAccessProgram(programId, uid);

    if (hasStatus) {
      await updateProgramStatus(programId, body.status!);
    }
    if (hasFeatured) {
      await updateProgramFeatured(programId, body.featured_on_landing!);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const early = programApiErrorResponse(error);
    if (early) return early;
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error updating program status:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update program status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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

    // Parse request body
    let body: { programData: ProgramTemplate; programConfig: ProgramConfig };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!body.programData || !body.programConfig) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: programData, programConfig' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await assertUserCanAccessProgram(programId, uid);
    await updateProgram(programId, body.programData, body.programConfig);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const early = programApiErrorResponse(error);
    if (early) return early;

    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error updating program:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to update program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
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
    await deleteProgram(programId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const early = programApiErrorResponse(error);
    if (early) return early;

    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error deleting program:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to delete program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
