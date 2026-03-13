/**
 * Guest (anonymous) AMRAP session results stored in localStorage.
 * Surfaces in "Recent sessions" on the With Friends page; persists across tab closes until user clears site data.
 */

const STORAGE_KEY = 'amrap_guest_session_results';
const MAX_ENTRIES = 20;

export interface GuestSessionResult {
  sessionId: string;
  participantId: string;
  totalRounds: number;
  workoutList: string[];
  durationMinutes: number;
  completedAt: string;
}

function getStored(): GuestSessionResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GuestSessionResult =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as GuestSessionResult).sessionId === 'string' &&
        typeof (item as GuestSessionResult).participantId === 'string' &&
        typeof (item as GuestSessionResult).totalRounds === 'number' &&
        Array.isArray((item as GuestSessionResult).workoutList) &&
        typeof (item as GuestSessionResult).durationMinutes === 'number' &&
        typeof (item as GuestSessionResult).completedAt === 'string'
    );
  } catch {
    return [];
  }
}

function setStored(results: GuestSessionResult[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, MAX_ENTRIES)));
  } catch {
    /* localStorage unavailable or full */
  }
}

/**
 * Save a guest session result (call when session finishes and user is not logged in).
 */
export function saveGuestSessionResult(
  sessionId: string,
  participantId: string,
  totalRounds: number,
  workoutList: string[],
  durationMinutes: number,
  completedAt: string
): void {
  const list = getStored();
  const existing = list.findIndex(
    (r) => r.sessionId === sessionId && r.participantId === participantId
  );
  const entry: GuestSessionResult = {
    sessionId,
    participantId,
    totalRounds,
    workoutList,
    durationMinutes,
    completedAt,
  };
  if (existing >= 0) {
    list[existing] = entry;
  } else {
    list.unshift(entry);
  }
  setStored(list);
}

/**
 * Get guest session results (newest first), max MAX_ENTRIES.
 */
export function getGuestSessionResults(): GuestSessionResult[] {
  return getStored();
}
