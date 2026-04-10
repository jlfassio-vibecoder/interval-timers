/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Draggable wrapper for unified calendar cards (P2).
 */

import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { UnifiedCalendarDragData } from '@/components/react/trainer/views/unified-calendar-dnd-types';

type Props = {
  id: string;
  data: UnifiedCalendarDragData;
  children: ReactNode;
};

export default function UnifiedCalendarDraggableCard({ id, data, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Copilot suggestion ignored: P2 is pointer-primary day snap only; a dedicated drag handle / reduced tab stops is a follow-up if we add keyboard DnD or stricter a11y for drag.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab touch-none'}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
