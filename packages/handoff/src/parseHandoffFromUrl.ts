import type { HandoffPayload } from './types';

/**
 * Parses handoff params from a URL.
 * @param url - Defaults to window.location.href when in browser
 * @returns HandoffPayload or null if intent/source missing
 */
export function parseHandoffFromUrl(url?: string): HandoffPayload | null {
  const href = url ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!href) return null;

  try {
    const parsed = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const intent = parsed.searchParams.get('intent');
    const source = parsed.searchParams.get('source') ?? parsed.searchParams.get('from');

    if (!intent || !source) return null;

    const time = parsed.searchParams.get('time') ?? undefined;
    const caloriesRaw = parsed.searchParams.get('calories');
    const roundsRaw = parsed.searchParams.get('rounds');
    const preset = parsed.searchParams.get('preset') ?? undefined;

    const calories = caloriesRaw ? parseInt(caloriesRaw, 10) : undefined;
    const rounds = roundsRaw ? parseInt(roundsRaw, 10) : undefined;
    const timestampRaw = parsed.searchParams.get('timestamp');
    const timestamp = timestampRaw ? parseInt(timestampRaw, 10) : Date.now();

    const result: HandoffPayload = {
      intent,
      source,
      from: source,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    };
    if (time) result.time = time;
    if (Number.isFinite(calories)) result.calories = calories!;
    if (Number.isFinite(rounds)) result.rounds = rounds!;
    if (preset) result.preset = preset;

    return result;
  } catch {
    return null;
  }
}
