/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P2: Cron-driven reminders for scheduled live occurrences (~24h and ~1h before start).
 * Sends email via Resend when RESEND_API_KEY + RESEND_FROM are set.
 */

import { getSupabaseServer } from '@/lib/supabase/server';

const WINDOW_MS = 20 * 60 * 1000;

function envStr(name: string): string | undefined {
  const meta = import.meta.env as unknown as Record<string, string | undefined>;
  const a = meta[name]?.trim();
  if (a) return a;
  if (typeof process !== 'undefined' && process.env[name]?.trim()) return process.env[name]!.trim();
  return undefined;
}

function reminderTargetMs(kind: '24h' | '1h', nowMs: number): { lo: number; hi: number } {
  const offset = kind === '24h' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const center = nowMs + offset;
  return { lo: center - WINDOW_MS / 2, hi: center + WINDOW_MS / 2 };
}

async function sendResendPlainEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = envStr('RESEND_API_KEY');
  const from = envStr('RESEND_FROM');
  if (!key || !from) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type RunScheduledLiveRemindersResult = {
  sent24h: number;
  sent1h: number;
  skippedNoEmail: number;
  occurrencesFlagged24h: number;
  occurrencesFlagged1h: number;
};

/**
 * For each scheduled occurrence whose start is in the ~24h or ~1h window and reminder flag is null,
 * email accepted invitees (Resend) and set the flag when all recipients with profile email succeed.
 */
export async function runScheduledLiveReminders(nowMs: number = Date.now()): Promise<RunScheduledLiveRemindersResult> {
  const supabase = getSupabaseServer();
  const hasResend = !!(envStr('RESEND_API_KEY') && envStr('RESEND_FROM'));

  const out: RunScheduledLiveRemindersResult = {
    sent24h: 0,
    sent1h: 0,
    skippedNoEmail: 0,
    occurrencesFlagged24h: 0,
    occurrencesFlagged1h: 0,
  };

  for (const kind of ['24h', '1h'] as const) {
    const { lo, hi } = reminderTargetMs(kind, nowMs);
    const loIso = new Date(lo).toISOString();
    const hiIso = new Date(hi).toISOString();
    const sentCol = kind === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';

    const { data: occs, error: occErr } = await supabase
      .from('trainer_live_session_occurrences')
      .select('id, scheduled_start_at, scheduled_end_at')
      .eq('status', 'scheduled')
      .gte('scheduled_start_at', loIso)
      .lte('scheduled_start_at', hiIso)
      .is(sentCol, null);

    if (occErr) {
      if (import.meta.env.DEV) console.warn('[live-schedule-reminders] occ query', occErr);
      continue;
    }

    for (const occ of occs ?? []) {
      const occId = occ.id as string;
      const startAt = occ.scheduled_start_at as string;
      const endAt = occ.scheduled_end_at as string;

      const { data: invs, error: invErr } = await supabase
        .from('trainer_live_session_invites')
        .select('id, invitee_user_id')
        .eq('occurrence_id', occId)
        .eq('status', 'accepted');

      if (invErr || !invs?.length) {
        await supabase
          .from('trainer_live_session_occurrences')
          .update({ [sentCol]: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', occId)
          .is(sentCol, null);
        if (kind === '24h') out.occurrencesFlagged24h += 1;
        else out.occurrencesFlagged1h += 1;
        continue;
      }

      const userIds = [...new Set(invs.map((i) => i.invitee_user_id as string).filter(Boolean))];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const emailByUser = new Map(
        (profs ?? []).map((p) => [p.id as string, (p.email as string | null)?.trim() || ''])
      );

      const when = kind === '24h' ? 'in about 24 hours' : 'in about one hour';
      const subject =
        kind === '24h'
          ? 'Reminder: live session coming up'
          : 'Reminder: live session starting soon';

      let allWithEmailOk = true;
      let attemptedSend = false;

      for (const uid of userIds) {
        const email = emailByUser.get(uid) ?? '';
        if (!email) {
          out.skippedNoEmail += 1;
          continue;
        }
        const name = (profs ?? []).find((p) => p.id === uid)?.full_name?.trim() || 'there';
        const text = `Hi ${name},

Your trainer scheduled a live session starting ${when}.

Starts: ${startAt} (UTC)
Ends: ${endAt} (UTC)

Open your Interval Timers calendar when it is time to join.

— Interval Timers`;

        if (!hasResend) {
          if (import.meta.env.DEV) {
            console.warn(`[live-schedule-reminders] ${kind} no Resend; would email`, email, occId);
          }
          continue;
        }

        attemptedSend = true;
        const ok = await sendResendPlainEmail(email, subject, text);
        if (ok) {
          if (kind === '24h') out.sent24h += 1;
          else out.sent1h += 1;
        } else {
          allWithEmailOk = false;
        }
      }

      const markSent =
        !hasResend && import.meta.env.DEV
          ? true
          : hasResend && attemptedSend && allWithEmailOk
            ? true
            : hasResend && !attemptedSend && userIds.every((uid) => !(emailByUser.get(uid) ?? ''));

      if (markSent) {
        await supabase
          .from('trainer_live_session_occurrences')
          .update({ [sentCol]: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', occId)
          .is(sentCol, null);
        if (kind === '24h') out.occurrencesFlagged24h += 1;
        else out.occurrencesFlagged1h += 1;
      }
    }
  }

  return out;
}
