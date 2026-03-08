/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  X,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  GripVertical,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
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
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProgramTemplate, WarmupBlock, Exercise, ExerciseBlock } from '@/types/ai-program';
import { validateWorkoutDescriptions } from '@/lib/validate-program-schedule';
import { normalizeWorkoutForEditor } from '@/lib/program-schedule-utils';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import { buildApprovedExerciseMaps, normalizeExerciseName } from '@/lib/approved-exercise-maps';
import type { Exercise as PublicExercise } from '@/types';
import type { ExtendedBiomechanics } from '@/components/react/ExerciseDetailModal';
import ExerciseMapPickerModal from '@/components/react/admin/ExerciseMapPickerModal';
import WarmupLikeBlockList from '@/components/react/admin/WarmupLikeBlockList';
import ExerciseDetailModal from '@/components/react/ExerciseDetailModal';

interface ProgramBlueprintEditorProps {
  initialData: ProgramTemplate;
  onSave: (data: ProgramTemplate) => Promise<void>;
  onCancel: () => void;
  /** Called when dirty state changes (program differs from initialData). */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Ensure each block and exercise has a stable id for React keys and DnD. */
function ensureStableIds(block: ExerciseBlock): ExerciseBlock {
  return {
    ...block,
    id: block.id ?? `block-${crypto.randomUUID()}`,
    exercises: (block.exercises ?? []).map((ex) => ({
      ...ex,
      id: ex.id ?? `ex-${crypto.randomUUID()}`,
    })),
  };
}

function normalizeScheduleForEditor(data: ProgramTemplate): ProgramTemplate {
  return {
    ...data,
    schedule: (data.schedule ?? []).map((week) => ({
      ...week,
      workouts: (week.workouts ?? []).map((w) => {
        const normalized = normalizeWorkoutForEditor({
          ...w,
          description: w.description ?? '',
        });
        return {
          ...normalized,
          exerciseBlocks: normalized.exerciseBlocks.map((b) => ensureStableIds(b)),
        };
      }),
    })),
  };
}

function getExerciseBlocks(workout: {
  exerciseBlocks?: ExerciseBlock[];
  blocks?: Exercise[];
}): ExerciseBlock[] {
  return workout.exerciseBlocks && workout.exerciseBlocks.length > 0 ? workout.exerciseBlocks : [];
}

interface SortableBlockItemProps {
  id: string;
  children: (props: {
    setNodeRef: (element: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: object;
    listeners: object;
    isDragging: boolean;
  }) => React.ReactNode;
}

function SortableBlockItem({ id, children }: SortableBlockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({
        setNodeRef,
        style,
        attributes: attributes as object,
        listeners: (listeners ?? {}) as object,
        isDragging,
      })}
    </>
  );
}

interface SortableExerciseRowProps {
  id: string;
  children: (props: {
    setNodeRef: (element: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: object;
    listeners: object;
    isDragging: boolean;
  }) => React.ReactNode;
}

function SortableExerciseRow({ id, children }: SortableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({
        setNodeRef,
        style,
        attributes: attributes as object,
        listeners: (listeners ?? {}) as object,
        isDragging,
      })}
    </>
  );
}

