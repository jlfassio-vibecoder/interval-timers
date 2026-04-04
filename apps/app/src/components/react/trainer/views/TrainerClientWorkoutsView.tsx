/**
 * Mission Control — library workouts with client assignments (one card per `public.workouts` row).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type {
  TrainerWorkoutOverviewRow,
  WorkoutAssignmentClientRow,
} from '@/lib/supabase/admin/trainer-client-assignments';

type OverviewPayload = {
  workouts: TrainerWorkoutOverviewRow[];
  assignmentsByWorkoutId: Record<string, WorkoutAssignmentClientRow[]>;
};

function buildWorkoutDisplayList(workouts: TrainerWorkoutOverviewRow[]) {
  const seriesMap = new Map<string, TrainerWorkoutOverviewRow[]>();
  const standalone: TrainerWorkoutOverviewRow[] = [];
  for (const w of workouts) {
    if (w.workoutSeriesId) {
      const arr = seriesMap.get(w.workoutSeriesId) ?? [];
      arr.push(w);
      seriesMap.set(w.workoutSeriesId, arr);
    } else {
      standalone.push(w);
    }
  }
  for (const [, arr] of seriesMap) {
    arr.sort((a, b) => (a.sessionIndex ?? 0) - (b.sessionIndex ?? 0));
  }
  const seriesList = [...seriesMap.entries()].map(([seriesId, sessions]) => {
    const sortKey = sessions.reduce(
      (m, s) => Math.max(m, s.createdAt ? new Date(s.createdAt).getTime() : 0),
      0
    );
    return {
      seriesId,
      sessions,
      title: sessions[0]?.seriesTitle ?? sessions[0]?.title ?? 'Workout series',
      sortKey,
    };
  });
  seriesList.sort((a, b) => b.sortKey - a.sortKey);
  standalone.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return { seriesList, standalone };
}

const TrainerClientWorkoutsView: React.FC = () => {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<
    Array<{ id: string; full_name: string | null; email: string | null }>
  >([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [assignByWorkoutId, setAssignByWorkoutId] = useState<Record<string, string[]>>({});
  const [assignBusyByWorkoutId, setAssignBusyByWorkoutId] = useState<Record<string, boolean>>({});

  const loadOverview = useCallback(async () => {
    setLoadError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch('/api/trainer/workouts/client-overview', {
        credentials: 'include',
        headers: { ...auth },
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof (raw as { error?: string }).error === 'string'
            ? (raw as { error: string }).error
            : 'Could not load workouts';
        throw new Error(msg);
      }
      const w = (raw as OverviewPayload).workouts;
      const a = (raw as OverviewPayload).assignmentsByWorkoutId;
      setOverview({
        workouts: Array.isArray(w) ? w : [],
        assignmentsByWorkoutId: a && typeof a === 'object' ? a : {},
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load workouts');
      setOverview({ workouts: [], assignmentsByWorkoutId: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    let cancelled = false;
    setRosterLoading(true);
    void (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const r = await fetch('/api/trainer/roster', {
          credentials: 'include',
          headers: { ...auth },
        });
        const raw = await r.json().catch(() => []);
        if (cancelled) return;
        const arr = Array.isArray(raw) ? raw : [];
        setRoster(
          arr
            .map((row: unknown) => {
              const o = row as { id?: string; full_name?: string | null; email?: string | null };
              return {
                id: typeof o.id === 'string' ? o.id : '',
                full_name: o.full_name ?? null,
                email: o.email ?? null,
              };
            })
            .filter((x) => x.id)
        );
      } catch {
        if (!cancelled) setRoster([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rosterLabel = (id: string) => {
    const r = roster.find((x) => x.id === id);
    return (r?.full_name?.trim() || r?.email?.trim() || id).trim();
  };

  const toggleAssign = (workoutId: string, clientUserId: string) => {
    setAssignByWorkoutId((prev) => {
      const cur = prev[workoutId] ?? [];
      const next = cur.includes(clientUserId)
        ? cur.filter((x) => x !== clientUserId)
        : [...cur, clientUserId];
      return { ...prev, [workoutId]: next };
    });
  };

  const assignWorkoutToClients = async (workoutId: string) => {
    const ids = assignByWorkoutId[workoutId] ?? [];
    if (ids.length === 0) return;
    setAssignBusyByWorkoutId((p) => ({ ...p, [workoutId]: true }));
    const auth = await missionControlApiAuthHeaders();
    let ok = 0;
    let already = 0;
    const failures: { id: string; message: string }[] = [];
    try {
      for (const clientUserId of ids) {
        try {
          const res = await fetch(
            `/api/trainer/clients/${encodeURIComponent(clientUserId)}/assignments`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                assignmentType: 'workout',
                resourceId: workoutId,
              }),
            }
          );
          const body = await res.json().catch(() => ({}));
          const errStr = typeof body.error === 'string' ? body.error : '';
          if (!res.ok) {
            if (/already|duplicate|exists/i.test(errStr)) {
              already += 1;
            } else {
              failures.push({
                id: clientUserId,
                message: errStr || 'Could not assign workout',
              });
            }
          } else {
            ok += 1;
          }
        } catch (err) {
          failures.push({
            id: clientUserId,
            message: err instanceof Error ? err.message : 'Request failed',
          });
        }
      }

      const n = ids.length;
      if (ok === n) {
        toast.success(
          n === 1 ? 'Workout assigned to client.' : `Workout assigned to ${n} clients.`
        );
      } else if (ok > 0 || already > 0) {
        const parts: string[] = [];
        if (ok > 0) parts.push(`Assigned: ${ok}`);
        if (already > 0) parts.push(`Already assigned: ${already}`);
        if (failures.length > 0) {
          const detail = failures
            .slice(0, 3)
            .map((f) => `${rosterLabel(f.id)}: ${f.message}`)
            .join(' · ');
          parts.push(detail);
        }
        toast.warning(parts.join(' · '));
      } else if (already === n) {
        toast.info('Already assigned for selected clients.');
      } else {
        toast.error(
          failures[0]
            ? `${rosterLabel(failures[0].id)}: ${failures[0].message}`
            : 'Could not assign workout'
        );
      }

      if (ok > 0 || already > 0) {
        setAssignByWorkoutId((p) => ({ ...p, [workoutId]: [] }));
        void loadOverview();
      }
    } finally {
      setAssignBusyByWorkoutId((p) => ({ ...p, [workoutId]: false }));
    }
  };

  const visibilityClass = (v?: string) => {
    if (v === 'assigned') return 'bg-emerald-500/20 text-emerald-200';
    if (v === 'ready') return 'bg-sky-500/20 text-sky-200';
    return 'bg-white/10 text-white/70';
  };

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Client Workouts</h1>
        <p className="mt-2 max-w-3xl text-white/60">
          Factory programs saved as a series are grouped with an Open series link; each session can
          be edited or assigned. Assign clients from your roster; open a client in Mission Control
          from the links below.
        </p>
      </header>

      {loadError && (
        <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        </div>
      ) : !overview?.workouts.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          <p className="mb-4">No workouts in your library yet.</p>
          <NavLink
            to="/workouts/factory"
            className="bg-orange-light/20 inline-block rounded-lg px-4 py-2 text-sm font-bold uppercase text-orange-light transition-colors hover:bg-orange-light hover:text-black"
          >
            Generate in Workout Factory
          </NavLink>
        </div>
      ) : (
        (() => {
          const { seriesList, standalone } = buildWorkoutDisplayList(overview.workouts);
          const renderWorkoutCard = (w: TrainerWorkoutOverviewRow) => {
            const assigned = overview.assignmentsByWorkoutId[w.id] ?? [];
            const busy = assignBusyByWorkoutId[w.id] ?? false;
            const selected = assignByWorkoutId[w.id] ?? [];
            const labClientId =
              selected.length === 1
                ? selected[0]
                : selected.length === 0 && assigned[0]
                  ? assigned[0].clientUserId
                  : '';
            return (
              <div className="hover:border-orange-light/40 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold leading-tight">{w.title}</h2>
                    <p className="mt-1 text-xs text-white/45">v{w.versionIndex}</p>
                  </div>
                  {w.durationMinutes != null && (
                    <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                      {w.durationMinutes} min
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <NavLink
                    to={`/workouts/${encodeURIComponent(w.id)}/edit`}
                    className="hover:bg-orange-light/20 inline-block rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:text-orange-light"
                  >
                    Edit workout
                  </NavLink>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {w.source && (
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide text-white/60">
                      {w.source}
                    </span>
                  )}
                  {w.visibility && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${visibilityClass(w.visibility)}`}
                    >
                      {w.visibility}
                    </span>
                  )}
                </div>
                <div className="mb-4 flex-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    Assigned clients
                  </p>
                  {assigned.length === 0 ? (
                    <p className="text-sm text-white/40">None yet</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {assigned.map((a) => (
                        <li key={a.assignmentId}>
                          <NavLink
                            to={`/roster/${encodeURIComponent(a.clientUserId)}`}
                            className="text-orange-light hover:underline"
                          >
                            {a.clientName}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    Assign to clients
                  </p>
                  {rosterLoading ? (
                    <p className="text-sm text-white/50">Loading roster…</p>
                  ) : roster.length === 0 ? (
                    <p className="text-sm text-white/50">No clients on your roster yet.</p>
                  ) : (
                    <>
                      <div className="mb-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                        {roster.map((r) => {
                          const checked = selected.includes(r.id);
                          return (
                            <label
                              key={r.id}
                              className="flex cursor-pointer items-center gap-2 text-sm text-white/80"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-white/30 bg-black/40"
                                checked={checked}
                                disabled={busy}
                                onChange={() => toggleAssign(w.id, r.id)}
                              />
                              <span>{rosterLabel(r.id)}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || selected.length === 0}
                          onClick={() => void assignWorkoutToClients(w.id)}
                          className="bg-orange-light/20 rounded-lg px-3 py-2 text-xs font-bold uppercase text-orange-light transition-colors enabled:hover:bg-orange-light enabled:hover:text-black disabled:opacity-40"
                        >
                          {busy ? 'Assigning…' : 'Assign selected'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setAssignByWorkoutId((p) => ({
                              ...p,
                              [w.id]: roster.map((x) => x.id),
                            }))
                          }
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold uppercase transition-colors hover:bg-white/20 disabled:opacity-40"
                        >
                          Select all
                        </button>
                        {labClientId ? (
                          <NavLink
                            to={`/roster/${encodeURIComponent(labClientId)}/lab?prefillWorkout=${encodeURIComponent(w.id)}`}
                            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold uppercase transition-colors hover:bg-white/20"
                          >
                            Performance Lab
                          </NavLink>
                        ) : (
                          <span
                            className="cursor-not-allowed rounded-lg bg-white/5 px-3 py-2 text-xs font-bold uppercase text-white/30"
                            title="Pick exactly one client above, or assign a client first"
                          >
                            Performance Lab
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {seriesList.map((group) => (
                <div
                  key={group.seriesId}
                  className="col-span-1 flex flex-col gap-4 md:col-span-2 xl:col-span-3"
                >
                  <div className="border-orange-light/25 bg-orange-light/5 rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-heading text-xl font-bold text-white">{group.title}</h2>
                      <NavLink
                        to={`/workouts/series/${encodeURIComponent(group.seriesId)}`}
                        className="bg-orange-light/20 rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-orange-light transition-colors hover:bg-orange-light hover:text-black"
                      >
                        Open series
                      </NavLink>
                    </div>
                    <p className="mt-1 text-xs text-white/50">{group.sessions.length} session(s)</p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {group.sessions.map((w) => (
                      <React.Fragment key={w.id}>{renderWorkoutCard(w)}</React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {standalone.map((w) => (
                <React.Fragment key={w.id}>{renderWorkoutCard(w)}</React.Fragment>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
};

export default TrainerClientWorkoutsView;
