/**
 * Mission Control — library workouts with client assignments (one card per `public.workouts` row).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import type { FactoryMetabolicMode } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import type { FeaturedWorkoutContext } from '@/lib/trainer-live/featured-workout-context';
import type {
  TrainerWorkoutOverviewRow,
  WorkoutAssignmentClientRow,
} from '@/lib/supabase/admin/trainer-client-assignments';
import {
  useFeaturedWorkoutsQuery,
  useUpdateFeaturedWorkoutsMutation,
} from '@/hooks/useFeaturedWorkouts';
import TrainerLibraryWorkoutCard from '@/components/react/trainer/workouts/TrainerLibraryWorkoutCard';

type ClientWorkoutMetabolicFilter = 'all' | FactoryMetabolicMode | 'unlabeled';

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
  const [workoutMetabolicFilter, setWorkoutMetabolicFilter] =
    useState<ClientWorkoutMetabolicFilter>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<
    Array<{ id: string; full_name: string | null; email: string | null }>
  >([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [assignByWorkoutId, setAssignByWorkoutId] = useState<Record<string, string[]>>({});
  const [assignBusyByWorkoutId, setAssignBusyByWorkoutId] = useState<Record<string, boolean>>({});

  const featuredAmrap = useFeaturedWorkoutsQuery('trainer_live_amrap');
  const featuredTabata = useFeaturedWorkoutsQuery('trainer_live_tabata');

  const refetchFeaturedWorkouts = useCallback(async () => {
    await Promise.all([featuredAmrap.refetch(), featuredTabata.refetch()]);
  }, [featuredAmrap.refetch, featuredTabata.refetch]);

  const { mutateAsync: mutateFeaturedWorkouts, pending: featuredUpdatePending } =
    useUpdateFeaturedWorkoutsMutation({
      onSuccess: refetchFeaturedWorkouts,
    });

  const featuredAmrapIds = useMemo(
    () => new Set(featuredAmrap.rows.map((r) => r.workout_id)),
    [featuredAmrap.rows]
  );
  const featuredTabataIds = useMemo(
    () => new Set(featuredTabata.rows.map((r) => r.workout_id)),
    [featuredTabata.rows]
  );

  const applyFeaturedToggle = useCallback(
    async (workoutId: string, context: FeaturedWorkoutContext, enable: boolean) => {
      const currentIds =
        context === 'trainer_live_amrap'
          ? featuredAmrap.rows.map((r) => r.workout_id)
          : featuredTabata.rows.map((r) => r.workout_id);
      const next = enable
        ? currentIds.includes(workoutId)
          ? currentIds
          : [...currentIds, workoutId]
        : currentIds.filter((id) => id !== workoutId);
      try {
        await mutateFeaturedWorkouts({
          p_context: context,
          p_workout_ids: next,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update featured workouts');
      }
    },
    [featuredAmrap.rows, featuredTabata.rows, mutateFeaturedWorkouts]
  );

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

  const filteredWorkouts = useMemo(() => {
    const list = overview?.workouts ?? [];
    if (workoutMetabolicFilter === 'all') return list;
    if (workoutMetabolicFilter === 'unlabeled') {
      return list.filter((w) => w.factoryMetabolicMode == null);
    }
    return list.filter((w) => w.factoryMetabolicMode === workoutMetabolicFilter);
  }, [overview?.workouts, workoutMetabolicFilter]);

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Client Workouts</h1>
        <p className="mt-2 max-w-3xl text-white/60">
          Factory programs saved as a series are grouped with an Open series link; each session can
          be edited or assigned. Assign clients from your roster; open a client in Mission Control
          from the links below.
        </p>
        {!loading && overview && overview.workouts.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label htmlFor="client-workouts-metabolic-filter" className="text-sm text-white/60">
              Factory mode
            </label>
            <select
              id="client-workouts-metabolic-filter"
              value={workoutMetabolicFilter}
              onChange={(e) =>
                setWorkoutMetabolicFilter(e.target.value as ClientWorkoutMetabolicFilter)
              }
              className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm text-white"
            >
              <option value="all">All workouts</option>
              <option value="amrap_density">Density AMRAP</option>
              <option value="tabata_balanced">Balanced Tabata</option>
              <option value="hiit">HIIT</option>
              <option value="emom_factory">EMOM</option>
              <option value="unlabeled">Unlabeled / other</option>
            </select>
          </div>
        ) : null}
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
      ) : !filteredWorkouts.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          <p className="mb-4">No workouts match this factory mode filter.</p>
          <button
            type="button"
            onClick={() => setWorkoutMetabolicFilter('all')}
            className="bg-orange-light/20 inline-block rounded-lg px-4 py-2 text-sm font-bold uppercase text-orange-light transition-colors hover:bg-orange-light hover:text-black"
          >
            Show all workouts
          </button>
        </div>
      ) : (
        (() => {
          const { seriesList, standalone } = buildWorkoutDisplayList(filteredWorkouts);
          const renderWorkoutCard = (w: TrainerWorkoutOverviewRow) => {
            const assigned = overview.assignmentsByWorkoutId[w.id] ?? [];
            const busy = assignBusyByWorkoutId[w.id] ?? false;
            const selected = assignByWorkoutId[w.id] ?? [];
            return (
              <TrainerLibraryWorkoutCard
                workout={w}
                assigned={assigned}
                assignBusy={busy}
                selectedClientIds={selected}
                roster={roster}
                rosterLoading={rosterLoading}
                rosterLabel={rosterLabel}
                onToggleAssignClient={(clientUserId) => toggleAssign(w.id, clientUserId)}
                onAssignSelected={() => void assignWorkoutToClients(w.id)}
                onSelectAllClients={() =>
                  setAssignByWorkoutId((p) => ({
                    ...p,
                    [w.id]: roster.map((x) => x.id),
                  }))
                }
                isFeaturedAmrap={featuredAmrapIds.has(w.id)}
                isFeaturedTabata={featuredTabataIds.has(w.id)}
                featuredUpdatePending={featuredUpdatePending}
                onFeaturedToggle={(ctx, enable) => void applyFeaturedToggle(w.id, ctx, enable)}
              />
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
