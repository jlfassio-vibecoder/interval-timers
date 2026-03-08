/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API: list published programs (metadata only).
 */

import type { APIRoute } from 'astro';
import { getPublishedPrograms } from '@/lib/supabase/public/program-service';

export const GET: APIRoute = async () => {
  try {
    const programs = await getPublishedPrograms();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (import.meta.env.PROD) {
      headers['Cache-Control'] = 'public, max-age=60';
    }
    return new Response(JSON.stringify(programs), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/programs] Error listing programs:', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
