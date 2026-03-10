/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable list for warmup/finisher/cooldown blocks: exercise name + instructions.
 * Used in WorkoutEditor (and optionally ProgramBlueprintEditor).
 * When onReorder is provided, items are sortable via drag handle.
 */

import React, { useCallback } from 'react';
import { Plus, Trash2, GripVertical, Link2, ExternalLink } from 'lucide-react';
import { normalizeExerciseName } from '@/lib/approved-exercise-maps';
import type { ApprovedExerciseMaps } from '@/lib/approved-exercise-maps';
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
import type { WarmupBlock } from '@/types/ai-program';

export interface WarmupLikeBlockListProps {
  title: string;
  addButtonLabel: string;
  emptyMessage: string;
  items: WarmupBlock[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof WarmupBlock, value: string | string[]) => void;
  onRemove: (index: number) => void;
  /** When provided, list items are sortable via drag handle. */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** When provided with onLink/onViewMapped/onExerciseQueryChange, rows show Link input, Map button, View mapped. */
  approvedMaps?: ApprovedExerciseMaps | null;
  onLink?: (index: number) => void;
  onViewMapped?: (index: number) => void;
  onExerciseQueryChange?: (index: number, value: string) => void;
}

function itemId(index: number): string {
  return `warmup-like-${index}`;
}

interface SortableItemRowProps {
  item: WarmupBlock;
  index: number;
  title: string;
  onUpdate: (index: number, field: keyof WarmupBlock, value: string | string[]) => void;
  onRemove: (index: number) => void;
  approvedMaps?: ApprovedExerciseMaps | null;
  onLink?: (index: number) => void;
  onViewMapped?: (index: number) => void;
  onExerciseQueryChange?: (index: number, value: string) => void;
}

