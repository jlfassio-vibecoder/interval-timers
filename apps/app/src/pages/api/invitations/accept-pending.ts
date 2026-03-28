/**
 * POST /api/invitations/accept-pending
 * Complete roster invites for the signed-in user when the invite token was lost after auth redirects.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { acceptPendingRosterInvitesForSession } from '@/lib/supabase/admin/roster-invitations';
import { extractAccessToken } from '@/lib/supabase/admin/auth';

const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = extractAccessToken(request, cookies);
    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const candidateEmails: string[] = [];
    if (user.email) candidateEmails.push(user.email);
    if (typeof meta?.email === 'string' && meta.email.trim()) {
      candidateEmails.push(meta.email);
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .maybeSingle();
    if (prof?.email?.trim()) {
      candidateEmails.push(prof.email);
    }

    const { acceptedCount } = await acceptPendingRosterInvitesForSession(
      user.id,
      candidateEmails,
      user.phone ?? undefined
    );

    return new Response(JSON.stringify({ ok: true, acceptedCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[invitations/accept-pending]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to accept invitations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
