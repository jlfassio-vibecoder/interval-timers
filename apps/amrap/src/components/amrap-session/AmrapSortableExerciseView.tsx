/**
 * Host-only: exercise cards with drag reorder (same layout as AmrapExerciseList).
 */
import { useCallback, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import {
  ExerciseDragHandle,
  sortableItemStyle,
} from './amrapExerciseSortableUtils';

const LINE_PARSE = /^(\d+(?:-\d+)?|\d+m)\s+(.+)$/;

function SortableViewCard({
  id,
  line,
}: {
  id: string;
  line: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const match = line.trim().match(LINE_PARSE);
  const reps = match ? match[1] : null;
  const name = match ? match[2] : line.trim();

  return (
    <li
      ref={setNodeRef}
      style={sortableItemStyle(transform, transition, isDragging)}
      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="shrink-0 pt-0.5">
          <ExerciseDragHandle attributes={attributes} listeners={listeners} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2 text-xl font-semibold text-white/95 sm:text-2xl">
            <span className="text-white/50">{Number(id) + 1}.</span>
            <span>{name}</span>
            {reps != null && (
              <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-white/80">
                {reps}
                {/\d$/.test(reps) ? ` rep${reps === '1' ? '' : 's'}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function AmrapSortableExerciseView({
  workoutList,
  gridClass,
  onSaveWorkoutList,
}: {
  workoutList: string[];
  gridClass: string;
  onSaveWorkoutList: (
    next: string[]
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = workoutList.map((_, i) => String(i));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(workoutList, oldIndex, newIndex);
      setReorderError(null);
      setReordering(true);
      try {
        const result = await onSaveWorkoutList(next);
        if (!result.ok) {
          setReorderError(result.error ?? 'Could not save order.');
        }
      } finally {
        setReordering(false);
      }
    },
    [workoutList, itemIds, onSaveWorkoutList]
  );

  return (
    <div className="w-full">
      {reorderError ? (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {reorderError}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <ul
            className={`${gridClass} ${reordering ? 'pointer-events-none opacity-80' : ''}`}
            aria-busy={reordering}
          >
            {workoutList.map((line, i) => (
              <SortableViewCard key={String(i)} id={String(i)} line={line} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
