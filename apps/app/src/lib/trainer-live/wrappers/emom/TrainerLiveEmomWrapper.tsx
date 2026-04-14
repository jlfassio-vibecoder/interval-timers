import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import { supabase } from '@/lib/supabase/supabase-instance';
import TrainerLiveEmomTimerBackground from '@/components/react/trainer/live/TrainerLiveEmomTimerBackground';
import TrainerLiveTabataVideoSpotlightPicker from '@/components/react/trainer/live/TrainerLiveTabataVideoSpotlightPicker';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import {
  computeEmomServerClock,
  emomRingProgress,
} from '@/lib/trainer-live/emom/computeEmomDisplay';
import type { TrainerLiveWrapperBaseProps } from '../types';
import { parseEmomSessionIdFromWrapperConfig } from '../parseWrapperConfig';

type EmomSessionRow = {
  id: string;
  started_at: string | null;
  paused_at: string | null;
  pause_accum_ms: number;
  /** Persisted on session; Trainer Live EMOM prep countdown uses `SETUP_DURATION_SECONDS` only. */
  warmup_seconds: number;
  round_count: number;
  status: 'active' | 'ended';
  workout_list: string[];
};

type LocalResting = { roundIndex: number; taskFinishedAt: number };

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function parseEmomWorkoutList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : x != null ? String(x) : ''))
    .filter((s) => s.trim().length > 0);
}

/**
 * `emom_round_logs.logged_weight` (text): per-exercise weights as JSON
 * `{"emomWeights":["135 lb","95 lb"]}` (indices align with `emom_sessions.workout_list`).
 * Legacy rows: plain text means a single weight for exercise index 0.
 */
const EMOM_LOGGED_WEIGHT_JSON_KEY = 'emomWeights';

function emomWeightDraftsStorageKey(emomSessionId: string, participantId: string): string {
  return `trainer-live-emom-weight-drafts:${emomSessionId}:${participantId}`;
}

function serializeEmomLoggedWeights(drafts: string[]): string | null {
  const trimmed = drafts.map((s) => s.trim());
  if (!trimmed.some((s) => s.length > 0)) return null;
  return JSON.stringify({ [EMOM_LOGGED_WEIGHT_JSON_KEY]: trimmed });
}

/** Same as `AmrapTimerDisplay` `EMBED_METRIC_CARD_SURFACE` — nearly transparent tiles over live video. */
const TL_EMBED_METRIC_SURFACE = 'rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4';

const TL_EMBED_OVERLAY_TITLE_SHADOW = 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]';

