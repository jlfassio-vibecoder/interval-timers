/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — trainer’s approved generated WODs (picker for Performance Lab assignments).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('generated_wods')
      .select('id, title, name')
      .eq('author_id', uid)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[trainer/wods]', error);
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (data ?? []).map((w) => {
      const row = w as { id: string; title?: string | null; name?: string | null };
      const title =
        (typeof row.name === 'string' && row.name.trim()) ||
        (typeof row.title === 'string' && row.title.trim()) ||
        'WOD';
      return { id: row.id, title };
    });

    return new Response(JSON.stringify(list), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/wods]', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
