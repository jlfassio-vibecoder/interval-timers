/**
 * AMRAP With Friends result detail drawer: full results, consistency chart, Copy, Do Again, Schedule.
 */

import React, { useState, useEffect } from 'react';
import { X, Play, Calendar, Copy } from 'lucide-react';
import type { AmrapSessionResult } from '@/lib/supabase/client/amrap-session-results';
import { buildAmrapResultsText } from '@/lib/amrap-results-text';
import RoundConsistencyChart from './RoundConsistencyChart';

export interface AmrapResultDetailDrawerProps {
  result: AmrapSessionResult | null;
  onClose: () => void;
  onDoAgain: (result: AmrapSessionResult) => void;
  onSchedule: (result: AmrapSessionResult) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSessionUrl(sessionId: string): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin;
  return `${base}/amrap/with-friends/session/${sessionId}`;
}

const AmrapResultDetailDrawer: React.FC<AmrapResultDetailDrawerProps> = ({
  result,
  onClose,
  onDoAgain,
  onSchedule,
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!result) return null;

  const sessionUrl = getSessionUrl(result.session_id);
  const resultsText = buildAmrapResultsText(
    result.workout_list,
    result.total_rounds,
    result.duration_minutes,
    sessionUrl,
    {
      workoutTitle: result.workout_name ?? undefined,
      roundDurations: result.round_durations.length > 0 ? result.round_durations : undefined,
    }
  );

  const workoutLabel = result.workout_name ?? result.workout_list?.[0]?.trim() ?? 'AMRAP';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resultsText);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
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
        aria-labelledby="amrap-result-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="amrap-result-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            AMRAP Result
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
          <div className="mb-4">
            <p className="font-heading text-xl font-black text-white">
              {workoutLabel}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/40">
              {formatDate(result.completed_at)} · {result.total_rounds} rounds · {result.duration_minutes} min
            </p>
          </div>

          {result.round_durations.length > 0 && (
            <RoundConsistencyChart roundDurations={result.round_durations} />
          )}

          <div className="mb-4">
            <p className="mb-2 font-mono text-[10px] uppercase text-white/50">Results</p>
            <pre className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4 font-sans text-sm text-white/90 whitespace-pre-wrap break-words">
              {resultsText}
            </pre>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white transition-colors hover:bg-white/20"
            >
              <Copy className="h-4 w-4" />
              Copy results
            </button>
            {copyStatus === 'success' && (
              <span className="text-xs text-emerald-400">Copied!</span>
            )}
            {copyStatus === 'error' && (
              <span className="text-xs text-red-400">Failed to copy</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onDoAgain(result)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-light/50 bg-orange-light/20 py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors hover:bg-orange-light/30"
            >
              <Play className="h-4 w-4" />
              Do Again
            </button>
            <button
              type="button"
              onClick={() => onSchedule(result)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 py-3 font-heading text-sm font-black uppercase text-white transition-colors hover:bg-white/20"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
          </div>

          <p className="mt-4 text-center">
            <a
              href={sessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-400 hover:underline"
            >
              View session
            </a>
          </p>
        </div>
      </div>
    </>
  );
};

export default AmrapResultDetailDrawer;
