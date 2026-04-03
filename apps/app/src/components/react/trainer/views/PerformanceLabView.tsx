/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Performance Lab P0: enrollments, recommended active program, end enrollment, Builder links.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, FlaskConical, ClipboardList } from 'lucide-react';
import { adminPaths } from '@/lib/admin/config';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type { CoachAssignmentListItem } from '@/lib/supabase/admin/trainer-client-assignments';
import PerformanceLabCalendarSection from '@/components/react/trainer/views/PerformanceLabCalendarSection';
import PerformanceLabMessagesSection from '@/components/react/trainer/views/PerformanceLabMessagesSection';
import PerformanceLabWeekSection from '@/components/react/trainer/views/PerformanceLabWeekSection';

type LabTab = 'programs' | 'calendar' | 'week' | 'messages';

type AssignKind = 'program' | 'workout' | 'wod' | 'exercise';

interface PickerItem {
  id: string;
  title: string;
}

interface EnrollmentRow {
  programId: string;
  title: string;
  status: string;
  startDate: string | null;
  source: string | null;
  isRecommended: boolean;
}

interface EnrollmentsResponse {
  recommendedProgramId: string | null;
  enrollments: EnrollmentRow[];
}

const PerformanceLabView: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [labTab, setLabTab] = useState<LabTab>('programs');
  const [data, setData] = useState<EnrollmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<CoachAssignmentListItem[]>([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [assignKind, setAssignKind] = useState<AssignKind>('program');
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [dueOn, setDueOn] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(`/api/trainer/clients/${encodeURIComponent(userId)}/enrollments`, {
        credentials: 'include',
        headers: { ...auth },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load enrollments');
        setData(null);
        return;
      }
      setData(body as EnrollmentsResponse);
    } catch {
      setError('Failed to load enrollments');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAssignments = useCallback(async () => {
    if (!userId) return;
    setAssignLoading(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/assignments`,
        { credentials: 'include', headers: { ...auth } }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignments([]);
        return;
      }
      const list = (body as { assignments?: CoachAssignmentListItem[] }).assignments ?? [];
      setAssignments(list);
    } catch {
      setAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    let cancelled = false;
    const path =
      assignKind === 'program'
        ? '/api/trainer/programs'
        : assignKind === 'workout'
          ? '/api/trainer/workouts'
          : assignKind === 'wod'
            ? '/api/trainer/wods'
            : '/api/trainer/exercises';
    setPickerLoading(true);
    setSelectedResourceId('');
    void (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        if (cancelled) return;
        const r = await fetch(path, { credentials: 'include', headers: { ...auth } });
        const raw = await r.json().catch(() => []);
        if (cancelled) return;
        const arr = Array.isArray(raw) ? raw : [];
        setPickerItems(
          arr
            .map((x: unknown) => {
              const o = x as { id?: string; title?: string; slug?: string };
              const id =
                typeof o.id === 'string'
                  ? o.id
                  : typeof o.slug === 'string'
                    ? o.slug
                    : '';
              return {
                id,
                title: typeof o.title === 'string' && o.title.trim() ? o.title : 'Item',
              };
            })
            .filter((x) => x.id)
        );
      } catch {
        if (!cancelled) setPickerItems([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignKind]);

  const setRecommended = async (programId: string | null) => {
    if (!userId) return;
    setBusy(programId ? `rec:${programId}` : 'rec:clear');
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/active-program`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ programId }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not update');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const createAssignment = async () => {
    if (!userId || !selectedResourceId) return;
    setBusy('assign:create');
    try {
      const auth = await missionControlApiAuthHeaders();
      const bodyPayload =
        assignKind === 'exercise'
          ? {
              assignmentType: 'exercise' as const,
              exerciseSlug: selectedResourceId,
              coachNote: coachNote.trim() || null,
              dueOn: dueOn.trim() || null,
            }
          : {
              assignmentType: assignKind,
              resourceId: selectedResourceId,
            };
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/assignments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not assign');
        return;
      }
      setSelectedResourceId('');
      setCoachNote('');
      setDueOn('');
      await loadAssignments();
      await load();
    } finally {
      setBusy(null);
    }
  };

  const revokeAssignment = async (assignmentId: string) => {
    if (!userId) return;
    if (!window.confirm('Revoke this assignment? The client will no longer see it in notifications.')) {
      return;
    }
    setBusy(`revoke:${assignmentId}`);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/assignments/${encodeURIComponent(assignmentId)}/revoke`,
        { method: 'POST', credentials: 'include', headers: { ...auth } }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not revoke');
        return;
      }
      await loadAssignments();
    } finally {
      setBusy(null);
    }
  };

  const endEnrollment = async (programId: string) => {
    if (!userId) return;
    if (!window.confirm('End this program for the client? They will keep history but enrollment becomes completed.')) {
      return;
    }
    setBusy(`end:${programId}`);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/enrollments/${encodeURIComponent(programId)}/end`,
        { method: 'POST', credentials: 'include', headers: { ...auth } }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not end enrollment');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading Performance Lab…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const enrollments = data?.enrollments ?? [];
  const hasRec = !!data?.recommendedProgramId;

  return (
    <div className="space-y-8">
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setLabTab('programs')}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide ${
            labTab === 'programs'
              ? 'bg-orange-light/20 text-orange-light'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          Programs & assignments
        </button>
        <button
          type="button"
          onClick={() => setLabTab('calendar')}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide ${
            labTab === 'calendar'
              ? 'bg-orange-light/20 text-orange-light'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setLabTab('week')}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide ${
            labTab === 'week'
              ? 'bg-orange-light/20 text-orange-light'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          Week
        </button>
        <button
          type="button"
          onClick={() => setLabTab('messages')}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide ${
            labTab === 'messages'
              ? 'bg-orange-light/20 text-orange-light'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          Messages
        </button>
      </div>

      {labTab === 'calendar' && userId ? (
        <PerformanceLabCalendarSection
          userId={userId}
          assignments={assignments}
          onRefreshAssignments={() => void loadAssignments()}
        />
      ) : null}

      {labTab === 'messages' && userId ? <PerformanceLabMessagesSection userId={userId} /> : null}

      {labTab === 'week' && userId ? <PerformanceLabWeekSection userId={userId} /> : null}

      {labTab === 'programs' ? (
        <>
      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
        <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-orange-light" />
        <div>
          <h2 className="font-heading text-xl font-bold">Programs & enrollments</h2>
          <p className="mt-1 text-sm text-white/60">
            Set the client&apos;s recommended active program (shown in their HUD when valid). End
            enrollments when they should no longer run the program. Edit templates in the Builder.
          </p>
          {hasRec && (
            <button
              type="button"
              disabled={busy === 'rec:clear'}
              onClick={() => void setRecommended(null)}
              className="mt-3 text-sm font-medium text-orange-light underline decoration-orange-light/50 hover:decoration-orange-light disabled:opacity-40"
            >
              Clear recommended active program
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-black/30">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Program</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Start</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Source</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-white/80">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-white/60">
                  No program enrollments for this client on your programs.
                </td>
              </tr>
            ) : (
              enrollments.map((row) => {
                const rowBusyEnd = busy === `end:${row.programId}`;
                const rowBusyRec = busy === `rec:${row.programId}`;
                // user_programs.status is only active|completed (00005_user_programs.sql); no paused/cancelled until schema changes.
                const canSetActive = row.status === 'active';
                return (
                  <tr key={row.programId} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="font-medium">{row.title}</div>
                      {row.isRecommended && (
                        <span className="mt-1 inline-block rounded bg-orange-light/20 px-2 py-0.5 text-xs font-bold uppercase text-orange-light">
                          Recommended active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white/70">{row.status}</td>
                    <td className="px-6 py-4 text-white/70">{formatDate(row.startDate)}</td>
                    <td className="px-6 py-4 text-white/70">{row.source ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canSetActive && !row.isRecommended && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void setRecommended(row.programId)}
                            className="rounded-lg border border-orange-light/40 px-3 py-1.5 text-xs font-bold uppercase text-orange-light hover:bg-orange-light/10 disabled:opacity-40"
                          >
                            {rowBusyRec ? '…' : 'Set active'}
                          </button>
                        )}
                        {canSetActive && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void endEnrollment(row.programId)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
                          >
                            {rowBusyEnd ? '…' : 'End'}
                          </button>
                        )}
                        <a
                          href={`${adminPaths.root}/programs/${row.programId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          Builder
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
        <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-orange-light" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-bold">Assignments</h2>
          <p className="mt-1 text-sm text-white/60">
            Assign programs (enrolls client), workouts, approved WODs, or published exercises. Clients
            see open items in HUD notifications; exercises deep-link to Learn.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Type</label>
              <select
                value={assignKind}
                onChange={(e) => setAssignKind(e.target.value as AssignKind)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="program">Program</option>
                <option value="workout">Workout</option>
                <option value="wod">WOD</option>
                <option value="exercise">Exercise</option>
              </select>
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                {assignKind === 'exercise' ? 'Exercise' : 'Resource'}
              </label>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                disabled={pickerLoading}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="">{pickerLoading ? 'Loading…' : 'Select…'}</option>
                {pickerItems.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            {assignKind === 'exercise' ? (
              <>
                <div className="min-w-[10rem] flex-1">
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">
                    Coach note
                  </label>
                  <input
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-white/50">Due</label>
                  <input
                    type="date"
                    value={dueOn}
                    onChange={(e) => setDueOn(e.target.value)}
                    className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
              </>
            ) : null}
            <button
              type="button"
              disabled={!!busy || !selectedResourceId}
              onClick={() => void createAssignment()}
              className="rounded-lg border border-orange-light/40 bg-orange-light/10 px-4 py-2 font-mono text-xs font-bold uppercase text-orange-light hover:bg-orange-light/20 disabled:opacity-40"
            >
              {busy === 'assign:create' ? '…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-black/30">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-white/80">Assigned</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-white/80">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {assignLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-white/50">
                  Loading assignments…
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-white/60">
                  No active assignments. Use the form above to assign a program, workout, WOD, or
                  exercise.
                </td>
              </tr>
            ) : (
              assignments.map((row) => (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-white/70">{row.assignmentType}</td>
                  <td className="px-6 py-4 font-medium">{row.titleSnapshot}</td>
                  <td className="px-6 py-4 text-white/70">{formatDate(row.assignedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void revokeAssignment(row.id)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
                    >
                      {busy === `revoke:${row.id}` ? '…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/50">Coming soon</p>
        <ul className="mt-2 list-inside list-disc text-sm text-white/45">
          <li>Challenge assignments (Challenge Factory)</li>
        </ul>
      </div>
        </>
      ) : null}
    </div>
  );
};

export default PerformanceLabView;
