/**
 * Host-only edit mode for AMRAP workout lines (reps + movement), with read-only view.
 */
import { useCallback, useEffect, useState } from 'react';
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
import AmrapExerciseList from './AmrapExerciseList';
import AmrapSortableExerciseView from './AmrapSortableExerciseView';
import {
  ExerciseDragHandle,
  sortableItemStyle,
} from './amrapExerciseSortableUtils';

export type AmrapExerciseListEditorProps = {
  workoutList: string[];
  fullWidthGrid?: boolean;
  maxTwoColumns?: boolean;
  hostCanEditWorkoutList?: boolean;
  onSaveWorkoutList?: (
    workoutList: string[]
  ) => Promise<{ ok: boolean; error?: string }>;
};

const LINE_RE = /^(\d+(?:-\d+)?|\d+m)\s+(.+)$/;

function parseLine(line: string): { reps: string; name: string } {
  const t = line.trim();
  const m = t.match(LINE_RE);
  if (m) {
    return { reps: m[1], name: m[2].trim() };
  }
  return { reps: '', name: t };
}

function formatLine(reps: string, name: string): string {
  const n = name.trim();
  const r = reps.trim();
  if (!n) return '';
  if (r) return `${r} ${n}`;
  return n;
}

function toRows(list: string[]): { reps: string; name: string }[] {
  if (list.length === 0) return [{ reps: '', name: '' }];
  return list.map((line) => parseLine(line));
}

function SortableEditRow({
  id,
  index,
  row,
  rowsLength,
  onUpdate,
  onRemove,
}: {
  id: string;
  index: number;
  row: { reps: string; name: string };
  rowsLength: number;
  onUpdate: (index: number, patch: Partial<{ reps: string; name: string }>) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={sortableItemStyle(transform, transition, isDragging)}
      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ExerciseDragHandle attributes={attributes} listeners={listeners} />
          <span className="text-sm font-bold text-white/50">{index + 1}.</span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={rowsLength <= 1}
          className="text-xs font-semibold text-red-400/90 hover:text-red-300 disabled:opacity-30"
        >
          Remove
        </button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Reps
          </span>
          <input
            type="text"
            value={row.reps}
            onChange={(e) => onUpdate(index, { reps: e.target.value })}
            placeholder="e.g. 15"
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </label>
        <label className="flex min-w-0 flex-[2] flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Exercise
          </span>
          <input
            type="text"
            value={row.name}
            onChange={(e) => onUpdate(index, { name: e.target.value })}
            placeholder="e.g. burpees"
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </label>
      </div>
    </li>
  );
}

export default function AmrapExerciseListEditor({
  workoutList,
  fullWidthGrid,
  maxTwoColumns,
  hostCanEditWorkoutList,
  onSaveWorkoutList,
}: AmrapExerciseListEditorProps) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<{ reps: string; name: string }[]>(() =>
    toRows(workoutList)
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setRows(toRows(workoutList));
    }
  }, [workoutList, editing]);

  const canEdit = !!hostCanEditWorkoutList && !!onSaveWorkoutList;

  const handleCancel = useCallback(() => {
    setRows(toRows(workoutList));
    setSaveError(null);
    setEditing(false);
  }, [workoutList]);

  const handleSave = useCallback(async () => {
    if (!onSaveWorkoutList) return;
    const lines = rows
      .map((row) => formatLine(row.reps, row.name))
      .filter((s) => s.length > 0);
    setSaveError(null);
    setSaving(true);
    try {
      const result = await onSaveWorkoutList(lines);
      if (result.ok) {
        setEditing(false);
      } else {
        setSaveError(result.error ?? 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }, [onSaveWorkoutList, rows]);

  const updateRow = useCallback(
    (index: number, patch: Partial<{ reps: string; name: string }>) => {
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { reps: '', name: '' }]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const editSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleEditDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const ids = prev.map((_, i) => String(i));
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  if (!canEdit) {
    return (
      <AmrapExerciseList
        workoutList={workoutList}
        fullWidthGrid={fullWidthGrid}
        maxTwoColumns={maxTwoColumns}
      />
    );
  }

  if (!editing && workoutList.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRows([{ reps: '', name: '' }]);
              setSaveError(null);
              setEditing(true);
            }}
            className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-600/30"
          >
            Edit workout
          </button>
        </div>
        <p className="text-sm text-white/60">No exercises in this workout yet. Tap Edit to add.</p>
      </div>
    );
  }

  const gridClass = fullWidthGrid
    ? maxTwoColumns
      ? 'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6'
      : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6'
    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6';

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setRows(toRows(workoutList));
                setSaveError(null);
                setEditing(true);
              }}
              className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-600/30"
            >
              Edit workout
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                aria-busy={saving}
                className="rounded-xl border border-orange-500 bg-orange-600/40 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600/60 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white/90 transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {saveError ? (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}

      {!editing ? (
        <AmrapSortableExerciseView
          workoutList={workoutList}
          gridClass={gridClass}
          onSaveWorkoutList={onSaveWorkoutList!}
        />
      ) : (
        <DndContext
          sensors={editSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleEditDragEnd}
        >
          <SortableContext
            items={rows.map((_, i) => String(i))}
            strategy={rectSortingStrategy}
          >
            <ul className={gridClass}>
              {rows.map((row, i) => (
                <SortableEditRow
                  key={String(i)}
                  id={String(i)}
                  index={i}
                  row={row}
                  rowsLength={rows.length}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {editing ? (
        <button
          type="button"
          onClick={addRow}
          className="mt-4 rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:bg-white/10"
        >
          Add exercise
        </button>
      ) : null}
    </div>
  );
}
