/**
 * Build results text for AMRAP sessions (HUD): rounds, volume, splits, session URL.
 * Mirrors apps/amrap/src/lib/workoutResults.ts for consistent display.
 */

const EXERCISE_REGEX = /^(\d+(?:-\d+)?|\d+m)\s+(.+)$/;

interface VolumeLine {
  name: string;
  perRound: string;
  total: string;
}

function parseExercise(ex: string): { perRound: string; name: string } | null {
  const trimmed = ex?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(EXERCISE_REGEX);
  if (!match) return null;
  return { perRound: match[1], name: match[2].trim() };
}

function computeTotal(perRound: string, rounds: number): string {
  if (rounds <= 0) return '0';
  const timeMatch = perRound.match(/^(\d+)m$/);
  if (timeMatch) return `${parseInt(timeMatch[1], 10) * rounds} min`;
  const rangeMatch = perRound.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10) * rounds;
    const hi = parseInt(rangeMatch[2], 10) * rounds;
    return `${lo}-${hi}`;
  }
  const singleMatch = perRound.match(/^\d+$/);
  if (singleMatch) return String(parseInt(perRound, 10) * rounds);
  return `${perRound} × ${rounds}`;
}

function computeVolumeLines(workoutList: string[], rounds: number): VolumeLine[] {
  if (!workoutList?.length) return [];
  return workoutList.map((ex) => {
    const parsed = parseExercise(ex);
    if (!parsed) {
      const trimmed = ex?.trim();
      return { name: trimmed || '—', perRound: '—', total: '—' };
    }
    const total = rounds <= 0 ? '0' : computeTotal(parsed.perRound, rounds);
    return { name: parsed.name, perRound: parsed.perRound, total };
  });
}

const MAX_TITLE_LENGTH = 30;

function formatVolumeLine(line: VolumeLine): string {
  if (line.total === '—') return `— ${line.name}`.trim();
  return `${line.total} ${line.name}`.trim();
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface BuildAmrapResultsTextOptions {
  workoutTitle?: string;
  compact?: boolean;
  /** Cumulative elapsed seconds at each round (splits). If not provided, derived from roundDurations. */
  splits?: number[];
}

/**
 * Build results text for an AMRAP session from stored result.
 * sessionUrl should be the full URL to view the session (e.g. origin + /amrap/with-friends/session/{session_id}).
 */
export function buildAmrapResultsText(
  workoutList: string[],
  rounds: number,
  durationMinutes: number,
  sessionUrl: string,
  options?: BuildAmrapResultsTextOptions & { roundDurations?: number[] }
): string {
  const workoutTitle = options?.workoutTitle?.trim();
  let titleSegment = '';
  if (workoutTitle && workoutTitle !== 'AMRAP') {
    titleSegment =
      workoutTitle.length <= MAX_TITLE_LENGTH
        ? ` ${workoutTitle}`
        : ` ${workoutTitle.slice(0, MAX_TITLE_LENGTH - 3).trim()}…`;
  }
  const summary = `AMRAP${titleSegment} ${durationMinutes} min: ${rounds} round${rounds === 1 ? '' : 's'}`;
  const volumeLines = computeVolumeLines(workoutList, rounds);
  const useCompact = options?.compact === true;
  const parts: string[] = [summary];

  let splits = options?.splits;
  if (!splits && options?.roundDurations?.length) {
    let cum = 0;
    splits = options.roundDurations.map((d) => (cum += d));
  }
  if (splits && splits.length > 0) {
    const splitStr = splits.map((sec, i) => `R${i + 1} ${formatElapsed(sec)}`).join(', ');
    parts.push(`Splits: ${splitStr}`);
  }

  if (volumeLines.length > 0) {
    const formatted = volumeLines.map(formatVolumeLine);
    if (useCompact) {
      const cap = 6;
      parts.push(
        `Volume: ${formatted.length <= cap ? formatted.join(', ') : formatted.slice(0, cap).join(', ') + ', …'}`
      );
    } else {
      parts.push(`Volume:\n${formatted.join('\n')}`);
    }
  }
  parts.push(`View: ${sessionUrl}`);
  return parts.join('\n\n');
}