function SortableItemRow({
  item,
  index,
  title,
  onUpdate,
  onRemove,
  approvedMaps,
  onLink,
  onViewMapped,
  onExerciseQueryChange,
}: SortableItemRowProps) {
  const id = itemId(index);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const showLinkBlock = onLink != null || onViewMapped != null || onExerciseQueryChange != null;
  const matchKey = normalizeExerciseName(
    (item.exerciseQuery ?? '').trim() || (item.exerciseName ?? '')
  );
  const isMapped = !!approvedMaps && !!matchKey && approvedMaps.exerciseMap.has(matchKey);

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
      <div className="min-w-0 flex-1 rounded border border-white/10 bg-black/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Order {item.order}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
            aria-label={`Remove ${title.toLowerCase()} item`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <input
          type="text"
          value={item.exerciseName}
          onChange={(e) => onUpdate(index, 'exerciseName', e.target.value)}
          className="focus:border-orange-light/50 mb-2 w-full rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-sm text-white focus:bg-black/20"
          placeholder="Exercise name (e.g., Neck Rolls)"
        />
        {showLinkBlock && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {onExerciseQueryChange != null && (
              <div className="min-w-0 flex-1">
                <label className="mb-0.5 block text-xs text-white/50">Link</label>
                <input
                  type="text"
                  value={item.exerciseQuery ?? ''}
                  onChange={(e) => onExerciseQueryChange(index, e.target.value)}
                  placeholder="e.g. bench press"
                  title="Map to approved exercise"
                  className="focus:border-orange-light/50 w-full min-w-0 rounded border-b border-transparent border-white/10 bg-transparent px-2 py-0.5 text-sm text-white/80 focus:bg-black/20 focus:outline-none"
                />
              </div>
            )}
            {onLink != null && (
              <button
                type="button"
                onClick={() => onLink(index)}
                className="shrink-0 rounded border border-white/20 bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Map to approved exercise"
                aria-label="Map to approved exercise"
              >
                <Link2 className="h-4 w-4" />
              </button>
            )}
            {onViewMapped != null && isMapped && (
              <button
                type="button"
                onClick={() => onViewMapped(index)}
                className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 p-1.5 text-amber-400 transition-colors hover:bg-amber-500/20"
                title="View mapped exercise"
                aria-label="View mapped exercise"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <textarea
          value={(item.instructions ?? []).join('\n')}
          onChange={(e) =>
            onUpdate(
              index,
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
    </div>
  );
}

function StaticItemRow({
  item,
  index,
  title,
  onUpdate,
  onRemove,
  approvedMaps,
  onLink,
  onViewMapped,
  onExerciseQueryChange,
}: SortableItemRowProps) {
  const showLinkBlock = onLink != null || onViewMapped != null || onExerciseQueryChange != null;
  const matchKey = normalizeExerciseName(
    (item.exerciseQuery ?? '').trim() || (item.exerciseName ?? '')
  );
  const isMapped = !!approvedMaps && !!matchKey && approvedMaps.exerciseMap.has(matchKey);

  return (
    <div className="rounded border border-white/10 bg-black/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-white/50">Order {item.order}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded p-1 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300"
          aria-label={`Remove ${title.toLowerCase()} item`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <input
        type="text"
        value={item.exerciseName}
        onChange={(e) => onUpdate(index, 'exerciseName', e.target.value)}
        className="focus:border-orange-light/50 mb-2 w-full rounded border-b border-transparent border-white/10 bg-transparent px-2 py-1 text-sm text-white focus:bg-black/20"
        placeholder="Exercise name (e.g., Neck Rolls)"
      />
      {showLinkBlock && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {onExerciseQueryChange != null && (
            <div className="min-w-0 flex-1">
              <label className="mb-0.5 block text-xs text-white/50">Link</label>
              <input
                type="text"
                value={item.exerciseQuery ?? ''}
                onChange={(e) => onExerciseQueryChange(index, e.target.value)}
                placeholder="e.g. bench press"
                title="Map to approved exercise"
                className="focus:border-orange-light/50 w-full min-w-0 rounded border-b border-transparent border-white/10 bg-transparent px-2 py-0.5 text-sm text-white/80 focus:bg-black/20 focus:outline-none"
              />
            </div>
          )}
          {onLink != null && (
            <button
              type="button"
              onClick={() => onLink(index)}
              className="shrink-0 rounded border border-white/20 bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title="Map to approved exercise"
              aria-label="Map to approved exercise"
            >
              <Link2 className="h-4 w-4" />
            </button>
          )}
          {onViewMapped != null && isMapped && (
            <button
              type="button"
              onClick={() => onViewMapped(index)}
              className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 p-1.5 text-amber-400 transition-colors hover:bg-amber-500/20"
              title="View mapped exercise"
              aria-label="View mapped exercise"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <textarea
        value={(item.instructions ?? []).join('\n')}
        onChange={(e) =>
          onUpdate(
            index,
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
  );
}

const WarmupLikeBlockList: React.FC<WarmupLikeBlockListProps> = ({
  title,
  addButtonLabel,
  emptyMessage,
  items,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  approvedMaps,
  onLink,
  onViewMapped,
  onExerciseQueryChange,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onReorder) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeStr = String(active.id);
      const overStr = String(over.id);
      if (!activeStr.startsWith('warmup-like-') || !overStr.startsWith('warmup-like-')) return;
      const fromIndex = parseInt(activeStr.replace('warmup-like-', ''), 10);
      const toIndex = parseInt(overStr.replace('warmup-like-', ''), 10);
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex < items.length && toIndex < items.length) {
        onReorder(fromIndex, toIndex);
      }
    },
    [onReorder, items.length]
  );

  const listContent =
    items.length === 0 ? (
      <p className="text-xs text-white/40">{emptyMessage}</p>
    ) : onReorder ? (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((_, i) => itemId(i))}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((item, idx) => (
              <SortableItemRow
                key={itemId(idx)}
                item={item}
                index={idx}
                title={title}
                onUpdate={onUpdate}
                onRemove={onRemove}
                approvedMaps={approvedMaps}
                onLink={onLink}
                onViewMapped={onViewMapped}
                onExerciseQueryChange={onExerciseQueryChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    ) : (
      <div className="space-y-3">
        {items.map((item, idx) => (
          <StaticItemRow
            key={idx}
            item={item}
            index={idx}
            title={title}
            onUpdate={onUpdate}
            onRemove={onRemove}
            approvedMaps={approvedMaps}
            onLink={onLink}
            onViewMapped={onViewMapped}
            onExerciseQueryChange={onExerciseQueryChange}
          />
        ))}
      </div>
    );

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/80">{title}</h4>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
          {addButtonLabel}
        </button>
      </div>
      {listContent}
    </div>
  );
};

export default WarmupLikeBlockList;
