/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API: list published WODs (no paywall).
 */

import type { APIRoute } from 'astro';
import { getPublishedWODs } from '@/lib/supabase/public/wod-service';

export const GET: APIRoute = async () => {
  try {
    const wods = await getPublishedWODs();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (import.meta.env.PROD) {
      headers['Cache-Control'] = 'public, max-age=60';
    }
    return new Response(JSON.stringify(wods), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/wod] Error listing WODs:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to list WODs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
