/**
 * Best-effort email delivery for roster invites via Supabase Auth Admin (requires service role).
 * New users: inviteUserByEmail with redirect to accept URL.
 * If that fails (e.g. invitee already exists from a prior invite that was cancelled in our DB),
 * signInWithOtp sends the standard magic-link email with the same redirect—generateLink alone
 * does not send mail.
 *
 * Phone/SMS: not implemented. Inviters must share inviteUrl for phone-based invites until Twilio
 * or Supabase SMS templates are configured.
 */

import { getSupabaseServer, getSupabaseAnonClient, hasServiceRoleKey } from '@/lib/supabase/server';
import {
  buildRosterInviteAcceptUrl,
  normalizeInviteEmail,
} from '@/lib/supabase/admin/roster-invitations';

export async function trySendRosterInviteEmail(
  rawToken: string,
  email: string,
  inviteAbsoluteUrl?: string
): Promise<void> {
  if (!hasServiceRoleKey()) {
    if (import.meta.env.DEV) {
      console.info(
        '[roster-invite-delivery] SUPABASE_SERVICE_ROLE_KEY missing; skipping Auth email. Share inviteUrl.'
      );
    }
    return;
  }

  const redirectTo =
    typeof inviteAbsoluteUrl === 'string' && inviteAbsoluteUrl.trim()
      ? inviteAbsoluteUrl.trim()
      : buildRosterInviteAcceptUrl(rawToken);
  const normalized = normalizeInviteEmail(email);
  const supabase = getSupabaseServer();

  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo,
  });

  if (!inviteErr) return;

  const otpClient = getSupabaseAnonClient() ?? supabase;
  const { error: otpErr } = await otpClient.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (!otpErr) {
    if (import.meta.env.DEV) {
      console.info(
        '[roster-invite-delivery] Sent magic link via signInWithOtp (inviteUserByEmail:',
        inviteErr.message,
        ')'
      );
    }
    return;
  }
  if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
    console.warn('[roster-invite-delivery] signInWithOtp:', otpErr.message);
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalized,
    options: { redirectTo },
  });

  if (linkErr) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.warn('[roster-invite-delivery] inviteUserByEmail:', inviteErr.message);
      console.warn('[roster-invite-delivery] generateLink:', linkErr.message);
    }
    return;
  }

  if (import.meta.env.DEV && linkData?.properties?.action_link) {
    console.info(
      '[roster-invite-delivery] Existing user: magic link generated (share manually if needed):',
      linkData.properties.action_link.slice(0, 80) + '…'
    );
  }
}
