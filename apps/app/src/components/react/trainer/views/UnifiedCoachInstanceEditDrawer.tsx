/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Edit coach schedule instance from unified calendar (P1).
 */

import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { UnifiedCalendarItem } from '@/lib/supabase/admin/trainer-unified-calendar';
import { safeIanaZone } from '@/lib/performance-lab/trainer-calendar-time';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type { CoachScheduleConflictItem } from '@/lib/supabase/admin/trainer-client-calendar';
import type { PendingScheduleConflictPayload } from '@/components/react/trainer/views/UnifiedScheduledLiveEditDrawer';

type CoachEv = UnifiedCalendarItem & { kind: 'coach_instance' };

type AssignmentOpt = { id: string; titleSnapshot: string };

type Props = {
  open: boolean;
  event: (CoachEv & { clientUserId: string; clientLabel: string }) | null;
  viewerTimezone: string;
  onClose: () => void;
  onSaved: () => void;
  onSchedulingConflict: (pending: PendingScheduleConflictPayload) => void;
};

function isoToDatetimeLocalValue(isoUtc: string, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromISO(isoUtc, { setZone: true });
  if (!dt.isValid) return '';
  return dt.setZone(z).toFormat("yyyy-MM-dd'T'HH:mm");
}

function datetimeLocalToUtcIso(value: string, zone: string): string | null {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromISO(value, { zone: z });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}

export default function UnifiedCoachInstanceEditDrawer({
  open,
  event,
  viewerTimezone,
  onClose,
  onSaved,
  onSchedulingConflict,
}: Props) {
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [liveSessionId, setLiveSessionId] = useState('');
  const [assignments, setAssignments] = useState<AssignmentOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !event) return;
    setScheduledLocal(isoToDatetimeLocalValue(event.scheduledAt, viewerTimezone));
    setAssignmentId(event.assignmentId);
    setLiveSessionId(event.trainerLiveSessionId ?? '');
    setErr(null);
  }, [open, event, viewerTimezone]);

  useEffect(() => {
    if (!open || !event) return;
    let cancelled = false;
    (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch(
          `/api/trainer/clients/${encodeURIComponent(event.clientUserId)}/assignments`,
          { credentials: 'include', headers: { ...auth } }
        );
        const j = (await res.json().catch(() => ({}))) as {
          assignments?: AssignmentOpt[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setAssignments([]);
          return;
        }
        setAssignments(Array.isArray(j.assignments) ? j.assignments : []);
      } catch {
        if (!cancelled) setAssignments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, event]);

  const save = useCallback(
    async (allowOverlap?: boolean) => {
      if (!event) return;
      const scheduledAt = datetimeLocalToUtcIso(scheduledLocal, viewerTimezone);
      if (!scheduledAt) {
        setErr('Invalid date/time.');
        return;
      }
      const aid = assignmentId.trim();
      if (!aid) {
        setErr('Pick an assignment.');
        return;
      }

      setBusy(true);
      setErr(null);
      try {
        const auth = await missionControlApiAuthHeaders();
        const url = `/api/trainer/clients/${encodeURIComponent(event.clientUserId)}/calendar/instances/${encodeURIComponent(event.instanceId)}`;
        const basePayload: Record<string, unknown> = {
          scheduledAt,
          assignmentId: aid,
        };
        const trimmedLive = liveSessionId.trim();
        if (trimmedLive) {
          basePayload.trainerLiveSessionId = trimmedLive;
        } else {
          basePayload.trainerLiveSessionId = null;
        }
        const body = allowOverlap ? { ...basePayload, allowOverlap: true } : basePayload;
        const res = await fetch(url, {
          method: 'PATCH',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          conflicts?: CoachScheduleConflictItem[];
        };
        if (
          res.status === 409 &&
          Array.isArray(j.conflicts) &&
          j.conflicts.length > 0 &&
          !allowOverlap
        ) {
          onSchedulingConflict({
            conflicts: j.conflicts,
            url,
            method: 'PATCH',
            basePayload,
            mode: 'patch_coach',
          });
          return;
        }
        if (!res.ok) {
          setErr(typeof j.error === 'string' ? j.error : 'Failed to save');
          return;
        }
        onSaved();
        onClose();
      } catch {
        setErr('Network error');
      } finally {
        setBusy(false);
      }
    },
    [
      event,
      scheduledLocal,
      assignmentId,
      liveSessionId,
      viewerTimezone,
      onClose,
      onSaved,
      onSchedulingConflict,
    ]
  );

  if (!open || !event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-2 sm:p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-coach-edit-title"
        className="flex h-full w-full max-w-md flex-col border-l border-white/15 bg-bg-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="unified-coach-edit-title" className="font-heading text-lg font-bold text-white">
            Edit coach instance
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="text-sm text-white/70">
            Client: <span className="text-orange-light/95">{event.clientLabel}</span>
          </p>

          <div>
            <label className="mb-1 block text-xs text-white/50" htmlFor="coach-edit-when">
              Scheduled (your timezone)
            </label>
            <input
              id="coach-edit-when"
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50" htmlFor="coach-edit-asg">
              Assignment
            </label>
            <select
              id="coach-edit-asg"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={busy || assignments.length === 0}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {assignments.length === 0 ? (
                <option value={event.assignmentId}>{event.title}</option>
              ) : (
                assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titleSnapshot}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50" htmlFor="coach-edit-live">
              Linked live session id (optional)
            </label>
            <input
              id="coach-edit-live"
              type="text"
              value={liveSessionId}
              onChange={(e) => setLiveSessionId(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
            />
          </div>

          {err ? <p className="text-sm text-red-300">{err}</p> : null}
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-orange-light/25 px-4 py-2 text-sm font-medium text-orange-light hover:bg-orange-light/35 disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
