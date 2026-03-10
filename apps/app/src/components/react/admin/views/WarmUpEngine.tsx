/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Warm-Up Engine: Admin UI to manage Daily Warm-Up slots, link to GeneratedExercises,
 * and set fallback image/instructions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  X,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  Search,
  ImageOff,
  CheckCircle2,
  GripVertical,
} from 'lucide-react';
import { getWarmupConfig, saveWarmupConfig } from '@/lib/supabase/client/warmup-config';
import type { WarmupConfigSlot } from '@/lib/supabase/client/warmup-config';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
} from '@/components/react/interval-timers/interval-timer-warmup';
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
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_SLOTS: WarmupConfigSlot[] = WARMUP_EXERCISES.map((e, i) => ({
  order: i + 1,
  exerciseName: e.name,
  detail: e.detail,
}));

function SlotRow({
  slot,
  index,
  onUpdate,
  onRemove,
  onLink,
  onClearLink,
  isLinked,
  linkedName,
}: {
  slot: WarmupConfigSlot;
  index: number;
  onUpdate: (
    index: number,
    field: keyof WarmupConfigSlot,
    value: string | string[] | number | undefined
  ) => void;
  onRemove: (index: number) => void;
  onLink: (index: number) => void;
  onClearLink: (index: number) => void;
  isLinked: boolean;
  linkedName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `warmup-slot-${index}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border border-white/10 bg-black/10 p-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="mt-2 shrink-0 cursor-grab touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/50">Order {slot.order}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
            aria-label="Remove slot"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <input
          type="text"
          value={slot.exerciseName}
          onChange={(e) => onUpdate(index, 'exerciseName', e.target.value)}
          className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
          placeholder="Exercise name"
        />
        <input
          type="text"
          value={slot.detail}
          onChange={(e) => onUpdate(index, 'detail', e.target.value)}
          className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-sm text-white/80 placeholder:text-white/40 focus:outline-none"
          placeholder="Detail (e.g. Left Side)"
        />
        <div className="flex flex-wrap items-center gap-2">
          {isLinked ? (
            <>
              <span className="text-xs text-amber-400">{linkedName}</span>
              <button
                type="button"
                onClick={() => onClearLink(index)}
                className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                Clear link
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onLink(index)}
              className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Link2 className="h-4 w-4" />
              Link to Exercise
            </button>
          )}
        </div>
        <input
          type="url"
          value={slot.fallbackImageUrl ?? ''}
          onChange={(e) => onUpdate(index, 'fallbackImageUrl', e.target.value || undefined)}
          className="focus:border-orange-light/50 w-full rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 placeholder:text-white/40 focus:outline-none"
          placeholder="Fallback image URL"
        />
        <textarea
          value={(slot.fallbackInstructions ?? []).join('\n')}
          onChange={(e) =>
            onUpdate(
              index,
              'fallbackInstructions',
              e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          rows={2}
          className="focus:border-orange-light/50 w-full resize-none rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 placeholder:text-white/40 focus:outline-none"
          placeholder="Fallback instructions (one per line)"
        />
      </div>
    </div>
  );
}

function LinkExerciseModal({
  isOpen,
  onClose,
  onSelect,
  slotLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  slotLabel: string;
}) {
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<GeneratedExercise | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getGeneratedExercises('approved')
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
    setSearchQuery('');
    setSelected(null);
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const q = searchQuery.toLowerCase();
    return exercises.filter(
      (ex) =>
        ex.exerciseName.toLowerCase().includes(q) || ex.kineticChainType?.toLowerCase().includes(q)
    );
  }, [exercises, searchQuery]);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected.id, selected.exerciseName);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="text-lg font-bold text-white">Link to Exercise — {slotLabel}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-2 text-white/70 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exercises..."
                className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-white placeholder:text-white/40 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/60">No exercises match.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((ex) => {
                  const isSelected = selected?.id === ex.id;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelected(ex)}
                      className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-white/10 bg-black/20 hover:border-white/30'
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden bg-black/40">
                        {ex.imageUrl ? (
                          <img src={ex.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageOff className="h-8 w-8 text-white/20" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute right-2 top-2 rounded-full bg-amber-500 p-1">
                            <CheckCircle2 className="h-4 w-4 text-black" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-sm font-medium text-white">
                          {ex.exerciseName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-white/10 p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              Link
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const WarmUpEngine: React.FC = () => {
  const [slots, setSlots] = useState<WarmupConfigSlot[]>([]);
  const [durationPerExercise, setDurationPerExercise] = useState(WARMUP_DURATION_PER_EXERCISE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkPickerIndex, setLinkPickerIndex] = useState<number | null>(null);
  const [approvedExercises, setApprovedExercises] = useState<GeneratedExercise[]>([]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await getWarmupConfig();
      if (config?.slots?.length) {
        const sorted = [...config.slots].sort((a, b) => a.order - b.order);
        setSlots(sorted);
        setDurationPerExercise(config.durationPerExercise);
      } else {
        setSlots(DEFAULT_SLOTS.map((s, i) => ({ ...s, order: i + 1 })));
        setDurationPerExercise(WARMUP_DURATION_PER_EXERCISE);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
      setSlots(DEFAULT_SLOTS.map((s, i) => ({ ...s, order: i + 1 })));
      setDurationPerExercise(WARMUP_DURATION_PER_EXERCISE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    getGeneratedExercises('approved')
      .then(setApprovedExercises)
      .catch(() => setApprovedExercises([]));
  }, []);

  const idToName = useMemo(() => {
    const m = new Map<string, string>();
    approvedExercises.forEach((ex) => m.set(ex.id, ex.exerciseName));
    return m;
  }, [approvedExercises]);

  const updateSlot = (
    index: number,
    field: keyof WarmupConfigSlot,
    value: string | string[] | number | undefined
  ) => {
    setSlots((prev) => {
      const next = [...prev];
      if (index < 0 || index >= next.length) return prev;
      (next[index] as unknown as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { order: prev.length + 1, exerciseName: '', detail: '' }]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = slots.findIndex((_, i) => `warmup-slot-${i}` === active.id);
    const newIndex = slots.findIndex((_, i) => `warmup-slot-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...slots];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    setSlots(reordered.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = async () => {
    const invalid = slots.some((s) => !s.exerciseName?.trim());
    if (invalid) {
      toast.error('Every slot must have an exercise name.');
      return;
    }
    setSaving(true);
    try {
      const withOrder = slots.map((s, i) => ({ ...s, order: i + 1 }));
      await saveWarmupConfig(withOrder, durationPerExercise);
      setSlots(withOrder);
      toast.success('Warm-up config saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Reset to default 16 exercises? This will clear all links and fallbacks.')) return;
    setSlots(DEFAULT_SLOTS.map((s, i) => ({ ...s, order: i + 1 })));
    setDurationPerExercise(WARMUP_DURATION_PER_EXERCISE);
    toast.success('Reset to defaults.');
  };

  const handleLinkSelect = (index: number, id: string) => {
    updateSlot(index, 'generatedExerciseId', id);
    setLinkPickerIndex(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
        <p className="mt-4 text-white/70">Loading warm-up config...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-white">Warm-Up Engine</h1>
        <p className="mt-2 text-white/70">
          Manage Daily Warm-Up slots. Link slots to approved exercises for images and instructions,
          or set fallback image URL and instructions per slot.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white/80">
          Duration per exercise (seconds):
          <input
            type="number"
            min={10}
            max={120}
            value={durationPerExercise}
            onChange={(e) => setDurationPerExercise(Number(e.target.value) || 30)}
            className="w-20 rounded border border-white/10 bg-black/20 px-2 py-1 text-white focus:border-amber-500/50 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Slots ({slots.length})</h2>
        <button
          type="button"
          onClick={addSlot}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          Add slot
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={slots.map((_, i) => `warmup-slot-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {slots.map((slot, index) => (
              <SlotRow
                key={`${index}-${slot.order}`}
                slot={slot}
                index={index}
                onUpdate={updateSlot}
                onRemove={removeSlot}
                onLink={setLinkPickerIndex}
                onClearLink={(i) => {
                  updateSlot(i, 'generatedExerciseId', undefined);
                }}
                isLinked={!!slot.generatedExerciseId}
                linkedName={
                  slot.generatedExerciseId ? idToName.get(slot.generatedExerciseId) : undefined
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {linkPickerIndex !== null && (
        <LinkExerciseModal
          isOpen={true}
          onClose={() => setLinkPickerIndex(null)}
          onSelect={(id) => handleLinkSelect(linkPickerIndex, id)}
          slotLabel={slots[linkPickerIndex]?.exerciseName || `Slot ${linkPickerIndex + 1}`}
        />
      )}
    </div>
  );
};

export default WarmUpEngine;
