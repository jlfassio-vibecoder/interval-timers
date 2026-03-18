/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer for timer calendar events: details, notes, Do Again, Edit (effort, rating, notes).
 */

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Pencil } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-events';
import { getAppById } from '@/lib/app-registry';
import { updateWorkoutLog } from '@/lib/supabase/client/workout-logs';

export interface TimerActivityDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  /** Called after a successful edit so parent can refresh. */
  onUpdated?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const TimerActivityDrawer: React.FC<TimerActivityDrawerProps> = ({ event, onClose, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [effort, setEffort] = useState(event.metadata?.effort ?? '');
  const [rating, setRating] = useState(event.metadata?.rating ?? '');
  const [notes, setNotes] = useState(event.metadata?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After save, show these so drawer reflects updates without parent refresh. */
  const [savedMeta, setSavedMeta] = useState<{
    effort?: number;
    rating?: number;
    notes?: string;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) setEditing(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  const dateLabel = formatDate(event.date);
  const meta = event.metadata;
  const display = savedMeta ? { ...meta, ...savedMeta } : meta;
  const app = event.sourceApp ? getAppById(event.sourceApp) : null;
  const logId = meta?.logId;

  const handleSave = async () => {
    if (!logId) return;
    setError(null);
    setSaving(true);
    try {
      const updates: { effort?: number; rating?: number; notes?: string } = {};
      const e = effort === '' ? undefined : Math.min(10, Math.max(1, Number(effort)));
      const r = rating === '' ? undefined : Math.min(5, Math.max(1, Number(rating)));
      if (e !== undefined) updates.effort = e;
      if (r !== undefined) updates.rating = r;
      updates.notes = notes.trim() || '';
      await updateWorkoutLog(logId, updates);
      setSavedMeta({ effort: e, rating: r, notes: notes.trim() || '' });
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-bg-dark shadow-2xl"
        role="dialog"
        aria-labelledby="timer-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="timer-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Timer
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
        <div className="p-6">
          <p className="font-heading text-xl font-black text-white">{event.workoutTitle}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase text-white/50">Timer</p>
          <p className="mt-1 font-mono text-[10px] text-white/40">{dateLabel}</p>
          {app && <p className="mt-0.5 font-mono text-[10px] text-white/40">{app.name}</p>}
          {display &&
            (display.durationSeconds != null ||
              display.effort != null ||
              display.rating != null ||
              display.rounds != null) && (
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs text-white/70">
                {display.durationSeconds != null && (
                  <span>{Math.round(display.durationSeconds / 60)} min</span>
                )}
                {display.rounds != null && <span>{display.rounds} rounds</span>}
                {display.effort != null && <span>Effort {display.effort}/10</span>}
                {display.rating != null && <span>Rating {display.rating}/5</span>}
              </div>
            )}
          {display?.notes && !editing && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-mono text-[10px] uppercase text-white/50">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{display.notes}</p>
            </div>
          )}

          {editing ? (
            <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-mono text-[10px] uppercase text-white/50">Edit</p>
              <div>
                <label className="block font-mono text-[10px] uppercase text-white/50">
                  Effort (1–10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={effort}
                  onChange={(e) => setEffort(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-white/50">
                  Rating (1–5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-white/50">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 rounded-xl border px-4 py-2 font-mono text-[10px] uppercase text-orange-light disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {app && (
                <a
                  href={app.path}
                  className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center justify-center gap-2 rounded-2xl border py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Do again — {app.name}
                </a>
              )}
              {logId && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 font-mono text-[10px] uppercase text-white/70 hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TimerActivityDrawer;
