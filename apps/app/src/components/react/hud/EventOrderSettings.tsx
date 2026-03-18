/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Settings UI for same-day event display order (Phase 5.9). Reorder types with up/down; on Save parent persists and refreshes.
 */

import React, { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import type { CalendarEventType } from '@/lib/calendar-events';
import { DEFAULT_EVENT_TYPE_ORDER } from '@/lib/calendar-event-order';

const TYPE_LABELS: Record<CalendarEventType, string> = {
  program: 'Program',
  amrap_scheduled: 'AMRAP scheduled',
  timer_scheduled: 'Timer scheduled',
  amrap: 'AMRAP',
  timer: 'Timer',
  readiness: 'Readiness',
};

export interface EventOrderSettingsProps {
  /** Current type order (e.g. from getEventOrderPreference). */
  currentOrder: CalendarEventType[];
  /** Called with new order when user clicks Save. Parent should call setEventOrderPreference and refresh state. */
  onSave: (newOrder: CalendarEventType[]) => void;
  /** Called when user closes without saving or after save. */
  onClose: () => void;
}

function moveIndex<T>(arr: T[], from: number, delta: number): T[] {
  const to = Math.max(0, Math.min(arr.length - 1, from + delta));
  if (from === to) return arr;
  const out = [...arr];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

const EventOrderSettings: React.FC<EventOrderSettingsProps> = ({
  currentOrder,
  onSave,
  onClose,
}) => {
  const [order, setOrder] = useState<CalendarEventType[]>(() =>
    currentOrder.length > 0 ? [...currentOrder] : [...DEFAULT_EVENT_TYPE_ORDER]
  );

  const moveUp = useCallback((index: number) => {
    setOrder((prev) => moveIndex(prev, index, -1));
  }, []);

  const moveDown = useCallback((index: number) => {
    setOrder((prev) => moveIndex(prev, index, 1));
  }, []);

  const handleSave = useCallback(() => {
    onSave(order);
  }, [order, onSave]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="event-order-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-dark shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2
            id="event-order-title"
            className="font-heading text-base font-bold uppercase text-white"
          >
            Event order
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/50">
          Order of event types on multi-activity days (calendar, strip, export)
        </p>
        <ul className="divide-y divide-white/10">
          {order.map((type, index) => (
            <li key={type} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="font-medium text-white">{TYPE_LABELS[type] ?? type}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label={`Move ${TYPE_LABELS[type]} up`}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === order.length - 1}
                  className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label={`Move ${TYPE_LABELS[type]} down`}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-orange-light px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-black transition-colors hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventOrderSettings;
