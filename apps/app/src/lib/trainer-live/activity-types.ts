export type TrainerLiveActivityStatus = 'active' | 'paused' | 'finalized';

export interface TrainerLiveActivitySegmentRow {
  id: string;
  ordinal: number;
  segment_type: string;
  label: string;
  started_at: string;
  ended_at: string | null;
  amrap_session_id: string | null;
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

export function parseTrainerLiveActivityState(data: unknown): TrainerLiveActivityState {
  if (!data || typeof data !== 'object') {
    return { has_activity: false };
  }
  const o = data as Record<string, unknown>;
  if (o.has_activity !== true) {
    return { has_activity: false };
  }
  const segments = Array.isArray(o.segments) ? (o.segments as TrainerLiveActivitySegmentRow[]) : [];
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
