import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
  AMRAP_WORKOUT_LIBRARY,
  AMRAP_LEVEL_DURATION,
  AMRAP_PROTOCOL_LABELS,
  AMRAP_BUILD_TEMPLATES,
  EXERCISE_SUGGESTIONS,
  getTemplatesForDuration,
  isDurationInRange,
  getRecommendedDurationForTemplate,
} from './amrap-setup-data';
import type { AmrapBuildTemplate } from './amrap-setup-data';
import type { RecentCustomWorkout } from '@/lib/recentCustomWorkouts';
import type { AmrapLevel } from './amrap-setup-data';
import type { CustomExercise } from './useAmrapSetup';
import { isValidQty, formatQtyHint } from '@/lib/exerciseFormat';

/** Protocol step: General AMRAP + three level buttons (Beginner, Intermediate, Advanced). */
export interface AmrapProtocolStepProps {
  onStartWithGeneral: () => void;
  onSelectLevel: (level: AmrapLevel) => void;
}

export function AmrapProtocolStep({
  onStartWithGeneral,
  onSelectLevel,
}: AmrapProtocolStepProps) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onStartWithGeneral}
        className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
      >
        <div>
          <div className="text-lg font-bold text-white group-hover:text-orange-400">
            {AMRAP_PROTOCOL_LABELS.generalAmrap}
          </div>
          <div className="mt-1 text-xs font-medium text-white/70">
            {AMRAP_PROTOCOL_LABELS.generalAmrapDesc}
          </div>
        </div>
        <div className="text-2xl opacity-50 transition-transform group-hover:scale-110 group-hover:opacity-100">
          ⏱️
        </div>
      </button>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelectLevel('beginner')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">{AMRAP_PROTOCOL_LABELS.beginner}</div>
          <div className="text-[10px] text-white/70">{AMRAP_PROTOCOL_LABELS.beginnerDesc}</div>
        </button>
        <button
          type="button"
          onClick={() => onSelectLevel('intermediate')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">
            {AMRAP_PROTOCOL_LABELS.intermediate}
          </div>
          <div className="text-[10px] text-white/70">
            {AMRAP_PROTOCOL_LABELS.intermediateDesc}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectLevel('advanced')}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="mb-1 font-bold text-white">{AMRAP_PROTOCOL_LABELS.advanced}</div>
          <div className="text-[10px] text-white/70">{AMRAP_PROTOCOL_LABELS.advancedDesc}</div>
        </button>
      </div>
    </div>
  );
}

/** Workout step: grid of workouts for the selected level. */
export interface AmrapWorkoutStepProps {
  selectedLevel: AmrapLevel | null;
  onStartWithWorkout: (durationMinutes: number, workoutList: string[]) => void;
}

export function AmrapWorkoutStep({
  selectedLevel,
  onStartWithWorkout,
}: AmrapWorkoutStepProps) {
  if (!selectedLevel) return null;

  const duration = AMRAP_LEVEL_DURATION[selectedLevel];
  const workouts = AMRAP_WORKOUT_LIBRARY[selectedLevel];

  return (
    <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
      {workouts.map((option) => (
        <button
          type="button"
          key={option.name}
          onClick={() => onStartWithWorkout(duration, [...option.exercises])}
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/10"
        >
          <div className="font-bold text-white">{option.name}</div>
          <div className="mt-1 line-clamp-2 text-[10px] text-white/70">
            {option.exercises.join(' → ')}
          </div>
        </button>
      ))}
    </div>
  );
}

