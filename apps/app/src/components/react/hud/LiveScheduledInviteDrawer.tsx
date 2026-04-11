/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client HUD: accept / decline scheduled live session invite (P0) + join when room is linked.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-events';
import { formatTimeInZone } from '@/lib/performance-lab/trainer-calendar-time';
import { getProfileTimezone } from '@/lib/profile-timezone';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  isWithinTrainerLiveJoinWindow,
  trainerLiveClientJoinPath,
} from '@/lib/trainer-live/client-join-window';

export interface LiveScheduledInviteDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated?: () => void;
}

/** Trainer may link `live_session_id` any time before class; poll often so Join appears quickly. */
const POLL_MS = 10_000;

const LiveScheduledInviteDrawer: React.FC<LiveScheduledInviteDrawerProps> = ({
  event,
  onClose,
  onUpdated,
}) => {
  const { user } = useAppContext();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const inviteId = event.metadata?.liveInviteId;
  const occurrenceId = event.metadata?.occurrenceId;
  const startIso = event.metadata?.scheduledAt ?? '';
  const endIso = event.metadata?.scheduledEndAt ?? '';
  const st = event.metadata?.inviteStatus ?? '';
  const waitlistPos = event.metadata?.waitlistPosition;
  const [tz, setTz] = useState('UTC');
  const [resolvedLiveSessionId, setResolvedLiveSessionId] = useState<string | null>(() => {
    const m = event.metadata?.liveSessionId;
    return m != null && String(m).trim() !== '' ? String(m).trim() : null;
  });

  React.useEffect(() => {
    const m = event.metadata?.liveSessionId;
    if (m != null && String(m).trim() !== '') {
      setResolvedLiveSessionId(String(m).trim());
    }
  }, [event.metadata?.liveSessionId]);

  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getProfileTimezone(user.uid)
      .then((t) => {
        if (!cancelled) setTz(t ?? 'UTC');
      })
      .catch(() => {
        if (!cancelled) setTz('UTC');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  /** Trainer may link `live_session_id` after the calendar row was built — poll occurrence row. */
  React.useEffect(() => {
    if (!occurrenceId || st !== 'accepted') return;
    if (resolvedLiveSessionId) return;

    let cancelled = false;

    const pull = async () => {
      const { data, error } = await supabase
        .from('trainer_live_session_occurrences')
        .select('live_session_id')
        .eq('id', occurrenceId)
        .maybeSingle();
      if (cancelled || error) return;
      const raw = data?.live_session_id;
      if (raw != null && String(raw).trim() !== '') {
        setResolvedLiveSessionId(String(raw).trim());
      }
    };

    void pull();
    const id = window.setInterval(() => void pull(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [occurrenceId, st, resolvedLiveSessionId]);

  const effectiveLiveSessionId = resolvedLiveSessionId;
  const canJoin =
    st === 'accepted' &&
    effectiveLiveSessionId != null &&
    startIso.length > 0 &&
    isWithinTrainerLiveJoinWindow(startIso, endIso);

  const canRespond = st === 'pending' || st === 'waitlisted';

  const post = async (path: 'accept' | 'decline') => {
    if (!inviteId || !user?.uid) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/client/live-schedule/invites/${encodeURIComponent(inviteId)}/${path}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        status?: string;
      };
      if (!res.ok) {
        setErr(typeof body.error === 'string' ? body.error : 'Request failed');
        return;
      }
      onUpdated?.();
      if (path === 'accept' && body.status === 'waitlisted') {
        setInfo(
          'This class is full. You’re on the waitlist in order of response; we’ll email you if a spot opens.'
        );
        return;
      }
      onClose();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  const joinHref =
    effectiveLiveSessionId != null ? trainerLiveClientJoinPath(effectiveLiveSessionId) : '#';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-invite-title"
        className="w-full max-w-md rounded-xl border border-white/15 bg-bg-dark p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 id="live-invite-title" className="font-heading text-lg font-bold text-white">
            {st === 'waitlisted' ? 'Live session · waitlist' : 'Live session'}
          </h3>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-white/70">
          {startIso ? (
            <>
              {formatTimeInZone(startIso, tz)}
              {endIso && endIso !== startIso ? (
                <>
                  {' '}
                  – {formatTimeInZone(endIso, tz)}
                </>
              ) : null}
            </>
          ) : (
            'Scheduled time unavailable'
          )}
        </p>
        {st === 'waitlisted' ? (
          <p className="mt-2 text-sm text-amber-100/85">
            {waitlistPos != null
              ? `You’re #${waitlistPos} on the waitlist for this time. Accept to stay on the list, or decline to give up your spot.`
              : 'You’re on the waitlist for this time. Accept to stay on the list, or decline to give up your spot.'}
          </p>
        ) : st === 'pending' ? (
          <p className="mt-2 text-sm text-white/65">
            Your trainer invited you to this scheduled live session. Accept to reserve your spot if capacity allows.
          </p>
        ) : null}
        {st === 'accepted' && !effectiveLiveSessionId ? (
          <p className="mt-2 text-sm text-white/55">
            Your trainer will open the live room before class. This screen checks every few seconds — or refresh your calendar.
          </p>
        ) : null}
        {st === 'accepted' && effectiveLiveSessionId && !canJoin ? (
          <p className="mt-2 text-sm text-white/55">
            Join opens 15 minutes before the scheduled start (and stays available for a few hours after).
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/45">
          Status: {st || 'unknown'}
        </p>
        {err ? <p className="mt-2 text-sm text-red-300">{err}</p> : null}
        {info ? <p className="mt-2 text-sm text-cyan-200/90">{info}</p> : null}
        {canJoin ? (
          <div className="mt-4">
            <a
              href={joinHref}
              className="flex w-full items-center justify-center rounded-lg bg-orange-light/25 px-4 py-3 text-sm font-semibold text-orange-light hover:bg-orange-light/35"
            >
              Join live class
            </a>
          </div>
        ) : null}
        {info ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => !busy && onClose()}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        ) : canRespond ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void post('accept')}
              className="rounded-lg bg-orange-light/25 px-4 py-2 text-sm font-medium text-orange-light hover:bg-orange-light/35 disabled:opacity-40"
            >
              {busy ? '…' : st === 'waitlisted' ? 'Stay on waitlist' : 'Accept'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void post('decline')}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              Decline
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LiveScheduledInviteDrawer;
