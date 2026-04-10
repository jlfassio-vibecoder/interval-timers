/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Edit scheduled live occurrence from unified calendar (P0): times, status, live link, invites, series scope.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import type { UnifiedScheduledLiveOccurrenceItem } from '@/lib/supabase/admin/trainer-unified-calendar';
import { SCHEDULED_LIVE_DEFAULT_CARD_TITLE } from '@/lib/scheduled-live-card-title';
import { safeIanaZone } from '@/lib/performance-lab/trainer-calendar-time';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type { CoachScheduleConflictItem } from '@/lib/supabase/admin/trainer-client-calendar';

export type PendingScheduleConflictPayload = {
  conflicts: CoachScheduleConflictItem[];
  url: string;
  method: 'POST' | 'PATCH';
  basePayload: Record<string, unknown>;
  mode:
    | 'create'
    | 'patch_occurrence'
    | 'patch_series'
    | 'patch_coach'
    | 'patch_occurrence_dnd'
    | 'patch_coach_dnd';
};

type Props = {
  open: boolean;
  event: UnifiedScheduledLiveOccurrenceItem | null;
  viewerTimezone: string;
  rosterOptions: Array<{ id: string; label: string }>;
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

export default function UnifiedScheduledLiveEditDrawer({
  open,
  event,
  viewerTimezone,
  rosterOptions,
  onClose,
  onSaved,
  onSchedulingConflict,
}: Props) {
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'cancelled' | 'completed'>('scheduled');
  const [liveSessionId, setLiveSessionId] = useState('');
  const [displayNameLocal, setDisplayNameLocal] = useState('');
  const [seriesScope, setSeriesScope] = useState<'this' | 'future'>('this');
  const [addInviteeIds, setAddInviteeIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !event) return;
    setStartLocal(isoToDatetimeLocalValue(event.scheduledStartAt, viewerTimezone));
    setEndLocal(isoToDatetimeLocalValue(event.scheduledEndAt, viewerTimezone));
    setStatus(
      event.status === 'cancelled' || event.status === 'completed'
        ? (event.status as 'cancelled' | 'completed')
        : 'scheduled'
    );
    setLiveSessionId(event.liveSessionId ?? '');
    setDisplayNameLocal(event.displayName ?? '');
    setSeriesScope('this');
    setAddInviteeIds(new Set());
    setErr(null);
  }, [open, event, viewerTimezone]);

  const invitedUserIds = useMemo(() => {
    if (!event) return new Set<string>();
    return new Set(
      event.inviteSummaries.map((s) => s.userId).filter((id) => typeof id === 'string' && id.length > 0)
    );
  }, [event]);

  const savePatch = useCallback(
    async (allowOverlap?: boolean) => {
      if (!event) return;
      const startIso = datetimeLocalToUtcIso(startLocal, viewerTimezone);
      const endIso = datetimeLocalToUtcIso(endLocal, viewerTimezone);
      if (!startIso || !endIso || Date.parse(endIso) <= Date.parse(startIso)) {
        setErr('End must be after start.');
        return;
      }

      setBusy(true);
      setErr(null);
      try {
        const auth = await missionControlApiAuthHeaders();

        if (event.seriesId && seriesScope === 'future') {
          const url = `/api/trainer/live-schedule/series/${encodeURIComponent(event.seriesId)}`;
          const basePayload: Record<string, unknown> = {
            rescheduleAnchorOccurrenceId: event.occurrenceId,
            scheduledStartAt: startIso,
            scheduledEndAt: endIso,
          };
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
              mode: 'patch_series',
            });
            return;
          }
          if (!res.ok) {
            setErr(typeof j.error === 'string' ? j.error : 'Failed to update series');
            return;
          }
        } else {
          const url = `/api/trainer/live-schedule/occurrences/${encodeURIComponent(event.occurrenceId)}`;
          const basePayload: Record<string, unknown> = {
            scheduledStartAt: startIso,
            scheduledEndAt: endIso,
            status,
            displayName: displayNameLocal.trim() || null,
          };
          const trimmedLive = liveSessionId.trim();
          if (trimmedLive) {
            basePayload.liveSessionId = trimmedLive;
          } else {
            basePayload.liveSessionId = null;
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
              mode: 'patch_occurrence',
            });
            return;
          }
          if (!res.ok) {
            setErr(typeof j.error === 'string' ? j.error : 'Failed to save');
            return;
          }
        }

        const toAdd = [...addInviteeIds].filter((id) => !invitedUserIds.has(id));
        if (toAdd.length > 0) {
          const invRes = await fetch(
            `/api/trainer/live-schedule/occurrences/${encodeURIComponent(event.occurrenceId)}/invites`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviteeUserIds: toAdd }),
            }
          );
          const invJ = (await invRes.json().catch(() => ({}))) as { error?: string };
          if (!invRes.ok) {
            setErr(typeof invJ.error === 'string' ? invJ.error : 'Saved time but failed to add invites');
            onSaved();
            return;
          }
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
      startLocal,
      endLocal,
      status,
      liveSessionId,
      displayNameLocal,
      seriesScope,
      viewerTimezone,
      addInviteeIds,
      invitedUserIds,
      onClose,
      onSaved,
      onSchedulingConflict,
    ]
  );

  const cancelInvite = useCallback(
    async (inviteId: string) => {
      if (!event) return;
      setBusy(true);
      setErr(null);
      try {
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch(
          `/api/trainer/live-schedule/invites/${encodeURIComponent(inviteId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' }),
          }
        );
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setErr(typeof j.error === 'string' ? j.error : 'Failed to cancel invite');
          return;
        }
        onSaved();
      } catch {
        setErr('Network error');
      } finally {
        setBusy(false);
      }
    },
    [event, onSaved]
  );

  if (!open || !event) return null;

  // Copilot suggestion ignored: swapping to shared Drawer would be a larger refactor; this overlay keeps the current trainer mission-control layout.
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-2 sm:p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-sched-live-edit-title"
        className="flex h-full w-full max-w-md flex-col border-l border-white/15 bg-bg-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="unified-sched-live-edit-title" className="font-heading text-lg font-bold text-white">
            Edit scheduled live
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
          {event.recurrenceSummary ? (
            <p className="text-xs text-teal-200/80">{event.recurrenceSummary}</p>
          ) : null}

          {event.seriesId ? (
            <fieldset className="space-y-2">
              <legend className="text-xs text-white/50">Apply time changes</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
                <input
                  type="radio"
                  name="series-scope"
                  checked={seriesScope === 'this'}
                  disabled={busy}
                  onChange={() => setSeriesScope('this')}
                />
                This occurrence only
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
                <input
                  type="radio"
                  name="series-scope"
                  checked={seriesScope === 'future'}
                  disabled={busy}
                  onChange={() => setSeriesScope('future')}
                />
                This and all future in series
              </label>
            </fieldset>
          ) : null}

          {seriesScope === 'this' ? (
            <div>
              <label className="mb-1 block text-xs text-white/50" htmlFor="sched-edit-display-name">
                Custom title (optional)
              </label>
              <input
                id="sched-edit-display-name"
                type="text"
                value={displayNameLocal}
                onChange={(e) => setDisplayNameLocal(e.target.value)}
                disabled={busy}
                placeholder={`Defaults to ${SCHEDULED_LIVE_DEFAULT_CARD_TITLE}`}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
          ) : (
            <p className="text-xs text-white/45">
              Custom title can be set when &quot;This occurrence only&quot; is selected.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs text-white/50" htmlFor="sched-edit-start">
              Start (your timezone)
            </label>
            <input
              id="sched-edit-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50" htmlFor="sched-edit-end">
              End (your timezone)
            </label>
            <input
              id="sched-edit-end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>

          {seriesScope === 'this' ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-white/50" htmlFor="sched-edit-status">
                  Status
                </label>
                <select
                  id="sched-edit-status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as 'scheduled' | 'cancelled' | 'completed')
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50" htmlFor="sched-edit-live">
                  Linked live session id (optional)
                </label>
                <input
                  id="sched-edit-live"
                  type="text"
                  value={liveSessionId}
                  onChange={(e) => setLiveSessionId(e.target.value)}
                  disabled={busy}
                  placeholder="Clear to unlink"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-white/45">
              Status and live link apply per occurrence; use “This occurrence only” to change them.
            </p>
          )}

          <div>
            <p className="mb-2 text-xs text-white/50">Invites</p>
            <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto rounded border border-white/10 p-2 text-xs">
              {event.inviteSummaries.length === 0 ? (
                <li className="text-white/40">No invites yet</li>
              ) : (
                event.inviteSummaries.map((s) => (
                  <li
                    key={s.inviteId}
                    className="flex items-center justify-between gap-2 text-white/80"
                  >
                    <span className="min-w-0 truncate">
                      {s.label}{' '}
                      <span className="text-white/45">({s.status})</span>
                    </span>
                    {(s.status === 'pending' || s.status === 'waitlisted') && seriesScope === 'this' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelInvite(s.inviteId)}
                        className="shrink-0 text-[10px] text-amber-200/90 underline"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {seriesScope === 'this' && rosterOptions.length > 0 ? (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-white/10 p-2">
                <p className="text-[10px] text-white/40">Add roster clients</p>
                {rosterOptions.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={busy || invitedUserIds.has(r.id)}
                      checked={addInviteeIds.has(r.id)}
                      onChange={() => {
                        setAddInviteeIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          return next;
                        });
                      }}
                    />
                    <span className="text-white/85">{r.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {err ? <p className="text-sm text-red-300">{err}</p> : null}
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void savePatch()}
              className="rounded-lg bg-teal-500/25 px-4 py-2 text-sm font-medium text-teal-100 hover:bg-teal-500/35 disabled:opacity-40"
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
