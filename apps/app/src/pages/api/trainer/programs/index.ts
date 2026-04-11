/**
 * GET /api/trainer/programs — trainer/admin/super_admin: programs owned by the current user (for client invites).
 * Hosts receive an empty array.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { getSupabaseMissionControl } from '@/lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseMissionControl();
    const { data, error } = await supabase
      .from('programs')
      .select('id, title, status')
      .eq('trainer_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[trainer/programs]', error);
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
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
      console.error('[trainer/programs]', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
