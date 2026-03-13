/**
 * Shared AMRAP exercise list. Parses workout strings (e.g. "15 burpees", "10-12 reps push-ups")
 * and renders the same card layout used in Social session view.
 */

export interface AmrapExerciseListProps {
  workoutList: string[];
}

export default function AmrapExerciseList({ workoutList }: AmrapExerciseListProps) {
  if (workoutList.length === 0) {
    return null;
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
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
                <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-base font-medium text-white/80 sm:text-lg">
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