/** Duration step with presets and custom "Other" input. */
function DurationStep({
  onSelectDuration,
}: {
  onSelectDuration: (minutes: number) => void;
}) {
  const [customMinutes, setCustomMinutes] = useState('');
  const [showOther, setShowOther] = useState(false);

  const parsedCustomMinutes = Number(customMinutes);
  const isValidCustomMinutes =
    Number.isFinite(parsedCustomMinutes) &&
    Number.isInteger(parsedCustomMinutes) &&
    parsedCustomMinutes >= 1 &&
    parsedCustomMinutes <= 60;

  const handleOtherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidCustomMinutes) {
      onSelectDuration(parsedCustomMinutes);
    }
  };

  const templates5 = getTemplatesForDuration(5);
  const templates15 = getTemplatesForDuration(15);
  const templates20 = getTemplatesForDuration(20);
  const customMinsNum = isValidCustomMinutes ? parsedCustomMinutes : null;
  const templatesCustom = customMinsNum != null ? getTemplatesForDuration(customMinsNum) : [];

  const formatBestFor = (templates: typeof templates5) =>
    templates.length > 0
      ? `Best for: ${templates.map((t) => t.name).join(', ')}`
      : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onSelectDuration(5)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
      >
        <div className="text-lg font-bold text-white">Sprint (5 Mins)</div>
        <div className="text-xs font-medium text-white/60">
          High intensity, zero rest
        </div>
        {formatBestFor(templates5) && (
          <div className="mt-0.5 text-[10px] text-orange-400/80">
            {formatBestFor(templates5)}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSelectDuration(15)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
      >
        <div className="text-lg font-bold text-white">Standard (15 Mins)</div>
        <div className="text-xs font-medium text-white/60">
          Classic CrossFit time domain
        </div>
        {formatBestFor(templates15) && (
          <div className="mt-0.5 text-[10px] text-orange-400/80">
            {formatBestFor(templates15)}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSelectDuration(20)}
        className="group w-full rounded-xl border-2 border-white/10 p-4 text-left transition-all hover:border-orange-500 hover:bg-orange-600/20"
      >
        <div className="text-lg font-bold text-white">Endurance (20 Mins)</div>
        <div className="text-xs font-medium text-white/60">
          Pacing is critical
        </div>
        {formatBestFor(templates20) && (
          <div className="mt-0.5 text-[10px] text-orange-400/80">
            {formatBestFor(templates20)}
          </div>
        )}
      </button>
      {!showOther ? (
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className="w-full rounded-xl border border-dashed border-white/20 p-3 text-sm text-white/60 transition-colors hover:border-orange-500/50 hover:text-white/80"
        >
          Other (1–60 min)
        </button>
      ) : (
        <form onSubmit={handleOtherSubmit} className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="custom-duration" className="mb-1 block text-xs text-white/60">
                Custom duration (1–60 min)
              </label>
              <input
                id="custom-duration"
                type="number"
                min={1}
                max={60}
                step={1}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="e.g. 10"
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                aria-label="Custom duration in minutes"
              />
            </div>
            <button
              type="submit"
              disabled={!isValidCustomMinutes}
              className="min-h-[44px] shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50"
            >
              Set
            </button>
          </div>
          {templatesCustom.length > 0 && (
            <p className="text-[10px] text-orange-400/80">
              Suggested templates: {templatesCustom.map((t) => t.name).join(', ')}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function ExerciseListItemContent({
  ex,
  index,
  onRemove,
}: {
  ex: CustomExercise;
  index: number;
  onRemove: () => void;
}) {
  const reps = ex.qty || null;
  const displayName = ex.name || '?';
  return (
    <>
      <span className="text-white/50">{index + 1}.</span>
      <span className="min-w-0 flex-1 truncate font-medium text-white">
        {displayName}
      </span>
      {reps != null && reps !== '' && (
        <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-sm font-medium text-white/80">
          {reps}
          {/\d$/.test(reps) ? ` rep${reps === '1' ? '' : 's'}` : ''}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label={`Remove ${displayName}`}
      >
        ×
      </button>
    </>
  );
}

function ExerciseListItem({
  ex,
  index,
  onRemove,
}: {
  ex: CustomExercise;
  index: number;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <ExerciseListItemContent ex={ex} index={index} onRemove={onRemove} />
    </li>
  );
}

function SortableExerciseItem({
  id,
  ex,
  index,
  onRemove,
}: {
  id: string;
  ex: CustomExercise;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <ExerciseListItemContent ex={ex} index={index} onRemove={onRemove} />
    </li>
  );
}

function ExerciseSortableList({
  customExercises,
  onRemoveExercise,
  onReorder,
}: {
  customExercises: CustomExercise[];
  onRemoveExercise: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  const itemIds = useMemo(
    () => customExercises.map((ex) => ex.id),
    [customExercises]
  );
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = customExercises.findIndex((ex) => ex.id === active.id);
      const newIndex = customExercises.findIndex((ex) => ex.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        onReorder(oldIndex, newIndex);
      }
    },
    [customExercises, onReorder]
  );

  return (
    <ul
      className="grid max-h-[30vh] grid-cols-1 gap-3 overflow-y-auto"
      aria-live="polite"
      aria-label="Exercise list"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {customExercises.map((ex, i) => (
            <SortableExerciseItem
              key={ex.id}
              id={ex.id}
              ex={ex}
              index={i}
              onRemove={() => onRemoveExercise(i)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </ul>
  );
}

/** General build flow: Step 1 (Duration) and Step 2 (Builder) with qty/name inputs. */
export interface AmrapBuildWorkoutStepProps {
  buildStep: 'duration' | 'builder';
  selectedDuration: number | null;
  customExercises: CustomExercise[];
  onSelectDuration: (minutes: number) => void;
  onAddExercise: (qty: string, name: string) => void;
  onRemoveExercise: (index: number) => void;
  onReorderExercises?: (fromIndex: number, toIndex: number) => void;
  onLoadTemplate?: (
    template: AmrapBuildTemplate,
    options?: { adjustDuration?: number }
  ) => void;
  onLoadRecent?: (durationMinutes: number, workoutList: string[]) => void;
  recentWorkouts?: RecentCustomWorkout[];
  onLaunch: () => void;
  onBackToDuration: () => void;
  qtyInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AmrapBuildWorkoutStep({
  buildStep,
  selectedDuration,
  customExercises,
  onSelectDuration,
  onAddExercise,
  onRemoveExercise,
  onReorderExercises,
  onLoadTemplate,
  onLoadRecent,
  recentWorkouts = [],
  onLaunch,
  onBackToDuration,
  qtyInputRef,
}: AmrapBuildWorkoutStepProps) {
  const [qty, setQty] = useState('');
  const [name, setName] = useState('');
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [duplicateWarn, setDuplicateWarn] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<AmrapBuildTemplate | null>(null);

  // Focus qty input when transitioning to builder sub-step
  useEffect(() => {
    if (buildStep === 'builder' && selectedDuration != null) {
      const t = requestAnimationFrame(() => {
        qtyInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(t);
    }
  }, [buildStep, selectedDuration, qtyInputRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQtyError(null);
    setDuplicateWarn(null);
    const q = qty.trim();
    const n = name.trim();
    if (!n) return;
    if (q && !isValidQty(q)) {
      setQtyError(`Use format ${formatQtyHint()}`);
      return;
    }
    const normName = n.toLowerCase();
    const isDuplicate = customExercises.some(
      (ex) => ex.name.trim().toLowerCase() === normName
    );
    if (isDuplicate) {
      setDuplicateWarn(`${n} already in list`);
      return;
    }
    onAddExercise(q, n);
    setQty('');
    setName('');
    requestAnimationFrame(() => qtyInputRef.current?.focus());
  };

  if (buildStep === 'duration') {
    return (
      <DurationStep onSelectDuration={onSelectDuration} />
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBackToDuration}
        className="text-sm text-white/60 hover:text-orange-400"
      >
        ← Back to duration
      </button>

      {onLoadRecent && recentWorkouts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-white/60">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recentWorkouts.map((r) => (
              <button
                key={r.completedAt}
                type="button"
                onClick={() => onLoadRecent(r.durationMinutes, r.workoutList)}
                className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-left text-sm text-white/90 transition-colors hover:border-orange-500/50 hover:bg-orange-600/20"
                title={`${r.durationMinutes}m: ${r.workoutList.join(', ')}`}
              >
                {r.durationMinutes}m · {r.workoutList.slice(0, 3).join(', ')}
                {r.workoutList.length > 3 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {onLoadTemplate && AMRAP_BUILD_TEMPLATES.length > 0 && selectedDuration != null && (
        <div>
          {(() => {
            const recommended = AMRAP_BUILD_TEMPLATES.filter((t) =>
              isDurationInRange(selectedDuration, t)
            );
            const other = AMRAP_BUILD_TEMPLATES.filter(
              (t) => !isDurationInRange(selectedDuration, t)
            );
            const formatDurationRange = (t: AmrapBuildTemplate) => {
              const [min, max] = t.durationRange;
              if (t.durationRangeBeginner) {
                const [bMin, bMax] = t.durationRangeBeginner;
                return `${min}-${max} min (or ${bMin}-${bMax} beginner)`;
              }
              return `${min}${min !== max ? `–${max}` : ''} min`;
            };
            const handleTemplateClick = (t: AmrapBuildTemplate) => {
              if (isDurationInRange(selectedDuration, t)) {
                onLoadTemplate(t);
              } else {
                setPendingTemplate(t);
              }
            };
            return (
              <>
                <p className="mb-2 text-xs font-medium text-white/60">
                  Start from template
                </p>
                {recommended.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] text-orange-400/80">
                      Recommended for {selectedDuration} min
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recommended.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => handleTemplateClick(t)}
                          className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-sm text-white/90 transition-colors hover:border-orange-500/50 hover:bg-orange-600/20"
                          title={t.pacingHint}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {other.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] text-white/50">
                      Other templates
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {other.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => handleTemplateClick(t)}
                          className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-sm text-white/90 transition-colors hover:border-orange-500/50 hover:bg-orange-600/20"
                          title={`${t.pacingHint} (works best at ${formatDurationRange(t)})`}
                        >
                          {t.name}
                          <span className="ml-1 text-[10px] text-white/50">
                            ({formatDurationRange(t)})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {pendingTemplate && onLoadTemplate && selectedDuration != null && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
          role="dialog"
          aria-labelledby="template-mismatch-title"
        >
          <p id="template-mismatch-title" className="mb-2 text-sm font-medium text-amber-200">
            {pendingTemplate.name} works best at{' '}
            {getRecommendedDurationForTemplate(pendingTemplate)} min. Your duration is{' '}
            {selectedDuration} min.
          </p>
          <p className="mb-3 text-xs text-white/70">
            Change duration to match the template, or keep your current duration.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const rec = getRecommendedDurationForTemplate(pendingTemplate);
                onLoadTemplate(pendingTemplate, { adjustDuration: rec });
                setPendingTemplate(null);
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              Change to {getRecommendedDurationForTemplate(pendingTemplate)} min
            </button>
            <button
              type="button"
              onClick={() => {
                onLoadTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Keep {selectedDuration} min
            </button>
            <button
              type="button"
              onClick={() => setPendingTemplate(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2 sm:flex-row">
          <div>
            <input
              ref={qtyInputRef}
              type="text"
              inputMode="numeric"
              placeholder={formatQtyHint()}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                if (qtyError) setQtyError(null);
              }}
              className="w-24 rounded-lg border border-white/20 bg-black/30 px-2.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:w-20"
              aria-label="Quantity"
              aria-describedby={qtyError ? 'qty-error' : undefined}
              aria-invalid={!!qtyError}
            />
            {qtyError && (
              <p id="qty-error" className="mt-1 text-xs text-red-400" role="alert">
                {qtyError}
              </p>
            )}
          </div>
          <input
            type="text"
            placeholder="burpees"
            value={name}
            onChange={(e) => setName(e.target.value)}
            list="exercise-suggestions"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-2.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:min-w-[8rem]"
            aria-label="Exercise name"
          />
          <datalist id="exercise-suggestions">
            {EXERCISE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-[44px] shrink-0 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_12px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600"
            aria-label="Add exercise"
          >
            +
          </button>
        </div>
      </form>
      {duplicateWarn && (
        <p className="text-xs text-amber-400" role="status">
          {duplicateWarn}
        </p>
      )}

      {customExercises.length >= 10 && (
        <p className="text-sm text-amber-400/90">
          Long workout — consider splitting for readability.
        </p>
      )}
      {customExercises.length === 0 ? (
        <p className="text-sm text-white/50">No exercises yet — add some or launch blank timer.</p>
      ) : onReorderExercises ? (
        <ExerciseSortableList
          customExercises={customExercises}
          onRemoveExercise={onRemoveExercise}
          onReorder={onReorderExercises}
        />
      ) : (
        <ul
          className="grid max-h-[30vh] grid-cols-1 gap-3 overflow-y-auto"
          aria-live="polite"
          aria-label="Exercise list"
        >
          {customExercises.map((ex, i) => (
            <ExerciseListItem
              key={ex.id}
              ex={ex}
              index={i}
              onRemove={() => onRemoveExercise(i)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onLaunch}
        className="w-full rounded-xl bg-orange-600 px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500"
      >
        {customExercises.length === 0
          ? 'Launch Blank Timer'
          : 'Launch Custom AMRAP'}
      </button>
    </div>
  );
}
