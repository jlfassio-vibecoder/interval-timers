/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sortable list of exercises with add/edit/remove/link actions.
 * Uses flat Exercise[] for single-session workouts.
 */

import React, { useCallback } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Exercise } from '@/types/ai-program';
import { normalizeExerciseName } from '@/lib/approved-exercise-maps';
import type { ApprovedExerciseMaps } from '@/lib/approved-exercise-maps';
import ExerciseBlockCard from './ExerciseBlockCard';

export interface ExerciseBlockListProps {
  exercises: Exercise[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onLink: (index: number) => void;
  onAdd: () => void;
  /** When provided with onViewMapped, shows "View mapped exercise" for exercises that match an approved exercise. */
  approvedMaps?: ApprovedExerciseMaps | null;
  onViewMapped?: (index: number) => void;
  /** Called when user clicks Generate (Sparkles) for an exercise. */
  onGenerate?: (index: number) => void;
  /** Called when user edits the Link (exerciseQuery) field. When provided, cards show editable Link input. */
  onExerciseQueryChange?: (index: number, value: string) => void;
  /** Keyed by exercise lookup key (exerciseQuery || exerciseName). When set, cards show a generated-image indicator for overrides with images. */
  exerciseOverrides?: Record<
    string,
    { name?: string; images?: string[]; instructions?: string[] }
  > | null;
}

/** Ensure each exercise has a unique id for DnD. Use index-based id to avoid duplicates when exercises from multiple blocks share ids (e.g. "0","1","2"). */
function ensureId(ex: Exercise, index: number): Exercise {
  const id = ex.id && String(ex.id).length > 8 ? ex.id : `ex-${index}`;
  return { ...ex, id };
}

interface SortableRowProps {
  exercise: Exercise;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onLink: () => void;
  onViewMapped?: () => void;
  onGenerate?: () => void;
  onExerciseQueryChange?: (value: string) => void;
  /** When set (e.g. from workout exerciseOverrides), card shows generated-image indicator. */
  override?: { name?: string; images?: string[]; instructions?: string[] } | null;
}

function SortableRow({
  exercise,
  index,
  onEdit,
  onRemove,
  onLink,
  onViewMapped,
  onGenerate,
  onExerciseQueryChange,
  override,
}: SortableRowProps) {
  const id = exercise.id ?? `ex-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="mt-3 shrink-0 cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <ExerciseBlockCard
          block={exercise}
          onEdit={onEdit}
          onLink={onLink}
          onRemove={onRemove}
          onViewMapped={onViewMapped}
          onGenerate={onGenerate}
          onExerciseQueryChange={onExerciseQueryChange}
          override={override}
        />
      </div>
    </div>
  );
}

const ExerciseBlockList: React.FC<ExerciseBlockListProps> = ({
  exercises,
  onReorder,
  onEdit,
  onRemove,
  onLink,
  onAdd,
  approvedMaps,
  onViewMapped,
  onGenerate,
  onExerciseQueryChange,
  exerciseOverrides,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const itemsWithIds = React.useMemo(() => exercises.map((ex, i) => ensureId(ex, i)), [exercises]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = itemsWithIds.findIndex((ex) => (ex.id ?? '') === active.id);
      const newIndex = itemsWithIds.findIndex((ex) => (ex.id ?? '') === over.id);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        onReorder(oldIndex, newIndex);
      }
    },
    [itemsWithIds, onReorder]
  );

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={itemsWithIds.map((ex) => ex.id ?? '')}
          strategy={verticalListSortingStrategy}
        >
          {itemsWithIds.map((exercise, index) => {
            const matchKey = normalizeExerciseName(
              exercise.exerciseQuery?.trim() || exercise.exerciseName || ''
            );
            const isMapped =
              !!approvedMaps &&
              !!onViewMapped &&
              !!matchKey &&
              approvedMaps.exerciseMap.has(matchKey);
            const overrideKey = exercise.exerciseQuery?.trim() || exercise.exerciseName || '';
            const override = overrideKey ? (exerciseOverrides?.[overrideKey] ?? null) : null;
            return (
              <SortableRow
                key={exercise.id ?? `ex-${index}`}
                exercise={exercise}
                index={index}
                onEdit={() => onEdit(index)}
                onRemove={() => onRemove(index)}
                onLink={() => onLink(index)}
                onViewMapped={isMapped ? () => onViewMapped(index) : undefined}
                onGenerate={onGenerate ? () => onGenerate(index) : undefined}
                onExerciseQueryChange={
                  onExerciseQueryChange ? (value) => onExerciseQueryChange(index, value) : undefined
                }
                override={override}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="hover:border-orange-light/40 hover:bg-orange-light/5 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-black/10 py-4 text-white/60 transition-colors hover:text-orange-light"
      >
        <Plus className="h-5 w-5" />
        <span>Add Exercise</span>
      </button>
    </div>
  );
};

export default ExerciseBlockList;