export default function TrainerLiveEmomWrapper({
  wrapperConfig,
  trainerLiveSessionId,
  participantId,
  authUserId,
  role,
  onWrapperError,
  videoTileExcludeUid,
}: TrainerLiveWrapperBaseProps) {
  const emomSessionId = parseEmomSessionIdFromWrapperConfig(wrapperConfig);
  const isTrainer = role === 'trainer';
  const { setTimerBackgroundSpotlightParticipantId } = useTrainerLiveTimerBackground();
  const [row, setRow] = useState<EmomSessionRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localResting, setLocalResting] = useState<LocalResting | null>(null);
  const [weightDrafts, setWeightDrafts] = useState<string[]>(['']);
  const [loggedWorkSeconds, setLoggedWorkSeconds] = useState<number | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const secInMinRef = useRef(0);
  /** One-time read from sessionStorage per EMOM session while still in waiting/setup. */
  const emomWeightDraftsHydratedRef = useRef(false);

  const weightStorageKey = useMemo(() => {
    if (!emomSessionId || !participantId) return null;
    return emomWeightDraftsStorageKey(emomSessionId, participantId);
  }, [emomSessionId, participantId]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isTrainer) return;
    return () => {
      setTimerBackgroundSpotlightParticipantId(null);
    };
  }, [isTrainer, setTimerBackgroundSpotlightParticipantId]);

  useEffect(() => {
    if (!emomSessionId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('emom_sessions')
        .select(
          'id, started_at, paused_at, pause_accum_ms, warmup_seconds, round_count, status, workout_list'
        )
        .eq('id', emomSessionId)
        .single();
      if (cancelled) return;
      if (error) {
        setLoadErr(error.message);
        return;
      }
      if (data) {
        const d = data as Record<string, unknown>;
        setRow({
          id: String(d.id),
          started_at:
            typeof d.started_at === 'string' || d.started_at === null ? d.started_at : null,
          paused_at: typeof d.paused_at === 'string' || d.paused_at === null ? d.paused_at : null,
          pause_accum_ms: typeof d.pause_accum_ms === 'number' ? d.pause_accum_ms : 0,
          warmup_seconds: typeof d.warmup_seconds === 'number' ? d.warmup_seconds : 10,
          round_count: typeof d.round_count === 'number' ? d.round_count : 1,
          status: d.status === 'ended' ? 'ended' : 'active',
          workout_list: parseEmomWorkoutList(d.workout_list),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emomSessionId]);

  useEffect(() => {
    if (!emomSessionId) return;
    const channel = supabase
      .channel(`emom-sess-${emomSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emom_sessions',
          filter: `id=eq.${emomSessionId}`,
        },
        (payload) => {
          const n = payload.new as Record<string, unknown> | null;
          if (!n?.id) return;
          setRow((prev) => ({
            id: String(n.id),
            started_at:
              n.started_at === null || typeof n.started_at === 'string'
                ? (n.started_at as string | null)
                : (prev?.started_at ?? null),
            paused_at:
              n.paused_at === null || typeof n.paused_at === 'string'
                ? (n.paused_at as string | null)
                : (prev?.paused_at ?? null),
            pause_accum_ms:
              typeof n.pause_accum_ms === 'number' ? n.pause_accum_ms : (prev?.pause_accum_ms ?? 0),
            warmup_seconds:
              typeof n.warmup_seconds === 'number'
                ? n.warmup_seconds
                : (prev?.warmup_seconds ?? 10),
            round_count:
              typeof n.round_count === 'number' ? n.round_count : (prev?.round_count ?? 1),
            status: n.status === 'ended' ? 'ended' : 'active',
            workout_list:
              n.workout_list !== undefined
                ? parseEmomWorkoutList(n.workout_list)
                : (prev?.workout_list ?? []),
          }));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [emomSessionId]);

  const derived = useMemo(() => {
    if (!row) return null;
    return computeEmomServerClock(
      nowMs,
      row.started_at,
      row.paused_at,
      row.pause_accum_ms,
      row.round_count,
      row.status
    );
  }, [row, nowMs]);

  useEffect(() => {
    if (derived?.phase === 'working') {
      secInMinRef.current = derived.secondsInMinute;
    }
  }, [derived]);

  useEffect(() => {
    if (!derived) return;
    if (derived.phase === 'finished') {
      setLocalResting(null);
      return;
    }
    setLocalResting((lr) => {
      if (!lr) return null;
      return derived.roundIndex > lr.roundIndex ? null : lr;
    });
  }, [derived]);

  const roundIndex = derived?.roundIndex;
  const workoutListLen = row?.workout_list.length ?? 0;

  useLayoutEffect(() => {
    emomWeightDraftsHydratedRef.current = false;
    setWeightDrafts(['']);
  }, [emomSessionId]);

  /**
   * Restore pre-start weight drafts from sessionStorage (waiting/setup only), then pad to workout length.
   * useLayoutEffect runs before paint so the first persist effect does not clobber stored values.
   */
  useLayoutEffect(() => {
    if (!row || !derived || row.id !== emomSessionId) return;
    const n = row.workout_list.length;
    const preWork = derived.phase === 'waiting' || derived.phase === 'setup';

    if (weightStorageKey && preWork && !emomWeightDraftsHydratedRef.current) {
      try {
        const raw = sessionStorage.getItem(weightStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
            const next =
              n === 0 ? [parsed[0] ?? ''] : Array.from({ length: n }, (_, i) => parsed[i] ?? '');
            emomWeightDraftsHydratedRef.current = true;
            setWeightDrafts(next);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      emomWeightDraftsHydratedRef.current = true;
    } else if (!preWork && !emomWeightDraftsHydratedRef.current) {
      emomWeightDraftsHydratedRef.current = true;
    }

    setWeightDrafts((prev) => {
      if (n === 0) {
        if (prev.length <= 1) return prev;
        return [prev[0] ?? ''];
      }
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? '');
    });
  }, [row, emomSessionId, derived?.phase, workoutListLen, weightStorageKey]);

  /** Persist editable pre-work drafts (waiting + setup) so refresh does not lose them. */
  useEffect(() => {
    if (!weightStorageKey || !derived) return;
    if (derived.phase !== 'waiting' && derived.phase !== 'setup') return;
    try {
      sessionStorage.setItem(weightStorageKey, JSON.stringify(weightDrafts));
    } catch {
      /* quota / private mode */
    }
  }, [weightStorageKey, derived?.phase, weightDrafts]);

  useEffect(() => {
    if (roundIndex == null) return;
    setLoggedWorkSeconds(null);
  }, [roundIndex]);

  const logRound = useCallback(
    async (args: {
      roundIndex: number;
      workSeconds: number;
      completed: boolean;
      loggedWeight: string | null;
    }) => {
      if (!emomSessionId) return;
      setLogBusy(true);
      try {
        if (authUserId) {
          const { error } = await supabase.rpc('trainer_live_emom_log_round', {
            p_emom_session_id: emomSessionId,
            p_participant_id: participantId,
            p_round_index: args.roundIndex,
            p_work_seconds: args.workSeconds,
            p_completed: args.completed,
            p_logged_weight: args.loggedWeight,
          });
          if (error) onWrapperError?.(error.message);
        } else {
          const { error } = await supabase.rpc('trainer_live_emom_log_round_for_participant', {
            p_trainer_live_session_id: trainerLiveSessionId,
            p_participant_id: participantId,
            p_emom_session_id: emomSessionId,
            p_round_index: args.roundIndex,
            p_work_seconds: args.workSeconds,
            p_completed: args.completed,
            p_logged_weight: args.loggedWeight,
          });
          if (error) onWrapperError?.(error.message);
        }
      } finally {
        setLogBusy(false);
      }
    },
    [authUserId, emomSessionId, onWrapperError, participantId, trainerLiveSessionId]
  );

  const runSessionRpc = useCallback(
    async (fn: () => ReturnType<typeof supabase.rpc>) => {
      setSessionBusy(true);
      try {
        const { error } = await fn();
        if (error) onWrapperError?.(error.message);
      } finally {
        setSessionBusy(false);
      }
    },
    [onWrapperError]
  );

  const handleTaskComplete = useCallback(async () => {
    if (!row || !derived || derived.phase !== 'working') return;
    const ws = secInMinRef.current;
    setLoggedWorkSeconds(ws);
    setLocalResting({ roundIndex: derived.roundIndex, taskFinishedAt: ws });
    await logRound({
      roundIndex: derived.roundIndex,
      workSeconds: ws,
      completed: true,
      loggedWeight: null,
    });
  }, [derived, logRound, row]);

  const handleWeightCommit = useCallback(async () => {
    if (!row || !derived) return;
    if (derived.phase === 'waiting') return;
    if (derived.phase !== 'working') return;
    if (loggedWorkSeconds == null) return;
    const n = row.workout_list.length;
    const paddedDrafts = Array.from({ length: n }, (_, i) => weightDrafts[i] ?? '');
    const loggedWeight =
      n === 0
        ? (() => {
            const t = (weightDrafts[0] ?? '').trim();
            return t.length ? t : null;
          })()
        : serializeEmomLoggedWeights(paddedDrafts);
    await logRound({
      roundIndex: derived.roundIndex,
      workSeconds: loggedWorkSeconds,
      completed: true,
      loggedWeight,
    });
  }, [derived, logRound, loggedWorkSeconds, row, weightDrafts]);

  if (!emomSessionId) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        Missing or invalid EMOM session. Ask the trainer to start EMOM again.
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
        {loadErr}
      </div>
    );
  }

  if (!row || !derived) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-black/40 px-3 py-4 text-sm text-white/70"
        data-testid="trainer-live-emom-loading"
      >
        Loading EMOM…
      </div>
    );
  }

  const restingOverlay =
    !!localResting && localResting.roundIndex === derived.roundIndex && derived.phase === 'working';

  const displayLabel = (() => {
    if (derived.phase === 'waiting') return 'READY';
    if (derived.phase === 'setup') return 'SETUP';
    if (derived.phase === 'finished') return 'DONE';
    if (restingOverlay) return 'REST';
    return 'WORK';
  })();

  const displaySub = (() => {
    if (derived.phase === 'waiting') {
      return isTrainer
        ? 'Press Start when your class is ready.'
        : 'Waiting for your trainer to start.';
    }
    if (derived.phase === 'finished') return 'Block complete';
    return '';
  })();

  const displayValue = (() => {
    if (derived.phase === 'waiting') return '00:00';
    if (derived.phase === 'setup') {
      return formatMmSs(derived.countdownRemaining);
    }
    if (derived.phase === 'finished') return '00:00';
    return formatMmSs(derived.secondsInMinute);
  })();

  const showStart = isTrainer && derived.phase === 'waiting';
  const isPaused = row.paused_at != null;
  const clockRunning =
    row.started_at != null &&
    derived.phase !== 'waiting' &&
    derived.phase !== 'finished' &&
    row.status === 'active';

  const showHostSessionControls =
    isTrainer && clockRunning && (derived.phase === 'setup' || derived.phase === 'working');

  const ringP = emomRingProgress(
    derived.phase,
    SETUP_DURATION_SECONDS,
    derived.countdownRemaining,
    derived.secondsInMinute
  );

  const hostOverlayControls =
    isTrainer && showHostSessionControls ? (
      <div className={`${TL_EMBED_METRIC_SURFACE} flex flex-col gap-2`}>
        {!isPaused ? (
          <button
            type="button"
            disabled={sessionBusy}
            onClick={() =>
              void runSessionRpc(() =>
                supabase.rpc('trainer_live_emom_pause', { p_emom_session_id: emomSessionId })
              )
            }
            className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/20 disabled:opacity-40"
          >
            PAUSE
          </button>
        ) : (
          <button
            type="button"
            disabled={sessionBusy}
            onClick={() =>
              void runSessionRpc(() =>
                supabase.rpc('trainer_live_emom_resume', { p_emom_session_id: emomSessionId })
              )
            }
            className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/20 disabled:opacity-40"
          >
            RESUME
          </button>
        )}
        {derived.phase === 'setup' && !isPaused ? (
          <button
            type="button"
            disabled={sessionBusy}
            onClick={() =>
              void runSessionRpc(() =>
                supabase.rpc('trainer_live_emom_skip_prep', { p_emom_session_id: emomSessionId })
              )
            }
            className="w-full rounded-xl border border-white/20 py-2.5 text-xs font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-40"
          >
            SKIP
          </button>
        ) : null}
        <button
          type="button"
          disabled={sessionBusy}
          onClick={() =>
            void runSessionRpc(() =>
              supabase.rpc('trainer_live_emom_finish_session', {
                p_emom_session_id: emomSessionId,
              })
            )
          }
          className="w-full rounded-xl border border-white/20 py-2.5 text-xs font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-40"
        >
          FINISH
        </button>
      </div>
    ) : null;

  const clockValueColor =
    derived.phase === 'finished'
      ? 'text-white/70'
      : derived.phase === 'working'
        ? 'text-teal-400'
        : 'text-white/90';

  const isClockMmSs = /^\d{1,2}:\d{2}$/.test(displayValue);

  const readyExerciseLines = row.workout_list;
  /** Waiting + setup: editable. After setup: locked until Task Complete for this round; then editable to update. */
  const weightInputsEditable =
    derived.phase === 'waiting' ||
    derived.phase === 'setup' ||
    (derived.phase === 'working' && loggedWorkSeconds != null);

  const exerciseSectionBelowVideo =
    readyExerciseLines.length > 0 && derived.phase !== 'finished' ? (
      <div
        className="w-full max-w-xl rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:px-4"
        data-testid="trainer-live-emom-exercise-weights"
      >
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-white/50">
          Exercises
        </p>
        {derived.phase === 'working' && loggedWorkSeconds == null ? (
          <p className="mb-2 text-[10px] leading-snug text-white/40">
            Locked until Task Complete; you can edit after. Last weights carry into the next round.
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          {readyExerciseLines.map((line, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3"
              data-testid={`trainer-live-emom-exercise-weight-row-${i}`}
            >
              <p className="min-w-0 flex-1 text-left text-xs leading-snug text-white/90">{line}</p>
              <textarea
                value={weightDrafts[i] ?? ''}
                disabled={!weightInputsEditable}
                onChange={(e) =>
                  setWeightDrafts((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                onBlur={() => void handleWeightCommit()}
                placeholder="Weight (optional)"
                rows={2}
                className="min-h-[2.75rem] w-full shrink-0 resize-y rounded-lg border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/30 disabled:opacity-50 sm:max-w-[11rem]"
              />
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const videoTopLeftOverlay = (
    <div className="flex w-[13rem] max-w-[min(100%,13rem)] flex-col gap-2">
      <h2
        className={`font-display text-2xl font-bold leading-tight text-white ${TL_EMBED_OVERLAY_TITLE_SHADOW}`}
      >
        EMOM
      </h2>
      {showStart ? (
        <button
          type="button"
          disabled={sessionBusy}
          onClick={() =>
            void runSessionRpc(() =>
              supabase.rpc('trainer_live_emom_start_clock', { p_emom_session_id: emomSessionId })
            )
          }
          className="bg-orange-600 hover:bg-orange-500 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(234,88,12,0.35)] disabled:opacity-40"
        >
          Start
        </button>
      ) : null}
      {hostOverlayControls}
      <div
        className={`${TL_EMBED_METRIC_SURFACE} flex aspect-square min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden text-center`}
      >
        {derived.phase === 'waiting' ? (
          <div className="flex w-full flex-col items-center justify-center gap-1">
            <p className="text-[15px] font-bold uppercase tracking-widest opacity-80">Minutes</p>
            <div
              className="flex w-full min-w-0 justify-center overflow-hidden font-bold tabular-nums text-white/90"
              style={{ containerType: 'inline-size' }}
            >
              <span style={{ fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }}>
                {row.round_count}
              </span>
            </div>
          </div>
        ) : null}
        <div className="mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80">
          {displayLabel}
        </div>
        <div
          className={`flex w-full min-w-0 justify-center overflow-hidden text-center font-mono font-bold tabular-nums ${clockValueColor}`}
          style={{ containerType: 'inline-size' }}
        >
          {isClockMmSs ? (
            <span style={{ fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }}>{displayValue}</span>
          ) : (
            <span className="text-[clamp(1.5rem,5vmin,4rem)]">{displayValue}</span>
          )}
        </div>
        {derived.phase !== 'waiting' && derived.phase !== 'finished' ? (
          <div className="mt-1 flex h-16 w-16 shrink-0 items-center justify-center opacity-90">
            <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="2" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2"
                strokeDasharray={`${Math.min(1, Math.max(0, ringP)) * 251.2} 251.2`}
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>
        ) : null}
        {displaySub.trim() ? (
          <p
            className={`mt-1 max-w-[11rem] text-balance text-xs leading-snug ${
              derived.phase === 'waiting' || derived.phase === 'finished'
                ? 'text-white/80'
                : 'text-white/65'
            }`}
          >
            {displaySub}
          </p>
        ) : null}
      </div>
    </div>
  );

  const videoTopRightOverlay =
    derived.phase === 'waiting' || derived.phase === 'finished' ? null : (
      <div
        className={`${TL_EMBED_METRIC_SURFACE} flex w-full flex-col items-center gap-3 text-center`}
      >
        <p className="text-[13px] font-bold uppercase tracking-widest text-white/75">
          Round {derived.roundIndex} of {derived.totalRounds}
        </p>
        {derived.phase === 'working' && !restingOverlay ? (
          <button
            type="button"
            disabled={logBusy || isPaused}
            onClick={() => void handleTaskComplete()}
            className="w-full rounded-2xl bg-teal-500 px-4 py-3 text-sm font-bold text-black shadow-[0_0_24px_rgba(45,212,191,0.35)] hover:bg-teal-400 disabled:opacity-40"
          >
            TASK COMPLETE
          </button>
        ) : null}
        {restingOverlay && localResting ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Rest earned</p>
            <p className="font-mono text-2xl font-bold text-teal-400">
              {60 - localResting.taskFinishedAt}s
            </p>
          </div>
        ) : null}
      </div>
    );

  const participantRail = (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      {derived.phase === 'finished' ? (
        <div className="text-sm text-white/85">Block complete</div>
      ) : (
        <>
          {readyExerciseLines.length === 0 ? (
            <div className="w-full max-w-[14rem] text-left">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/50">
                Weight (optional)
              </label>
              <textarea
                value={weightDrafts[0] ?? ''}
                disabled={!weightInputsEditable}
                onChange={(e) => setWeightDrafts([e.target.value])}
                onBlur={() => void handleWeightCommit()}
                placeholder="e.g. 135 lb"
                rows={2}
                className="min-h-[2.75rem] w-full resize-y rounded-lg border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/30 disabled:opacity-50"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div
      className="trainer-live-emom-embed relative w-full min-w-0 text-white"
      data-region="trainer-live-emom-interval"
      data-testid="trainer-live-emom-shell"
    >
      {logBusy ? (
        <div className="absolute left-2 top-2 z-[5] text-[10px] text-white/50">Saving…</div>
      ) : null}

      <TrainerLiveEmomTimerBackground
        trainerLiveSessionId={trainerLiveSessionId}
        participantId={participantId}
        role={role}
        videoTileExcludeUid={videoTileExcludeUid}
        videoTopLeftOverlay={videoTopLeftOverlay}
        videoTopRightOverlay={videoTopRightOverlay}
      />

      <div className="relative z-10 flex flex-col gap-4 px-3 pb-4 pt-4 sm:px-4">
        {isTrainer ? (
          <TrainerLiveTabataVideoSpotlightPicker
            sessionId={trainerLiveSessionId}
            trainerParticipantId={participantId}
          />
        ) : null}
        {exerciseSectionBelowVideo}
        {participantRail}
      </div>
    </div>
  );
}
