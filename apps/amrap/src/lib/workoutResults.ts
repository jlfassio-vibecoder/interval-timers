/**
 * Build results text for AMRAP sessions: rounds, volume per exercise, and session URL.
 * Uses the same exercise parsing as AmrapExerciseList for consistency.
 */

const EXERCISE_REGEX = /^(\d+(?:-\d+)?|\d+m)\s+(.+)$/;

export interface VolumeLine {
  name: string;
  perRound: string;
  total: string;
}

/**
 * Parse an exercise string (e.g. "10 Burpees", "10-12 reps push-ups", "5m run").
 * Returns { perRound, name } or null if unparseable.
 */
function parseExercise(ex: string): { perRound: string; name: string } | null {
  const trimmed = ex?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(EXERCISE_REGEX);
  if (!match) return null;
  const perRound = match[1];
  const name = match[2].trim();
  return { perRound, name };
}

/**
 * Compute total volume for a single exercise.
 * - "10" × 5 rounds → "50"
 * - "10-12" × 5 rounds → "50-60"
 * - "5m" × 5 rounds → "25 min"
 */
function computeTotal(perRound: string, rounds: number): string {
  if (rounds <= 0) return '0';
  const timeMatch = perRound.match(/^(\d+)m$/);
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10) * rounds;
    return `${mins} min`;
  }
  const rangeMatch = perRound.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10) * rounds;
    const hi = parseInt(rangeMatch[2], 10) * rounds;
    return `${lo}-${hi}`;
  }
  const singleMatch = perRound.match(/^\d+$/);
  if (singleMatch) {
    const reps = parseInt(perRound, 10) * rounds;
    return String(reps);
  }
  return `${perRound} × ${rounds}`;
}

/**
 * Compute volume lines for each exercise in the workout.
 * Unparseable exercises get a line with "—" for perRound and total.
 */
export function computeVolumeLines(
  workoutList: string[],
  rounds: number
): VolumeLine[] {
  if (!workoutList?.length) return [];
  const lines: VolumeLine[] = [];
  for (const ex of workoutList) {
    const parsed = parseExercise(ex);
    if (!parsed) {
      const trimmed = ex?.trim();
      if (trimmed)
        lines.push({ name: trimmed, perRound: '—', total: '—' });
      continue;
    }
    const total = rounds <= 0 ? '0' : computeTotal(parsed.perRound, rounds);
    lines.push({
      name: parsed.name,
      perRound: parsed.perRound,
      total,
    });
  }
  return lines;
}

const MAX_TITLE_LENGTH = 30;

/**
 * Format a single volume line for display (e.g. "50 burpees" or "— exercise name").
 */
function formatVolumeLine(line: VolumeLine): string {
  if (line.total === '—') return `— ${line.name}`.trim();
  return `${line.total} ${line.name}`.trim();
}

export interface BuildResultsTextOptions {
  /** Workout title (e.g. from getWorkoutTitle). Omitted if "AMRAP" or empty. */
  workoutTitle?: string;
  /** When true, volume is a single comma-separated line; when false and volume lines > 6, still compact. */
  compact?: boolean;
  /** Cumulative elapsed seconds at each round (when round was completed). Shown as splits below summary. */
  splits?: number[];
}

/** Format seconds as M:SS (e.g. 154 → "2:34"). */
function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Build the full results text: summary + volume breakdown + URL.
 */
