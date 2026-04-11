/**
 * Workout list for Trainer Live Tabata embed — in-shell or overlaid on timer video background.
 */
import type { TabataEngine } from '@/types/tabata-session';
import AmrapExerciseListEditor from '@/components/amrap-session/AmrapExerciseListEditor';

export default function TabataEmbedExerciseSection({
  engine,
  className,
  maxTwoColumns = false,
}: {
  engine: TabataEngine;
  className?: string;
  maxTwoColumns?: boolean;
}) {
  const { workoutList, isTrainer, hostCanEditWorkoutList, onSaveWorkoutList } = engine;

  const showEditorHost = !!isTrainer && !!hostCanEditWorkoutList && !!onSaveWorkoutList;

  if (workoutList.length === 0 && !showEditorHost) {
    return null;
  }

  return (
    <div className={className ?? 'flex w-full flex-col gap-6'}>
      <div>
        <AmrapExerciseListEditor
          workoutList={workoutList}
          fullWidthGrid
          maxTwoColumns={maxTwoColumns}
          hostCanEditWorkoutList={hostCanEditWorkoutList}
          onSaveWorkoutList={onSaveWorkoutList}
        />
      </div>
    </div>
  );
}
