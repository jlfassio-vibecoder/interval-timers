import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/** Drag handle for exercise cards (view or edit). */
export function ExerciseDragHandle({
  attributes,
  listeners,
  disabled,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`touch-none rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'
      }`}
      aria-label="Drag to reorder"
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-5 w-5 shrink-0" aria-hidden />
    </button>
  );
}

export function sortableItemStyle(
  transform: ReturnType<typeof useSortable>['transform'],
  transition: string | undefined | null,
  isDragging: boolean
) {
  return {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };
}
