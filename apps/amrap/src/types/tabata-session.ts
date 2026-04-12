/**
 * Tabata session engine types for Trainer Live embed (`useTabataEmbedded`, `TabataSessionShell`).
 * `TabataStateJson` is stored in `public.tabata_sessions.state` (merged via `tabata_session_apply_patch`).
 */

/** Phases stored in DB JSON and surfaced to the shell */
export type TabataPhase = 'idle' | 'setup' | 'work' | 'rest' | 'finished' | 'paused';

/**
 * Server-authoritative state for one Tabata block. Keys are merged by `tabata_session_apply_patch`;
 * `version` is bumped server-side on each patch.
 */
export interface TabataStateJson {
  phase: TabataPhase;
  version: number;
  /** 0-based index within the block (0 .. round_count - 1) */
  current_interval?: number;
  /** ISO timestamp when the current work/rest phase began (wall-clock sync for all clients) */
  phase_started_at?: string;
  /** When `phase === 'paused'`, which phase we froze */
  paused_from_phase?: 'work' | 'rest';
  /** Seconds left in that phase when paused */
  paused_remaining_sec?: number;
}

/** Row shape from `public.tabata_sessions` (subset used by the embed hook) */
export interface TabataSessionRow {
  id: string;
  trainer_live_session_id: string;
  work_seconds: number;
  rest_seconds: number;
  round_count: number;
  workout_list: unknown;
  state: TabataStateJson;
}

/**
 * Engine passed to `TabataSessionShell`. No Agora / video — Trainer Live owns the video plane.
 */
export interface TabataEngine {
  loading: boolean;
  error: string | null;

  /** Current protocol phase */
  phase: TabataPhase;
  /** Main countdown display (e.g. MM:SS) */
  displayValue: string;
  displayLabel: string;
  displayTitle: string;
  displaySub?: string;

  roundCount: number;
  /** 0-based current work interval index */
  currentIntervalIndex: number;
  /** When `phase === 'paused'`, which interval type was frozen (for UI tone). */
  pausedFromPhase: 'work' | 'rest' | null;
  workSeconds: number;
  restSeconds: number;
  workoutList: string[];

  isTrainer: boolean;

  onStart?: () => void;
  /** Skip the pre-work setup countdown (trainer only), same idea as AMRAP Skip during setup. */
  onSkipSetup?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onFinish?: () => void;

  /** Trainer Live embed: host can edit/reorder exercises (idle / setup / work / rest / paused). */
  hostCanEditWorkoutList: boolean;
  onSaveWorkoutList?: (
    workoutList: string[]
  ) => Promise<{ ok: boolean; error?: string }>;
}