const ProgramBlueprintEditor: React.FC<ProgramBlueprintEditorProps> = ({
  initialData,
  onSave,
  onCancel,
  onDirtyChange,
}) => {
  const [program, setProgram] = useState<ProgramTemplate>(() =>
    normalizeScheduleForEditor(initialData)
  );
  const [saving, setSaving] = useState(false);
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approved exercises for mapping (state so UI updates when loaded)
  const [approvedMaps, setApprovedMaps] = useState<{
    exerciseMap: Map<string, PublicExercise>;
    extendedMap: Map<string, ExtendedBiomechanics>;
    slugMap: Map<string, string>;
  }>({
    exerciseMap: new Map(),
    extendedMap: new Map(),
    slugMap: new Map(),
  });

  // Map picker: which exercise row is being mapped
  const [mapPickerTarget, setMapPickerTarget] = useState<{
    weekIndex: number;
    workoutIndex: number;
    blockIndex: number;
    exerciseIndex: number;
  } | null>(null);

  // View exercise (ExerciseDetailModal)
  const [previewExercise, setPreviewExercise] = useState<PublicExercise | null>(null);
  const [previewExtended, setPreviewExtended] = useState<ExtendedBiomechanics | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  // Report dirty state to parent (program differs from initialData). Baseline memoized - initialData changes rarely.
  const baselineStr = useMemo(
    () => JSON.stringify(normalizeScheduleForEditor(initialData)),
    [initialData]
  );
  useEffect(() => {
    const isDirty = JSON.stringify(program) !== baselineStr;
    onDirtyChange?.(isDirty);
  }, [program, baselineStr, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    getGeneratedExercises('approved')
      .then((list) => {
        if (cancelled) return;
        const maps = buildApprovedExerciseMaps(list as GeneratedExercise[]);
        setApprovedMaps({
          exerciseMap: maps.exerciseMap,
          extendedMap: maps.extendedMap,
          slugMap: maps.slugMap,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setApprovedMaps({
            exerciseMap: new Map(),
            extendedMap: new Map(),
            slugMap: new Map(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Detect if the program is missing weeks (schedule length < durationWeeks)
  const missingWeeks = Math.max(0, program.durationWeeks - program.schedule.length);

  const handleExtendProgram = async () => {
    if (missingWeeks <= 0) return;
    setExtending(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/extend-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program,
          targetWeeks: program.durationWeeks,
        }),
      });
      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = response.statusText || 'Failed to extend program';
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            errorMessage = parsed.error;
          }
        } catch {
          if (raw.trim().length > 0) {
            errorMessage = raw.length > 200 ? raw.slice(0, 200) + '…' : raw.trim();
          }
        }
        throw new Error(errorMessage);
      }
      const extendedProgram: ProgramTemplate = await response.json();
      setProgram(normalizeScheduleForEditor(extendedProgram));

      // Show success toast
      toast.success('Program extended!', {
        description: `Added ${missingWeeks} missing week(s) to the program.`,
      });
    } catch (err) {
      console.error('[ProgramBlueprintEditor] Extend error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to extend program';
      setError(errorMessage);

      // Show error toast
      toast.error('Failed to extend program', {
        description: errorMessage,
      });
    } finally {
      setExtending(false);
    }
  };

  const handleSave = async () => {
    const descValidation = validateWorkoutDescriptions(program.schedule);
    if (!descValidation.valid) {
      setError(descValidation.error);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(program);
      // Success toast is shown by the parent (ProgramGeneratorModal)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save program';
      setError(errorMessage);
      // Show error toast
      toast.error('Failed to save program', {
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTitle = (title: string) => {
    setProgram((prev) => ({ ...prev, title }));
  };

  const updateDescription = (description: string) => {
    setProgram((prev) => ({ ...prev, description }));
  };

  const updateWeekWorkout = (
    weekIndex: number,
    workoutIndex: number,
    field: 'title' | 'description',
    value: string
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        [field]: value,
      };
      newSchedule[weekIndex] = {
        ...newSchedule[weekIndex],
        workouts: newWorkouts,
      };
      return { ...prev, schedule: newSchedule };
    });
  };

  const exerciseBlocks = (weekIndex: number, workoutIndex: number): ExerciseBlock[] =>
    getExerciseBlocks(program.schedule[weekIndex].workouts[workoutIndex]);

  const updateExerciseBlock = (
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    field: 'order' | 'name',
    value: string | number
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], [field]: value };
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: newBlocks };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const updateExercise = (
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    exerciseIndex: number,
    field: keyof Exercise,
    value: string | number | undefined
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const newBlocks = [...blocks];
      const exs = [...(newBlocks[blockIndex].exercises ?? [])];
      exs[exerciseIndex] = { ...exs[exerciseIndex], [field]: value };
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], exercises: exs };
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: newBlocks };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const warmupBlocks = (weekIndex: number, workoutIndex: number): WarmupBlock[] =>
    program.schedule[weekIndex].workouts[workoutIndex].warmupBlocks ?? [];

  const updateWarmupBlock = (
    weekIndex: number,
    workoutIndex: number,
    warmupIndex: number,
    field: keyof WarmupBlock,
    value: number | string | string[]
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].warmupBlocks ?? [];
      const newWarmup = [...current];
      newWarmup[warmupIndex] = { ...newWarmup[warmupIndex], [field]: value };
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        warmupBlocks: newWarmup,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addWarmupBlock = (weekIndex: number, workoutIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].warmupBlocks ?? [];
      const newWarmup = [
        ...current,
        { order: current.length + 1, exerciseName: '', instructions: [] },
      ];
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        warmupBlocks: newWarmup,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeWarmupBlock = (weekIndex: number, workoutIndex: number, warmupIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].warmupBlocks ?? [];
      const newWarmup = current
        .filter((_, i) => i !== warmupIndex)
        .map((b, i) => ({ ...b, order: i + 1 }));
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        warmupBlocks: newWarmup,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const finisherBlocks = (weekIndex: number, workoutIndex: number): WarmupBlock[] =>
    program.schedule[weekIndex].workouts[workoutIndex].finisherBlocks ?? [];

  const updateFinisherBlock = (
    weekIndex: number,
    workoutIndex: number,
    finisherIndex: number,
    field: keyof WarmupBlock,
    value: number | string | string[]
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].finisherBlocks ?? [];
      const newFinisher = [...current];
      newFinisher[finisherIndex] = { ...newFinisher[finisherIndex], [field]: value };
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        finisherBlocks: newFinisher,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addFinisherBlock = (weekIndex: number, workoutIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].finisherBlocks ?? [];
      const newFinisher = [
        ...current,
        { order: current.length + 1, exerciseName: '', instructions: [] },
      ];
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        finisherBlocks: newFinisher,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeFinisherBlock = (weekIndex: number, workoutIndex: number, finisherIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].finisherBlocks ?? [];
      const newFinisher = current
        .filter((_, i) => i !== finisherIndex)
        .map((b, i) => ({ ...b, order: i + 1 }));
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        finisherBlocks: newFinisher,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const cooldownBlocks = (weekIndex: number, workoutIndex: number): WarmupBlock[] =>
    program.schedule[weekIndex].workouts[workoutIndex].cooldownBlocks ?? [];

  const updateCooldownBlock = (
    weekIndex: number,
    workoutIndex: number,
    cooldownIndex: number,
    field: keyof WarmupBlock,
    value: number | string | string[]
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].cooldownBlocks ?? [];
      const newCooldown = [...current];
      newCooldown[cooldownIndex] = { ...newCooldown[cooldownIndex], [field]: value };
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        cooldownBlocks: newCooldown,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addCooldownBlock = (weekIndex: number, workoutIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].cooldownBlocks ?? [];
      const newCooldown = [
        ...current,
        { order: current.length + 1, exerciseName: '', instructions: [] },
      ];
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        cooldownBlocks: newCooldown,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeCooldownBlock = (weekIndex: number, workoutIndex: number, cooldownIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const current = newWorkouts[workoutIndex].cooldownBlocks ?? [];
      const newCooldown = current
        .filter((_, i) => i !== cooldownIndex)
        .map((b, i) => ({ ...b, order: i + 1 }));
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        cooldownBlocks: newCooldown,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addExerciseBlock = (weekIndex: number, workoutIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const newBlock: ExerciseBlock = {
        id: `block-${crypto.randomUUID()}`,
        order: blocks.length + 1,
        name: '',
        exercises: [],
      };
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        exerciseBlocks: [...blocks, newBlock],
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeExerciseBlock = (weekIndex: number, workoutIndex: number, blockIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const newBlocks = blocks
        .filter((_, i) => i !== blockIndex)
        .map((b, i) => ({ ...b, order: i + 1 }));
      newWorkouts[workoutIndex] = {
        ...newWorkouts[workoutIndex],
        exerciseBlocks: newBlocks,
      };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addExercise = (weekIndex: number, workoutIndex: number, blockIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const exs = blocks[blockIndex]?.exercises ?? [];
      const newEx: Exercise = {
        id: `ex-${crypto.randomUUID()}`,
        order: exs.length + 1,
        exerciseName: '',
        sets: 3,
        reps: '8-10',
      };
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        exercises: [...exs, newEx],
      };
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: newBlocks };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeExercise = (
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    exerciseIndex: number
  ) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const exs = (blocks[blockIndex]?.exercises ?? []).filter((_, i) => i !== exerciseIndex);
      const newExs = exs.map((e, i) => ({ ...e, order: i + 1 }));
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], exercises: newExs };
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: newBlocks };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const reorderExerciseBlocks = (
    weekIndex: number,
    workoutIndex: number,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const reordered = arrayMove(blocks, fromIndex, toIndex);
      const withOrder = reordered.map((b, i) => ({ ...b, order: i + 1 }));
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: withOrder };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const reorderExercises = (
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = [...newSchedule[weekIndex].workouts];
      const blocks = getExerciseBlocks(newWorkouts[workoutIndex]);
      const exs = blocks[blockIndex]?.exercises ?? [];
      const reordered = arrayMove(exs, fromIndex, toIndex);
      const withOrder = reordered.map((e, i) => ({ ...e, order: i + 1 }));
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], exercises: withOrder };
      newWorkouts[workoutIndex] = { ...newWorkouts[workoutIndex], exerciseBlocks: newBlocks };
      newSchedule[weekIndex] = { ...newSchedule[weekIndex], workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const addWorkout = (weekIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const week = newSchedule[weekIndex];
      const newWorkouts = [
        ...week.workouts,
        {
          title: `Workout ${week.workouts.length + 1}`,
          description: '',
          exerciseBlocks: [
            { id: `block-${crypto.randomUUID()}`, order: 1, name: '', exercises: [] },
          ],
          warmupBlocks: [],
          finisherBlocks: [],
          cooldownBlocks: [],
        },
      ];
      newSchedule[weekIndex] = { ...week, workouts: newWorkouts };
      return { ...prev, schedule: newSchedule };
    });
  };

  const removeWorkout = (weekIndex: number, workoutIndex: number) => {
    setProgram((prev) => {
      const newSchedule = [...prev.schedule];
      const newWorkouts = newSchedule[weekIndex].workouts.filter((_, i) => i !== workoutIndex);
      if (newWorkouts.length === 0) return prev;
      newSchedule[weekIndex] = {
        ...newSchedule[weekIndex],
        workouts: newWorkouts,
      };
      return { ...prev, schedule: newSchedule };
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent, weekIndex: number, workoutIndex: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    const blocks = exerciseBlocks(weekIndex, workoutIndex);

    // Block reorder: resolve stable IDs to indices
    const blockFromIndex = blocks.findIndex((b, i) => (b.id ?? `block-${i}`) === activeStr);
    const blockToIndex = blocks.findIndex((b, i) => (b.id ?? `block-${i}`) === overStr);
    if (blockFromIndex >= 0 && blockToIndex >= 0) {
      reorderExerciseBlocks(weekIndex, workoutIndex, blockFromIndex, blockToIndex);
      return;
    }

    // Exercise reorder: resolve stable IDs to block + indices
    for (let bi = 0; bi < blocks.length; bi++) {
      const exs = blocks[bi].exercises ?? [];
      const exFromIndex = exs.findIndex((e, i) => (e.id ?? `ex-${bi}-${i}`) === activeStr);
      const exToIndex = exs.findIndex((e, i) => (e.id ?? `ex-${bi}-${i}`) === overStr);
      if (exFromIndex >= 0 && exToIndex >= 0 && exFromIndex !== exToIndex) {
        reorderExercises(weekIndex, workoutIndex, bi, exFromIndex, exToIndex);
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex-1">
            <p className="font-medium text-red-300">Error</p>
            <p className="mt-1 text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Header Section - Editable Title & Description */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Program Title</label>
          <input
            type="text"
            value={program.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="focus:border-orange-light/50 w-full rounded border-b border-transparent border-white/20 bg-transparent px-2 py-2 text-white transition-colors placeholder:text-white/40 focus:bg-black/20"
            placeholder="Enter program title"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">Description</label>
          <textarea
            value={program.description}
            onChange={(e) => updateDescription(e.target.value)}
            rows={3}
            className="focus:border-orange-light/50 w-full resize-none rounded border-b border-transparent border-white/20 bg-transparent px-2 py-2 text-white transition-colors placeholder:text-white/40 focus:bg-black/20"
            placeholder="Enter program description"
          />
        </div>
      </div>

      {/* Weeks Accordion */}
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-bold text-white">Program Schedule</h3>
        {program.schedule.map((week, weekIndex) => (
          <details
            key={weekIndex}
            className="group rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm"
          >
            <summary className="cursor-pointer list-none font-semibold text-white transition-colors hover:text-orange-light">
              <div className="flex items-center justify-between">
                <span>
                  Week {week.weekNumber} - {week.workouts.length} workout
                  {week.workouts.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm text-white/60 group-open:hidden">Click to expand</span>
              </div>
            </summary>

            <div className="mt-4 space-y-6">
              {week.workouts.map((workout, workoutIndex) => (
                <div
                  key={workoutIndex}
                  className="rounded-lg border border-white/5 bg-black/10 p-4"
                >
                  {/* Workout Header: Title + Add/Remove Workout */}
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-white/60">
                        Workout Title
                      </label>
                      <input
                        type="text"
                        value={workout.title}
                        onChange={(e) =>
                          updateWeekWorkout(weekIndex, workoutIndex, 'title', e.target.value)
                        }
                        className="focus:border-orange-light/50 w-full rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 font-medium text-white transition-colors focus:bg-black/20"
                      />
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => removeWorkout(weekIndex, workoutIndex)}
                        disabled={week.workouts.length <= 1}
                        className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40 disabled:hover:bg-red-500/10"
                        title="Remove workout from week"
                        aria-label="Remove workout"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Workout
                      </button>
                      <button
                        type="button"
                        onClick={() => addWorkout(weekIndex)}
                        className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 flex items-center gap-1 rounded border px-2 py-1 text-xs text-orange-light transition-colors"
                        title="Add another workout to this week"
                        aria-label="Add workout"
                      >
                        <Plus className="h-4 w-4" />
                        Add Workout
                      </button>
                    </div>
                  </div>

                  {/* Workout Description */}
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-white/60">
                      Workout Description
                    </label>
                    <textarea
                      value={workout.description ?? ''}
                      onChange={(e) =>
                        updateWeekWorkout(weekIndex, workoutIndex, 'description', e.target.value)
                      }
                      rows={2}
                      className="focus:border-orange-light/50 w-full resize-none rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-sm text-white transition-colors focus:bg-black/20"
                      placeholder="e.g., Warm-up and main focus for this session"
                    />
                  </div>

                  {/* Warmup (exercise name and instructions) */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium text-white/60">
                        Warmup (exercise name and instructions)
                      </label>
                      <button
                        type="button"
                        onClick={() => addWarmupBlock(weekIndex, workoutIndex)}
                        className="flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
                      >
                        <Plus className="h-3 w-3" />
                        Add warmup item
                      </button>
                    </div>
                    {warmupBlocks(weekIndex, workoutIndex).length === 0 ? (
                      <p className="text-xs text-white/40">
                        No warmup items. Add items to list warmup exercises with step-by-step
                        instructions.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {warmupBlocks(weekIndex, workoutIndex).map((wb, wbIndex) => (
                          <div
                            key={wbIndex}
                            className="rounded border border-white/10 bg-black/10 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs text-white/50">Order {wb.order}</span>
                              <button
                                type="button"
                                onClick={() => removeWarmupBlock(weekIndex, workoutIndex, wbIndex)}
                                className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
                                aria-label="Remove warmup item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={wb.exerciseName}
                              onChange={(e) =>
                                updateWarmupBlock(
                                  weekIndex,
                                  workoutIndex,
                                  wbIndex,
                                  'exerciseName',
                                  e.target.value
                                )
                              }
                              className="focus:border-orange-light/50 mb-2 w-full rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-sm text-white focus:bg-black/20"
                              placeholder="Exercise name (e.g., Neck Rolls)"
                            />
                            <textarea
                              value={(wb.instructions ?? []).join('\n')}
                              onChange={(e) =>
                                updateWarmupBlock(
                                  weekIndex,
                                  workoutIndex,
                                  wbIndex,
                                  'instructions',
                                  e.target.value
                                    .split('\n')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                )
                              }
                              rows={2}
                              className="focus:border-orange-light/50 w-full resize-none rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 focus:bg-black/20"
                              placeholder="One instruction per line (e.g., Assume proper starting position)"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Finisher */}
                  <div className="mb-4">
                    <WarmupLikeBlockList
                      title="Finisher"
                      addButtonLabel="Add finisher item"
                      emptyMessage="No finisher items. Add items to list finisher exercises with step-by-step instructions."
                      items={finisherBlocks(weekIndex, workoutIndex)}
                      onAdd={() => addFinisherBlock(weekIndex, workoutIndex)}
                      onUpdate={(index, field, value) =>
                        updateFinisherBlock(weekIndex, workoutIndex, index, field, value)
                      }
                      onRemove={(index) => removeFinisherBlock(weekIndex, workoutIndex, index)}
                    />
                  </div>

                  {/* Cool down */}
                  <div className="mb-4">
                    <WarmupLikeBlockList
                      title="Cool down"
                      addButtonLabel="Add cool down item"
                      emptyMessage="No cool down items. Add items to list cool down exercises with step-by-step instructions."
                      items={cooldownBlocks(weekIndex, workoutIndex)}
                      onAdd={() => addCooldownBlock(weekIndex, workoutIndex)}
                      onUpdate={(index, field, value) =>
                        updateCooldownBlock(weekIndex, workoutIndex, index, field, value)
                      }
                      onRemove={(index) => removeCooldownBlock(weekIndex, workoutIndex, index)}
                    />
                  </div>

                  {/* Exercises (blocks + exercises) */}
                  <div className="mt-4">
                    <h4 className="mb-3 text-sm font-medium text-white/70">Exercises</h4>
                    {exerciseBlocks(weekIndex, workoutIndex).length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-white/20 bg-black/10 p-6 text-center">
                        <p className="text-sm text-white/50">
                          No exercise blocks. Add a block to group exercises (e.g. strength block,
                          cardio block).
                        </p>
                        <button
                          type="button"
                          onClick={() => addExerciseBlock(weekIndex, workoutIndex)}
                          className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 mt-3 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-orange-light transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add Exercise Block
                        </button>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleDragEnd(e, weekIndex, workoutIndex)}
                      >
                        <div className="space-y-4">
                          <SortableContext
                            items={exerciseBlocks(weekIndex, workoutIndex).map(
                              (eb, i) => eb.id ?? `block-${i}`
                            )}
                            strategy={verticalListSortingStrategy}
                          >
                            {exerciseBlocks(weekIndex, workoutIndex).map((eb, blockIndex) => (
                              <SortableBlockItem
                                key={eb.id ?? blockIndex}
                                id={eb.id ?? `block-${blockIndex}`}
                              >
                                {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                                  <div
                                    ref={setNodeRef}
                                    style={style}
                                    className={`rounded-lg border border-white/10 bg-black/10 p-4 transition-opacity ${isDragging ? 'opacity-60' : ''}`}
                                  >
                                    <div className="mb-3 flex items-center gap-2">
                                      <button
                                        type="button"
                                        {...attributes}
                                        {...listeners}
                                        className="-m-1 cursor-grab touch-none rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
                                        aria-label="Drag to reorder block"
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                      <input
                                        type="text"
                                        value={eb.name ?? ''}
                                        onChange={(e) =>
                                          updateExerciseBlock(
                                            weekIndex,
                                            workoutIndex,
                                            blockIndex,
                                            'name',
                                            e.target.value
                                          )
                                        }
                                        className="focus:border-orange-light/50 flex-1 rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-sm font-medium text-white placeholder:text-white/40 focus:bg-black/20"
                                        placeholder="Block name (e.g. Strength, Cardio)"
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addExercise(weekIndex, workoutIndex, blockIndex)
                                          }
                                          className="flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Add Exercise
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeExerciseBlock(weekIndex, workoutIndex, blockIndex)
                                          }
                                          className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/20"
                                          aria-label="Remove block"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          Remove Block
                                        </button>
                                      </div>
                                    </div>
                                    {(eb.exercises ?? []).length === 0 ? (
                                      <div className="rounded border-2 border-dashed border-white/10 p-4 text-center">
                                        <p className="text-xs text-white/40">
                                          No exercises in this block.
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addExercise(weekIndex, workoutIndex, blockIndex)
                                          }
                                          className="mt-2 inline-flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Add Exercise
                                        </button>
                                      </div>
                                    ) : (
                                      <SortableContext
                                        items={(eb.exercises ?? []).map(
                                          (ex, i) => ex.id ?? `ex-${blockIndex}-${i}`
                                        )}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <div className="overflow-x-auto">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="border-b border-white/10">
                                                <th
                                                  className="w-10 px-2 py-2 text-left text-xs font-medium text-white/60"
                                                  aria-hidden="true"
                                                />
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Order
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Exercise
                                                </th>
                                                <th
                                                  className="px-2 py-2 text-left text-xs font-medium text-white/60"
                                                  title="Link to approved exercise DB (e.g. bench press)"
                                                >
                                                  Link
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Sets
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Reps
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  RPE
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Rest (s)
                                                </th>
                                                <th className="px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Notes
                                                </th>
                                                <th className="w-10 px-2 py-2 text-left text-xs font-medium text-white/60">
                                                  Actions
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                              {(eb.exercises ?? []).map((ex, exerciseIndex) => (
                                                <SortableExerciseRow
                                                  key={ex.id ?? exerciseIndex}
                                                  id={ex.id ?? `ex-${blockIndex}-${exerciseIndex}`}
                                                >
                                                  {({
                                                    setNodeRef,
                                                    style,
                                                    attributes,
                                                    listeners,
                                                    isDragging,
                                                  }) => (
                                                    <tr
                                                      ref={setNodeRef}
                                                      style={style}
                                                      className={`transition-colors hover:bg-white/5 ${isDragging ? 'opacity-60' : ''}`}
                                                    >
                                                      <td className="px-2 py-2">
                                                        <button
                                                          type="button"
                                                          {...attributes}
                                                          {...listeners}
                                                          className="-m-1 cursor-grab touch-none rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
                                                          aria-label="Drag to reorder exercise"
                                                        >
                                                          <GripVertical className="h-4 w-4" />
                                                        </button>
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="number"
                                                          value={ex.order}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'order',
                                                              parseInt(e.target.value) || 1
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-12 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-center text-sm text-white transition-colors focus:bg-black/20"
                                                          min="1"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="text"
                                                          value={ex.exerciseName}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'exerciseName',
                                                              e.target.value
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-full min-w-[150px] rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-sm text-white transition-colors focus:bg-black/20"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <div className="flex min-w-[180px] items-center gap-1">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setMapPickerTarget({
                                                                weekIndex,
                                                                workoutIndex,
                                                                blockIndex,
                                                                exerciseIndex,
                                                              })
                                                            }
                                                            className="shrink-0 rounded border border-white/20 bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                                                            title="Map to approved exercise"
                                                          >
                                                            <Link2 className="h-4 w-4" />
                                                          </button>
                                                          {(() => {
                                                            const matchKey = normalizeExerciseName(
                                                              ex.exerciseQuery?.trim() ||
                                                                ex.exerciseName
                                                            );
                                                            const matchedEx =
                                                              approvedMaps.exerciseMap.get(
                                                                matchKey
                                                              );
                                                            const matchedSlug =
                                                              approvedMaps.slugMap.get(matchKey);
                                                            const isMapped =
                                                              !!matchedEx && matchKey;
                                                            return isMapped ? (
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setPreviewExercise(matchedEx);
                                                                  setPreviewExtended(
                                                                    approvedMaps.extendedMap.get(
                                                                      matchKey
                                                                    ) ?? null
                                                                  );
                                                                  setPreviewSlug(
                                                                    matchedSlug ?? null
                                                                  );
                                                                }}
                                                                className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 p-1.5 text-amber-400 transition-colors hover:bg-amber-500/20"
                                                                title="View mapped exercise"
                                                              >
                                                                <ExternalLink className="h-4 w-4" />
                                                              </button>
                                                            ) : null;
                                                          })()}
                                                          <input
                                                            type="text"
                                                            value={ex.exerciseQuery ?? ''}
                                                            onChange={(e) =>
                                                              updateExercise(
                                                                weekIndex,
                                                                workoutIndex,
                                                                blockIndex,
                                                                exerciseIndex,
                                                                'exerciseQuery',
                                                                e.target.value
                                                              )
                                                            }
                                                            placeholder="e.g. bench press"
                                                            className="focus:border-orange-light/50 min-w-0 flex-1 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-sm text-white/80 transition-colors placeholder:text-white/40 focus:bg-black/20"
                                                            title="Link to approved exercise (or use Map button)"
                                                          />
                                                        </div>
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="number"
                                                          value={ex.sets}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'sets',
                                                              parseInt(e.target.value) || 0
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-16 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-center text-sm text-white transition-colors focus:bg-black/20"
                                                          min="0"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="text"
                                                          value={ex.reps}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'reps',
                                                              e.target.value
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-20 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-sm text-white transition-colors focus:bg-black/20"
                                                          placeholder="e.g., 8-10"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="number"
                                                          value={ex.rpe ?? ''}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'rpe',
                                                              e.target.value
                                                                ? parseInt(e.target.value, 10)
                                                                : undefined
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-16 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-center text-sm text-white transition-colors focus:bg-black/20"
                                                          min="1"
                                                          max="10"
                                                          placeholder="1-10"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="number"
                                                          value={ex.restSeconds ?? ''}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'restSeconds',
                                                              e.target.value
                                                                ? parseInt(e.target.value, 10)
                                                                : undefined
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-20 rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-center text-sm text-white transition-colors focus:bg-black/20"
                                                          min="0"
                                                          placeholder="seconds"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <input
                                                          type="text"
                                                          value={ex.coachNotes ?? ''}
                                                          onChange={(e) =>
                                                            updateExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex,
                                                              'coachNotes',
                                                              e.target.value
                                                            )
                                                          }
                                                          className="focus:border-orange-light/50 w-full min-w-[200px] rounded border-b border-transparent border-white/10 bg-transparent px-1 py-1 text-sm text-white transition-colors focus:bg-black/20"
                                                          placeholder="Coach notes"
                                                        />
                                                      </td>
                                                      <td className="px-2 py-2">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            removeExercise(
                                                              weekIndex,
                                                              workoutIndex,
                                                              blockIndex,
                                                              exerciseIndex
                                                            )
                                                          }
                                                          className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
                                                          aria-label="Remove exercise"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  )}
                                                </SortableExerciseRow>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </SortableContext>
                                    )}
                                  </div>
                                )}
                              </SortableBlockItem>
                            ))}
                          </SortableContext>
                          <button
                            type="button"
                            onClick={() => addExerciseBlock(weekIndex, workoutIndex)}
                            className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-orange-light transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            Add Exercise Block
                          </button>
                        </div>
                      </DndContext>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* Partial Program Notice */}
      {missingWeeks > 0 && (
        <div className="border-orange-light/30 bg-orange-light/10 flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-orange-light" />
            <p className="text-sm text-white">
              This program has <span className="font-bold">{program.schedule.length}</span> of{' '}
              <span className="font-bold">{program.durationWeeks}</span> weeks.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExtendProgram}
            disabled={extending || saving}
            className="bg-orange-light/20 hover:bg-orange-light/30 flex items-center gap-2 rounded-lg border border-orange-light px-4 py-2 text-sm font-medium text-orange-light transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${extending ? 'animate-spin' : ''}`} />
            <span>
              {extending
                ? 'Generating...'
                : `Generate Missing ${missingWeeks} Week${missingWeeks > 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-6 py-2 text-white transition-colors hover:bg-white/5"
          disabled={saving}
        >
          <X className="h-5 w-5" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 font-medium text-black transition-colors disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          <span>{saving ? 'Saving...' : 'Save Program'}</span>
        </button>
      </div>

      {/* Map Exercise Picker */}
      {mapPickerTarget != null && (
        <ExerciseMapPickerModal
          isOpen
          onClose={() => setMapPickerTarget(null)}
          programExerciseName={(() => {
            const wk = program.schedule[mapPickerTarget.weekIndex];
            const w = wk?.workouts[mapPickerTarget.workoutIndex];
            const blocks = getExerciseBlocks(w ?? {});
            const ex =
              blocks[mapPickerTarget.blockIndex]?.exercises?.[mapPickerTarget.exerciseIndex];
            return ex?.exerciseName ?? '';
          })()}
          onMap={(exerciseName) => {
            if (mapPickerTarget == null) return;
            updateExercise(
              mapPickerTarget.weekIndex,
              mapPickerTarget.workoutIndex,
              mapPickerTarget.blockIndex,
              mapPickerTarget.exerciseIndex,
              'exerciseQuery',
              exerciseName
            );
            setMapPickerTarget(null);
          }}
        />
      )}

      {/* View Exercise (mapped) */}
      <ExerciseDetailModal
        exercise={previewExercise}
        onClose={() => {
          setPreviewExercise(null);
          setPreviewExtended(null);
          setPreviewSlug(null);
        }}
        extendedBiomechanics={previewExtended}
        exerciseSlug={previewSlug}
      />
    </div>
  );
};

export default ProgramBlueprintEditor;
