/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API: list published workout sets (no paywall).
 */

import type { APIRoute } from 'astro';
import { getPublishedWorkoutSets } from '@/lib/supabase/public/workout-set-service';

export const GET: APIRoute = async () => {
  try {
    const sets = await getPublishedWorkoutSets();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (import.meta.env.PROD) {
      headers['Cache-Control'] = 'public, max-age=60';
    }
    return new Response(JSON.stringify(sets), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/workouts] Error listing workout sets:', error);
    }
    // Return empty list instead of 500 so UI can show empty state (dev/MVP: no workouts yet)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
