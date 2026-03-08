/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unlock API: grant the current user access to a challenge (mock purchase).
 */

import type { APIRoute } from 'astro';
import { getCurrentUserFromRequest } from '@/lib/supabase/admin/auth';
import { ensureChallengePublished, grantChallengeAccess } from '@/lib/supabase/server/entitlements';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getCurrentUserFromRequest(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { challengeId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const challengeId = body.challengeId;
    if (!challengeId || typeof challengeId !== 'string' || !challengeId.trim()) {
      return new Response(JSON.stringify({ error: 'challengeId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await ensureChallengePublished(challengeId);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        return new Response(JSON.stringify({ error: 'Challenge not found or not published' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }

    await grantChallengeAccess(user.uid, challengeId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/challenges/unlock] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to unlock challenge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
