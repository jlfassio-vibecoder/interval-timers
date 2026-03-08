/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin-only sanity check: whether GEMINI_API_KEY is available at runtime.
 * Used to verify production API configuration (do not expose the key).
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);
    const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
    return new Response(JSON.stringify({ ok: true, hasKey }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    if (error instanceof Error) {
      // Return 401 for both to match all other admin API routes (stats, users, programs, etc.).
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: JSON_HEADERS,
        });
      }
    }
    return new Response(JSON.stringify({ error: 'Failed to check environment' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
