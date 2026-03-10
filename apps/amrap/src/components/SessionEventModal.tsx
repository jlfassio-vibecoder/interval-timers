import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getStoredHostToken } from '@/hooks/useAmrapSession';
import type { ScheduledSession } from '@/hooks/useScheduledSessions';
import { getWorkoutTitle, getWorkoutTitleAndDuration } from '@/lib/workoutLabel';
import CreateFlowSchedulePicker from '@/components/CreateFlowSchedulePicker';

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface SessionEventModalProps {
  session: ScheduledSession;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onRescheduled: () => void;
  /** Max weeks ahead for reschedule picker (1 = 2 weeks, 52 = 1 year). */
  maxWeeksAhead?: number;
}

export default function SessionEventModal({
  session,
  isOpen,
  onClose,
  onDeleted,
  onRescheduled,
  maxWeeksAhead = 1,
}: SessionEventModalProps) {
  const navigate = useNavigate();
  const isHost = Boolean(getStoredHostToken(session.id));

  const [step, setStep] = useState<'main' | 'reschedule' | 'delete'>('main');
  const [rescheduleValue, setRescheduleValue] = useState(() =>
    toDatetimeLocal(new Date(session.scheduled_start_at))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<'success' | 'error' | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyToast = useCallback((type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setCopyToast(type);
    toastTimeoutRef.current = setTimeout(() => setCopyToast(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const copySessionId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      showCopyToast('success');
    } catch {
      showCopyToast('error');
    }
  }, [session.id, showCopyToast]);

  const copySessionUrl = useCallback(async () => {
    const base = import.meta.env.BASE_URL ?? '/';
    const url = `${window.location.origin}${base}with-friends/session/${session.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showCopyToast('success');
    } catch {
      showCopyToast('error');
    }
  }, [session.id, showCopyToast]);

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

  if (!isOpen) return null;

  const handleEnter = () => {
    onClose();
    navigate(`/with-friends/session/${session.id}${isHost ? '?host=1' : ''}`);
  };

  const handleRescheduleSave = async () => {
    const hostToken = getStoredHostToken(session.id);
    if (!hostToken) return;
    const dt = new Date(rescheduleValue);
    if (Number.isNaN(dt.getTime()) || dt.getTime() < Date.now()) {
      setError('Please select a valid future date and time.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('reschedule_session', {
      p_session_id: session.id,
      p_host_token: hostToken,
      p_scheduled_start_at: dt.toISOString(),
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    if (data === 1) {
      onRescheduled();
      onClose();
    } else {
      setError('Could not reschedule.');
    }
  };

  const handleDeleteConfirm = async () => {
    const hostToken = getStoredHostToken(session.id);
    if (!hostToken) return;
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('delete_session', {
      p_session_id: session.id,
      p_host_token: hostToken,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    if (data === 1) {
      onDeleted();
      onClose();
    } else {
      setError('Could not delete.');
    }
  };

  const handleBack = () => {
    setStep('main');
    setRescheduleValue(toDatetimeLocal(new Date(session.scheduled_start_at)));
    setError(null);
  };

  return (
    <>
      {copyToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
            copyToast === 'success'
              ? 'border border-emerald-500/40 bg-emerald-900/95 text-emerald-100'
              : 'border border-red-500/40 bg-red-900/95 text-red-100'
          }`}
        >
          {copyToast === 'success' ? 'Copied!' : 'Failed to copy'}
        </div>
      )}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
      >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl">
        <h2 id="session-modal-title" className="mb-4 text-xl font-bold text-white">
          {step === 'main' && 'Session'}
          {step === 'reschedule' && 'Reschedule'}
          {step === 'delete' && 'Delete session'}
        </h2>

        {step === 'main' && (
          <>
            <div className="mb-6 space-y-2 text-sm text-white/90">
              <p className="font-medium text-orange-400">
                {format(new Date(session.scheduled_start_at), 'EEEE, MMM d, yyyy')} at{' '}
                {format(new Date(session.scheduled_start_at), 'h:mm a')}
              </p>
              <p>{getWorkoutTitleAndDuration(session.workout_list, session.duration_minutes)}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleEnter}
                className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500"
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
            <CreateFlowSchedulePicker
              value={rescheduleValue}
              onChange={setRescheduleValue}
              minDate={new Date()}
              maxWeeksAhead={maxWeeksAhead}
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
                className="flex-1 rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
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
                {format(new Date(session.scheduled_start_at), 'MMM d, h:mm a')}
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

        <button
          type="button"
          onClick={step === 'main' ? onClose : handleBack}
          className="mt-4 w-full text-sm text-white/50 hover:text-white/80"
        >
          {step === 'main' ? 'Close' : 'Back'}
        </button>
      </div>
      </div>
    </>
  );
}
