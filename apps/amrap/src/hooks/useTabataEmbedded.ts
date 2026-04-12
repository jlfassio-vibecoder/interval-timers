/**
 * Trainer Live embed hook for Tabata: loads `tabata_sessions`, subscribes via Realtime,
 * derives countdown from `phase_started_at`, and applies patches via `tabata_session_apply_patch` (trainer only).
 * Does not use Agora.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import { supabase } from '@/lib/supabase';
import { playTabataRestStartSound, playTabataWorkStartSound } from '@/lib/tabataSounds';
import type {
  TabataEngine,
  TabataPhase,
  TabataSessionRow,
  TabataStateJson,
} from '@/types/tabata-session';

export type UseTabataEmbeddedOptions = {
  tabataSessionId: string;
  /** Must be `'trainer_live'` — single supported embed mode (no separate video channel). */
  embedVideo: 'trainer_live';
  /** When true, host controls (start / pause / resume / finish / auto-advance) call RPC. */
  isTrainer?: boolean;
};

function parseWorkoutList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (typeof x === 'string') return x;
    if (
      x &&
      typeof x === 'object' &&
      'name' in x &&
      typeof (x as { name: unknown }).name === 'string'
    ) {
      return (x as { name: string }).name;
    }
    return String(x);
  });
}

export function parseTabataState(raw: unknown): TabataStateJson {
  if (!raw || typeof raw !== 'object') {
    return { phase: 'idle', version: 1 };
  }
  const o = raw as Record<string, unknown>;
  const phase = o.phase;
  const valid: TabataPhase[] = ['idle', 'setup', 'work', 'rest', 'finished', 'paused'];
  return {
    phase: valid.includes(phase as TabataPhase) ? (phase as TabataPhase) : 'idle',
    version: typeof o.version === 'number' ? o.version : 1,
    current_interval: typeof o.current_interval === 'number' ? o.current_interval : undefined,
    phase_started_at: typeof o.phase_started_at === 'string' ? o.phase_started_at : undefined,
    paused_from_phase:
      o.paused_from_phase === 'work' || o.paused_from_phase === 'rest'
        ? o.paused_from_phase
        : undefined,
    paused_remaining_sec:
      typeof o.paused_remaining_sec === 'number' ? o.paused_remaining_sec : undefined,
  };
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

function formatSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${pad2(sec)}`;
}

function exerciseLabel(r: TabataSessionRow, intervalIndex: number): string {
  const list = parseWorkoutList(r.workout_list);
  if (!list.length) return 'Move';
  return list[intervalIndex % list.length] ?? list[0];
}

/** Remaining seconds in the current work/rest phase; for paused, uses `paused_remaining_sec`. */
export function computeTabataRemainingSec(
  row: TabataSessionRow,
  state: TabataStateJson,
  nowMs: number
): number | null {
  if (state.phase === 'idle' || state.phase === 'finished') return null;
  if (state.phase === 'paused') {
    return state.paused_remaining_sec ?? null;
  }
  if (!state.phase_started_at) return null;
  const started = Date.parse(state.phase_started_at);
  if (Number.isNaN(started)) return null;
  if (state.phase === 'setup') {
    const end = started + SETUP_DURATION_SECONDS * 1000;
    return Math.max(0, (end - nowMs) / 1000);
  }
  const dur =
    state.phase === 'work'
      ? row.work_seconds
      : state.phase === 'rest'
        ? row.rest_seconds
        : 0;
  const end = started + dur * 1000;
  return Math.max(0, (end - nowMs) / 1000);
}

export function useTabataEmbedded(options: UseTabataEmbeddedOptions): TabataEngine {
  const { tabataSessionId, embedVideo, isTrainer = false } = options;

  if (embedVideo !== 'trainer_live') {
    throw new Error(
      `useTabataEmbedded: unsupported embedVideo "${String(embedVideo)}", expected "trainer_live"`
    );
  }

  const [row, setRow] = useState<TabataSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const advancingRef = useRef(false);
  const tabataSoundHydratedRef = useRef(false);
  const prevPhaseForSoundRef = useRef<TabataPhase | null>(null);

  useEffect(() => {
    tabataSoundHydratedRef.current = false;
    prevPhaseForSoundRef.current = null;
  }, [tabataSessionId]);

  const loadRow = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('tabata_sessions')
      .select('id, trainer_live_session_id, work_seconds, rest_seconds, round_count, workout_list, state')
      .eq('id', tabataSessionId)
      .maybeSingle();

    if (e) {
      setError(e.message);
      setRow(null);
      return;
    }
    if (!data) {
      setError('Tabata session not found');
      setRow(null);
      return;
    }

    setError(null);
    setRow({
      ...(data as TabataSessionRow),
      state: parseTabataState(data.state),
    });
  }, [tabataSessionId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadRow();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRow]);

  useEffect(() => {
    const ch = supabase
      .channel(`tabata_sessions:${tabataSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tabata_sessions',
          filter: `id=eq.${tabataSessionId}`,
        },
        () => {
          void loadRow();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tabataSessionId, loadRow]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** Deep bell on work/rest interval starts (Realtime sync for trainer + clients). Skips initial hydrate and resume-from-pause. */
  // Copilot suggestion ignored: work/rest transition sounds are not unit-tested here because they require driving Realtime `row` updates; initial-hydrate no-sound is covered in useTabataEmbedded.test.ts.
  useEffect(() => {
    if (!row) {
      tabataSoundHydratedRef.current = false;
      prevPhaseForSoundRef.current = null;
      return;
    }
    const phase = parseTabataState(row.state).phase;
    if (!tabataSoundHydratedRef.current) {
      tabataSoundHydratedRef.current = true;
      prevPhaseForSoundRef.current = phase;
      return;
    }
    const prev = prevPhaseForSoundRef.current;
    if (phase !== prev) {
      const toWork =
        (prev === 'setup' || prev === 'rest' || prev === 'idle') && phase === 'work';
      const toRest = prev === 'work' && phase === 'rest';
      if (toWork) playTabataWorkStartSound();
      else if (toRest) playTabataRestStartSound();
    }
    prevPhaseForSoundRef.current = phase;
  }, [row]);

  const sessionState = row ? parseTabataState(row.state) : parseTabataState(null);

  const applyPatch = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!isTrainer) return;
      const { error: e } = await supabase.rpc('tabata_session_apply_patch', {
        p_tabata_session_id: tabataSessionId,
        p_patch: patch,
      });
      if (e) setError(e.message);
      else await loadRow();
    },
    [isTrainer, tabataSessionId, loadRow]
  );

  const advanceIfDue = useCallback(async () => {
    if (!row || !isTrainer || advancingRef.current) return;
    const st = parseTabataState(row.state);

    if (st.phase === 'setup') {
      const rem = computeTabataRemainingSec(row, st, Date.now());
      if (rem === null || rem > 0.25) return;
      advancingRef.current = true;
      try {
        await applyPatch({
          phase: 'work',
          current_interval: 0,
          phase_started_at: new Date().toISOString(),
        });
      } finally {
        advancingRef.current = false;
      }
      return;
    }

    if (st.phase !== 'work' && st.phase !== 'rest') return;
    const rem = computeTabataRemainingSec(row, st, Date.now());
    if (rem === null || rem > 0.25) return;

    advancingRef.current = true;
    try {
      const ci = st.current_interval ?? 0;
      const rc = row.round_count;
      if (st.phase === 'work') {
        await applyPatch({
          phase: 'rest',
          phase_started_at: new Date().toISOString(),
          current_interval: ci,
        });
      } else {
        if (ci < rc - 1) {
          await applyPatch({
            phase: 'work',
            current_interval: ci + 1,
            phase_started_at: new Date().toISOString(),
          });
        } else {
          await applyPatch({ phase: 'finished' });
        }
      }
    } finally {
      advancingRef.current = false;
    }
  }, [row, isTrainer, applyPatch]);

  useEffect(() => {
    if (!isTrainer || !row) return;
    const st = parseTabataState(row.state);
    if (st.phase !== 'work' && st.phase !== 'rest' && st.phase !== 'setup') return;
    const rem = computeTabataRemainingSec(row, st, Date.now());
    if (rem !== null && rem <= 0.25) {
      void advanceIfDue();
    }
  }, [tick, row, isTrainer, advanceIfDue]);

  const onStart = useCallback(() => {
    void applyPatch({
      phase: 'setup',
      current_interval: 0,
      phase_started_at: new Date().toISOString(),
    });
  }, [applyPatch]);

  const onSkipSetup = useCallback(() => {
    void applyPatch({
      phase: 'work',
      current_interval: 0,
      phase_started_at: new Date().toISOString(),
    });
  }, [applyPatch]);

  const onFinish = useCallback(() => {
    void applyPatch({ phase: 'finished' });
  }, [applyPatch]);

  const onPause = useCallback(() => {
    if (!row) return;
    const st = parseTabataState(row.state);
    if (st.phase === 'setup') return;
    if (st.phase !== 'work' && st.phase !== 'rest') return;
    const rem = computeTabataRemainingSec(row, st, Date.now());
    if (rem === null) return;
    void applyPatch({
      phase: 'paused',
      paused_from_phase: st.phase,
      paused_remaining_sec: Math.max(0, Math.ceil(rem)),
      current_interval: st.current_interval ?? 0,
    });
  }, [row, applyPatch]);

  const onResume = useCallback(() => {
    if (!row) return;
    const st = parseTabataState(row.state);
    if (st.phase !== 'paused' || !st.paused_from_phase || st.paused_remaining_sec == null) return;
    const dur = st.paused_from_phase === 'work' ? row.work_seconds : row.rest_seconds;
    const rem = Math.min(st.paused_remaining_sec, dur);
    const started = new Date(Date.now() - (dur - rem) * 1000).toISOString();
    void applyPatch({
      phase: st.paused_from_phase,
      phase_started_at: started,
      paused_from_phase: null,
      paused_remaining_sec: null,
    });
  }, [row, applyPatch]);

  const displayParts = useMemo(() => {
    if (!row) {
      return { label: '', title: 'Tabata', sub: '', value: '--:--' };
    }
    const st = parseTabataState(row.state);
    if (st.phase === 'idle') {
      return {
        label: 'READY',
        title: 'Tabata',
        sub: `${row.round_count} rounds · ${row.work_seconds}s:${row.rest_seconds}s`,
        value: formatSec(row.work_seconds),
      };
    }
    if (st.phase === 'setup') {
      const rem = computeTabataRemainingSec(row, st, Date.now()) ?? 0;
      return {
        label: 'SETUP',
        title: 'Get ready',
        sub: `Round 1 / ${row.round_count} · ${exerciseLabel(row, 0)}`,
        value: formatSec(rem),
      };
    }
    if (st.phase === 'finished') {
      return {
        label: 'DONE',
        title: 'Tabata complete',
        sub: `${row.round_count} rounds`,
        value: '0:00',
      };
    }
    if (st.phase === 'paused') {
      return {
        label: 'PAUSED',
        title: 'Tabata',
        sub: st.paused_from_phase === 'work' ? 'Work' : 'Rest',
        value: formatSec(st.paused_remaining_sec ?? 0),
      };
    }
    const rem = computeTabataRemainingSec(row, st, Date.now()) ?? 0;
    const idx = (st.current_interval ?? 0) + 1;
    if (st.phase === 'work') {
      return {
        label: 'WORK',
        title: `Round ${idx} / ${row.round_count}`,
        sub: exerciseLabel(row, st.current_interval ?? 0),
        value: formatSec(rem),
      };
    }
    if (st.phase === 'rest') {
      return {
        label: 'REST',
        title: `Round ${idx} / ${row.round_count}`,
        sub: 'Recover',
        value: formatSec(rem),
      };
    }
    return { label: '', title: 'Tabata', sub: '', value: '--:--' };
  }, [row, tick]);

  const phase = sessionState.phase;
  const hostCanEditWorkoutList: boolean =
    !!isTrainer &&
    !!row &&
    (phase === 'idle' ||
      phase === 'setup' ||
      phase === 'work' ||
      phase === 'rest' ||
      phase === 'paused');

  const saveWorkoutList = useCallback(
    async (workoutList: string[]) => {
      if (!isTrainer) return { ok: false as const, error: 'Not trainer' };
      const { error: e } = await supabase.rpc('tabata_session_set_workout_list', {
        p_tabata_session_id: tabataSessionId,
        p_workout_list: workoutList,
      });
      if (e) return { ok: false as const, error: e.message };
      await loadRow();
      return { ok: true as const };
    },
    [isTrainer, tabataSessionId, loadRow]
  );

  return {
    loading,
    error,
    phase,
    displayValue: displayParts.value,
    displayLabel: displayParts.label,
    displayTitle: displayParts.title,
    displaySub: displayParts.sub,
    roundCount: row?.round_count ?? 8,
    currentIntervalIndex: sessionState.current_interval ?? 0,
    pausedFromPhase: sessionState.paused_from_phase ?? null,
    workSeconds: row?.work_seconds ?? 20,
    restSeconds: row?.rest_seconds ?? 10,
    workoutList: row ? parseWorkoutList(row.workout_list) : [],
    isTrainer,
    onStart: isTrainer ? onStart : undefined,
    onSkipSetup: isTrainer ? onSkipSetup : undefined,
    onPause: isTrainer ? onPause : undefined,
    onResume: isTrainer ? onResume : undefined,
    onFinish: isTrainer ? onFinish : undefined,
    hostCanEditWorkoutList,
    onSaveWorkoutList: hostCanEditWorkoutList ? saveWorkoutList : undefined,
  };
}
