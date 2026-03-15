/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin program CRUD (GET/PUT/PATCH/DELETE). Uses Supabase auth: callers must send
 * Supabase session access_token (Bearer or sb-access-token cookie).
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import {
  fetchFullProgram,
  updateProgram,
  deleteProgram,
  updateProgramStatus,
} from '@/lib/supabase/admin/program-server';
import type { ProgramTemplate, ProgramConfig } from '@/types/ai-program';

export const GET: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const program = await fetchFullProgram(programId);

    return new Response(JSON.stringify(program), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle not found errors
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Log other errors in development or when error logging is enabled
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
    await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { status: 'draft' | 'published' };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.status || (body.status !== 'draft' && body.status !== 'published')) {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid field: status (must be "draft" or "published")',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await updateProgramStatus(programId, body.status);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
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
    await verifyTrainerOrAdminRequest(request, cookies);

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

    await updateProgram(programId, body.programData, body.programConfig);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle not found errors
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Log other errors in development or when error logging is enabled
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
    await verifyTrainerOrAdminRequest(request, cookies);

    const programId = params.programId;
    if (!programId) {
      return new Response(JSON.stringify({ error: 'Program ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteProgram(programId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle not found errors
      if (error.message.includes('not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Log other errors in development or when error logging is enabled
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error deleting program:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to delete program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
