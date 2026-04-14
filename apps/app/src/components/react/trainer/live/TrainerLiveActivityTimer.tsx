import { useEffect, useMemo, useState } from 'react';
import { setStoredHostToken, setStoredParticipantId } from 'amrap/embed';
import { isValidAttachWorkoutInput } from '@interval-timers/amrap-workout-picker';
import { supabase } from '@/lib/supabase/supabase-instance';
import { useTrainerLiveActivitySession } from '@/hooks/useTrainerLiveActivitySession';
import type { TrainerLiveShell } from '@/lib/trainer-live/shells';
import type { TrainerLiveActivitySegmentRow } from '@/lib/trainer-live/activity-types';
import { isValidTabataAttachInput } from '@/lib/trainer-live/tabata-workout-list-adapter';
import {
  getPreferredOrFirstBlock,
  type PreferredBlockIdsByKind,
  sessionPlanHasAnyBlocks,
} from '@/lib/trainer-live/session-workout-plan/prefill';
import {
  loadPreferredPlanBlocksFromSessionStorage,
  loadSessionWorkoutPlanFromSessionStorage,
  savePreferredPlanBlocksToSessionStorage,
  saveSessionWorkoutPlanToSessionStorage,
} from '@/lib/trainer-live/session-workout-plan/storage';
import type { TrainerLiveSessionWorkoutPlan } from '@/lib/trainer-live/session-workout-plan/types';
import { nonEmptyTrimmedExerciseLines } from '@/lib/trainer-live/session-workout-plan/exerciseLines';
import { segmentLabelFromPlanExercises } from '@/lib/trainer-live/session-workout-plan/warmupCooldownLabel';
import TrainerLiveAmrapWorkoutPickerModal from './TrainerLiveAmrapWorkoutPickerModal';
import TrainerLiveEmomRoundModal from './TrainerLiveEmomRoundModal';
import TrainerLiveSessionWorkoutPlanEditor from './TrainerLiveSessionWorkoutPlanEditor';
import TrainerLiveTabataWorkoutPickerModal from './TrainerLiveTabataWorkoutPickerModal';

function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function currentSegmentLabel(segments: TrainerLiveActivitySegmentRow[] | undefined): string {
  if (!segments?.length) return '—';
  const open = segments.filter((x) => !x.ended_at).sort((a, b) => a.ordinal - b.ordinal);
  if (open.length) {
    const s = open[open.length - 1];
    return s.label || s.segment_type;
  }
  const last = [...segments].sort((a, b) => b.ordinal - a.ordinal)[0];
  return last ? `${last.label || last.segment_type} (done)` : '—';
}

