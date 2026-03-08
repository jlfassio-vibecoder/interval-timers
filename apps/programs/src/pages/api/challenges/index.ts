/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API: list published challenges (metadata only).
 */

import type { APIRoute } from 'astro';
import { getPublishedChallenges } from '@/lib/supabase/public/challenge-service';

export const GET: APIRoute = async () => {
  try {
    const challenges = await getPublishedChallenges();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (import.meta.env.PROD) {
      headers['Cache-Control'] = 'public, max-age=60';
    }
    return new Response(JSON.stringify(challenges), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/challenges] Error listing challenges:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to list challenges' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
