/**
 * Mission Control — single library workout card (assignments + Live featured toggles).
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { FactoryMetabolicMode } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import type { FeaturedWorkoutContext } from '@/lib/trainer-live/featured-workout-context';
import type {
  TrainerWorkoutOverviewRow,
  WorkoutAssignmentClientRow,
} from '@/lib/supabase/admin/trainer-client-assignments';

export type TrainerLibraryWorkoutCardProps = {
  workout: TrainerWorkoutOverviewRow;
  assigned: WorkoutAssignmentClientRow[];
  assignBusy: boolean;
  selectedClientIds: string[];
  roster: Array<{ id: string; full_name: string | null; email: string | null }>;
  rosterLoading: boolean;
  rosterLabel: (clientUserId: string) => string;
  onToggleAssignClient: (clientUserId: string) => void;
  onAssignSelected: () => void;
  onSelectAllClients: () => void;
  isFeaturedAmrap: boolean;
  isFeaturedTabata: boolean;
  featuredUpdatePending: boolean;
  onFeaturedToggle: (context: FeaturedWorkoutContext, enable: boolean) => void;
};

function factoryModeLabel(m: FactoryMetabolicMode | null | undefined): string {
  if (m === 'amrap_density') return 'Density AMRAP';
  if (m === 'tabata_balanced') return 'Balanced Tabata';
  if (m === 'hiit') return 'HIIT';
  return '';
}

function visibilityClass(v?: string): string {
  if (v === 'assigned') return 'bg-emerald-500/20 text-emerald-200';
  if (v === 'ready') return 'bg-sky-500/20 text-sky-200';
  return 'bg-white/10 text-white/70';
}

const TrainerLibraryWorkoutCard: React.FC<TrainerLibraryWorkoutCardProps> = ({
  workout: w,
  assigned,
  assignBusy: busy,
  selectedClientIds: selected,
  roster,
  rosterLoading,
  rosterLabel,
  onToggleAssignClient,
  onAssignSelected,
  onSelectAllClients,
  isFeaturedAmrap,
  isFeaturedTabata,
  featuredUpdatePending,
  onFeaturedToggle,
}) => {
  const labClientId =
    selected.length === 1
      ? selected[0]
      : selected.length === 0 && assigned[0]
        ? assigned[0].clientUserId
        : '';

  const canFeatureAmrap = w.factoryMetabolicMode === 'amrap_density';
  const canFeatureTabata = w.factoryMetabolicMode === 'tabata_balanced';
  const showFeatureInLiveMenu = canFeatureAmrap || canFeatureTabata;

  return (
    <div className="hover:border-orange-light/40 flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{w.title}</h2>
          <p className="mt-1 text-xs text-white/45">v{w.versionIndex}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {w.durationMinutes != null && (
            <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
              {w.durationMinutes} min
            </span>
          )}
          {showFeatureInLiveMenu ? (
            <details className="group relative">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-white/15 bg-black/30 text-white/70 transition-colors hover:border-white/25 hover:text-white [&::-webkit-details-marker]:hidden"
                aria-label="Feature in Live options"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </summary>
              <div
                className="absolute right-0 z-20 mt-1 min-w-[12.5rem] rounded-lg border border-white/15 bg-zinc-950 py-1 shadow-xl"
                onClick={(e) => {
                  const det = (e.target as HTMLElement).closest('details');
                  if (det) det.open = false;
                }}
              >
                {canFeatureAmrap ? (
                  <button
                    type="button"
                    disabled={featuredUpdatePending}
                    className="block w-full px-3 py-2 text-left text-xs text-white/90 transition-colors hover:bg-white/10 disabled:opacity-40"
                    onClick={() =>
                      onFeaturedToggle('trainer_live_amrap', !isFeaturedAmrap)
                    }
                  >
                    {isFeaturedAmrap
                      ? 'Remove from AMRAP Live featured'
                      : 'Feature in AMRAP Live'}
                  </button>
                ) : null}
                {canFeatureTabata ? (
                  <button
                    type="button"
                    disabled={featuredUpdatePending}
                    className="block w-full px-3 py-2 text-left text-xs text-white/90 transition-colors hover:bg-white/10 disabled:opacity-40"
                    onClick={() =>
                      onFeaturedToggle('trainer_live_tabata', !isFeaturedTabata)
                    }
                  >
                    {isFeaturedTabata
                      ? 'Remove from Tabata Live featured'
                      : 'Feature in Tabata Live'}
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
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
        {factoryModeLabel(w.factoryMetabolicMode) ? (
          <span className="rounded-md bg-orange-light/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-orange-light/95">
            {factoryModeLabel(w.factoryMetabolicMode)}
          </span>
        ) : null}
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
                      onChange={() => onToggleAssignClient(r.id)}
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
                onClick={onAssignSelected}
                className="bg-orange-light/20 rounded-lg px-3 py-2 text-xs font-bold uppercase text-orange-light transition-colors enabled:hover:bg-orange-light enabled:hover:text-black disabled:opacity-40"
              >
                {busy ? 'Assigning…' : 'Assign selected'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSelectAllClients}
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

export default TrainerLibraryWorkoutCard;
