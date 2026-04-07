/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client HUD: accept / decline scheduled live session invite (P0).
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-events';
import { formatTimeInZone } from '@/lib/performance-lab/trainer-calendar-time';
import { getProfileTimezone } from '@/lib/profile-timezone';
import { useAppContext } from '@/contexts/AppContext';

export interface LiveScheduledInviteDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated?: () => void;
}

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
  const startIso = event.metadata?.scheduledAt ?? '';
  const endIso = event.metadata?.scheduledEndAt ?? '';
  const st = event.metadata?.inviteStatus ?? '';
  const waitlistPos = event.metadata?.waitlistPosition;
  const [tz, setTz] = useState('UTC');

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

  const canRespond = st === 'pending' || st === 'waitlisted';

  const post = async (path: 'accept' | 'decline') => {
    if (!inviteId || !user?.uid) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/client/live-schedule/invites/${encodeURIComponent(inviteId)}/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
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
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/45">
          Status: {st || 'unknown'}
        </p>
        {err ? <p className="mt-2 text-sm text-red-300">{err}</p> : null}
        {info ? <p className="mt-2 text-sm text-cyan-200/90">{info}</p> : null}
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
