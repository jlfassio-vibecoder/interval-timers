/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal to enter, copy link, reschedule, or delete an AMRAP session from the HUD calendar.
 * Reuses the behavior of apps/amrap SessionEventModal without importing from that app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { getAmrapSessionDisplayTitle } from '@/lib/amrap-preset-name';
import { getAmrapSessionUrl } from '@/lib/amrap-urls';
import { getStoredHostToken } from '@/lib/amrap-host-token';
import { rescheduleAmrapSession } from '@/lib/supabase/client/amrap-reschedule';
import { deleteAmrapSessionByHost } from '@/lib/supabase/client/amrap-delete-session';
import { toast } from 'sonner';

export interface AmrapSessionData {
  id: string;
  duration_minutes: number;
  workout_list: string[];
  scheduled_start_at: string;
}

export interface AmrapSessionActionModalProps {
  session: AmrapSessionData;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onRescheduled?: () => void;
  /** Max weeks ahead for reschedule picker (1 = 2 weeks). */
  maxWeeksAhead?: number;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('default', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('default', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSessionShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('default', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getWorkoutTitle(workoutList: string[] | undefined): string {
  return getAmrapSessionDisplayTitle(null, workoutList);
}

function getWorkoutTitleAndDuration(
  workoutList: string[] | undefined,
  durationMinutes: number
): string {
  return `${getWorkoutTitle(workoutList)} · ${durationMinutes} min`;
}

export default function AmrapSessionActionModal({
  session,
  isOpen,
  onClose,
  onDeleted,
  onRescheduled,
  maxWeeksAhead = 1,
}: AmrapSessionActionModalProps) {
  const isHost = Boolean(getStoredHostToken(session.id));

  const [step, setStep] = useState<'main' | 'reschedule' | 'delete'>('main');
  const [rescheduleValue, setRescheduleValue] = useState(() =>
    toDatetimeLocal(new Date(session.scheduled_start_at))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minReschedule = toDatetimeLocal(new Date());
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxWeeksAhead * 14);
  const maxReschedule = toDatetimeLocal(maxDate);

  const handleEnter = useCallback(() => {
    onClose();
    const url = getAmrapSessionUrl(session.id) + (isHost ? '?host=1' : '');
    window.location.href = url;
  }, [session.id, isHost, onClose]);

  const copySessionId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      toast.success('Session ID copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [session.id]);

  const copySessionUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getAmrapSessionUrl(session.id));
      toast.success('Session URL copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [session.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (step === 'main') onClose();
      else {
        setStep('main');
        setRescheduleValue(toDatetimeLocal(new Date(session.scheduled_start_at)));
        setError(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, step, session.scheduled_start_at]);

  const handleRescheduleSave = async () => {
    const dt = new Date(rescheduleValue);
    if (Number.isNaN(dt.getTime()) || dt.getTime() < Date.now()) {
      setError('Please select a valid future date and time.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await rescheduleAmrapSession(session.id, dt.toISOString());
      onRescheduled?.();
      onClose();
      toast.success('Session rescheduled');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reschedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const deleted = await deleteAmrapSessionByHost(session.id);
      if (deleted) {
        onDeleted?.();
        onClose();
        toast.success('Session deleted');
      } else {
        setError('Could not delete.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setStep('main');
    setRescheduleValue(toDatetimeLocal(new Date(session.scheduled_start_at)));
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amrap-session-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="amrap-session-modal-title" className="text-xl font-bold text-white">
            {step === 'main' && 'Session'}
            {step === 'reschedule' && 'Reschedule'}
            {step === 'delete' && 'Delete session'}
          </h2>
          <button
            type="button"
            onClick={step === 'main' ? onClose : handleBack}
            className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'main' && (
          <>
            <div className="mb-6 space-y-2 text-sm text-white/90">
              <p className="text-orange-400 font-medium">
                {formatSessionDate(session.scheduled_start_at)} at{' '}
                {formatSessionTime(session.scheduled_start_at)}
              </p>
              <p>{getWorkoutTitleAndDuration(session.workout_list, session.duration_minutes)}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleEnter}
                className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-4 py-3 font-bold text-white transition-colors"
              >
                Enter session
              </button>
              {isHost && (
                <>
                  <button
                    type="button"
                    onClick={copySessionId}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
                  >
                    Copy session ID
                  </button>
                  <button
                    type="button"
                    onClick={copySessionUrl}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
                  >
                    Copy session URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('reschedule')}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('delete')}
                    className="rounded-xl border border-red-500/50 bg-red-600/20 px-4 py-3 font-bold text-red-300 transition-colors hover:bg-red-600/30"
                  >
                    Delete session
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {step === 'reschedule' && (
          <>
            <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
              New date & time
            </label>
            <input
              type="datetime-local"
              value={rescheduleValue}
              onChange={(e) => setRescheduleValue(e.target.value)}
              min={minReschedule}
              max={maxReschedule}
              className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRescheduleSave}
                disabled={saving}
                className="border-orange-500 bg-orange-600 hover:bg-orange-500 flex-1 rounded-xl border-2 px-4 py-3 font-bold text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}

        {step === 'delete' && (
          <>
            <p className="mb-6 text-sm text-white/80">
              Are you sure you want to delete{' '}
              <span className="font-bold text-white">
                {getWorkoutTitle(session.workout_list)} on{' '}
                {formatSessionShort(session.scheduled_start_at)}
              </span>
              ? Participants will no longer see this session.
            </p>
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="flex-1 rounded-xl border-2 border-red-500 bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        )}

        {step !== 'main' && (
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 w-full text-sm text-white/50 hover:text-white/80"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