export function buildResultsText(
  workoutList: string[],
  rounds: number,
  durationMinutes: number,
  sessionUrl: string,
  options?: BuildResultsTextOptions
): string {
  let titleSegment = '';
  const rawTitle = options?.workoutTitle?.trim();
  if (rawTitle && rawTitle !== 'AMRAP') {
    titleSegment =
      rawTitle.length <= MAX_TITLE_LENGTH
        ? ` ${rawTitle}`
        : ` ${rawTitle.slice(0, MAX_TITLE_LENGTH - 3).trim()}…`;
  }
  const summary = `AMRAP${titleSegment} ${durationMinutes} min: ${rounds} round${rounds === 1 ? '' : 's'}`;
  const volumeLines = computeVolumeLines(workoutList, rounds);
  const useCompact = options?.compact === true;
  const parts: string[] = [summary];

  if (options?.splits && options.splits.length > 0) {
    const splitStr = options.splits
      .map((sec, i) => `R${i + 1} ${formatElapsed(sec)}`)
      .join(', ');
    parts.push(`Splits: ${splitStr}`);
  }

  if (volumeLines.length > 0) {
    if (useCompact) {
      const formatted = volumeLines.map(formatVolumeLine);
      const cap = 6;
      const volumeLine =
        formatted.length <= cap
          ? formatted.join(', ')
          : formatted.slice(0, cap).join(', ') + ', …';
      parts.push(`Volume: ${volumeLine}`);
    } else {
      const volumeBlock = volumeLines.map(formatVolumeLine).join('\n');
      parts.push(`Volume:\n${volumeBlock}`);
    }
  }
  parts.push(`View: ${sessionUrl}`);
  return parts.join('\n\n');
}

/** Single-line volume summary for roster cards (e.g. "50 burpees, 75 squats"). */
export function formatCompactVolumeSummary(workoutList: string[], rounds: number): string {
  const volumeLines = computeVolumeLines(workoutList, rounds);
  if (volumeLines.length === 0) return '';
  return volumeLines.map(formatVolumeLine).join(', ');
}

export type AmrapSessionResultsParticipantRow = {
  participantId: string;
  nickname: string;
  isHostParticipant: boolean;
  roundCount: number;
  volumeSummary: string;
};

const MAX_TRAINER_SHARE_CHARS = 3500;

/**
 * Clipboard-oriented class summary for the host. Adds per-athlete volume only if the full
 * string stays under ~MAX_TRAINER_SHARE_CHARS; otherwise roster is rounds-only + URL.
 */
export function buildTrainerClassResultsText(
  workoutList: string[],
  durationMinutes: number,
  sessionUrl: string,
  roster: {
    participantId: string;
    nickname: string;
    isHostParticipant: boolean;
    roundCount: number;
  }[],
  workoutTitle: string | undefined,
  opts?: { forCopy?: boolean }
): string {
  const rawTitle = workoutTitle?.trim();
  const head =
    rawTitle && rawTitle !== 'AMRAP'
      ? rawTitle.length <= MAX_TITLE_LENGTH
        ? rawTitle
        : `${rawTitle.slice(0, MAX_TITLE_LENGTH - 3).trim()}…`
      : 'AMRAP session';
  const sorted = [...roster].sort((a, b) => b.roundCount - a.roundCount);
  const bullets = sorted
    .map((r) => {
      const label = r.isHostParticipant ? `${r.nickname} (Host)` : r.nickname;
      return `• ${label}: ${r.roundCount} round${r.roundCount === 1 ? '' : 's'}`;
    })
    .join('\n');
  let text = `${head} — ${durationMinutes} min\n\nClass results:\n${bullets}`;

  const detailParts: string[] = [];
  for (const r of sorted) {
    if (r.roundCount <= 0) continue;
    const vol = formatCompactVolumeSummary(workoutList, r.roundCount);
    const label = r.isHostParticipant ? `${r.nickname} (Host)` : r.nickname;
    detailParts.push(`${label}\n${vol || 'Volume: —'}`);
  }
  const detailBlock = detailParts.length > 0 ? `\n\n${detailParts.join('\n\n')}` : '';
  const footer = `\n\nView: ${sessionUrl}`;
  const withDetail = `${text}${detailBlock}${footer}`;

  if (opts?.forCopy === true && withDetail.length > MAX_TRAINER_SHARE_CHARS) {
    return `${text}${footer}`;
  }
  return withDetail;
}
