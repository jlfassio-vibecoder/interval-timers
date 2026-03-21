/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Text entry mode for /workout/log-pasted when no hid/savedId.
 * Paste or type workout text, parse via API, then Schedule/Log Past/Save/Start Workout.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import CreateFlowSchedulePicker from '@interval-timers/schedule-picker';
import { useAppContext } from '@/contexts/AppContext';
import { parsePastedWorkoutViaApi } from '@/lib/parse-pasted-workout-client';
import PastedWorkoutSession from './PastedWorkoutSession';
import WorkoutSetPreviewLanding from './WorkoutSetPreviewLanding';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

const SAMPLE_PASTE_TEXT = `Upper body chipper - 15 min AMRAP

- 15 KB swings
- 10 push-ups
- 8 pull-ups
- 45 sec plank
- 20 min morning walk
- 30 min gardening in the yard`;

type PanelState = 'empty' | 'loading' | 'parsed' | 'error';
type Tab = 'paste' | 'text';

const RETURN_PATH = '/workout/log-pasted';

function hasExercises(workoutSet: WorkoutSetTemplate): boolean {
  return workoutSet.workouts?.some((w) => {
    if (w.exerciseBlocks?.length) {
      return w.exerciseBlocks.some((b) => (b.exercises?.length ?? 0) > 0);
    }
    return (w.blocks?.length ?? 0) > 0;
  });
}

