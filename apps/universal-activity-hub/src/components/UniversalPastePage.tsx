import { useCallback, useEffect, useRef, useState } from 'react';
import { parsePastedWorkoutViaApi } from '@/lib/parseViaApi';
import { SAMPLE_PASTE_TEXT } from '@/lib/samplePasteText';
import type { WorkoutSetTemplate } from '@/types/workoutSetTemplate';
import WorkoutSetPreview from './WorkoutSetPreview';
import UniversalPasteFooter from './UniversalPasteFooter';

type PanelState = 'empty' | 'loading' | 'parsed' | 'error';

const DEBOUNCE_MS = 600;

export default function UniversalPastePage() {
  const [text, setText] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('empty');
  const [workoutSet, setWorkoutSet] = useState<WorkoutSetTemplate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runParse = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
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
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const controller = new AbortController();
      abortRef.current = controller;
      setPanelState('loading');
      setWorkoutSet(null);
      setErrorMessage(null);
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
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    runParse(v);
  };

  const handleLoadSample = () => {
    setText(SAMPLE_PASTE_TEXT);
    runParse(SAMPLE_PASTE_TEXT);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
          ✨ Universal Activity Hub
        </p>
        <h1 className="font-heading mt-2 text-3xl font-bold text-white sm:text-4xl">
          Paste any workout or day
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          🤖 Raw text from ChatGPT, Apple Notes, or a photo caption — AI extracts structure for
          logging, scheduling, or timers. Training Log in the main app stays the home for saved
          activity.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex min-h-[320px] flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="paste-input"
              className="font-mono text-xs uppercase tracking-wider text-white/50"
            >
              📋 Paste here
            </label>
            <button
              type="button"
              onClick={handleLoadSample}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/10"
            >
              Load Sample
            </button>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/35 via-orange-500/25 to-rose-500/20 p-[1px]">
            <textarea
              id="paste-input"
              value={text}
              onChange={handleChange}
              placeholder="Paste workout notes, intervals, or a lifestyle log…"
              rows={14}
              className="min-h-[280px] w-full resize-y rounded-2xl border-0 bg-neutral-950 px-4 py-3 font-mono text-sm leading-relaxed text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/45"
            />
          </div>
        </div>

        <div
          className="flex min-h-[320px] flex-col rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6"
          aria-live="polite"
        >
          {panelState === 'empty' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="text-4xl" aria-hidden>
                ✨
              </span>
              <p className="font-heading text-lg text-white/70">Awaiting Input</p>
              <p className="max-w-xs font-mono text-xs text-white/40">
                Type or paste on the left — AI parses after a short pause. Start the app dev server
                (port 3006) for the parse API.
              </p>
            </div>
          )}
          {panelState === 'loading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <span className="text-4xl animate-pulse-soft" aria-hidden>
                🤖
              </span>
              <p className="font-heading text-lg text-white/80">Extracting Data…</p>
              <p className="font-mono text-xs text-white/45">AI parsing your text</p>
            </div>
          )}
          {panelState === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <span className="text-4xl" aria-hidden>
                ⚠️
              </span>
              <p className="font-heading text-lg text-red-300">Parse failed</p>
              <p className="max-w-sm font-mono text-xs text-white/60">{errorMessage}</p>
              <p className="font-mono text-[10px] text-white/40">
                Ensure the app runs on port 3006 and GEMINI_API_KEY or GOOGLE_PROJECT_ID is set in
                apps/app/.env.local.
              </p>
            </div>
          )}
          {panelState === 'parsed' && workoutSet && (
            <WorkoutSetPreview workoutSet={workoutSet} />
          )}
        </div>
      </div>

      <UniversalPasteFooter workoutSet={panelState === 'parsed' ? workoutSet : null} />
    </div>
  );
}
