/**
 * GET /api/trainer/challenges — published challenges authored by the current user (Performance Lab picker).
 * Hosts receive an empty array (same pattern as /api/trainer/programs).
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
      .from('challenges')
      .select('id, title')
      .eq('author_id', uid)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[trainer/challenges]', error);
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (data ?? []).map((row) => ({
      id: row.id as string,
      title:
        typeof (row as { title?: string }).title === 'string' &&
        (row as { title: string }).title.trim()
          ? (row as { title: string }).title.trim()
          : 'Challenge',
    }));

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
      console.error('[trainer/challenges]', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