export default function PastedWorkoutTextEntry() {
  const { user } = useAppContext();
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('empty');
  const [workoutSet, setWorkoutSet] = useState<WorkoutSetTemplate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'entry' | 'session'>('entry');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runParse = useCallback((value: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setPanelState('empty');
      setWorkoutSet(null);
      setErrorMessage(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPanelState('loading');
    setWorkoutSet(null);
    setErrorMessage(null);
    (async () => {
      try {
        const result = await parsePastedWorkoutViaApi(value, controller.signal);
        if (controller.signal.aborted) return;
        setWorkoutSet(result);
        setPanelState('parsed');
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Parse failed');
        setPanelState('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleFormatAndAdd = () => {
    runParse(text);
  };

  const handleLoadSample = () => {
    setText(SAMPLE_PASTE_TEXT);
    runParse(SAMPLE_PASTE_TEXT);
  };

  const postWorkoutHandoff = useCallback(async (): Promise<string | null> => {
    if (!workoutSet) return null;
    const res = await fetch('/api/workout-handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutSet }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
    }
    const handoffId = data.handoffId;
    if (!handoffId) throw new Error('No handoff ID returned');
    return handoffId;
  }, [workoutSet]);

  const handleSchedule = useCallback(() => {
    setScheduleError(null);
    setScheduleModalOpen(true);
  }, []);

  const handleScheduleSubmit = useCallback(async () => {
    if (!scheduleValue.trim() || !workoutSet) return;
    setScheduleError(null);
    setScheduleSubmitting(true);
    try {
      const res = await fetch('/api/schedule-workout-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutSet,
          scheduledAt: new Date(scheduleValue).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
      }
      const handoffId = data.handoffId;
      if (!handoffId) throw new Error('No handoff ID returned');
      window.location.href = `/workout/schedule-pasted?hid=${encodeURIComponent(handoffId)}`;
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduleSubmitting(false);
    }
  }, [workoutSet, scheduleValue]);

  const handleLogPast = useCallback(async () => {
    if (!workoutSet) return;
    setHandoffError(null);
    try {
      const res = await fetch('/api/quick-log-workout-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutSet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
      }
      const handoffId = data.handoffId;
      if (!handoffId) throw new Error('No handoff ID returned');
      window.location.href = `/workout/log-past-summary?hid=${encodeURIComponent(handoffId)}`;
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Failed to open log form');
    }
  }, [workoutSet]);

  const handleSave = useCallback(async () => {
    setHandoffError(null);
    try {
      const handoffId = await postWorkoutHandoff();
      if (!handoffId) return;
      window.location.href = `/workout/save-pasted?hid=${encodeURIComponent(handoffId)}`;
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Failed to save workout');
    }
  }, [postWorkoutHandoff]);

  const handleStartWorkout = useCallback(() => {
    setViewMode('session');
  }, []);

  const handleComplete = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  const handleClose = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  if (viewMode === 'session' && workoutSet) {
    return (
      <PastedWorkoutSession
        workoutSet={workoutSet}
        onClose={handleClose}
        onComplete={handleComplete}
      />
    );
  }

  const parsedReady = panelState === 'parsed' && workoutSet;
  const hasPayload = parsedReady && workoutSet && (Boolean(workoutSet.title?.trim()) || hasExercises(workoutSet));

  if (parsedReady && hasPayload) {
    if (!user?.uid) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
          <p className="text-white/70">Sign in to log this workout.</p>
          <a
            href={`/account?returnUrl=${encodeURIComponent(RETURN_PATH)}`}
            className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-black hover:bg-orange-400"
          >
            Sign in
          </a>
        </div>
      );
    }

    return (
      <>
        <WorkoutSetPreviewLanding
          workoutSet={workoutSet}
          onStartWorkout={handleStartWorkout}
          returnPath={RETURN_PATH}
          onSchedule={handleSchedule}
          onLogPast={handleLogPast}
          onSave={handleSave}
        />
        {handoffError && (
          <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-md rounded-lg bg-red-900/80 px-4 py-3 text-center text-sm text-red-100">
            {handoffError}
          </div>
        )}
      </>
    );
  }

  const pastePlaceholder = 'Paste workout here…';
  const textPlaceholder = 'Type or paste workout notes, intervals, or a lifestyle log…';
  const placeholder = tab === 'paste' ? pastePlaceholder : textPlaceholder;

  return (
    <div className="flex min-h-screen flex-col bg-black/95 text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <a href="/training-log" className="text-sm text-white/70 transition hover:text-white">
          ← Training Log
        </a>
      </header>
      <main className="flex flex-1 flex-col gap-6 overflow-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
              tab === 'paste'
                ? 'border border-amber-500/40 bg-amber-500/20 text-amber-100'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            Paste
          </button>
          <button
            type="button"
            onClick={() => setTab('text')}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
              tab === 'text'
                ? 'border border-amber-500/40 bg-amber-500/20 text-amber-100'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            Text
          </button>
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
          Enter workout
        </h1>
        <p className="text-sm text-white/70">
          {tab === 'paste'
            ? 'Paste your workout from anywhere, then click below to format it.'
            : 'Type your workout notes, then click below when ready to format.'}
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="paste-input"
              className="font-mono text-xs uppercase tracking-wider text-white/50"
            >
              {tab === 'paste' ? 'Paste here' : 'Type or paste'}
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/10"
            >
              Load Sample
            </button>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-rose-500/10 p-[1px]">
            <textarea
              id="paste-input"
              value={text}
              onChange={handleChange}
              placeholder={placeholder}
              rows={12}
              className="min-h-[240px] w-full resize-y rounded-2xl border-0 bg-neutral-950 px-4 py-3 font-mono text-sm leading-relaxed text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/45"
            />
          </div>
          <button
            type="button"
            onClick={handleFormatAndAdd}
            disabled={!text.trim() || panelState === 'loading'}
            className="w-full rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-600/40 to-orange-600/30 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-amber-50 transition-colors hover:from-amber-600/55 hover:to-orange-600/45 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {panelState === 'loading' ? 'Formatting…' : 'Format & add to workout'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-5" aria-live="polite">
          {panelState === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="text-3xl" aria-hidden>
                ✨
              </span>
              <p className="font-heading text-base text-white/70">Ready when you are</p>
              <p className="max-w-xs font-mono text-xs text-white/40">
                Type or paste your workout, then click Format & add to workout when you&apos;re done.
              </p>
            </div>
          )}
          {panelState === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="text-3xl animate-pulse" aria-hidden>
                🤖
              </span>
              <p className="font-heading text-base text-white/80">Extracting data…</p>
              <p className="font-mono text-xs text-white/45">AI parsing your text</p>
            </div>
          )}
          {panelState === 'error' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="text-3xl" aria-hidden>
                ⚠️
              </span>
              <p className="font-heading text-base text-red-300">Parse failed</p>
              <p className="max-w-sm font-mono text-xs text-white/60">{errorMessage}</p>
            </div>
          )}
          {panelState === 'parsed' && workoutSet && !hasPayload && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <span className="text-3xl" aria-hidden>
                ⚠️
              </span>
              <p className="font-heading text-base text-amber-300">No exercises found</p>
              <p className="max-w-sm font-mono text-xs text-white/60">
                Try editing the text and clicking Format & add to workout again.
              </p>
            </div>
          )}
        </div>
      </main>

      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setScheduleModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-black/90 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-white">Schedule Workout</h2>
            <CreateFlowSchedulePicker
              value={scheduleValue}
              onChange={setScheduleValue}
              minDate={new Date()}
              maxWeeksAhead={52}
              description="Pick when to schedule this workout. It will be added to your calendar."
            />
            {scheduleError && <p className="mt-2 text-sm text-red-300">{scheduleError}</p>}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={!scheduleValue.trim() || scheduleSubmitting}
                className="flex-1 rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scheduleSubmitting ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