export default function TrainerLiveActivityTimer({
  sessionId,
  participantId,
  authUserId,
  role,
  shell,
  compact = false,
  drawerLayout = false,
}: {
  sessionId: string;
  participantId: string;
  authUserId: string | null;
  role: 'trainer' | 'client';
  shell: TrainerLiveShell;
  compact?: boolean;
  /** Stack session time, current block, and controls vertically (left activity drawer). */
  drawerLayout?: boolean;
}) {
  const { state, loading, error, refresh, displayElapsedSec } = useTrainerLiveActivitySession({
    trainerLiveSessionId: sessionId,
    participantId,
    authUserId,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [amrapPickerOpen, setAmrapPickerOpen] = useState(false);
  const [amrapPickerKey, setAmrapPickerKey] = useState(0);
  const [tabataPickerOpen, setTabataPickerOpen] = useState(false);
  const [tabataPickerKey, setTabataPickerKey] = useState(0);
  const [emomPickerOpen, setEmomPickerOpen] = useState(false);
  const [emomPickerKey, setEmomPickerKey] = useState(0);
  const [warmupTextSizeStep, setWarmupTextSizeStep] = useState(1);

  const [sessionWorkoutPlan, setSessionWorkoutPlan] = useState<TrainerLiveSessionWorkoutPlan>({
    blocks: [],
  });
  const [preferredBlockIds, setPreferredBlockIds] = useState<PreferredBlockIdsByKind>({});

  const canIntervalSegments = shell === 'countdown_timer';
  const isTrainer = role === 'trainer';

  useEffect(() => {
    if (role !== 'trainer') return;
    const loaded = loadSessionWorkoutPlanFromSessionStorage(sessionId);
    const preferredLoaded = loadPreferredPlanBlocksFromSessionStorage(sessionId);
    if (loaded) setSessionWorkoutPlan(loaded);
    else setSessionWorkoutPlan({ blocks: [] });
    setPreferredBlockIds(preferredLoaded);
  }, [sessionId, role]);

  useEffect(() => {
    if (role !== 'trainer') return;
    saveSessionWorkoutPlanToSessionStorage(sessionId, sessionWorkoutPlan);
  }, [sessionId, sessionWorkoutPlan, role]);

  useEffect(() => {
    if (role !== 'trainer') return;
    savePreferredPlanBlocksToSessionStorage(sessionId, preferredBlockIds);
  }, [preferredBlockIds, role, sessionId]);

  const amrapPrefill = useMemo(() => {
    const b = getPreferredOrFirstBlock(sessionWorkoutPlan, 'amrap', preferredBlockIds.amrap);
    const list = b ? nonEmptyTrimmedExerciseLines(b.exercises) : [];
    if (!b || b.kind !== 'amrap' || !isValidAttachWorkoutInput(b.durationMinutes, list)) return null;
    return { durationMinutes: b.durationMinutes, workoutList: list };
  }, [sessionWorkoutPlan, preferredBlockIds.amrap]);

  const tabataPrefill = useMemo(() => {
    const b = getPreferredOrFirstBlock(sessionWorkoutPlan, 'tabata', preferredBlockIds.tabata);
    const list = b ? nonEmptyTrimmedExerciseLines(b.exercises) : [];
    if (!b || b.kind !== 'tabata' || !isValidTabataAttachInput(b.roundCount, list)) return null;
    return { roundCount: b.roundCount, workoutList: list };
  }, [sessionWorkoutPlan, preferredBlockIds.tabata]);

  const emomPrefill = useMemo(() => {
    const b = getPreferredOrFirstBlock(sessionWorkoutPlan, 'emom', preferredBlockIds.emom);
    if (!b || b.kind !== 'emom') return null;
    if (b.roundCount < 1 || b.roundCount > 120) return null;
    return { roundCount: b.roundCount, workoutList: nonEmptyTrimmedExerciseLines(b.exercises) };
  }, [sessionWorkoutPlan, preferredBlockIds.emom]);

  const currentOpenSegment = useMemo(() => {
    const segments = state.segments;
    if (!segments?.length) return null;
    const open = segments.filter((x) => !x.ended_at).sort((a, b) => a.ordinal - b.ordinal);
    return open.length ? open[open.length - 1] ?? null : null;
  }, [state.segments]);

  const currentWarmupExercises = useMemo(() => {
    if (currentOpenSegment?.segment_type !== 'warmup') return [];
    const warmupBlock = getPreferredOrFirstBlock(
      sessionWorkoutPlan,
      'warmup',
      preferredBlockIds.warmup
    );
    if (!warmupBlock || warmupBlock.kind !== 'warmup') return [];
    return nonEmptyTrimmedExerciseLines(warmupBlock.exercises);
  }, [currentOpenSegment?.segment_type, sessionWorkoutPlan, preferredBlockIds.warmup]);

  const warmupTextClass =
    warmupTextSizeStep <= 0
      ? 'text-xs'
      : warmupTextSizeStep === 1
        ? 'text-sm'
        : warmupTextSizeStep === 2
          ? 'text-base'
          : 'text-lg';

  const showSessionPlanEditor = isTrainer && canIntervalSegments;

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(key);
    setLocalErr(null);
    try {
      const { error: e } = await fn();
      if (e) setLocalErr(e.message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const err = error || localErr;

  if (loading && !state.has_activity) {
    return (
      <div
        className={`text-xs text-white/50 ${compact ? 'py-1' : 'py-2'}`}
        data-testid="trainer-live-activity-timer-loading"
      >
        Activity timer…
      </div>
    );
  }

  return (
    <>
      {showSessionPlanEditor && !state.has_activity ? (
        <div className={compact ? 'mb-2' : 'mb-3'}>
          <TrainerLiveSessionWorkoutPlanEditor
            plan={sessionWorkoutPlan}
            onChange={setSessionWorkoutPlan}
            onImportedBlock={(kind, blockId) =>
              setPreferredBlockIds((prev) => ({ ...prev, [kind]: blockId }))
            }
            disabled={!!busy}
            compact={compact}
          />
        </div>
      ) : null}
      {showSessionPlanEditor && state.has_activity && state.status !== 'finalized' ? (
        <details className={compact ? 'mb-2' : 'mb-3'}>
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wider text-white/45">
            Edit session workout plan
          </summary>
          <div className="mt-2">
            <TrainerLiveSessionWorkoutPlanEditor
              plan={sessionWorkoutPlan}
              onChange={setSessionWorkoutPlan}
              onImportedBlock={(kind, blockId) =>
                setPreferredBlockIds((prev) => ({ ...prev, [kind]: blockId }))
              }
              disabled={!!busy}
              compact
            />
          </div>
        </details>
      ) : null}
      <div
        className={`rounded-xl border border-white/10 bg-black/50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        data-region="trainer-live-activity-timer-panel"
        data-testid="trainer-live-activity-timer"
      >
        <div className={drawerLayout ? 'flex flex-col gap-3' : 'flex flex-wrap items-center gap-3'}>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Session activity
            </div>
            <div className="font-mono text-lg tabular-nums text-white">
              {formatElapsed(displayElapsedSec)}
            </div>
          </div>
          <div className={drawerLayout ? 'w-full min-w-0' : 'min-w-0 flex-1'}>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Current block</div>
            <div className="text-orange-200/90 truncate text-sm">
              {currentSegmentLabel(state.segments)}
            </div>
            {state.status === 'finalized' ? (
              <div className="text-xs text-white/50">Logged to training history</div>
            ) : null}
          </div>
        </div>

        {err ? (
          <p className="mt-2 text-xs text-amber-200" role="alert">
            {err}
          </p>
        ) : null}

        {isTrainer ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {!state.has_activity ? (
              <button
                type="button"
                disabled={!!busy}
                data-testid="trainer-live-activity-start"
                onClick={() =>
                  void run('start', async () =>
                    supabase.rpc('trainer_live_activity_start', {
                      p_trainer_live_session_id: sessionId,
                      p_planned_duration_sec: null,
                    })
                  )
                }
                className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 rounded-lg border px-2 py-1 text-xs text-orange-light disabled:opacity-40"
              >
                {busy === 'start' ? 'Starting…' : 'Start timer'}
              </button>
            ) : null}

            {state.has_activity && state.status === 'active' ? (
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  void run('pause', async () =>
                    supabase.rpc('trainer_live_activity_pause', {
                      p_trainer_live_session_id: sessionId,
                    })
                  )
                }
                className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
              >
                {busy === 'pause' ? 'Pausing…' : 'Pause'}
              </button>
            ) : null}

            {state.has_activity && state.status === 'paused' ? (
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  void run('resume', async () =>
                    supabase.rpc('trainer_live_activity_resume', {
                      p_trainer_live_session_id: sessionId,
                    })
                  )
                }
                className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
              >
                {busy === 'resume' ? 'Resuming…' : 'Resume'}
              </button>
            ) : null}

            {state.has_activity && state.status !== 'finalized' ? (
              <>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    const w = getPreferredOrFirstBlock(
                      sessionWorkoutPlan,
                      'warmup',
                      preferredBlockIds.warmup
                    );
                    const label =
                      w && w.kind === 'warmup' && w.exercises.length > 0
                        ? segmentLabelFromPlanExercises(w.label, w.exercises, 'Warm-up')
                        : 'Warm-up';
                    void run('warmup', async () =>
                      supabase.rpc('trainer_live_activity_begin_segment', {
                        p_trainer_live_session_id: sessionId,
                        p_segment_type: 'warmup',
                        p_label: label,
                      })
                    );
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                >
                  {busy === 'warmup' ? '…' : 'Warm-up'}
                </button>
                <button
                  type="button"
                  disabled={!!busy || !canIntervalSegments}
                  data-testid="trainer-live-activity-amrap-block"
                  title={
                    !canIntervalSegments
                      ? 'Switch room to Video + Intervals for AMRAP blocks'
                      : undefined
                  }
                  onClick={() => {
                    setAmrapPickerKey((k) => k + 1);
                    setAmrapPickerOpen(true);
                  }}
                  className="border-orange-light/30 text-orange-light/90 hover:bg-orange-light/10 rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
                >
                  {busy === 'amrap' ? '…' : 'AMRAP block'}
                </button>
                <button
                  type="button"
                  disabled={!!busy || !canIntervalSegments}
                  data-testid="trainer-live-activity-tabata-block"
                  title={
                    !canIntervalSegments
                      ? 'Switch room to Video + Intervals for Tabata blocks'
                      : undefined
                  }
                  onClick={() => {
                    setTabataPickerKey((k) => k + 1);
                    setTabataPickerOpen(true);
                  }}
                  className="border-orange-light/30 text-orange-light/90 hover:bg-orange-light/10 rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
                >
                  Tabata block
                </button>
                <button
                  type="button"
                  disabled={!!busy || !canIntervalSegments}
                  data-testid="trainer-live-activity-emom-block"
                  title={
                    !canIntervalSegments
                      ? 'Switch room to Video + Intervals for EMOM blocks'
                      : undefined
                  }
                  onClick={() => {
                    setEmomPickerKey((k) => k + 1);
                    setEmomPickerOpen(true);
                  }}
                  className="rounded-lg border border-teal-400/35 px-2 py-1 text-xs text-teal-200/90 hover:bg-teal-500/10 disabled:opacity-40"
                >
                  {busy === 'emom' ? '…' : 'EMOM block'}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    const c = getPreferredOrFirstBlock(
                      sessionWorkoutPlan,
                      'cooldown',
                      preferredBlockIds.cooldown
                    );
                    const label =
                      c && c.kind === 'cooldown' && c.exercises.length > 0
                        ? segmentLabelFromPlanExercises(c.label, c.exercises, 'Cooldown')
                        : 'Cooldown';
                    void run('cooldown', () =>
                      supabase.rpc('trainer_live_activity_begin_segment', {
                        p_trainer_live_session_id: sessionId,
                        p_segment_type: 'cooldown',
                        p_label: label,
                      })
                    );
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                >
                  {busy === 'cooldown' ? '…' : 'Cooldown'}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  data-testid="trainer-live-activity-finalize"
                  onClick={() =>
                    void run('finalize', async () =>
                      supabase.rpc('trainer_live_activity_finalize', {
                        p_trainer_live_session_id: sessionId,
                      })
                    )
                  }
                  className="rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-600/25"
                >
                  {busy === 'finalize' ? 'Saving…' : 'Log session & stop timer'}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {currentOpenSegment?.segment_type === 'warmup' && currentWarmupExercises.length > 0 ? (
        <div
          className={`mt-2 rounded-xl border border-white/10 bg-black/40 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
          data-region="trainer-live-warmup-exercises-panel"
          data-testid="trainer-live-warmup-exercises-panel"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Warm-up exercises
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWarmupTextSizeStep((prev) => Math.max(0, prev - 1))}
                className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/10"
                aria-label="Decrease warm-up text size"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setWarmupTextSizeStep((prev) => Math.min(3, prev + 1))}
                className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/10"
                aria-label="Increase warm-up text size"
              >
                A+
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {currentWarmupExercises.map((exercise, idx) => (
              <li key={`${exercise}-${idx}`} className={`${warmupTextClass} break-words text-white/80`}>
                {idx + 1}. {exercise}
              </li>
            ))}
          </ul>
          {isTrainer && state.status !== 'finalized' ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('log_warmup', () =>
                  supabase.rpc('trainer_live_activity_log_warmup', {
                    p_trainer_live_session_id: sessionId,
                    p_exercises: currentWarmupExercises,
                  })
                )
              }
              className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/25 disabled:opacity-40"
            >
              {busy === 'log_warmup' ? 'Logging…' : 'Log warmup'}
            </button>
          ) : null}
        </div>
      ) : null}
      <TrainerLiveAmrapWorkoutPickerModal
        open={amrapPickerOpen}
        pickerKey={amrapPickerKey}
        onOpenChange={setAmrapPickerOpen}
        disabled={!!busy}
        initialAmrapPrefill={sessionPlanHasAnyBlocks(sessionWorkoutPlan) ? amrapPrefill : null}
        onWorkoutChosen={async (workoutList, durationMinutes) => {
          if (!isValidAttachWorkoutInput(durationMinutes, workoutList)) {
            setLocalErr('Choose a duration between 1 and 180 minutes and at least one exercise.');
            return;
          }
          await run('amrap', async () => {
            const res = await supabase.rpc('trainer_live_activity_begin_amrap_segment', {
              p_trainer_live_session_id: sessionId,
              p_duration_minutes: durationMinutes,
              p_workout_list: workoutList,
              p_label: 'AMRAP',
            });
            if (!res.error && res.data && typeof res.data === 'object') {
              const d = res.data as Record<string, unknown>;
              const aid = d.amrap_session_id as string | undefined;
              const ht = d.host_token as string | undefined;
              const apid = d.amrap_participant_id as string | undefined;
              if (aid && ht) setStoredHostToken(aid, ht);
              if (aid && apid) setStoredParticipantId(aid, apid);
            }
            if (!res.error) setAmrapPickerOpen(false);
            return { error: res.error };
          });
        }}
      />
      <TrainerLiveEmomRoundModal
        open={emomPickerOpen}
        pickerKey={emomPickerKey}
        onOpenChange={setEmomPickerOpen}
        disabled={!!busy}
        initialEmomPrefill={sessionPlanHasAnyBlocks(sessionWorkoutPlan) ? emomPrefill : null}
        onConfirm={async (roundCount, workoutList) => {
          await run('emom', async () => {
            const res = await supabase.rpc('trainer_live_activity_begin_emom_segment', {
              p_trainer_live_session_id: sessionId,
              p_label: 'EMOM',
              p_round_count: roundCount,
              p_workout_list: workoutList,
            });
            if (!res.error) setEmomPickerOpen(false);
            return { error: res.error };
          });
        }}
      />
      <TrainerLiveTabataWorkoutPickerModal
        open={tabataPickerOpen}
        pickerKey={tabataPickerKey}
        onOpenChange={setTabataPickerOpen}
        disabled={!!busy}
        initialTabataPrefill={sessionPlanHasAnyBlocks(sessionWorkoutPlan) ? tabataPrefill : null}
        onWorkoutChosen={async (workoutList, roundCount) => {
          if (!isValidTabataAttachInput(roundCount, workoutList)) {
            setLocalErr('Choose 1–32 rounds and at least one exercise.');
            return;
          }
          await run('tabata', async () => {
            const res = await supabase.rpc('trainer_live_activity_begin_tabata_segment', {
              p_trainer_live_session_id: sessionId,
              p_label: 'Tabata',
              p_round_count: roundCount,
              p_workout_list: workoutList,
            });
            if (!res.error) setTabataPickerOpen(false);
            return { error: res.error };
          });
        }}
      />
    </>
  );
}
