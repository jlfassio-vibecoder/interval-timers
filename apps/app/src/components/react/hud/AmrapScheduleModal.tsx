/**
 * Modal to schedule an AMRAP session for a future date (from HUD Do Again / Schedule).
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AmrapSessionResult } from '@/lib/supabase/client/amrap-session-results';
import { createAmrapSession } from '@/lib/supabase/client/amrap-create-session';

export interface AmrapScheduleModalProps {
  result: AmrapSessionResult | null;
  onClose: () => void;
  onScheduled?: () => void;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AmrapScheduleModal({
  result,
  onClose,
  onScheduled,
}: AmrapScheduleModalProps) {
  const now = new Date();
  const minDate = new Date(now);
  minDate.setMinutes(0, 0, 0);
  if (minDate.getTime() <= now.getTime()) {
    minDate.setHours(minDate.getHours() + 1);
  }
  const [value, setValue] = useState(() => toDatetimeLocal(minDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!result) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createAmrapSession({
        duration_minutes: result.duration_minutes,
        workout_list: result.workout_list,
        host_nickname: 'Host',
        scheduled_start_at: new Date(value).toISOString(),
      });
      setSuccess(true);
      onScheduled?.(); // parent may refresh calendar etc.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setLoading(false);
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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-bg-dark p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="amrap-schedule-modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="amrap-schedule-modal-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Schedule AMRAP
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <p className="text-white/90">
            Scheduled. View it in your calendar or{' '}
            <a href="/account" className="text-orange-400 hover:underline">
              go to account
            </a>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-3 text-sm text-white/70">
              {result.workout_name ?? result.workout_list?.[0] ?? 'AMRAP'} ·{' '}
              {result.duration_minutes} min
            </p>
            <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
              Date & time
            </label>
            <input
              type="datetime-local"
              value={value}
              min={toDatetimeLocal(minDate)}
              onChange={(e) => setValue(e.target.value)}
              className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1"
            />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
