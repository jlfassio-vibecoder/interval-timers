/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unlock API: grant the current user access to a program (mock purchase).
 */

import type { APIRoute } from 'astro';
import { getCurrentUserFromRequest } from '@/lib/supabase/admin/auth';
import {
  ensureProgramPublished,
  grantProgramAccess,
} from '@/lib/supabase/server/program-entitlements';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getCurrentUserFromRequest(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { programId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const programId = body.programId;
    if (!programId || typeof programId !== 'string' || !programId.trim()) {
      return new Response(JSON.stringify({ error: 'programId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await ensureProgramPublished(programId);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        return new Response(JSON.stringify({ error: 'Program not found or not published' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }

    await grantProgramAccess(user.uid, programId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/programs/unlock] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to unlock program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
