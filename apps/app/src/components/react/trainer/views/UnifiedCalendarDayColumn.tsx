/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Droppable day column for unified calendar week grid (P2).
 */

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

type Props = {
  /** YYYY-MM-DD column id (must match dnd-kit over.id). */
  date: string;
  weekdayLabel: string;
  dateShort: string;
  children: ReactNode;
};

export default function UnifiedCalendarDayColumn({
  date,
  weekdayLabel,
  dateShort,
  children,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: date });

  return (
    <div className="flex min-h-[200px] min-w-[7.5rem] flex-1 flex-col border border-white/10 bg-black/30 p-2">
      <div className="mb-2 border-b border-white/10 pb-1 text-center">
        <div className="font-mono text-[10px] uppercase text-white/45">{weekdayLabel}</div>
        <div className="font-mono text-xs text-white/80">{dateShort}</div>
      </div>
      <div
        ref={setNodeRef}
        className={
          isOver
            ? 'bg-orange-light/5 ring-orange-light/25 min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-md ring-1 ring-inset'
            : 'min-h-0 flex-1 space-y-1.5 overflow-y-auto'
        }
      >
        {children}
      </div>
    </div>
  );
}
