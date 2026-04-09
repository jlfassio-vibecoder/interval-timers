/**
 * Shapes returned by `public.get_live_session_summary(p_session_id uuid)` (JSONB).
 * AMRAP metrics are scoped to the calling auth user’s `amrap_participants` row when present.
 */

export interface AmrapRoundSplit {
  round_index: number;
  split_sec: number;
}

export interface AmrapSummaryMetrics {
  viewer_amrap_participant_id: string | null;
  total_rounds: number;
  fastest_split_sec: number | null;
  /** Per-round durations (non-cumulative), ordered by round_index. */
  rounds: AmrapRoundSplit[];
}

export interface TabataSummaryMetrics {
  tabata_session_id: string;
  work_seconds: number;
  rest_seconds: number;
  round_count: number;
  /** Engine state (phase, version, etc.) */
  state: Record<string, unknown>;
  workout_list: unknown;
}

export interface LiveSessionSummarySegment {
  id: string;
  ordinal: number;
  segment_type: string;
  label: string;
  started_at: string;
  ended_at: string | null;
  amrap_session_id: string | null;
  tabata_session_id: string | null;
  amrap_metrics: AmrapSummaryMetrics | null;
  tabata_metrics: TabataSummaryMetrics | null;
}

export interface LiveSessionSummaryActivitySession {
  id: string;
  status: string;
}

export interface LiveSessionSummary {
  trainer_live_session_id: string;
  activity_session: LiveSessionSummaryActivitySession | null;
  segments: LiveSessionSummarySegment[];
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function parseRoundSplits(raw: unknown): AmrapRoundSplit[] {
  if (!Array.isArray(raw)) return [];
  const out: AmrapRoundSplit[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const ri = asNumber(r.round_index);
    const ss = asNumber(r.split_sec);
    if (ri == null || ss == null) continue;
    out.push({ round_index: Math.floor(ri), split_sec: Math.max(0, Math.floor(ss)) });
  }
  out.sort((a, b) => a.round_index - b.round_index);
  return out;
}

function parseAmrapMetrics(raw: unknown): AmrapSummaryMetrics | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const total = asNumber(o.total_rounds);
  return {
    viewer_amrap_participant_id: asString(o.viewer_amrap_participant_id),
    total_rounds: total != null ? Math.max(0, Math.floor(total)) : 0,
    fastest_split_sec:
      o.fastest_split_sec == null ? null : asNumber(o.fastest_split_sec),
    rounds: parseRoundSplits(o.rounds),
  };
}

function parseTabataMetrics(raw: unknown): TabataSummaryMetrics | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.tabata_session_id);
  if (!id) return null;
  const ws = asNumber(o.work_seconds);
  const rs = asNumber(o.rest_seconds);
  const rc = asNumber(o.round_count);
  const state = o.state;
  return {
    tabata_session_id: id,
    work_seconds: ws ?? 0,
    rest_seconds: rs ?? 0,
    round_count: rc != null ? Math.max(0, Math.floor(rc)) : 0,
    state: state != null && typeof state === 'object' && !Array.isArray(state) ? (state as Record<string, unknown>) : {},
    workout_list: o.workout_list ?? null,
  };
}

function parseSegment(raw: unknown): LiveSessionSummarySegment | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.id);
  const ord = asNumber(o.ordinal);
  const st = asString(o.segment_type);
  const label = typeof o.label === 'string' ? o.label : '';
  const started = asString(o.started_at);
  if (!id || ord == null || !st || !started) return null;
  return {
    id,
    ordinal: Math.floor(ord),
    segment_type: st,
    label,
    started_at: started,
    ended_at: o.ended_at == null ? null : asString(o.ended_at),
    amrap_session_id: o.amrap_session_id == null ? null : asString(o.amrap_session_id),
    tabata_session_id: o.tabata_session_id == null ? null : asString(o.tabata_session_id),
    amrap_metrics: parseAmrapMetrics(o.amrap_metrics),
    tabata_metrics: parseTabataMetrics(o.tabata_metrics),
  };
}

/** Best-effort parse of RPC JSONB; drops malformed segment entries. */
export function parseLiveSessionSummary(raw: unknown): LiveSessionSummary | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const sid = asString(o.trainer_live_session_id);
  if (!sid) return null;

  let activity: LiveSessionSummaryActivitySession | null = null;
  const act = o.activity_session;
  if (act != null && typeof act === 'object') {
    const a = act as Record<string, unknown>;
    const aid = asString(a.id);
    const st = asString(a.status);
    if (aid && st) activity = { id: aid, status: st };
  }

  const segRaw = o.segments;
  const segments: LiveSessionSummarySegment[] = [];
  if (Array.isArray(segRaw)) {
    for (const item of segRaw) {
      const seg = parseSegment(item);
      if (seg) segments.push(seg);
    }
    segments.sort((a, b) => a.ordinal - b.ordinal);
  }

  return {
    trainer_live_session_id: sid,
    activity_session: activity,
    segments,
  };
}
