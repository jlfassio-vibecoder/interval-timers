export type TrainerLiveActivityStatus = 'active' | 'paused' | 'finalized';

export interface TrainerLiveActivitySegmentRow {
  id: string;
  ordinal: number;
  segment_type: string;
  label: string;
  started_at: string;
  ended_at: string | null;
  amrap_session_id: string | null;
  /** Present on every segment row from activity get_state RPC (null when not a Tabata segment). */
  tabata_session_id: string | null;
  /** Present on every segment row from activity get_state RPC (null when not an EMOM segment). */
  emom_session_id: string | null;
}

export interface TrainerLiveActivityState {
  has_activity: boolean;
  activity_session_id?: string;
  status?: TrainerLiveActivityStatus;
  accumulated_elapsed_sec?: number;
  current_elapsed_sec?: number;
  last_resume_at?: string | null;
  planned_duration_sec?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  segments?: TrainerLiveActivitySegmentRow[];
}

/**
 * Live elapsed for the UI clock without polling the RPC every second while `status === 'active'`.
 * Mirrors DB logic: `accumulated_elapsed_sec` + wall time since `last_resume_at` when running.
 */
export function computeTrainerLiveDisplayElapsedSec(
  state: TrainerLiveActivityState,
  nowMs: number = Date.now()
): number {
  if (!state.has_activity) return 0;
  if (state.status === 'active' && state.last_resume_at) {
    const acc = state.accumulated_elapsed_sec ?? 0;
    const resumeMs = new Date(state.last_resume_at).getTime();
    if (Number.isNaN(resumeMs)) return state.current_elapsed_sec ?? 0;
    const addSec = Math.max(0, (nowMs - resumeMs) / 1000);
    return Math.max(0, acc + addSec);
  }
  return state.current_elapsed_sec ?? state.accumulated_elapsed_sec ?? 0;
}

export function parseTrainerLiveActivityState(data: unknown): TrainerLiveActivityState {
  if (!data || typeof data !== 'object') {
    return { has_activity: false };
  }
  const o = data as Record<string, unknown>;
  if (o.has_activity !== true) {
    return { has_activity: false };
  }
  const segments: TrainerLiveActivitySegmentRow[] = Array.isArray(o.segments)
    ? (o.segments as Record<string, unknown>[]).map((seg) => {
        const base = seg as Record<string, unknown>;
        const tid = base.tabata_session_id;
        const eid = base.emom_session_id;
        return {
          ...(seg as unknown as TrainerLiveActivitySegmentRow),
          tabata_session_id: tid == null ? null : typeof tid === 'string' ? tid : null,
          emom_session_id: eid == null ? null : typeof eid === 'string' ? eid : null,
        };
      })
    : [];
  return {
    has_activity: true,
    activity_session_id:
      typeof o.activity_session_id === 'string' ? o.activity_session_id : undefined,
    status: o.status as TrainerLiveActivityStatus | undefined,
    accumulated_elapsed_sec:
      typeof o.accumulated_elapsed_sec === 'number' ? o.accumulated_elapsed_sec : undefined,
    current_elapsed_sec:
      typeof o.current_elapsed_sec === 'number' ? o.current_elapsed_sec : undefined,
    last_resume_at: (o.last_resume_at as string | null) ?? null,
    planned_duration_sec:
      typeof o.planned_duration_sec === 'number' ? o.planned_duration_sec : null,
    started_at: (o.started_at as string | null) ?? null,
    ended_at: (o.ended_at as string | null) ?? null,
    segments,
  };
}

/** Parse activity_session_id from workout_logs.handoff_dedupe_key `trainer_live:userId:activitySessionId`. */
export function parseTrainerLiveActivitySessionIdFromDedupeKey(
  key: string | undefined
): string | null {
  if (!key || !key.startsWith('trainer_live:')) return null;
  const parts = key.split(':');
  if (parts.length < 3) return null;
  return parts[2] ?? null;
}
