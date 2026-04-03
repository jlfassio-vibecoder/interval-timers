/**
 * Shared AMRAP exercise list. Parses workout strings (e.g. "15 burpees", "10-12 reps push-ups")
 * and renders the same card layout used in Social session view.
 */

export interface AmrapExerciseListProps {
  workoutList: string[];
  /**
   * Full-width host (e.g. Trainer Live sidebar): multi-column grid on large breakpoints.
   * Default: 2 cols until `lg` then 1 col — for the narrow right rail in the 3-column session shell.
   */
  fullWidthGrid?: boolean;
}

export default function AmrapExerciseList({ workoutList, fullWidthGrid }: AmrapExerciseListProps) {
  if (workoutList.length === 0) {
    return null;
  }

  const gridClass = fullWidthGrid
    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6'
    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6';

  return (
    <ul className={gridClass}>
      {workoutList.map((ex, i) => {
        const match = ex.trim().match(/^(\d+(?:-\d+)?|\d+m)\s+(.+)$/);
        const reps = match ? match[1] : null;
        const name = match ? match[2] : ex.trim();
        return (
          <li
            key={i}
            className="rounded-2xl border border-white/10 bg-black/30 px-6 py-5 sm:px-8 sm:py-6"
          >
            <div className="flex flex-wrap items-baseline gap-2 text-xl font-semibold text-white/95 sm:text-2xl">
              <span className="text-white/50">{i + 1}.</span>
              <span>{name}</span>
              {reps != null && (
                <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-white/80">
                  {reps}
                  {/\d$/.test(reps) ? ` rep${reps === '1' ? '' : 's'}` : ''}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
