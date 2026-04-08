/**
 * Workout list block for Trainer Live embed — used in-shell or overlaid on timer video background.
 */
import type { AmrapSessionEngine } from '@/types/amrap-session';
import AmrapExerciseListEditor from './AmrapExerciseListEditor';

export default function AmrapEmbedExerciseSection({
  engine,
  className,
  maxTwoColumns = false,
}: {
  engine: AmrapSessionEngine;
  className?: string;
  /** Trainer Live embed: cap exercise grid at two columns. */
  maxTwoColumns?: boolean;
}) {
  const { timerPhase, workoutList, slots, isHost, isFreeWorkoutSegment, hostCanEditWorkoutList, onSaveWorkoutList } =
    engine;

  const showEditorHost =
    isHost &&
    (timerPhase === 'waiting' ||
      timerPhase === 'setup' ||
      timerPhase === 'work' ||
      timerPhase === 'finished');

  if (
    workoutList.length === 0 &&
    !showEditorHost &&
    !slots?.rightColumn
  ) {
    return null;
  }

  return (
    <div className={className ?? 'flex w-full flex-col gap-6'}>
      {slots?.rightColumn}

      {(workoutList.length > 0 || showEditorHost) && (
        <div>
          {isFreeWorkoutSegment && timerPhase === 'work' ? (
            <p className="text-sm text-white/70">
              No prescribed list for this segment — the host demonstrates movements for the group.
            </p>
          ) : (
            <AmrapExerciseListEditor
              workoutList={workoutList}
              fullWidthGrid
              maxTwoColumns={maxTwoColumns}
              hostCanEditWorkoutList={hostCanEditWorkoutList}
              onSaveWorkoutList={onSaveWorkoutList}
            />
          )}
        </div>
      )}
    </div>
  );
}
